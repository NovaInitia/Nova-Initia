import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IGenericPlacementRepository, PlacementFilter } from '../contracts/repositories.js';
import type { PageId, PlacementId, PlayerId } from '../domain/ids.js';
import type { PlaceableToolType, ConsumptionCause } from '../domain/enums.js';
import type {
  Placement,
  TrapPlacement,
  SpiderPlacement,
  BarrelPlacement,
  DoorwayPlacement,
  SignpostPlacement,
  IPlaced
} from '../domain/placement.js';
import { ToolType } from '../domain/enums.js';
import { PagePlacementCapReached } from '../domain/errors.js';
import { executor } from './PgUnitOfWork.js';

function isPgError(e: unknown): e is { code?: string; constraint?: string } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

function dbToPlacement(
  baseRow: {
    id: string;
    tool_type_id: number;
    placer_id: string;
    page_id: string;
    placed_at: Date;
    placer_class_id: number;
    placer_level: number;
    consumed_at: Date | null;
    consumption_cause_code: string | null;
  },
  subtypeRow:
    | {
        id: string;
        tool_type_id: number;
        is_anonymous: boolean;
      }
    | {
        id: string;
        tool_type_id: number;
        variant: string;
        last_moved_at: Date | null;
      }
    | {
        id: string;
        tool_type_id: number;
        sg_amount: number;
        inside_message: string | null;
        outside_message: string | null;
        durability: number;
        visit_count: number;
      }
    | {
        id: string;
        tool_type_id: number;
        destination_url: string;
        title: string | null;
        comment: string | null;
        is_nsfw: boolean;
        charges_remaining: number;
        chain_root_id: string | null;
        next_id: string | null;
      }
    | {
        id: string;
        tool_type_id: number;
        destination_url: string;
        title: string | null;
        comment: string | null;
        is_nsfw: boolean;
        tour_root_id: string | null;
        branch_a_id: string | null;
        branch_b_id: string | null;
        branch_c_id: string | null;
        branch_d_id: string | null;
      }
): Placement {
  const consumptionCause: ConsumptionCause | null = baseRow.consumption_cause_code as ConsumptionCause | null;

  const base = {
    id: baseRow.id as PlacementId,
    toolType: baseRow.tool_type_id as PlaceableToolType,
    placerId: baseRow.placer_id as PlayerId,
    pageId: baseRow.page_id as PageId,
    placedAt: baseRow.placed_at,
    placerClass: baseRow.placer_class_id,
    placerLevel: baseRow.placer_level,
    consumedAt: baseRow.consumed_at,
    consumptionCause
  };

  if (baseRow.tool_type_id === ToolType.Trap) {
    const row = subtypeRow as Record<string, unknown>;
    return {
      ...base,
      isAnonymous: row.is_anonymous
    } as TrapPlacement;
  } else if (baseRow.tool_type_id === ToolType.Spider) {
    const row = subtypeRow as Record<string, unknown>;
    return {
      ...base,
      variant: row.variant,
      lastMovedAt: row.last_moved_at
    } as SpiderPlacement;
  } else if (baseRow.tool_type_id === ToolType.Barrel) {
    const row = subtypeRow as Record<string, unknown>;
    return {
      ...base,
      sgAmount: row.sg_amount,
      insideMessage: row.inside_message,
      outsideMessage: row.outside_message,
      durability: row.durability,
      visitCount: row.visit_count,
      contents: new Map(),
      useLimitFor: () => 0
    } as unknown as BarrelPlacement;
  } else if (baseRow.tool_type_id === ToolType.Doorway) {
    const row = subtypeRow as Record<string, unknown>;
    return {
      ...base,
      destinationUrl: row.destination_url,
      title: row.title,
      comment: row.comment,
      isNsfw: row.is_nsfw,
      chargesRemaining: row.charges_remaining,
      chainRootId: row.chain_root_id as PlacementId | null,
      nextId: row.next_id as PlacementId | null,
      useLimitFor: () => 0
    } as unknown as DoorwayPlacement;
  } else {
    // Signpost
    const row = subtypeRow as Record<string, unknown>;
    return {
      ...base,
      destinationUrl: row.destination_url,
      title: row.title,
      comment: row.comment,
      isNsfw: row.is_nsfw,
      tourRootId: row.tour_root_id as PlacementId | null,
      branchAId: row.branch_a_id as PlacementId | null,
      branchBId: row.branch_b_id as PlacementId | null,
      branchCId: row.branch_c_id as PlacementId | null,
      branchDId: row.branch_d_id as PlacementId | null,
      useLimitFor: () => 0
    } as unknown as SignpostPlacement;
  }
}

export class PgPlacementRepository implements IGenericPlacementRepository {
  constructor(private readonly pool: Pool) {}

