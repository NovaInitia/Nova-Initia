import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PlayerId } from '../domain/ids.js';
import type { Player, ClassProgress } from '../domain/player.js';
import type { LedgerEntry } from '../domain/progression.js';
import {
  InMemoryDatabase,
  InMemoryPlayerRepository,
  InMemoryClassProgressRepository,
  InMemoryLedgerRepository,
  InMemoryUnitOfWork
} from './InMemoryDatabase.js';
import { NotImplemented, ConcurrentUnitOfWork } from '../domain/errors.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = 'player1' as PlayerId;
  return {
    id,
    name: 'Alice',
    credentialHash: 'hash',
    email: null,
    activeClass: PlayerClass.Giver,
    karma: 50,
    sg: 100,
    isModerator: false,
    isOperator: false,
    isActive: true,
    avatarUrl: null,
    comment: null,
    registeredAt: new Date('2024-01-01'),
    lastActiveAt: null,
    lastStipendAt: null,
    ...overrides
  };
}

function makeProgress(overrides: Partial<ClassProgress> = {}): ClassProgress {
  const playerId = 'player1' as PlayerId;
  return {
    playerId,
    playerClass: PlayerClass.Giver,
    level: 1,
    experience: 100,
    ...overrides
  };
}

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const playerId = 'player1' as PlayerId;
  return {
    playerId,
    resourceKind: 'xp',
    playerClass: PlayerClass.Giver,
    appliedDelta: 10,
    balanceAfter: 110,
    cause: 'trigger_reward',
    placementId: null,
    counterpartyId: null,
    jobRunId: null,
    occurredAt: new Date(),
    ...overrides
  };
}

describe('InMemoryPlayerRepository', () => {
  it('get returns null for an unknown id', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const result = await repo.get('unknown' as PlayerId);
    assert.equal(result, null);
  });

  it('getByName returns null for an unknown name', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const result = await repo.getByName('Unknown');
    assert.equal(result, null);
  });

  it('save then get round-trips the values', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const player = makePlayer({ id: 'p1' as PlayerId, name: 'TestPlayer' });
    const tx = { id: 'tx1' };

    await repo.save(player, tx);
    const retrieved = await repo.get('p1' as PlayerId);

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'TestPlayer');
    assert.equal(retrieved.karma, 50);
    assert.equal(retrieved.sg, 100);
  });

  it('copy on read: get returns a distinct object', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const player = makePlayer({ id: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await repo.save(player, tx);
    const first = await repo.get('p1' as PlayerId);
    assert.ok(first);
    first.karma = 75;

    const second = await repo.get('p1' as PlayerId);
    assert.ok(second);
    assert.equal(second.karma, 50);
  });

  it('copy on write: save stores a distinct copy', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const player = makePlayer({ id: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await repo.save(player, tx);
    player.karma = 99;

    const retrieved = await repo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 50);
  });

  it('getByName is case-sensitive', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    const player = makePlayer({ id: 'p1' as PlayerId, name: 'Alice' });
    const tx = { id: 'tx1' };

    await repo.save(player, tx);
    assert.ok(await repo.getByName('Alice'));
    assert.equal(await repo.getByName('alice'), null);
  });

  it('listStipendDue throws NotImplemented', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryPlayerRepository(db);
    try {
      await repo.listStipendDue(new Date(), 0, 0);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof NotImplemented);
    }
  });
});

describe('InMemoryClassProgressRepository', () => {
  it('get returns null for an unknown class', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const result = await repo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.equal(result, null);
  });

  it('save then get round-trips the values', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      playerClass: PlayerClass.Guardian,
      level: 5,
      experience: 1000
    });
    const tx = { id: 'tx1' };

    await repo.save(progress, tx);
    const retrieved = await repo.get('p1' as PlayerId, PlayerClass.Guardian);

    assert.ok(retrieved);
    assert.equal(retrieved.level, 5);
    assert.equal(retrieved.experience, 1000);
  });

  it('copy on read: get returns a distinct object', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const progress = makeProgress({ playerId: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await repo.save(progress, tx);
    const first = await repo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(first);
    first.experience = 999;

    const second = await repo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(second);
    assert.equal(second.experience, 100);
  });

  it('copy on write: save stores a distinct copy', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const progress = makeProgress({ playerId: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await repo.save(progress, tx);
    progress.experience = 999;

    const retrieved = await repo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.experience, 100);
  });

  it('list returns results ordered by playerClass ascending', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const tx = { id: 'tx1' };

    await repo.save(
      makeProgress({
        playerId: 'p1' as PlayerId,
        playerClass: PlayerClass.Guide,
        level: 3
      }),
      tx
    );
    await repo.save(
      makeProgress({
        playerId: 'p1' as PlayerId,
        playerClass: PlayerClass.Giver,
        level: 1
      }),
      tx
    );
    await repo.save(
      makeProgress({
        playerId: 'p1' as PlayerId,
        playerClass: PlayerClass.Guardian,
        level: 2
      }),
      tx
    );

    const results = await repo.list('p1' as PlayerId);
    assert.equal(results.length, 3);
    assert.equal(results[0].playerClass, PlayerClass.Giver);
    assert.equal(results[1].playerClass, PlayerClass.Guardian);
    assert.equal(results[2].playerClass, PlayerClass.Guide);
  });

  it('list returns empty array for a player with no progress', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const results = await repo.list('unknown' as PlayerId);
    assert.deepEqual(results, []);
  });

  it('list returns copies', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryClassProgressRepository(db);
    const progress = makeProgress({ playerId: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await repo.save(progress, tx);
    const results = await repo.list('p1' as PlayerId);
    results[0].experience = 999;

    const again = await repo.list('p1' as PlayerId);
    assert.equal(again[0].experience, 100);
  });
});

