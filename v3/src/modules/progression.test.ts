import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PlayerId } from '../domain/ids.js';
import type { Player, ClassProgress } from '../domain/player.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { ProgressionModule } from './progression.js';
import {
  InMemoryDatabase,
  InMemoryPlayerRepository,
  InMemoryClassProgressRepository,
  InMemoryLedgerRepository,
  InMemoryUnitOfWork
} from '../repositories/InMemoryDatabase.js';
import { InvalidXpAmount, InvalidSgDelta, UnknownClassProgress } from '../domain/errors.js';

function makePlayer(overrides: Partial<Player> = {}): Player {
  const id = 'player1' as PlayerId;
  return {
    id,
    name: 'Alice',
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
    experience: 0,
    ...overrides
  };
}

describe('ProgressionModule.awardXp', () => {
  it('adds to experience and persists', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      experience: 100
    });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    await progression.awardXp(tx, player, PlayerClass.Giver, 50, 'trigger_reward', null);

    const retrieved = await progressRepo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.experience, 150);
  });

  it('writes one ledger row with balanceAfter equal to new total', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      experience: 100
    });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    await progression.awardXp(tx, player, PlayerClass.Giver, 50, 'trigger_reward', null);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].resourceKind, 'xp');
    assert.equal(entries[0].appliedDelta, 50);
    assert.equal(entries[0].balanceAfter, 150);
    assert.equal(entries[0].playerClass, PlayerClass.Giver);
  });

  it('leaves progress.level untouched', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: 5,
      experience: 100
    });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    await progression.awardXp(tx, player, PlayerClass.Giver, 50, 'trigger_reward', null);

    const retrieved = await progressRepo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.level, 5);
  });

  it('two successive awards accumulate and produce two rows', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      experience: 0
    });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    await progression.awardXp(tx, player, PlayerClass.Giver, 30, 'trigger_reward', null);
    await progression.awardXp(tx, player, PlayerClass.Giver, 40, 'trigger_reward', null);

    const retrieved = await progressRepo.get('p1' as PlayerId, PlayerClass.Giver);
    assert.ok(retrieved);
    assert.equal(retrieved.experience, 70);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 2);
    assert.equal(entries[1].appliedDelta, 30);
    assert.equal(entries[0].appliedDelta, 40);
  });

  it('rejects 0 with InvalidXpAmount', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      experience: 100
    });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    try {
      await progression.awardXp(tx, player, PlayerClass.Giver, 0, 'trigger_reward', null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidXpAmount);
    }

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('rejects negative amount with InvalidXpAmount', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({ playerId: 'p1' as PlayerId, experience: 100 });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    try {
      await progression.awardXp(tx, player, PlayerClass.Giver, -5, 'trigger_reward', null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidXpAmount);
    }

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('rejects non-integer with InvalidXpAmount', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const progress = makeProgress({ playerId: 'p1' as PlayerId, experience: 100 });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);
    await progressRepo.save(progress, tx);

    try {
      await progression.awardXp(tx, player, PlayerClass.Giver, 3.5, 'trigger_reward', null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidXpAmount);
    }

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('throws UnknownClassProgress when no progress row', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId });
    const tx = { id: 'tx1' };

    await playerRepo.save(player, tx);

    try {
      await progression.awardXp(tx, player, PlayerClass.Guardian, 50, 'trigger_reward', null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof UnknownClassProgress);
    }

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });
});

describe('ProgressionModule.adjustKarma', () => {
  it('matching class: giver placing trap loses 1 karma', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 50 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Trap, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 49);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].resourceKind, 'karma');
    assert.equal(entries[0].cause, 'tool_use');
    assert.equal(entries[0].appliedDelta, -1);
    assert.equal(entries[0].balanceAfter, 49);
  });

  it('matching class: giver placing barrel gains 1 karma', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 50 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Barrel, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 51);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].appliedDelta, 1);
  });

  it('non-matching class: giver using spider changes nothing', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 50 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Spider, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 50);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('non-matching class: guardian using barrel changes nothing', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Guardian, karma: 50 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Barrel, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 50);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('clamping at min: at karma 0 placing trap stays at 0', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 0 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Trap, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 0);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('clamping at max: at karma 100 placing barrel stays at 100', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Barrel, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 100);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('at bound in other direction: at karma 0 placing barrel goes to 1', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, activeClass: PlayerClass.Giver, karma: 0 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustKarma(tx, player, ToolType.Barrel, null);

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.karma, 1);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].appliedDelta, 1);
  });
});