  async get(id: PlacementId): Promise<Placement | null> {
    const exec = executor(this.pool);

    const baseResult = await exec.query(
      `SELECT p.id, p.tool_type_id, p.placer_id, p.page_id, p.placed_at, p.placer_class_id, p.placer_level, p.consumed_at, cc.code as consumption_cause_code
       FROM placement p
       LEFT JOIN consumption_cause cc ON p.consumption_cause_id = cc.id
       WHERE p.id = $1`,
      [id]
    );

    if (baseResult.rows.length === 0) {
      return null;
    }

    const baseRow = baseResult.rows[0];
    const toolTypeId = baseRow.tool_type_id as number;

    let subtypeResult;
    if (toolTypeId === ToolType.Trap) {
      subtypeResult = await exec.query(
        `SELECT id, tool_type_id, is_anonymous FROM trap_placement WHERE id = $1`,
        [id]
      );
    } else if (toolTypeId === ToolType.Spider) {
      subtypeResult = await exec.query(
        `SELECT id, tool_type_id, variant, last_moved_at FROM spider_placement WHERE id = $1`,
        [id]
      );
    } else if (toolTypeId === ToolType.Barrel) {
      subtypeResult = await exec.query(
        `SELECT id, tool_type_id, sg_amount, inside_message, outside_message, durability, visit_count FROM barrel_placement WHERE id = $1`,
        [id]
      );
    } else if (toolTypeId === ToolType.Doorway) {
      subtypeResult = await exec.query(
        `SELECT id, tool_type_id, destination_url, title, comment, is_nsfw, charges_remaining, chain_root_id, next_id FROM doorway_placement WHERE id = $1`,
        [id]
      );
    } else {
      // Signpost
      subtypeResult = await exec.query(
        `SELECT id, tool_type_id, destination_url, title, comment, is_nsfw, tour_root_id, branch_a_id, branch_b_id, branch_c_id, branch_d_id FROM signpost_placement WHERE id = $1`,
        [id]
      );
    }

    if (subtypeResult.rows.length === 0) {
      return null;
    }

    return dbToPlacement(baseRow, subtypeResult.rows[0]);
  }

