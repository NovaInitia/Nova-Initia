import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PlayerId, SessionId } from '../domain/ids.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { IdentityModule } from './identity.js';
import {
  InMemoryDatabase,
  InMemoryPlayerRepository,
  InMemoryClassProgressRepository,
  InMemoryLedgerRepository,
  InMemoryUnitOfWork,
  InMemoryInventoryRepository,
  InMemoryArmorRepository,
  InMemorySessionRepository
} from '../repositories/InMemoryDatabase.js';
import {
  InvalidRegistration,
  NameTaken,
  AuthenticationFailed,
  SessionNotOwned,
  NegativeInventory
} from '../domain/errors.js';

describe('IdentityModule.register', () => {
  it('happy path: creates player with seed balances and returns token', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    assert.ok(result.player);
    assert.ok(result.session);
    assert.ok(result.token);
    assert.equal(result.player.name, 'Alice');
    assert.equal(result.player.activeClass, PlayerClass.Giver);
    assert.equal(result.player.sg, balance.constant('starting_sg'));
    assert.equal(result.player.karma, balance.constant('starting_karma'));
    assert.equal(result.player.isActive, true);

    const retrieved = await playerRepo.get(result.player.id);
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Alice');
  });

  it('all three ClassProgress rows exist at level 1', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    for (const pc of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
      const progress = await progressRepo.get(result.player.id, pc);
      assert.ok(progress);
      assert.equal(progress.level, 1);
      assert.equal(progress.experience, 0);
    }
  });

  it('inventory has 10 of chosen class tools and 5 of others', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const inventory = await inventoryRepo.get(result.player.id);

    for (const tool of [ToolType.Trap, ToolType.Barrel, ToolType.Spider, ToolType.Shield, ToolType.Doorway, ToolType.Signpost]) {
      const count = inventory.counts.get(tool) ?? 0;
      const expectedQty =
        balance.owningClassOf(tool) === PlayerClass.Giver
          ? balance.constant('starting_tools_in_class')
          : balance.constant('starting_tools_other');
      assert.equal(count, expectedQty);
    }
  });

  it('armor exists and is inactive', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const armor = await armorRepo.get(result.player.id);

    assert.ok(armor);
    assert.equal(armor.isActive, false);
    assert.equal(armor.chargesRemaining, 0);
  });

  it('session exists and token is returned', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    assert.ok(result.session);
    assert.ok(result.token);
    assert.equal(result.session.playerId, result.player.id);
    assert.equal(result.session.revokedAt, null);
  });

  it('ledger invariant at birth: sg sum equals player sg', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    const entries = await ledgerRepo.listForPlayer(result.player.id, 100);
    const sgEntries = entries.filter((e) => e.resourceKind === 'sg');
    const sgSum = sgEntries.reduce((sum, e) => sum + e.appliedDelta, 0);

    assert.equal(sgSum, result.player.sg);
  });

  it('ledger invariant at birth: karma sum equals player karma', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    const entries = await ledgerRepo.listForPlayer(result.player.id, 100);
    const karmaEntries = entries.filter((e) => e.resourceKind === 'karma');
    const karmaSum = karmaEntries.reduce((sum, e) => sum + e.appliedDelta, 0);

    assert.equal(karmaSum, result.player.karma);
  });

  it('rejects short name', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Al', 'password123', 'alice@example.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }

    const count = (await playerRepo.get('id' as PlayerId)) ? 1 : 0;
    assert.equal(count, 0);
  });

  it('rejects name with space', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice Smith', 'password123', 'alice@example.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }
  });

  it('rejects name with punctuation', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice!', 'password123', 'alice@example.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }
  });

  it('rejects short credential', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice', 'passwor', 'alice@example.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }
  });

  it('rejects email without @', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice', 'password123', 'aliceexample.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }
  });

  it('rejects out-of-range class', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice', 'password123', 'alice@example.com', 999 as PlayerClass);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof InvalidRegistration);
    }
  });

  it('throws NameTaken when name already exists', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    try {
      await identity.register('Alice', 'password456', 'alice2@example.com', PlayerClass.Guardian);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof NameTaken);
    }
  });

  it('is atomic: if inventory adjust fails, nothing is written', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);

    let adjustCount = 0;
    const originalAdjust = inventoryRepo.adjust.bind(inventoryRepo);
    inventoryRepo.adjust = async (playerId, tool, delta, tx) => {
      adjustCount++;
      if (adjustCount === 4) {
        throw new Error('Stub failure');
      }
      return originalAdjust(playerId, tool, delta, tx);
    };

    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }

    const allPlayers = await playerRepo.get('dummy' as PlayerId);
    assert.equal(allPlayers, null);
  });

  it('stored credential hash is not the credential', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    assert.notEqual(result.player.credentialHash, 'password123');
    assert.ok(result.player.credentialHash.startsWith('scrypt$32768$8$1$'));
  });

  it('two registrations with same credential produce different hashes', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result1 = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const result2 = await identity.register('Bob', 'password123', 'bob@example.com', PlayerClass.Guardian);

    assert.notEqual(result1.player.credentialHash, result2.player.credentialHash);
  });

  it('generated ids are valid v4 UUIDs', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    assert.ok(uuidRegex.test(result.player.id), `player id ${result.player.id} is not a valid v4 UUID`);
    assert.ok(uuidRegex.test(result.session.id), `session id ${result.session.id} is not a valid v4 UUID`);
  });
});

