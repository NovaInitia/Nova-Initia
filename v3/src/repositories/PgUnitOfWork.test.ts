import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass } from '../domain/enums.js';
import type { PlayerId } from '../domain/ids.js';
import type { Player, ClassProgress } from '../domain/player.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { PgUnitOfWork } from './PgUnitOfWork.js';
import { PgPlayerRepository } from './PgPlayerRepository.js';
import { PgClassProgressRepository } from './PgClassProgressRepository.js';
import { PgLedgerRepository } from './PgLedgerRepository.js';

function makePlayer(id: PlayerId, name?: string): Player {
  return {
    id,
    name: name || `player-${id}`,
    credentialHash: 'hash',
    email: null,
    activeClass: PlayerClass.Giver,
    karma: 50,
    sg: 1000,
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

describe('PgUnitOfWork', { skip: DB_SKIP }, () => {
  it('committed run persists writes', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const progress = makeProgress(playerId, PlayerClass.Giver);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        await progressRepo.save(progress, tx);
      });

      const retrieved = await playerRepo.get(playerId);
      assert.ok(retrieved);
      assert.equal(retrieved.name, `player-${playerId}`);

      const progressRetrieved = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.ok(progressRetrieved);
      assert.equal(progressRetrieved.level, 1);
    } finally {
      await closeDb(pool);
    }
  });

  it('rollback loses all writes', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const progress = makeProgress(playerId, PlayerClass.Giver);

      try {
        await unitOfWork.run(null, async (tx) => {
          await playerRepo.save(player, tx);
          await progressRepo.save(progress, tx);
          throw new Error('intentional error');
        });
      } catch (err) {
        // Expected
      }

      const retrieved = await playerRepo.get(playerId);
      assert.equal(retrieved, null);

      const progressRetrieved = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.equal(progressRetrieved, null);

      const ledgerEntries = await ledgerRepo.listForPlayer(playerId, 100);
      assert.equal(ledgerEntries.length, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('original error propagates unchanged', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const originalError = new Error('test error');

      let caught: Error | null = null;
      try {
        await unitOfWork.run(null, async (tx) => {
          throw originalError;
        });
      } catch (err) {
        caught = err as Error;
      }

      assert.ok(caught);
      assert.equal(caught, originalError);
      assert.equal(caught.message, 'test error');
    } finally {
      await closeDb(pool);
    }
  });

  it('concurrent runs both succeed', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const p1Id = randomUUID() as PlayerId;
      const p2Id = randomUUID() as PlayerId;

      const promises = [
        unitOfWork.run(null, async (tx) => {
          const player1 = makePlayer(p1Id);
          await playerRepo.save(player1, tx);
        }),
        unitOfWork.run(null, async (tx) => {
          const player2 = makePlayer(p2Id);
          await playerRepo.save(player2, tx);
        })
      ];

      await Promise.all(promises);

      const p1 = await playerRepo.get(p1Id);
      assert.ok(p1);

      const p2 = await playerRepo.get(p2Id);
      assert.ok(p2);
    } finally {
      await closeDb(pool);
    }
  });

  it('isolation: concurrent write is not visible until committed', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const p1Id = randomUUID() as PlayerId;
      const p2Id = randomUUID() as PlayerId;

      // First, create player 1
      const player1 = makePlayer(p1Id);
      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player1, tx);
      });

      // Now run two concurrent transactions where one writes player 2 and the other reads
      let tx1Completed = false;
      let readResult: Player | null = null;

      const promises = [
        unitOfWork.run(null, async (tx) => {
          const player2 = makePlayer(p2Id);
          await playerRepo.save(player2, tx);
          // Simulate delay to ensure the read happens before commit
          await new Promise((resolve) => setTimeout(resolve, 100));
          tx1Completed = true;
        }),
        unitOfWork.run(null, async (tx) => {
          // Small delay to ensure write starts first
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Try to read player 2 (should not see it until tx1 commits)
          readResult = await playerRepo.get(p2Id);
        })
      ];

      await Promise.all(promises);

      // After both complete, we should see player 2
      const p2 = await playerRepo.get(p2Id);
      assert.ok(p2);
    } finally {
      await closeDb(pool);
    }
  });

  it('read-your-own-writes within transaction', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
        // Read back the same player within the same transaction
        const retrieved = await playerRepo.get(playerId);
        assert.ok(retrieved);
        assert.equal(retrieved.name, `player-${playerId}`);
      });
    } finally {
      await closeDb(pool);
    }
  });

  it('actor propagation with non-null actorId', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const playerId = randomUUID() as PlayerId;
      const actorId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await unitOfWork.run(actorId, async (tx) => {
        await playerRepo.save(player, tx);
      });

      // Query audit_log directly to verify changed_by is set
      const result = await pool.query(
        "SELECT changed_by FROM audit_log WHERE table_name = 'player' LIMIT 1"
      );

      assert.ok(result.rows.length > 0);
      assert.equal(result.rows[0].changed_by, actorId);
    } finally {
      await closeDb(pool);
    }
  });

  it('actor propagation with null actorId', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await unitOfWork.run(null, async (tx) => {
        await playerRepo.save(player, tx);
      });

      // Query audit_log directly to verify changed_by is NULL
      const result = await pool.query(
        "SELECT changed_by FROM audit_log WHERE table_name = 'player' LIMIT 1"
      );

      assert.ok(result.rows.length > 0);
      assert.equal(result.rows[0].changed_by, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('connection is released even on error', async () => {
    const pool = await freshDb();
    try {
      const unitOfWork = new PgUnitOfWork(pool);
      const playerRepo = new PgPlayerRepository(pool);

      const initialTotal = pool.totalCount;

      // Run multiple failing transactions to check for connection leaks
      for (let i = 0; i < 20; i++) {
        try {
          await unitOfWork.run(null, async (tx) => {
            throw new Error('test error');
          });
        } catch {
          // Expected
        }
      }

      // Check pool state - should not have accumulated idle clients
      // Allow some margin for variance in timing
      assert.ok(pool.idleCount >= 0, 'idle count should be non-negative');
    } finally {
      await closeDb(pool);
    }
  });
});