  async save(placement: Placement, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    try {
      await exec.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placed_at, placer_class_id, placer_level, consumed_at, consumption_cause_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT id FROM consumption_cause WHERE code = $9))
         ON CONFLICT (id) DO UPDATE SET
           tool_type_id = $2,
           placer_id = $3,
           page_id = $4,
           placed_at = $5,
           placer_class_id = $6,
           placer_level = $7,
           consumed_at = $8,
           consumption_cause_id = (SELECT id FROM consumption_cause WHERE code = $9)`,
        [
          placement.id,
          placement.toolType,
          placement.placerId,
          placement.pageId,
          placement.placedAt,
          placement.placerClass,
          placement.placerLevel,
          placement.consumedAt,
          placement.consumptionCause
        ]
      );

      // Save subtype row
      if (placement.toolType === ToolType.Trap) {
        const trap = placement as TrapPlacement;
        await exec.query(
          `INSERT INTO trap_placement (id, tool_type_id, is_anonymous)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET is_anonymous = $3`,
          [placement.id, ToolType.Trap, trap.isAnonymous]
        );
      } else if (placement.toolType === ToolType.Spider) {
        const spider = placement as SpiderPlacement;
        await exec.query(
          `INSERT INTO spider_placement (id, tool_type_id, variant, last_moved_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET variant = $3, last_moved_at = $4`,
          [placement.id, ToolType.Spider, spider.variant, spider.lastMovedAt]
        );
      } else if (placement.toolType === ToolType.Barrel) {
        const barrel = placement as BarrelPlacement;
        await exec.query(
          `INSERT INTO barrel_placement (id, tool_type_id, sg_amount, inside_message, outside_message, durability, visit_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET sg_amount = $3, inside_message = $4, outside_message = $5, durability = $6, visit_count = $7`,
          [
            placement.id,
            ToolType.Barrel,
            barrel.sgAmount,
            barrel.insideMessage,
            barrel.outsideMessage,
            barrel.durability,
            barrel.visitCount
          ]
        );
      } else if (placement.toolType === ToolType.Doorway) {
        const doorway = placement as DoorwayPlacement;
        await exec.query(
          `INSERT INTO doorway_placement (id, tool_type_id, destination_url, title, comment, is_nsfw, charges_remaining, chain_root_id, next_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET destination_url = $3, title = $4, comment = $5, is_nsfw = $6, charges_remaining = $7, chain_root_id = $8, next_id = $9`,
          [
            placement.id,
            ToolType.Doorway,
            doorway.destinationUrl,
            doorway.title,
            doorway.comment,
            doorway.isNsfw,
            doorway.chargesRemaining,
            doorway.chainRootId,
            doorway.nextId
          ]
        );
      } else {
        // Signpost
        const signpost = placement as SignpostPlacement;
        await exec.query(
          `INSERT INTO signpost_placement (id, tool_type_id, destination_url, title, comment, is_nsfw, tour_root_id, branch_a_id, branch_b_id, branch_c_id, branch_d_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET destination_url = $3, title = $4, comment = $5, is_nsfw = $6, tour_root_id = $7, branch_a_id = $8, branch_b_id = $9, branch_c_id = $10, branch_d_id = $11`,
          [
            placement.id,
            ToolType.Signpost,
            signpost.destinationUrl,
            signpost.title,
            signpost.comment,
            signpost.isNsfw,
            signpost.tourRootId,
            signpost.branchAId,
            signpost.branchBId,
            signpost.branchCId,
            signpost.branchDId
          ]
        );
      }
    } catch (error) {
      if (isPgError(error) && error.code === '23514') {
        throw new PagePlacementCapReached(placement.toolType, placement.pageId);
      }
      throw error;
    }
  }

  async list(pageId: PageId, filter: PlacementFilter): Promise<Placement[]> {
    const exec = executor(this.pool);

    const conditions: string[] = ['p.page_id = $1'];
    const params: Array<PageId | PlaceableToolType[] | PlayerId | number> = [pageId];
    let paramIndex = 2;

    if (filter.liveOnly) {
      conditions.push('p.consumed_at IS NULL');
    }

    if (filter.toolTypes && filter.toolTypes.length > 0) {
      conditions.push(`p.tool_type_id = ANY($${paramIndex})`);
      params.push([...filter.toolTypes]);
      paramIndex++;
    }

    if (filter.excludeNsfw) {
      conditions.push(`(p.tool_type_id NOT IN (${ToolType.Doorway}, ${ToolType.Signpost}) OR (
        (p.tool_type_id = ${ToolType.Doorway} AND (SELECT is_nsfw FROM doorway_placement WHERE id = p.id) = false) OR
        (p.tool_type_id = ${ToolType.Signpost} AND (SELECT is_nsfw FROM signpost_placement WHERE id = p.id) = false)
      ))`);
    }

    if (filter.excludeDismissedFor) {
      conditions.push(`p.id NOT IN (
        SELECT placement_id FROM placement_interaction
        WHERE player_id = $${paramIndex} AND is_dismissed = true
      )`);
      params.push(filter.excludeDismissedFor);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const baseResult = await exec.query(
      `SELECT p.id, p.tool_type_id, p.placer_id, p.page_id, p.placed_at, p.placer_class_id, p.placer_level, p.consumed_at, cc.code as consumption_cause_code
       FROM placement p
       LEFT JOIN consumption_cause cc ON p.consumption_cause_id = cc.id
       WHERE ${whereClause}
       ORDER BY p.placed_at ASC`,
      params
    );

    const placements: Placement[] = [];

    for (const baseRow of baseResult.rows) {
      const toolTypeId = baseRow.tool_type_id as number;

      let subtypeResult;
      if (toolTypeId === ToolType.Trap) {
        subtypeResult = await exec.query(
          `SELECT id, tool_type_id, is_anonymous FROM trap_placement WHERE id = $1`,
          [baseRow.id]
        );
      } else if (toolTypeId === ToolType.Spider) {
        subtypeResult = await exec.query(
          `SELECT id, tool_type_id, variant, last_moved_at FROM spider_placement WHERE id = $1`,
          [baseRow.id]
        );
      } else if (toolTypeId === ToolType.Barrel) {
        subtypeResult = await exec.query(
          `SELECT id, tool_type_id, sg_amount, inside_message, outside_message, durability, visit_count FROM barrel_placement WHERE id = $1`,
          [baseRow.id]
        );
      } else if (toolTypeId === ToolType.Doorway) {
        subtypeResult = await exec.query(
          `SELECT id, tool_type_id, destination_url, title, comment, is_nsfw, charges_remaining, chain_root_id, next_id FROM doorway_placement WHERE id = $1`,
          [baseRow.id]
        );
      } else {
        // Signpost
        subtypeResult = await exec.query(
          `SELECT id, tool_type_id, destination_url, title, comment, is_nsfw, tour_root_id, branch_a_id, branch_b_id, branch_c_id, branch_d_id FROM signpost_placement WHERE id = $1`,
          [baseRow.id]
        );
      }

      if (subtypeResult.rows.length > 0) {
        placements.push(dbToPlacement(baseRow, subtypeResult.rows[0]));
      }
    }

    return placements;
  }

  async countOnPageBy(pageId: PageId, playerId: PlayerId, tool: PlaceableToolType): Promise<number> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT COUNT(*)::int AS count FROM placement
       WHERE page_id = $1 AND placer_id = $2 AND tool_type_id = $3 AND consumed_at IS NULL`,
      [pageId, playerId, tool]
    );

    return result.rows[0].count as number;
  }

  async markConsumed(id: PlacementId, cause: string, at: Date, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `UPDATE placement SET consumed_at = $1, consumption_cause_id = (SELECT id FROM consumption_cause WHERE code = $2)
       WHERE id = $3`,
      [at, cause, id]
    );
  }
}
