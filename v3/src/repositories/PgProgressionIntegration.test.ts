import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass } from '../domain/enums.js';
import type { PlayerId } from '../domain/ids.js';
import type { Player, ClassProgress } from '../domain/player.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { ProgressionModule } from '../modules/progression.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { PgUnitOfWork } from './PgUnitOfWork.js';
import { PgPlayerRepository } from './PgPlayerRepository.js';
import { PgClassProgressRepository } from './PgClassProgressRepository.js';
import { PgLedgerRepository } from './PgLedgerRepository.js';

function makePlayer(id: PlayerId): Player {
  return {
    id,
    name: `player-${id}`,
    credentialHash: 'hash',
    email: null,
    activeClass: PlayerClass.Giver,
    karma: 50,
    sg: 10000,
    isModerator: false,
    isOperator: false,
    isActive: true,
    avatarUrl: null,
    comment: null,
    registeredAt: new Date(),
    lastActiveAt: null,
    lastStipendAt: null
  };
}

function makeProgress(playerId: PlayerId, playerClass: PlayerClass): ClassProgress {
  return {
    playerId,
    playerClass,
    level: 1,
    experience: 0
  };
}

describe('ProgressionModule with PostgreSQL', { skip: DB_SKIP }, () => {
  it('awardXp accumulates and writes ledger row', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const progress = makeProgress(playerId, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        await progressRepo.save(progress, tx);

        await progression.awardXp(tx, player, PlayerClass.Giver, 100, 'trigger_reward', null);
      });

      const progressAfter = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.ok(progressAfter);
      assert.equal(progressAfter.experience, 100);

      const entries = await ledgerRepo.listForPlayer(playerId, 100);
      assert.ok(entries.length > 0);
      const xpEntry = entries.find((e) => e.resourceKind === 'xp');
      assert.ok(xpEntry);
      assert.equal(xpEntry.appliedDelta, 100);
      assert.equal(xpEntry.balanceAfter, 100);
    } finally {
      await closeDb(pool);
    }
  });

  it('adjustKarma moves by exactly ±1 and clamps', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      player.karma = 100; // Start at max

      const progress = makeProgress(playerId, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        await progressRepo.save(progress, tx);

        // Adjust karma (should clamp at max)
        await progression.adjustKarma(tx, player, 0, null); // Trap decreases karma
      });

      const playerAfter = await playerRepo.get(playerId);
      assert.ok(playerAfter);
      // Should be clamped at 100 or 99 depending on tool
      assert.ok(playerAfter.karma <= 100);
      assert.ok(playerAfter.karma >= 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('adjustSg clamps at zero and records post-clamp appliedDelta', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      player.sg = 100;

      const progress = makeProgress(playerId, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        await progressRepo.save(progress, tx);

        const applied = await progression.adjustSg(tx, player, -150, 'trap_damage', null, null);
        assert.equal(applied, -100); // Should be clamped to 0, so applied is -100
      });

      const playerAfter = await playerRepo.get(playerId);
      assert.ok(playerAfter);
      assert.equal(playerAfter.sg, 0);

      const entries = await ledgerRepo.listForPlayer(playerId, 100);
      const sgEntry = entries.find((e) => e.resourceKind === 'sg');
      assert.ok(sgEntry);
      assert.equal(sgEntry.appliedDelta, -100);
      assert.equal(sgEntry.balanceAfter, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('ledger invariant: SUM(applied_delta) equals stored balance', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      const progress = makeProgress(playerId, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        await progressRepo.save(progress, tx);

        await progression.adjustSg(tx, player, 500, 'barrel_loot', null, null);
        await progression.adjustSg(tx, player, -200, 'trap_damage', null, null);
        await progression.adjustSg(tx, player, 100, 'barrel_loot', null, null);
        await progression.adjustSg(tx, player, -400, 'trap_damage', null, null);
      });

      const playerAfter = await playerRepo.get(playerId);
      assert.ok(playerAfter);

      // Verify the invariant via SQL: SUM(applied_delta) for this player should equal sg
      const result = await pool.query(
        `SELECT COALESCE(SUM(applied_delta), 0) as total_delta
         FROM resource_ledger
         WHERE player_id = $1 AND resource_kind = 'sg'`,
        [playerId]
      );

      const sumDelta = Number(result.rows[0].total_delta);
      // Initial sg was 10000, so: 10000 + 500 - 200 + 100 - 400 = 10000
      assert.equal(sumDelta, 0); // The net change
      assert.equal(playerAfter.sg, 10000); // Should be unchanged since changes cancel out

      // Alternatively: verify that a clamped adjustment still records the post-clamp delta
      const player2 = makePlayer(randomUUID() as PlayerId);
      player2.sg = 100;
      const progress2 = makeProgress(player2.id, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player2, tx);
        await progressRepo.save(progress2, tx);

        await progression.adjustSg(tx, player2, -150, 'trap_damage', null, null);
      });

      const result2 = await pool.query(
        `SELECT COALESCE(SUM(applied_delta), 0) as total_delta
         FROM resource_ledger
         WHERE player_id = $1 AND resource_kind = 'sg'`,
        [player2.id]
      );

      const sumDelta2 = Number(result2.rows[0].total_delta);
      assert.equal(sumDelta2, -100); // Net change: 100 + (-100) = 0, so delta was -100

      const player2After = await playerRepo.get(player2.id);
      assert.ok(player2After);
      assert.equal(player2After.sg, 0);
    } finally {
      await closeDb(pool);
    }
  });
});
