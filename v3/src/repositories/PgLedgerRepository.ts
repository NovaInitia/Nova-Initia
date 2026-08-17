import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { ILedgerRepository } from '../contracts/repositories.js';
import type { PlayerId, PlacementId, JobRunId } from '../domain/ids.js';
import type { PlayerClass, LedgerCause, ResourceKind } from '../domain/enums.js';
import type { LedgerEntry } from '../domain/progression.js';
import { executor } from './PgUnitOfWork.js';

function dbToLedgerEntry(row: {
  player_id: string;
  resource_kind: string;
  class_id: number | null;
  applied_delta: number;
  balance_after: number;
  cause_id: number;
  cause_code: string;
  placement_id: string | null;
  counterparty_id: string | null;
  job_run_id: number | null;
  occurred_at: Date;
}): LedgerEntry {
  return {
    playerId: row.player_id as PlayerId,
    resourceKind: row.resource_kind as ResourceKind,
    playerClass: row.class_id as PlayerClass | null,
    appliedDelta: row.applied_delta,
    balanceAfter: row.balance_after,
    cause: row.cause_code as LedgerCause,
    placementId: row.placement_id as PlacementId | null,
    counterpartyId: row.counterparty_id as PlayerId | null,
    jobRunId: row.job_run_id as JobRunId | null,
    occurredAt: row.occurred_at
  };
}

export class PgLedgerRepository implements ILedgerRepository {
  constructor(private readonly pool: Pool) {}

  async append(entry: LedgerEntry, tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO resource_ledger (player_id, resource_kind, class_id, applied_delta, balance_after, cause_id, placement_id, counterparty_id, job_run_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM ledger_cause WHERE code = $6), $7, $8, $9, $10)`,
      [
        entry.playerId,
        entry.resourceKind,
        entry.playerClass,
        entry.appliedDelta,
        entry.balanceAfter,
        entry.cause,
        entry.placementId,
        entry.counterpartyId,
        entry.jobRunId,
        entry.occurredAt
      ]
    );
  }

  async listForPlayer(playerId: PlayerId, limit: number): Promise<LedgerEntry[]> {
    const exec = executor(this.pool);

    const clampedLimit = Math.max(limit, 0);

    const result = await exec.query(
      `SELECT
         rl.player_id,
         rl.resource_kind,
         rl.class_id,
         rl.applied_delta,
         rl.balance_after,
         rl.cause_id,
         lc.code AS cause_code,
         rl.placement_id,
         rl.counterparty_id,
         rl.job_run_id,
         rl.occurred_at
       FROM resource_ledger rl
       JOIN ledger_cause lc ON rl.cause_id = lc.id
       WHERE rl.player_id = $1
       ORDER BY rl.occurred_at DESC, rl.id DESC
       LIMIT $2`,
      [playerId, clampedLimit]
    );

    return result.rows.map(dbToLedgerEntry);
  }
}