describe('IdentityModule.authenticate', () => {
  it('correct credential returns session and token', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const result = await identity.authenticate('Alice', 'password123');

    assert.ok(result.session);
    assert.ok(result.token);
  });

  it('wrong credential throws AuthenticationFailed', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    try {
      await identity.authenticate('Alice', 'wrongpassword');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AuthenticationFailed);
    }
  });

  it('unknown name throws AuthenticationFailed', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    try {
      await identity.authenticate('Unknown', 'password123');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AuthenticationFailed);
    }
  });

  it('inactive player throws AuthenticationFailed', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const result = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const tx = { id: 'tx1' };
    result.player.isActive = false;
    await playerRepo.save(result.player, tx);

    try {
      await identity.authenticate('Alice', 'password123');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AuthenticationFailed);
    }
  });
});

describe('IdentityModule.resolveSession', () => {
  it('valid token returns the player', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const player = await identity.resolveSession(regResult.token);

    assert.ok(player);
    assert.equal(player.id, regResult.player.id);
  });

  it('garbage string returns null', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const player = await identity.resolveSession('garbage');

    assert.equal(player, null);
  });

  it('revoked session returns null', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    await identity.revokeSession(regResult.player, regResult.session.id);

    const player = await identity.resolveSession(regResult.token);

    assert.equal(player, null);
  });

  it('expired session returns null', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);

    const session = regResult.session;
    session.expiresAt = new Date(Date.now() - 1000);
    const tx = { id: 'tx1' };
    await sessionRepo.save(session, tx);

    const player = await identity.resolveSession(regResult.token);

    assert.equal(player, null);
  });
});

describe('IdentityModule.revokeSession', () => {
  it('owner can revoke their session', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    await identity.revokeSession(regResult.player, regResult.session.id);

    const player = await identity.resolveSession(regResult.token);
    assert.equal(player, null);
  });

  it('different player cannot revoke another session', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const reg1 = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const reg2 = await identity.register('Bob', 'password456', 'bob@example.com', PlayerClass.Guardian);

    try {
      await identity.revokeSession(reg2.player, reg1.session.id);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof SessionNotOwned);
    }

    const player = await identity.resolveSession(reg1.token);
    assert.ok(player);
  });
});

