import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass, ToolType, PLACEABLE_TOOL_TYPES } from '../domain/enums.js';
import type { PlayerId, PageId } from '../domain/ids.js';
import type { Player } from '../domain/player.js';
import type { Pool } from 'pg';
import type { Page } from '../domain/geography.js';
import type { PlacementSpec } from '../domain/placement.js';
import type { DomainId } from '../domain/ids.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { PlacementModule } from './placement.js';
import { ProgressionModule } from './progression.js';
import { PgPlayerRepository } from '../repositories/PgPlayerRepository.js';
import { PgPageRepository } from '../repositories/PgPageRepository.js';
import { PgClassProgressRepository } from '../repositories/PgClassProgressRepository.js';
import { PgInventoryRepository } from '../repositories/PgInventoryRepository.js';
import { PgLedgerRepository } from '../repositories/PgLedgerRepository.js';
import { PgPlacementRepository } from '../repositories/PgPlacementRepository.js';
import { PgPlacementInteractionRepository } from '../repositories/PgPlacementInteractionRepository.js';
import { PgBarrelContentRepository } from '../repositories/PgBarrelContentRepository.js';
import { PgAdvisoryLock } from '../repositories/PgAdvisoryLock.js';
import { Consumption } from '../repositories/Consumption.js';
import { PgUnitOfWork } from '../repositories/PgUnitOfWork.js';
import { AbilityLocked, PagePlacementCapReached, NegativeInventory } from '../domain/errors.js';
import { PgDomainRepository } from '../repositories/PgDomainRepository.js';

function makePage(id: PageId, domainId: DomainId): Page {
  return {
    id,
    urlHash: `hash-${id}`,
    domainId,
    normalisationVersion: 1,
    firstSeenAt: new Date()
  };
}

