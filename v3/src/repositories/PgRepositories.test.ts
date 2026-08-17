import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass, ResourceKind, ToolType, type LedgerCause } from '../domain/enums.js';
import type { PlayerId, SessionId } from '../domain/ids.js';
import type { Player, ClassProgress, Armor, Session } from '../domain/player.js';
import type { LedgerEntry } from '../domain/progression.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { NameTaken, NegativeInventory, InventoryCapExceeded } from '../domain/errors.js';
import { PgPlayerRepository } from './PgPlayerRepository.js';
import { PgClassProgressRepository } from './PgClassProgressRepository.js';
import { PgLedgerRepository } from './PgLedgerRepository.js';
import { PgInventoryRepository } from './PgInventoryRepository.js';
import { PgArmorRepository } from './PgArmorRepository.js';
import { PgSessionRepository } from './PgSessionRepository.js';

function makePlayer(id: PlayerId, name?: string): Player {
  return {
    id,
    name: name || `player-${id}`,
    credentialHash: 'hash',
    email: 'test@example.com',
    activeClass: PlayerClass.Giver,
    karma: 50,
    sg: 1000,
    isModerator: false,
    isOperator: false,
    isActive: true,
    avatarUrl: 'http://example.com/avatar.png',
    comment: 'test comment',
    registeredAt: new Date('2024-01-01T00:00:00Z'),
    lastActiveAt: new Date('2024-01-02T00:00:00Z'),
    lastStipendAt: null
  };
}

function makeProgress(playerId: PlayerId, playerClass: PlayerClass): ClassProgress {
  return {
    playerId,
    playerClass,
    level: 5,
    experience: 1000
  };
}

