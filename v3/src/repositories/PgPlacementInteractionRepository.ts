import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IPlacementInteractionRepository } from '../contracts/repositories.js';
import type { PlacementId, PlayerId } from '../domain/ids.js';
import type { PlacementInteraction } from '../domain/placement.js';
import { executor } from './PgUnitOfWork.js';

function dbToInteraction(row: {
  player_id: string;
  placement_id: string;
  use_count: number;
  is_dismissed: boolean;
  rating: number | null;
  rated_at: Date | null;
  first_seen_at: Date;
  last_used_at: Date | null;
}): PlacementInteraction {
  return {
    playerId: row.player_id as PlayerId,
    placementId: row.placement_id as PlacementId,
    useCount: row.use_count,
    isDismissed: row.is_dismissed,
    rating: row.rating,
    ratedAt: row.rated_at,
    firstSeenAt: row.first_seen_at,
    lastUsedAt: row.last_used_at
  };
}

export class PgPlacementInteractionRepository implements IPlacementInteractionRepository {
  constructor(private readonly pool: Pool) {}

  async get(playerId: PlayerId, placementId: PlacementId): Promise<PlacementInteraction | null> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT player_id, placement_id, use_count, is_dismissed, rating, rated_at, first_seen_at, last_used_at
       FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
      [playerId, placementId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToInteraction(result.rows[0]);
  }

  async save(interaction: PlacementInteraction, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO placement_interaction (player_id, placement_id, use_count, is_dismissed, rating, rated_at, first_seen_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (player_id, placement_id) DO UPDATE SET
         use_count = $3,
         is_dismissed = $4,
         rating = $5,
         rated_at = $6,
         first_seen_at = $7,
         last_used_at = $8`,
      [
        interaction.playerId,
        interaction.placementId,
        interaction.useCount,
        interaction.isDismissed,
        interaction.rating,
        interaction.ratedAt,
        interaction.firstSeenAt,
        interaction.lastUsedAt
      ]
    );
  }
}