describe('InMemoryLedgerRepository', () => {
  it('listForPlayer returns empty array for a player with no entries', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const results = await repo.listForPlayer('p1' as PlayerId, 10);
    assert.deepEqual(results, []);
  });

  it('append then listForPlayer round-trips entries', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const entry = makeLedgerEntry({
      playerId: 'p1' as PlayerId,
      appliedDelta: 50,
      balanceAfter: 150
    });
    const tx = { id: 'tx1' };

    await repo.append(entry, tx);
    const results = await repo.listForPlayer('p1' as PlayerId, 10);

    assert.equal(results.length, 1);
    assert.equal(results[0].appliedDelta, 50);
    assert.equal(results[0].balanceAfter, 150);
  });

  it('listForPlayer returns newest-first', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const tx = { id: 'tx1' };

    const now = Date.now();
    await repo.append(
      makeLedgerEntry({ playerId: 'p1' as PlayerId, occurredAt: new Date(now) }),
      tx
    );
    await repo.append(
      makeLedgerEntry({ playerId: 'p1' as PlayerId, occurredAt: new Date(now + 1000) }),
      tx
    );
    await repo.append(
      makeLedgerEntry({ playerId: 'p1' as PlayerId, occurredAt: new Date(now + 2000) }),
      tx
    );

    const results = await repo.listForPlayer('p1' as PlayerId, 10);
    assert.equal(results.length, 3);
    assert.ok(results[0].occurredAt.getTime() >= results[1].occurredAt.getTime());
    assert.ok(results[1].occurredAt.getTime() >= results[2].occurredAt.getTime());
  });

  it('listForPlayer respects limit', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const tx = { id: 'tx1' };

    for (let i = 0; i < 5; i++) {
      await repo.append(makeLedgerEntry({ playerId: 'p1' as PlayerId }), tx);
    }

    const results = await repo.listForPlayer('p1' as PlayerId, 2);
    assert.equal(results.length, 2);
  });

  it('listForPlayer clamps negative limit to 0', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const tx = { id: 'tx1' };

    for (let i = 0; i < 3; i++) {
      await repo.append(makeLedgerEntry({ playerId: 'p1' as PlayerId }), tx);
    }

    const results = await repo.listForPlayer('p1' as PlayerId, -1);
    assert.equal(results.length, 0);
  });

  it('occurredAt is a distinct Date instance', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const originalDate = new Date();
    const entry = makeLedgerEntry({ playerId: 'p1' as PlayerId, occurredAt: originalDate });
    const tx = { id: 'tx1' };

    await repo.append(entry, tx);
    const results = await repo.listForPlayer('p1' as PlayerId, 10);

    assert.equal(results[0].occurredAt.getTime(), originalDate.getTime());
    assert.notEqual(results[0].occurredAt, originalDate);
  });

  it('append returns copies', async () => {
    const db = new InMemoryDatabase();
    const repo = new InMemoryLedgerRepository(db);
    const date = new Date();
    const originalYear = date.getFullYear();
    const entry = makeLedgerEntry({ playerId: 'p1' as PlayerId, occurredAt: date });
    const tx = { id: 'tx1' };

    await repo.append(entry, tx);
    entry.occurredAt.setFullYear(1999);

    const results = await repo.listForPlayer('p1' as PlayerId, 10);
    assert.equal(results[0].occurredAt.getFullYear(), originalYear);
  });
});

