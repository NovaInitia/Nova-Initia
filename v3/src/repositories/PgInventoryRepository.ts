import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IInventoryRepository } from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { Inventory } from '../domain/player.js';
import type { ToolType } from '../domain/enums.js';
import { NegativeInventory, InventoryCapExceeded } from '../domain/errors.js';
import { executor } from './PgUnitOfWork.js';

function isPgError(e: unknown): e is { code?: string; constraint?: string } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

export class PgInventoryRepository implements IInventoryRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: PlayerId): Promise<Inventory> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT tool_type_id, quantity FROM player_inventory WHERE player_id = $1`,
      [playerId]
    );

    const counts = new Map<ToolType, number>();
    for (const row of result.rows) {
      counts.set(row.tool_type_id as ToolType, row.quantity as number);
    }

    return { playerId, counts };
  }

  async adjust(
    playerId: PlayerId,
    tool: ToolType,
    delta: number,
    _tx: Transaction
  ): Promise<void> {
    const exec = executor(this.pool);

    try {
      await exec.query(
        `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, tool_type_id)
         DO UPDATE SET quantity = player_inventory.quantity + EXCLUDED.quantity`,
        [playerId, tool, delta]
      );
    } catch (error) {
      if (isPgError(error) && error.code === '23514') {
        if (error.constraint) {
          throw new NegativeInventory(tool);
        } else {
          throw new InventoryCapExceeded(tool);
        }
      }
      throw error;
    }
  }
}
