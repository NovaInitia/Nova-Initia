import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IPlayerRepository } from '../contracts/repositories.js';
import type { PlayerId } from '../domain/ids.js';
import type { Player, ClassProgress } from '../domain/player.js';
import type { PlayerClass } from '../domain/enums.js';
import { NameTaken } from '../domain/errors.js';
import { executor } from './PgUnitOfWork.js';

function isPgError(e: unknown): e is { code?: string; constraint?: string } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

function dbToPlayer(row: {
  id: string;
  name: string;
  credential_hash: string;
  email: string | null;
  active_class_id: number;
  karma: number;
  sg: number;
  is_moderator: boolean;
  is_operator: boolean;
  is_active: boolean;
  avatar_url: string | null;
  comment: string | null;
  registered_at: Date;
  last_active_at: Date | null;
  last_stipend_at: Date | null;
}): Player {
  return {
    id: row.id as PlayerId,
    name: row.name,
    credentialHash: row.credential_hash,
    email: row.email,
    activeClass: row.active_class_id as PlayerClass,
    karma: row.karma,
    sg: row.sg,
    isModerator: row.is_moderator,
    isOperator: row.is_operator,
    isActive: row.is_active,
    avatarUrl: row.avatar_url,
    comment: row.comment,
    registeredAt: row.registered_at,
    lastActiveAt: row.last_active_at,
    lastStipendAt: row.last_stipend_at
  };
}

export class PgPlayerRepository implements IPlayerRepository {
  constructor(private readonly pool: Pool) {}

  async get(id: PlayerId): Promise<Player | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at
       FROM player WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToPlayer(result.rows[0]);
  }

  async getByName(name: string): Promise<Player | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at
       FROM player WHERE name = $1`,
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToPlayer(result.rows[0]);
  }

  async save(player: Player, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    try {
      await exec.query(
        `INSERT INTO player (id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           name = $2,
           credential_hash = $3,
           email = $4,
           active_class_id = $5,
           karma = $6,
           sg = $7,
           is_moderator = $8,
           is_operator = $9,
           is_active = $10,
           avatar_url = $11,
           comment = $12,
           registered_at = $13,
           last_active_at = $14,
           last_stipend_at = $15`,
        [
          player.id,
          player.name,
          player.credentialHash,
          player.email,
          player.activeClass,
          player.karma,
          player.sg,
          player.isModerator,
          player.isOperator,
          player.isActive,
          player.avatarUrl,
          player.comment,
          player.registeredAt,
          player.lastActiveAt,
          player.lastStipendAt
        ]
      );
    } catch (error) {
      if (
        isPgError(error) &&
        error.code === '23505' &&
        error.constraint === 'player_name_key'
      ) {
        throw new NameTaken();
      }
      throw error;
    }
  }

  async listStipendDue(
    now: Date,
    activityWindowMs: number,
    intervalMs: number
  ): Promise<Player[]> {
    throw new Error('Not implemented');
  }
}