function makePlayer(id: PlayerId, activeClass: PlayerClass = PlayerClass.Giver): Player {
  return {
    id,
    name: `player-${id}`,
    credentialHash: 'hash',
    email: 'test@example.com',
    activeClass,
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

describe('PlacementModule.place', { skip: DB_SKIP }, () => {
  it('places a trap and creates base + subtype rows', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placement = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 5,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      // Set inventory to have 10 traps
      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      const result = await placement.place(player, page, spec);

      assert.equal(result.toolType, ToolType.Trap);
      assert.equal(result.placerId, playerId);
      assert.equal(result.pageId, pageId);
      assert.equal(result.placerClass, PlayerClass.Giver);
      assert.equal(result.placerLevel, 5);
      assert.equal(result.consumedAt, null);
      assert.equal(result.consumptionCause, null);

      // Verify it was saved to the database
      const retrieved = await placementRepo.get(result.id);
      assert.ok(retrieved);
      assert.equal(retrieved.id, result.id);
    } finally {
      await closeDb(pool);
    }
  });

  it('places a spider with wandering variant', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId, PlayerClass.Guardian);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 15,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Spider, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Spider,
        spiderVariant: 'wandering'
      };

      const result = await placeModule.place(player, page, spec);

      // Narrow through the discriminated union rather than casting: `toolType` is the
      // discriminant, so this checks the shape instead of switching off checking.
      assert.equal(result.toolType, ToolType.Spider);
      if (result.toolType !== ToolType.Spider) {
        throw new Error('expected a spider placement');
      }
      assert.equal(result.variant, 'wandering');
      assert.equal(result.lastMovedAt, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('decrements inventory by exactly one', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 5,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      const beforeInventory = await inventoryRepo.get(playerId);
      const beforeCount = beforeInventory.counts.get(ToolType.Trap) || 0;

      await placeModule.place(player, page, spec);

      const afterInventory = await inventoryRepo.get(playerId);
      const afterCount = afterInventory.counts.get(ToolType.Trap) || 0;

      assert.equal(beforeCount - afterCount, 1);
    } finally {
      await closeDb(pool);
    }
  });

  it('D17: placer level is snapshotted and not re-read after player levels up', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      // Place trap at level 1
      const placedTrap = await placeModule.place(player, page, spec);
      assert.equal(placedTrap.placerLevel, 1);

      // Raise player level to 5
      const progress = await progressRepo.get(playerId, PlayerClass.Giver);
      assert.ok(progress);
      progress.level = 5;
      await progressRepo.save(progress, tx);

      // Re-read the placement and verify level is still 1
      const retrieved = await placementRepo.get(placedTrap.id);
      assert.ok(retrieved);
      assert.equal(retrieved.placerLevel, 1);
      assert.equal(retrieved.placerClass, PlayerClass.Giver);
    } finally {
      await closeDb(pool);
    }
  });

  it('writes XP ledger entry with placement reference', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      const placed = await placeModule.place(player, page, spec);

      const ledger = await ledgerRepo.listForPlayer(playerId, 100);
      const xpEntry = ledger.find(e => e.resourceKind === 'xp' && e.cause === 'placement_reward');
      assert.ok(xpEntry);
      assert.equal(xpEntry.placementId, placed.id);
    } finally {
      await closeDb(pool);
    }
  });

  it('atomicity: inventory not decremented if placement fails at cap', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      // Fill up the cap
      const cap = balance.pagePlacementCap();
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placed_at, placer_class_id, placer_level, consumed_at, consumption_cause_id)
         SELECT gen_random_uuid(), $1, $2, $3, now(), $4, 1, NULL, NULL
         FROM generate_series(1, $5)`,
        [ToolType.Trap, playerId, pageId, PlayerClass.Giver, cap]
      );

      const beforeInventory = await inventoryRepo.get(playerId);
      const beforeCount = beforeInventory.counts.get(ToolType.Trap) || 0;

      try {
        await placeModule.place(player, page, spec);
        assert.fail('Should have thrown PagePlacementCapReached');
      } catch (e) {
        assert.ok(e instanceof PagePlacementCapReached);
      }

      const afterInventory = await inventoryRepo.get(playerId);
      const afterCount = afterInventory.counts.get(ToolType.Trap) || 0;

      // Inventory should be unchanged because the transaction rolled back
      assert.equal(beforeCount, afterCount);
    } finally {
      await closeDb(pool);
    }
  });

  it('insufficient inventory throws NegativeInventory', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      // Don't add inventory

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      try {
        await placeModule.place(player, page, spec);
        assert.fail('Should have thrown NegativeInventory');
      } catch (e) {
        assert.ok(e instanceof NegativeInventory);
      }

      // Verify no placement was created
      const placements = await placementRepo.list(pageId, { liveOnly: true, excludeNsfw: false });
      assert.equal(placements.length, 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('anonymous trap gate: level-1 giver throws AbilityLocked, level-10 succeeds', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      const tx = { id: 'tx1' };
      await domainRepo.save(domain, tx);

      const pageId = randomUUID() as PageId;
      const page = makePage(pageId, domainId);
      await pageRepo.save(page, tx);

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: true
      };

      // Test level 1 - should fail
      {
        const playerId = randomUUID() as PlayerId;
        const player = makePlayer(playerId);
        await playerRepo.save(player, tx);
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Giver,
            level: 1,
            experience: 0
          },
          tx
        );
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Guardian,
            level: 1,
            experience: 0
          },
          tx
        );
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Guide,
            level: 1,
            experience: 0
          },
          tx
        );
        await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

        try {
          await placeModule.place(player, page, spec);
          assert.fail('Should have thrown AbilityLocked');
        } catch (e) {
          assert.ok(e instanceof AbilityLocked);
        }
      }

      // Test level 10 - should succeed
      {
        const playerId = randomUUID() as PlayerId;
        const player = makePlayer(playerId);
        await playerRepo.save(player, tx);
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Giver,
            level: 10,
            experience: 0
          },
          tx
        );
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Guardian,
            level: 1,
            experience: 0
          },
          tx
        );
        await progressRepo.save(
          {
            playerId,
            playerClass: PlayerClass.Guide,
            level: 1,
            experience: 0
          },
          tx
        );
        await inventoryRepo.adjust(playerId, ToolType.Trap, 10, tx);

        const result = await placeModule.place(player, page, spec);
        assert.ok(result);
        assert.equal(result.toolType, ToolType.Trap);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('D16 cap: with cap reached, another placement throws, different tool/page succeed', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      const ledgerRepo = new PgLedgerRepository(pool);
      const placementRepo = new PgPlacementRepository(pool);
      const interactionRepo = new PgPlacementInteractionRepository(pool);
      const contentRepo = new PgBarrelContentRepository(pool);
      const advisoryLock = new PgAdvisoryLock(pool);
      const unitOfWork = new PgUnitOfWork(pool);
      const balance = new StaticBalanceTable(SEED_BALANCE);
      const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
      const consumption = new Consumption(placementRepo, inventoryRepo);
      const placeModule = new PlacementModule(
        placementRepo,
        interactionRepo,
        contentRepo,
        inventoryRepo,
        consumption,
        progression,
        balance,
        unitOfWork,
        progressRepo,
        advisoryLock
      );

      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId);
      const tx = { id: 'tx1' };

      await playerRepo.save(player, tx);
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Giver,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guardian,
          level: 1,
          experience: 0
        },
        tx
      );
      await progressRepo.save(
        {
          playerId,
          playerClass: PlayerClass.Guide,
          level: 1,
          experience: 0
        },
        tx
      );

      await inventoryRepo.adjust(playerId, ToolType.Trap, 200, tx);
      await inventoryRepo.adjust(playerId, ToolType.Spider, 200, tx);

      const domainId = randomUUID() as DomainId;
      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await domainRepo.save(domain, tx);

      const pageId1 = randomUUID() as PageId;
      const page1 = makePage(pageId1, domainId);
      await pageRepo.save(page1, tx);

      const pageId2 = randomUUID() as PageId;
      const page2 = makePage(pageId2, domainId);
      await pageRepo.save(page2, tx);

      // Reach cap on page1 with traps
      const cap = balance.pagePlacementCap();
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placed_at, placer_class_id, placer_level, consumed_at, consumption_cause_id)
         SELECT gen_random_uuid(), $1, $2, $3, now(), $4, 1, NULL, NULL
         FROM generate_series(1, $5)`,
        [ToolType.Trap, playerId, pageId1, PlayerClass.Giver, cap]
      );

      const spec: PlacementSpec = {
        toolType: ToolType.Trap,
        isAnonymous: false
      };

      // Same tool, same page should fail
      try {
        await placeModule.place(player, page1, spec);
        assert.fail('Should have thrown PagePlacementCapReached');
      } catch (e) {
        assert.ok(e instanceof PagePlacementCapReached);
      }

      // Different tool, same page should succeed
      const spec2: PlacementSpec = {
        toolType: ToolType.Spider,
        spiderVariant: 'standard'
      };
      const result2 = await placeModule.place(player, page1, spec2);
      assert.ok(result2);
      assert.equal(result2.toolType, ToolType.Spider);

      // Same tool, different page should succeed
      const result3 = await placeModule.place(player, page2, spec);
      assert.ok(result3);
      assert.equal(result3.toolType, ToolType.Trap);
    } finally {
      await closeDb(pool);
    }
  });
});

