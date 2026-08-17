import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IBarrelContentRepository } from '../contracts/repositories.js';
import type { PlacementId } from '../domain/ids.js';
import type { ToolType } from '../domain/enums.js';
import { executor } from './PgUnitOfWork.js';

export class PgBarrelContentRepository implements IBarrelContentRepository {
  constructor(private readonly pool: Pool) {}

  async get(barrelId: PlacementId): Promise<ReadonlyMap<ToolType, number>> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT tool_type_id, quantity FROM barrel_content WHERE barrel_id = $1`,
      [barrelId]
    );

    const contents = new Map<ToolType, number>();
    for (const row of result.rows) {
      contents.set(row.tool_type_id as ToolType, row.quantity as number);
    }

    return contents;
  }

  async save(barrelId: PlacementId, contents: ReadonlyMap<ToolType, number>, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    for (const [toolType, quantity] of contents.entries()) {
      await exec.query(
        `INSERT INTO barrel_content (barrel_id, tool_type_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (barrel_id, tool_type_id) DO UPDATE SET quantity = $3`,
        [barrelId, toolType, quantity]
      );
    }
  }

  async clear(barrelId: PlacementId, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(`DELETE FROM barrel_content WHERE barrel_id = $1`, [barrelId]);
  }
}