describe('InMemoryUnitOfWork', () => {
  it('run with commit leaves changes visible', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const player = makePlayer({ id: 'p1' as PlayerId, karma: 50 });

    await uow.run('actor1' as PlayerId, async (tx) => {
      player.karma = 75;
      await playerRepo.save(player, tx);
    });

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 75);
  });

  it('run records the lastActorId', async () => {
    const db = new InMemoryDatabase();
    const uow = new InMemoryUnitOfWork(db);

    await uow.run('actor1' as PlayerId, async () => {
      // no-op
    });

    assert.equal(uow.lastActorId, 'actor1');
  });

  it('run rolls back on throw and restores state', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const player = makePlayer({ id: 'p1' as PlayerId, karma: 50 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    try {
      await uow.run('actor1' as PlayerId, async (tx) => {
        player.karma = 75;
        await playerRepo.save(player, tx);
        throw new Error('Oops');
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 50);
  });

  it('run re-throws the original error', async () => {
    const db = new InMemoryDatabase();
    const uow = new InMemoryUnitOfWork(db);
    const testError = new Error('Test error');

    try {
      await uow.run('actor1' as PlayerId, async () => {
        throw testError;
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.equal(err, testError);
    }
  });

  it('run rolls back an insert on throw', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const player = makePlayer({ id: 'newplayer' as PlayerId });

    try {
      await uow.run('actor1' as PlayerId, async (tx) => {
        await playerRepo.save(player, tx);
        throw new Error('Oops');
      });
      assert.fail('should have thrown');
    } catch (err) {
      // expected
    }

    const retrieved = await playerRepo.get('newplayer' as PlayerId);
    assert.equal(retrieved, null);
  });

  it('run with class progress', async () => {
    const db = new InMemoryDatabase();
    const progressRepo = new InMemoryClassProgressRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: 1,
      experience: 100
    });

    await uow.run('actor1' as PlayerId, async (tx) => {
      await progressRepo.save(progress, tx);
    });

    const retrieved = await progressRepo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.experience, 100);
  });

  it('run rolls back class progress on throw', async () => {
    const db = new InMemoryDatabase();
    const progressRepo = new InMemoryClassProgressRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const progress = makeProgress({ playerId: 'p1' as PlayerId, experience: 100 });
    const tx = { id: 'tx1' };
    await progressRepo.save(progress, tx);

    try {
      await uow.run('actor1' as PlayerId, async (tx) => {
        progress.experience = 200;
        await progressRepo.save(progress, tx);
        throw new Error('Oops');
      });
    } catch {
      // expected
    }

    const retrieved = await progressRepo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.experience, 100);
  });

  it('multiple runs accumulate state', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const p1 = makePlayer({ id: 'p1' as PlayerId });
    const p2 = makePlayer({ id: 'p2' as PlayerId });

    await uow.run('actor1' as PlayerId, async (tx) => {
      await playerRepo.save(p1, tx);
    });

    await uow.run('actor2' as PlayerId, async (tx) => {
      await playerRepo.save(p2, tx);
    });

    assert.ok(await playerRepo.get('p1' as PlayerId));
    assert.ok(await playerRepo.get('p2' as PlayerId));
  });

  it('concurrent run calls throw ConcurrentUnitOfWork', async () => {
    const db = new InMemoryDatabase();
    const uow = new InMemoryUnitOfWork(db);
    let innerRunThrew = false;

    try {
      await uow.run('actor1' as PlayerId, async () => {
        try {
          await uow.run('actor2' as PlayerId, async () => {
            // no-op
          });
          assert.fail('inner run should have thrown');
        } catch (err) {
          assert.ok(err instanceof ConcurrentUnitOfWork);
          innerRunThrew = true;
        }
      });
    } catch (err) {
      assert.fail('outer run should not have thrown');
    }

    assert.equal(innerRunThrew, true);
  });

  it('subsequent run after committed run works normally', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const p1 = makePlayer({ id: 'p1' as PlayerId });
    await uow.run('actor1' as PlayerId, async (tx) => {
      await playerRepo.save(p1, tx);
    });

    const p2 = makePlayer({ id: 'p2' as PlayerId });
    await uow.run('actor2' as PlayerId, async (tx) => {
      await playerRepo.save(p2, tx);
    });

    assert.ok(await playerRepo.get('p1' as PlayerId));
    assert.ok(await playerRepo.get('p2' as PlayerId));
  });

  it('subsequent run after thrown run works normally', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const p1 = makePlayer({ id: 'p1' as PlayerId });
    try {
      await uow.run('actor1' as PlayerId, async (tx) => {
        await playerRepo.save(p1, tx);
        throw new Error('Oops');
      });
    } catch (err) {
      // expected
    }

    const p2 = makePlayer({ id: 'p2' as PlayerId });
    await uow.run('actor2' as PlayerId, async (tx) => {
      await playerRepo.save(p2, tx);
    });

    assert.equal(await playerRepo.get('p1' as PlayerId), null);
    assert.ok(await playerRepo.get('p2' as PlayerId));
  });
});

describe('InMemoryDatabase integration', () => {
  it('reset clears all data', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const tx = { id: 'tx1' };

    const player = makePlayer({ id: 'p1' as PlayerId });
    await playerRepo.save(player, tx);

    db.reset();

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.equal(retrieved, null);
  });
});