interface Harness {
  placement: PlacementModule;
  inventoryRepo: PgInventoryRepository;
  placementRepo: PgPlacementRepository;
  progressRepo: PgClassProgressRepository;
  balance: StaticBalanceTable;
  player: Player;
  page: Page;
}

// The tests above each rebuild this by hand. Added in cycle 9 so the cases below could be
// written without a fourth copy of forty lines of wiring.
async function harness(
  pool: Pool,
  activeClass: PlayerClass = PlayerClass.Giver,
  level = 20
): Promise<Harness> {
  const domainRepo = new PgDomainRepository(pool);
  const pageRepo = new PgPageRepository(pool);
  const playerRepo = new PgPlayerRepository(pool);
  const progressRepo = new PgClassProgressRepository(pool);
  const inventoryRepo = new PgInventoryRepository(pool);
  const ledgerRepo = new PgLedgerRepository(pool);
  const placementRepo = new PgPlacementRepository(pool);
  const interactionRepo = new PgPlacementInteractionRepository(pool);
  const contentRepo = new PgBarrelContentRepository(pool);
  const advisoryLock = new PgAdvisoryLock(pool);
  const unitOfWork = new PgUnitOfWork(pool);
  const balance = new StaticBalanceTable(SEED_BALANCE);
  const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
  const consumption = new Consumption(placementRepo, inventoryRepo);
  const placement = new PlacementModule(
    placementRepo, interactionRepo, contentRepo, inventoryRepo, consumption,
    progression, balance, unitOfWork, progressRepo, advisoryLock
  );

  const playerId = randomUUID() as PlayerId;
  const player = makePlayer(playerId, activeClass);
  const tx = { id: 'harness' };
  await playerRepo.save(player, tx);
  for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
    await progressRepo.save({ playerId, playerClass: cls, level, experience: 0 }, tx);
  }
  for (const seedTool of PLACEABLE_TOOL_TYPES) {
    await inventoryRepo.adjust(playerId, seedTool, 200, tx);
  }

  const domainId = randomUUID() as DomainId;
  await domainRepo.save(
    {
      id: domainId,
      domainHash: `domain-${domainId}`,
      normalisationVersion: 1,
      uri: null,
      hitCount: 0,
      firstSeenAt: new Date()
    },
    tx
  );
  const pageId = randomUUID() as PageId;
  const page = makePage(pageId, domainId);
  await pageRepo.save(page, tx);

  return { placement, inventoryRepo, placementRepo, progressRepo, balance, player, page };
}