describe('ProgressionModule.adjustSg', () => {
  it('positive delta credits and returns the delta', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    const applied = await progression.adjustSg(tx, player, 50, 'trigger_reward', null, null);

    assert.equal(applied, 50);
    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 150);
  });

  it('negative delta debits and returns it', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    const applied = await progression.adjustSg(tx, player, -30, 'trap_damage', null, null);

    assert.equal(applied, -30);
    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 70);
  });

  it('balanceAfter matches the new balance', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustSg(tx, player, -20, 'trap_damage', null, null);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].balanceAfter, 80);
  });

  it('floors at 0: player with 10 sg taking -50 ends at 0, returns -10', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 10 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    const applied = await progression.adjustSg(tx, player, -50, 'trap_damage', null, null);

    assert.equal(applied, -10);
    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 0);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].appliedDelta, -10);
  });

  it('no-op: player at 0 sg with -50 returns 0 and writes no row', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 0 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    const applied = await progression.adjustSg(tx, player, -50, 'trap_damage', null, null);

    assert.equal(applied, 0);
    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('NaN delta throws InvalidSgDelta and does not modify player or ledger', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    try {
      await progression.adjustSg(tx, player, NaN, 'trap_damage', null, null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidSgDelta);
    }

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 100);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('fractional delta throws InvalidSgDelta and does not modify player or ledger', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    try {
      await progression.adjustSg(tx, player, 0.5, 'trap_damage', null, null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidSgDelta);
    }

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 100);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('Infinity delta throws InvalidSgDelta and does not modify player or ledger', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    try {
      await progression.adjustSg(tx, player, Infinity, 'trap_damage', null, null);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidSgDelta);
    }

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 100);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('delta 0 is legal and writes no row', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    const applied = await progression.adjustSg(tx, player, 0, 'trigger_reward', null, null);

    assert.equal(applied, 0);
    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('ledger invariant: sum of appliedDelta equals final balance', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 0 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await progression.adjustSg(tx, player, 50, 'trigger_reward', null, null);
    await progression.adjustSg(tx, player, -30, 'trap_damage', null, null);
    await progression.adjustSg(tx, player, -40, 'trap_damage', null, null);
    await progression.adjustSg(tx, player, 20, 'trigger_reward', null, null);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    const sumOfDeltas = entries.reduce((sum, e) => sum + e.appliedDelta, 0);

    const finalPlayer = await playerRepo.get('p1' as PlayerId);
    assert.ok(finalPlayer);
    assert.equal(sumOfDeltas, finalPlayer.sg);

    // Verify the clamping row has appliedDelta === -20, not -40
    const clampingRow = entries.find((e) => e.appliedDelta === -20);
    assert.ok(clampingRow);
  });
});

describe('ProgressionModule inside InMemoryUnitOfWork', () => {
  it('thrown adjustSg inside uow.run rolls back changes', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
    const uow = new InMemoryUnitOfWork(db);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    try {
      await uow.run('actor1' as PlayerId, async (tx) => {
        await progression.adjustSg(tx, player, -40, 'trap_damage', null, null);
        throw new Error('Oops');
      });
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 100);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 0);
  });

  it('successful adjustSg inside uow.run commits changes', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
    const uow = new InMemoryUnitOfWork(db);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100 });
    const tx = { id: 'tx1' };
    await playerRepo.save(player, tx);

    await uow.run('actor1' as PlayerId, async (tx) => {
      await progression.adjustSg(tx, player, -40, 'trap_damage', null, null);
    });

    const retrieved = await playerRepo.get('p1' as PlayerId);
    assert.ok(retrieved);
    assert.equal(retrieved.sg, 60);

    const entries = await ledgerRepo.listForPlayer('p1' as PlayerId, 100);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].appliedDelta, -40);
  });
});

describe('ProgressionModule.canAdvance', () => {
  it('false when experience is short', async () => {
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 1000 });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: 1,
      experience: 100
    });

    const result = progression.canAdvance(player, progress);
    assert.equal(result, false);
  });

  it('false when experience suffices but sg does not', async () => {
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 50 });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: 1,
      experience: 1000
    });

    const result = progression.canAdvance(player, progress);
    assert.equal(result, false);
  });

  it('true when both experience and sg suffice', async () => {
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const player = makePlayer({ id: 'p1' as PlayerId, sg: 200 });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: 1,
      experience: 700
    });

    const result = progression.canAdvance(player, progress);
    assert.equal(result, true);
  });

  it('false at max level even with enormous experience and sg', async () => {
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);

    const maxLevel = balance.maxLevel();
    const player = makePlayer({ id: 'p1' as PlayerId, sg: 100000 });
    const progress = makeProgress({
      playerId: 'p1' as PlayerId,
      level: maxLevel,
      experience: 1000000
    });

    const result = progression.canAdvance(player, progress);
    assert.equal(result, false);
  });
});
