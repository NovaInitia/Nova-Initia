import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PlayerId } from '../domain/ids.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import {
  NameTaken,
  AuthenticationFailed,
  SessionNotOwned,
} from '../domain/errors.js';
import { IdentityModule } from '../modules/identity.js';
import { PgPlayerRepository } from './PgPlayerRepository.js';
import { PgInventoryRepository } from './PgInventoryRepository.js';
import { PgArmorRepository } from './PgArmorRepository.js';
import { PgSessionRepository } from './PgSessionRepository.js';
import { PgClassProgressRepository } from './PgClassProgressRepository.js';
import { PgLedgerRepository } from './PgLedgerRepository.js';
import { PgUnitOfWork } from './PgUnitOfWork.js';

describe('IdentityModule with PostgreSQL', { skip: DB_SKIP }, () => {
  it('register creates player with D22 starting state via ledger', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      const result = await identity.register(
        'TestPlayer',
        'password123',
        'test@example.com',
        PlayerClass.Giver
      );

      assert.ok(result.player);
      assert.ok(result.session);
      assert.ok(result.token);

      // Verify starting sg via ledger sum
      const sgEntries = await ledgerRepo.listForPlayer(result.player.id, 100);
      const sgSum = sgEntries
        .filter((e) => e.resourceKind === 'sg')
        .reduce((sum, e) => sum + e.appliedDelta, 0);
      assert.equal(sgSum, balance.constant('starting_sg'));

      // Verify starting karma via ledger sum
      const karmaSum = sgEntries
        .filter((e) => e.resourceKind === 'karma')
        .reduce((sum, e) => sum + e.appliedDelta, 0);
      assert.equal(karmaSum, balance.constant('starting_karma'));

      // Verify inventory: 10 of own class, 5 of others
      const inventory = await inventoryRepo.get(result.player.id);
      for (const tool of [
        ToolType.Trap,
        ToolType.Barrel,
        ToolType.Spider,
        ToolType.Shield,
        ToolType.Doorway,
        ToolType.Signpost,
      ]) {
        const count = inventory.counts.get(tool) ?? 0;
        const expectedQty =
          balance.owningClassOf(tool) === PlayerClass.Giver
            ? balance.constant('starting_tools_in_class')
            : balance.constant('starting_tools_other');
        assert.equal(
          count,
          expectedQty,
          `Tool ${tool} count mismatch`
        );
      }

      // Verify class progress exists for all three classes at level 1
      for (const pc of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
        const progress = await progressRepo.get(result.player.id, pc);
        assert.ok(progress, `Missing progress for class ${pc}`);
        assert.equal(progress.level, 1);
        assert.equal(progress.experience, 0);
      }

      // Verify armor is inactive
      const armor = await armorRepo.get(result.player.id);
      assert.ok(armor);
      assert.equal(armor.isActive, false);
      assert.equal(armor.chargesRemaining, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('authenticate succeeds with correct credentials', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      const authResult = await identity.authenticate('Alice', 'password123');
      assert.ok(authResult.session);
      assert.ok(authResult.token);
    } finally {
      await closeDb(pool);
    }
  });

  it('authenticate fails with wrong credentials', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      try {
        await identity.authenticate('Alice', 'wrongpassword');
        assert.fail('should have thrown AuthenticationFailed');
      } catch (err) {
        assert.ok(err instanceof AuthenticationFailed);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('authenticate fails with generic error for unknown name', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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
        assert.fail('should have thrown AuthenticationFailed');
      } catch (err) {
        assert.ok(err instanceof AuthenticationFailed);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('resolveSession returns player for valid token', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      const regResult = await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      const player = await identity.resolveSession(regResult.token);
      assert.ok(player);
      assert.equal(player.id, regResult.player.id);
    } finally {
      await closeDb(pool);
    }
  });

  it('resolveSession returns null for garbage token', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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
    } finally {
      await closeDb(pool);
    }
  });

  it('resolveSession returns null for revoked token', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      const regResult = await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      await identity.revokeSession(regResult.player, regResult.session.id);

      const player = await identity.resolveSession(regResult.token);
      assert.equal(player, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('revokeSession cannot revoke another player session', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      const reg1 = await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );
      const reg2 = await identity.register(
        'Bob',
        'password456',
        'bob@example.com',
        PlayerClass.Guardian
      );

      try {
        await identity.revokeSession(reg2.player, reg1.session.id);
        assert.fail('should have thrown SessionNotOwned');
      } catch (err) {
        assert.ok(err instanceof SessionNotOwned);
      }

      // Verify reg1's session is still valid
      const player = await identity.resolveSession(reg1.token);
      assert.ok(player);
    } finally {
      await closeDb(pool);
    }
  });

  it('getPublicProfile returns only public fields', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      const regResult = await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      const profile = await identity.getPublicProfile(regResult.player.id);
      assert.ok(profile);

      // Check actual key set
      const keys = new Set(Object.keys(profile));
      const expectedKeys = new Set(['id', 'name', 'avatarUrl', 'activeClass', 'levels', 'registeredAt', 'comment']);
      assert.deepEqual(keys, expectedKeys, `Profile keys mismatch. Got: ${Array.from(keys).sort().join(', ')}`);

      // Verify no sensitive fields
      assert.ok(!('credentialHash' in profile));
      assert.ok(!('email' in profile));
      assert.ok(!('sg' in profile));
      assert.ok(!('karma' in profile));
      assert.ok(!('isModerator' in profile));
      assert.ok(!('isOperator' in profile));
    } finally {
      await closeDb(pool);
    }
  });

  it('registering same name twice fails with NameTaken', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      await identity.register(
        'Alice',
        'password123',
        'alice@example.com',
        PlayerClass.Giver
      );

      try {
        await identity.register(
          'Alice',
          'password456',
          'alice2@example.com',
          PlayerClass.Guardian
        );
        assert.fail('should have thrown NameTaken');
      } catch (err) {
        assert.ok(err instanceof NameTaken);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('concurrent registrations of same name: exactly one succeeds', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const uow = new PgUnitOfWork(pool);
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

      // Start both registrations concurrently
      const promise1 = identity.register(
        'ConcurrentTest',
        'password123',
        'test1@example.com',
        PlayerClass.Giver
      );
      const promise2 = identity.register(
        'ConcurrentTest',
        'password456',
        'test2@example.com',
        PlayerClass.Guardian
      );

      const results = await Promise.allSettled([promise1, promise2]);

      // Exactly one should succeed, one should reject with NameTaken
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(succeeded.length, 1, 'Expected exactly one registration to succeed');
      assert.equal(rejected.length, 1, 'Expected exactly one registration to be rejected');

      const rejectionReason = rejected[0];
      if (rejectionReason.status === 'rejected') {
        assert.ok(
          rejectionReason.reason instanceof NameTaken,
          `Expected NameTaken error, got ${rejectionReason.reason?.constructor?.name}`
        );
      }

      // Verify exactly one row exists with that name
      const retrieved1 = await playerRepo.getByName('ConcurrentTest');
      const retrieved2 = await playerRepo.getByName('CONCURRENTTEST'); // case-insensitive
      assert.ok(retrieved1, 'Expected one player with that name');
      assert.equal(
        retrieved1?.id,
        retrieved2?.id,
        'Case-insensitive lookup should return same player'
      );

      // Verify the winner
      const successResult = succeeded[0];
      if (successResult.status === 'fulfilled') {
        assert.equal(
          retrieved1.id,
          successResult.value.player.id,
          'The player in database should match the successful registration'
        );
      }
    } finally {
      await closeDb(pool);
    }
  });
});
