import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { ISessionRepository } from '../contracts/repositories.js';
import type { Session } from '../domain/player.js';
import type { PlayerId, SessionId } from '../domain/ids.js';
import { executor } from './PgUnitOfWork.js';

export class PgSessionRepository implements ISessionRepository {
  constructor(private readonly pool: Pool) {}

  async get(id: string): Promise<Session | null> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT id, player_id, token_hash, issued_at, expires_at, revoked_at FROM session WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as SessionId,
      playerId: row.player_id as PlayerId,
      tokenHash: row.token_hash as string,
      issuedAt: row.issued_at as Date,
      expiresAt: row.expires_at as Date,
      revokedAt: row.revoked_at as Date | null
    };
  }

  async getByTokenHash(tokenHash: string): Promise<Session | null> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT id, player_id, token_hash, issued_at, expires_at, revoked_at FROM session WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id as SessionId,
      playerId: row.player_id as PlayerId,
      tokenHash: row.token_hash as string,
      issuedAt: row.issued_at as Date,
      expiresAt: row.expires_at as Date,
      revokedAt: row.revoked_at as Date | null
    };
  }

  async save(session: Session, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO session (id, player_id, token_hash, issued_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         player_id = $2,
         token_hash = $3,
         issued_at = $4,
         expires_at = $5,
         revoked_at = $6`,
      [
        session.id,
        session.playerId,
        session.tokenHash,
        session.issuedAt,
        session.expiresAt,
        session.revokedAt
      ]
    );
  }

  async revoke(id: string, at: Date, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `UPDATE session SET revoked_at = $1 WHERE id = $2`,
      [at, id]
    );
  }
}
