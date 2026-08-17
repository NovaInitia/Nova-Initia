import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IPresenceRepository } from '../contracts/repositories.js';
import type { PageId, PlayerId } from '../domain/ids.js';
import type { Presence } from '../domain/geography.js';
import { executor } from './PgUnitOfWork.js';

function dbToPresence(row: {
  player_id: string;
  page_id: string;
  arrived_at: Date;
  last_seen_at: Date;
}): Presence {
  return {
    playerId: row.player_id as PlayerId,
    pageId: row.page_id as PageId,
    arrivedAt: row.arrived_at,
    lastSeenAt: row.last_seen_at
  };
}

export class PgPresenceRepository implements IPresenceRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: PlayerId): Promise<Presence | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT player_id, page_id, arrived_at, last_seen_at FROM presence WHERE player_id = $1`,
      [playerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToPresence(result.rows[0]);
  }

  async listOnPage(pageId: PageId): Promise<Presence[]> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT player_id, page_id, arrived_at, last_seen_at FROM presence
       WHERE page_id = $1
       ORDER BY arrived_at ASC`,
      [pageId]
    );

    return result.rows.map(dbToPresence);
  }

  async save(presence: Presence, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO presence (player_id, page_id, arrived_at, last_seen_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id) DO UPDATE SET
         page_id = $2,
         arrived_at = CASE WHEN presence.page_id != EXCLUDED.page_id THEN $3 ELSE presence.arrived_at END,
         last_seen_at = $4`,
      [
        presence.playerId,
        presence.pageId,
        presence.arrivedAt,
        presence.lastSeenAt
      ]
    );
  }

  async remove(playerId: PlayerId, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `DELETE FROM presence WHERE player_id = $1`,
      [playerId]
    );
  }

  async removeStale(olderThan: Date, _tx: Transaction): Promise<number> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `DELETE FROM presence WHERE last_seen_at < $1`,
      [olderThan]
    );

    return result.rowCount ?? 0;
  }
}