describe('PgPlayerRepository', { skip: DB_SKIP }, () => {
  it('round-trip: save and get returns all fields', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);
      const retrieved = await playerRepo.get(playerId);

      assert.ok(retrieved);
      assert.equal(retrieved.id, player.id);
      assert.equal(retrieved.name, player.name);
      assert.equal(retrieved.credentialHash, player.credentialHash);
      assert.equal(retrieved.email, player.email);
      assert.equal(retrieved.activeClass, player.activeClass);
      assert.equal(retrieved.karma, player.karma);
      assert.equal(retrieved.sg, player.sg);
      assert.equal(retrieved.isModerator, player.isModerator);
      assert.equal(retrieved.isOperator, player.isOperator);
      assert.equal(retrieved.isActive, player.isActive);
      assert.equal(retrieved.avatarUrl, player.avatarUrl);
      assert.equal(retrieved.comment, player.comment);
      assert.equal(retrieved.registeredAt.getTime(), player.registeredAt.getTime());
      assert.equal(
        retrieved.lastActiveAt?.getTime(),
        player.lastActiveAt?.getTime()
      );
      assert.equal(retrieved.lastStipendAt, player.lastStipendAt);
    } finally {
      await closeDb(pool);
    }
  });

  it('get on unknown id returns null', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);

      const result = await playerRepo.get(randomUUID() as PlayerId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('getByName is case-insensitive', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId, 'Alice');

      await playerRepo.save(player, tx);

      const lowercase = await playerRepo.getByName('alice');
      assert.ok(lowercase);
      assert.equal(lowercase.id, playerId);

      const uppercase = await playerRepo.getByName('ALICE');
      assert.ok(uppercase);
      assert.equal(uppercase.id, playerId);

      const mixedcase = await playerRepo.getByName('aLiCe');
      assert.ok(mixedcase);
      assert.equal(mixedcase.id, playerId);
    } finally {
      await closeDb(pool);
    }
  });

  it('save twice on same id updates', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId, 'Alice');

      await playerRepo.save(player, tx);

      player.karma = 75;
      player.sg = 2000;
      await playerRepo.save(player, tx);

      const retrieved = await playerRepo.get(playerId);
      assert.ok(retrieved);
      assert.equal(retrieved.karma, 75);
      assert.equal(retrieved.sg, 2000);
      assert.equal(retrieved.name, 'Alice');
    } finally {
      await closeDb(pool);
    }
  });

  it('duplicate name (case-insensitive) throws NameTaken', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const tx = { id: 'tx1' };

      const p1 = makePlayer(randomUUID() as PlayerId, 'Alice');
      const p2 = makePlayer(randomUUID() as PlayerId, 'alice');

      await playerRepo.save(p1, tx);

      try {
        await playerRepo.save(p2, tx);
        assert.fail('should have thrown NameTaken');
      } catch (err) {
        assert.ok(err instanceof NameTaken);
      }
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgClassProgressRepository', { skip: DB_SKIP }, () => {
  it('save and get round-trip', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const progress = makeProgress(playerId, PlayerClass.Giver);

      await playerRepo.save(player, tx);
      await progressRepo.save(progress, tx);

      const retrieved = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.ok(retrieved);
      assert.equal(retrieved.playerId, progress.playerId);
      assert.equal(retrieved.playerClass, progress.playerClass);
      assert.equal(retrieved.level, progress.level);
      assert.equal(retrieved.experience, progress.experience);
    } finally {
      await closeDb(pool);
    }
  });

  it('get on unknown returns null', async () => {
    const pool = await freshDb();
    try {
      const progressRepo = new PgClassProgressRepository(pool);

      const result = await progressRepo.get(randomUUID() as PlayerId, PlayerClass.Giver);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('list returns all rows ordered by class_id', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);

      const progressGiver = makeProgress(playerId, PlayerClass.Giver);
      const progressGuardian = makeProgress(playerId, PlayerClass.Guardian);
      const progressGuide = makeProgress(playerId, PlayerClass.Guide);

      await progressRepo.save(progressGiver, tx);
      await progressRepo.save(progressGuardian, tx);
      await progressRepo.save(progressGuide, tx);

      const list = await progressRepo.list(playerId);
      assert.equal(list.length, 3);
      assert.equal(list[0].playerClass, PlayerClass.Giver);
      assert.equal(list[1].playerClass, PlayerClass.Guardian);
      assert.equal(list[2].playerClass, PlayerClass.Guide);
    } finally {
      await closeDb(pool);
    }
  });

  it('save twice on same (playerId, class) updates', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const progress = makeProgress(playerId, PlayerClass.Giver);

      await playerRepo.save(player, tx);
      await progressRepo.save(progress, tx);

      progress.level = 10;
      progress.experience = 5000;
      await progressRepo.save(progress, tx);

      const retrieved = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.ok(retrieved);
      assert.equal(retrieved.level, 10);
      assert.equal(retrieved.experience, 5000);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgLedgerRepository', { skip: DB_SKIP }, () => {
  it('append then listForPlayer returns newest first', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);

      const entry1: LedgerEntry = {
        playerId,
        resourceKind: 'sg' as ResourceKind,
        playerClass: null,
        appliedDelta: 100,
        balanceAfter: 1100,
        cause: 'trigger_reward',
        placementId: null,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date('2024-01-01T10:00:00Z')
      };

      const entry2: LedgerEntry = {
        playerId,
        resourceKind: 'sg' as ResourceKind,
        playerClass: null,
        appliedDelta: 50,
        balanceAfter: 1150,
        cause: 'barrel_loot',
        placementId: null,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date('2024-01-01T11:00:00Z')
      };

      await ledgerRepo.append(entry1, tx);
      await ledgerRepo.append(entry2, tx);

      const list = await ledgerRepo.listForPlayer(playerId, 100);
      assert.equal(list.length, 2);
      // Should be newest first
      assert.equal(list[0].cause, 'barrel_loot');
      assert.equal(list[1].cause, 'trigger_reward');
    } finally {
      await closeDb(pool);
    }
  });

  it('limit is respected', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);

      for (let i = 0; i < 10; i++) {
        const entry: LedgerEntry = {
          playerId,
          resourceKind: 'sg' as ResourceKind,
          playerClass: null,
          appliedDelta: 10,
          balanceAfter: 1000 + (i + 1) * 10,
          cause: 'trigger_reward',
          placementId: null,
          counterpartyId: null,
          jobRunId: null,
          occurredAt: new Date(Date.now() + i * 1000)
        };
        await ledgerRepo.append(entry, tx);
      }

      const list3 = await ledgerRepo.listForPlayer(playerId, 3);
      assert.equal(list3.length, 3);

      const list0 = await ledgerRepo.listForPlayer(playerId, 0);
      assert.equal(list0.length, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('negative limit behaves like in-memory (guard with Math.max)', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);

      const entry: LedgerEntry = {
        playerId,
        resourceKind: 'sg' as ResourceKind,
        playerClass: null,
        appliedDelta: 10,
        balanceAfter: 1010,
        cause: 'trigger_reward',
        placementId: null,
        counterpartyId: null,
        jobRunId: null,
        occurredAt: new Date()
      };
      await ledgerRepo.append(entry, tx);

      const listNeg = await ledgerRepo.listForPlayer(playerId, -5);
      assert.equal(listNeg.length, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('cause lookup works for multiple causes', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);

      await playerRepo.save(player, tx);

      const causes = ['trigger_reward', 'barrel_loot', 'tool_use'];

      for (const cause of causes) {
        const entry: LedgerEntry = {
          playerId,
          resourceKind: 'sg' as ResourceKind,
          playerClass: null,
          appliedDelta: 10,
          balanceAfter: 1000,
          cause: cause as LedgerCause,
          placementId: null,
          counterpartyId: null,
          jobRunId: null,
          occurredAt: new Date()
        };
        await ledgerRepo.append(entry, tx);
      }

      const list = await ledgerRepo.listForPlayer(playerId, 100);
      assert.equal(list.length, 3);

      const causesRetrieved = new Set(list.map((e) => e.cause));
      for (const cause of causes) {
        assert.ok(causesRetrieved.has(cause as LedgerCause));
      }
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgInventoryRepository', { skip: DB_SKIP }, () => {
  it('get on unknown player returns empty map', async () => {
    const pool = await freshDb();
    try {
      const inventoryRepo = new PgInventoryRepository(pool);

      const result = await inventoryRepo.get(randomUUID() as PlayerId);
      assert.equal(result.counts.size, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('adjust adds items when not present', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const result = await inventoryRepo.get(playerId);
      assert.equal(result.counts.get(ToolType.Trap), 10);
    } finally {
      await closeDb(pool);
    }
  });

  it('adjust increments existing items', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);
      await inventoryRepo.adjust(playerId, ToolType.Trap, 5, tx);

      const result = await inventoryRepo.get(playerId);
      assert.equal(result.counts.get(ToolType.Trap), 15);
    } finally {
      await closeDb(pool);
    }
  });

  it('adjust negative delta throws NegativeInventory when result would be negative', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      await inventoryRepo.adjust(playerId, ToolType.Trap, 5, tx);

      try {
        await inventoryRepo.adjust(playerId, ToolType.Trap, -10, tx);
        assert.fail('should have thrown NegativeInventory');
      } catch (err) {
        assert.ok(err instanceof NegativeInventory);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('adjust exceeding inventory cap throws InventoryCapExceeded', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      try {
        await inventoryRepo.adjust(playerId, ToolType.Trap, 251, tx);
        assert.fail('should have thrown InventoryCapExceeded');
      } catch (err) {
        assert.ok(err instanceof InventoryCapExceeded);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('handles multiple tools independently', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);
      await inventoryRepo.adjust(playerId, ToolType.Spider, 5, tx);
      await inventoryRepo.adjust(playerId, ToolType.Barrel, 3, tx);

      const result = await inventoryRepo.get(playerId);
      assert.equal(result.counts.get(ToolType.Trap), 10);
      assert.equal(result.counts.get(ToolType.Spider), 5);
      assert.equal(result.counts.get(ToolType.Barrel), 3);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgArmorRepository', { skip: DB_SKIP }, () => {
  it('get on unknown player returns null', async () => {
    const pool = await freshDb();
    try {
      const armorRepo = new PgArmorRepository(pool);

      const result = await armorRepo.get(randomUUID() as PlayerId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('save and get round-trip', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      const armor: Armor = {
        playerId,
        isActive: true,
        chargesRemaining: 42
      };

      await armorRepo.save(armor, tx);
      const retrieved = await armorRepo.get(playerId);

      assert.ok(retrieved);
      assert.equal(retrieved.playerId, armor.playerId);
      assert.equal(retrieved.isActive, true);
      assert.equal(retrieved.chargesRemaining, 42);
    } finally {
      await closeDb(pool);
    }
  });

  it('save twice updates', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const armorRepo = new PgArmorRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      let armor: Armor = {
        playerId,
        isActive: false,
        chargesRemaining: 0
      };

      await armorRepo.save(armor, tx);

      armor.isActive = true;
      armor.chargesRemaining = 50;
      await armorRepo.save(armor, tx);

      const retrieved = await armorRepo.get(playerId);
      assert.ok(retrieved);
      assert.equal(retrieved.isActive, true);
      assert.equal(retrieved.chargesRemaining, 50);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgSessionRepository', { skip: DB_SKIP }, () => {
  it('get on unknown session returns null', async () => {
    const pool = await freshDb();
    try {
      const sessionRepo = new PgSessionRepository(pool);

      const result = await sessionRepo.get(randomUUID() as SessionId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('getByTokenHash on unknown hash returns null', async () => {
    const pool = await freshDb();
    try {
      const sessionRepo = new PgSessionRepository(pool);

      const result = await sessionRepo.getByTokenHash('unknown-hash');
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('save and get round-trip', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      const now = new Date();
      const session: Session = {
        id: randomUUID() as SessionId,
        playerId,
        tokenHash: 'hash123',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 1000000),
        revokedAt: null
      };

      await sessionRepo.save(session, tx);
      const retrieved = await sessionRepo.get(session.id);

      assert.ok(retrieved);
      assert.equal(retrieved.id, session.id);
      assert.equal(retrieved.playerId, session.playerId);
      assert.equal(retrieved.tokenHash, session.tokenHash);
      assert.equal(retrieved.revokedAt, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('getByTokenHash finds session by token hash', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      const now = new Date();
      const session: Session = {
        id: randomUUID() as SessionId,
        playerId,
        tokenHash: 'unique-hash-123',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 1000000),
        revokedAt: null
      };

      await sessionRepo.save(session, tx);
      const retrieved = await sessionRepo.getByTokenHash('unique-hash-123');

      assert.ok(retrieved);
      assert.equal(retrieved.id, session.id);
      assert.equal(retrieved.tokenHash, 'unique-hash-123');
    } finally {
      await closeDb(pool);
    }
  });

  it('revoke sets revokedAt', async () => {
    const pool = await freshDb();
    try {
      const playerRepo = new PgPlayerRepository(pool);
      const sessionRepo = new PgSessionRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      await playerRepo.save(player, tx);

      const now = new Date();
      const session: Session = {
        id: randomUUID() as SessionId,
        playerId,
        tokenHash: 'hash456',
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 1000000),
        revokedAt: null
      };

      await sessionRepo.save(session, tx);

      const revokeTime = new Date(now.getTime() + 5000);
      await sessionRepo.revoke(session.id, revokeTime, tx);

      const retrieved = await sessionRepo.get(session.id);
      assert.ok(retrieved);
      assert.ok(retrieved.revokedAt);
      assert.equal(retrieved.revokedAt.getTime(), revokeTime.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('revoke on unknown session id does nothing', async () => {
    const pool = await freshDb();
    try {
      const sessionRepo = new PgSessionRepository(pool);
      const tx = { id: 'tx1' };

      const unknownId = randomUUID() as SessionId;
      // Should not throw
      await sessionRepo.revoke(unknownId, new Date(), tx);

      const retrieved = await sessionRepo.get(unknownId);
      assert.equal(retrieved, null);
    } finally {
      await closeDb(pool);
    }
  });
});
