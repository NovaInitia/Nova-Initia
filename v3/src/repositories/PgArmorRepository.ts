import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IArmorRepository } from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { Armor } from '../domain/player.js';
import { executor } from './PgUnitOfWork.js';

export class PgArmorRepository implements IArmorRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: PlayerId): Promise<Armor | null> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT player_id, is_active, charges_remaining FROM player_armor WHERE player_id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      playerId: row.player_id as PlayerId,
      isActive: row.is_active as boolean,
      chargesRemaining: row.charges_remaining as number
    };
  }

  async save(armor: Armor, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO player_armor (player_id, is_active, charges_remaining)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id) DO UPDATE SET
         is_active = $2,
         charges_remaining = $3`,
      [armor.playerId, armor.isActive, armor.chargesRemaining]
    );
  }
}