describe('PlacementModule.place — cycle 9 additions', { skip: DB_SKIP }, () => {
  it('places a doorway and a signpost, each into its own subtype table', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guide);

      const doorway = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'https://example.com/there',
        isNsfw: false
      });
      const signpost = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Signpost,
        destinationUrl: 'https://example.com/that-way',
        isNsfw: false
      });

      assert.equal(doorway.toolType, ToolType.Doorway);
      assert.equal(signpost.toolType, ToolType.Signpost);

      const back = await h.placementRepo.get(doorway.id);
      assert.ok(back);
      assert.equal(back.toolType, ToolType.Doorway);

      const rows = await pool.query(
        'SELECT count(*)::int c FROM doorway_placement WHERE id = $1',
        [doorway.id]
      );
      assert.equal(rows.rows[0].c, 1);
    } finally {
      await closeDb(pool);
    }
  });

  it('karma moves by one only when the tool class matches the active class', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const owning = h.balance.owningClassOf(ToolType.Trap);
      assert.equal(owning, PlayerClass.Giver, 'trap should be a giver tool');

      const before = (
        await pool.query('SELECT karma FROM player WHERE id = $1', [h.player.id])
      ).rows[0].karma;

      // Trap is the active class's tool: karma moves by exactly one.
      await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      const afterOwn = (
        await pool.query('SELECT karma FROM player WHERE id = $1', [h.player.id])
      ).rows[0].karma;
      assert.equal(Math.abs(afterOwn - before), 1);

      // Spider is a guardian tool placed by a giver: karma must not move at all.
      await h.placement.place(h.player, h.page, { toolType: ToolType.Spider });
      const afterOther = (
        await pool.query('SELECT karma FROM player WHERE id = $1', [h.player.id])
      ).rows[0].karma;
      assert.equal(afterOther, afterOwn);
    } finally {
      await closeDb(pool);
    }
  });

  it('concurrent placements never exceed the D16 cap', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const cap = h.balance.pagePlacementCap();

      // Fill to one below the cap directly, so two concurrent placements race for the
      // last slot.
      //
      // This asserts the invariant, not the mechanism. Verified by mutation in cycle 9:
      // disabling the advisory lock alone leaves this test GREEN — what actually refuses
      // the second placement is cycle 5's enforce_page_placement_cap trigger, helped by
      // the row lock both transactions take on the same player_inventory row. Disable the
      // trigger as well and this test fails. The advisory lock (CHARTER A4) is therefore
      // defence in depth here, and no test currently distinguishes it.
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT gen_random_uuid(), $1, $2, $3, $4, $5 FROM generate_series(1, $6)`,
        [ToolType.Trap, h.player.id, h.page.id, PlayerClass.Giver, 1, cap - 1]
      );

      const results = await Promise.allSettled([
        h.placement.place(h.player, h.page, { toolType: ToolType.Trap }),
        h.placement.place(h.player, h.page, { toolType: ToolType.Trap })
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;
      assert.equal(fulfilled, 1, 'exactly one placement should win the last slot');
      assert.equal(rejected, 1, 'exactly one placement should be refused');

      const live = await pool.query(
        `SELECT count(*)::int c FROM placement
         WHERE page_id = $1 AND placer_id = $2 AND tool_type_id = $3 AND consumed_at IS NULL`,
        [h.page.id, h.player.id, ToolType.Trap]
      );
      assert.equal(live.rows[0].c, cap, 'live count must never exceed the cap');
    } finally {
      await closeDb(pool);
    }
  });
});