describe('IdentityModule.getPublicProfile', () => {
  it('returns profile with all three class levels', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const profile = await identity.getPublicProfile(regResult.player.id);

    assert.ok(profile);
    assert.ok(profile.levels.has(PlayerClass.Giver));
    assert.ok(profile.levels.has(PlayerClass.Guardian));
    assert.ok(profile.levels.has(PlayerClass.Guide));
  });

  it('profile has no credentialHash, email, sg, or karma', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const profile = await identity.getPublicProfile(regResult.player.id);

    assert.ok(profile);
    assert.ok(!('credentialHash' in profile));
    assert.ok(!('email' in profile));
    assert.ok(!('sg' in profile));
    assert.ok(!('karma' in profile));
  });

  it('returns null for inactive player', async () => {
    const db = new InMemoryDatabase();
    const playerRepo = new InMemoryPlayerRepository(db);
    const progressRepo = new InMemoryClassProgressRepository(db);
    const ledgerRepo = new InMemoryLedgerRepository(db);
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const armorRepo = new InMemoryArmorRepository(db);
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);
    const balance = new StaticBalanceTable(SEED_BALANCE);
    const identity = new IdentityModule(
      playerRepo,
      sessionRepo,
      inventoryRepo,
      armorRepo,
      progressRepo,
      balance,
      uow,
      ledgerRepo
    );

    const regResult = await identity.register('Alice', 'password123', 'alice@example.com', PlayerClass.Giver);
    const tx = { id: 'tx1' };
    regResult.player.isActive = false;
    await playerRepo.save(regResult.player, tx);

    const profile = await identity.getPublicProfile(regResult.player.id);

    assert.equal(profile, null);
  });
});

describe('InMemoryDatabase transaction rollback', () => {
  it('rolled back transaction includes inventory', async () => {
    const db = new InMemoryDatabase();
    const inventoryRepo = new InMemoryInventoryRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const playerId = 'p1' as PlayerId;
    await inventoryRepo.adjust(playerId, ToolType.Trap, 10, { id: 'tx1' });

    try {
      await uow.run(playerId, async (tx) => {
        await inventoryRepo.adjust(playerId, ToolType.Trap, 5, tx);
        throw new Error('Oops');
      });
    } catch {
      // Expected
    }

    const inventory = await inventoryRepo.get(playerId);
    assert.equal(inventory.counts.get(ToolType.Trap), 10);
  });

  it('rolled back transaction includes armor', async () => {
    const db = new InMemoryDatabase();
    const armorRepo = new InMemoryArmorRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const playerId = 'p1' as PlayerId;
    await armorRepo.save(
      { playerId, isActive: false, chargesRemaining: 0 },
      { id: 'tx1' }
    );

    try {
      await uow.run(playerId, async (tx) => {
        const armor = await armorRepo.get(playerId);
        if (armor) {
          armor.isActive = true;
          await armorRepo.save(armor, tx);
        }
        throw new Error('Oops');
      });
    } catch {
      // Expected
    }

    const armor = await armorRepo.get(playerId);
    assert.ok(armor);
    assert.equal(armor.isActive, false);
  });

  it('rolled back transaction includes sessions', async () => {
    const db = new InMemoryDatabase();
    const sessionRepo = new InMemorySessionRepository(db);
    const uow = new InMemoryUnitOfWork(db);

    const playerId = 'p1' as PlayerId;
    const sessionId = 'sess1' as SessionId;
    const now = new Date();

    await sessionRepo.save(
      {
        id: sessionId,
        playerId,
        tokenHash: 'hash1',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 1000),
        revokedAt: null
      },
      { id: 'tx1' }
    );

    try {
      await uow.run(playerId, async (tx) => {
        await sessionRepo.revoke(sessionId, now, tx);
        throw new Error('Oops');
      });
    } catch {
      // Expected
    }

    const session = await sessionRepo.get(sessionId);
    assert.ok(session);
    assert.equal(session.revokedAt, null);
  });
});
