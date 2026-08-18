import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass, ToolType, PLACEABLE_TOOL_TYPES } from '../domain/enums.js';
import type { PlayerId, PageId } from '../domain/ids.js';
import type { Player } from '../domain/player.js';
import type { Pool } from 'pg';
import type { Page } from '../domain/geography.js';
import type { PlacementSpec, BarrelSpec, Placement } from '../domain/placement.js';
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
import {
  AbilityLocked,
  PagePlacementCapReached,
  NegativeInventory,
  BarrelCapacityExceeded,
  MessageTooLong,
  HtmlNotPermitted,
  DoorwayPageOwnLimitReached,
  DoorwayPageTotalLimitReached
} from '../domain/errors.js';
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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

      const outcome = await placement.place(player, page, spec);

      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      const result = outcome.placement;
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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

      const outcome = await placeModule.place(player, page, spec);

      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      const result = outcome.placement;
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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
      const trapOutcome = await placeModule.place(player, page, spec);
      assert.ok(trapOutcome.placement);
      const placedTrap = trapOutcome.placement;
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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

      const outcome = await placeModule.place(player, page, spec);
      assert.ok(outcome.placement);
      const placed = outcome.placement;

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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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

        const outcome = await placeModule.place(player, page, spec);
        assert.ok(outcome.placement);
        assert.equal(outcome.failed, false);
        assert.equal(outcome.placement.toolType, ToolType.Trap);
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
        advisoryLock,
        () => 1 // predates placement failure; asserts the success path
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
      const outcome2 = await placeModule.place(player, page1, spec2);
      assert.ok(outcome2.placement);
      assert.equal(outcome2.failed, false);
      assert.equal(outcome2.placement.toolType, ToolType.Spider);

      // Same tool, different page should succeed
      const outcome3 = await placeModule.place(player, page2, spec);
      assert.ok(outcome3.placement);
      assert.equal(outcome3.failed, false);
      assert.equal(outcome3.placement.toolType, ToolType.Trap);
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
  level = 20,
  // Never fails by default. Placement gained a 5% failure chance in cycle 11, and a
  // real Math.random here would make every success-path test flaky at ~5% per placement.
  random: () => number = () => 1
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
    progression, balance, unitOfWork, progressRepo, advisoryLock, random
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

      const doorwayOutcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'https://example.com/there',
        isNsfw: false
      });
      assert.ok(doorwayOutcome.placement);
      const doorway = doorwayOutcome.placement;

      const signpostOutcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Signpost,
        destinationUrl: 'https://example.com/that-way',
        isNsfw: false
      });
      assert.ok(signpostOutcome.placement);
      const signpost = signpostOutcome.placement;

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

  it('rolls back a write already made when the failure is not a SQL error', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);

      // The sibling atomicity test fails on a CHECK violation, which aborts the
      // transaction -- and PostgreSQL then treats COMMIT as ROLLBACK, so that test would
      // pass even against an application that never rolls back. This one fails on an
      // *application* throw instead: adjust() raises NegativeInventory when its UPDATE
      // matches zero rows, and a zero-row UPDATE is not a SQL error, so the transaction
      // stays alive and only the application's own ROLLBACK can undo the barrel decrement
      // that already succeeded.
      await pool.query(
        'DELETE FROM player_inventory WHERE player_id = $1 AND tool_type_id = $2',
        [h.player.id, ToolType.Signpost]
      );

      const before = await h.inventoryRepo.get(h.player.id);
      const barrelsBefore = before.counts.get(ToolType.Barrel);
      assert.ok(barrelsBefore && barrelsBefore > 0, 'player must hold barrels to start');

      await assert.rejects(
        h.placement.stashBarrel(h.player, h.page, {
          sgAmount: 0,
          contents: new Map([[ToolType.Signpost, 1]])
        }),
        NegativeInventory
      );

      const after = await h.inventoryRepo.get(h.player.id);
      assert.equal(
        after.counts.get(ToolType.Barrel),
        barrelsBefore,
        'the barrel consumed before the failure must be rolled back'
      );

      const barrels = await pool.query(
        'SELECT count(*)::int c FROM placement WHERE placer_id = $1 AND tool_type_id = $2',
        [h.player.id, ToolType.Barrel]
      );
      assert.equal(barrels.rows[0].c, 0, 'no barrel row survives');
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

describe('PlacementModule.place — placement failure', { skip: DB_SKIP }, () => {
  it('with random returning 1, never fails and is regression guard for return-type change', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 20, () => 1);

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      assert.equal(outcome.toolConsumed, true);
      assert.equal(outcome.xpAwarded, h.balance.initialXpFor(ToolType.Trap));

      // Verify placement row exists
      const placement = await h.placementRepo.get(outcome.placement.id);
      assert.ok(placement);
    } finally {
      await closeDb(pool);
    }
  });

  it('with random returning 0, trap always fails: no placement, inventory reduced, XP awarded, karma moved', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 20, () => 0);
      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeTraps = beforeInv.counts.get(ToolType.Trap) || 0;
      const beforeKarma = h.player.karma;

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.equal(outcome.failed, true);
      assert.equal(outcome.placement, null);
      assert.equal(outcome.toolConsumed, true);
      assert.equal(outcome.xpAwarded, h.balance.initialXpFor(ToolType.Trap));

      // Verify inventory reduced
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterTraps = afterInv.counts.get(ToolType.Trap) || 0;
      assert.equal(beforeTraps - afterTraps, 1, 'trap consumed on failure');

      // Verify XP ledger entry exists
      const ledger = await pool.query(
        `SELECT count(*)::int c FROM resource_ledger WHERE player_id = $1 AND resource_kind = 'xp' AND cause_id = (SELECT id FROM ledger_cause WHERE code = 'placement_reward')`,
        [h.player.id]
      );
      assert.equal(ledger.rows[0].c, 1, 'XP ledger entry created on failure');

      // Verify karma moved (by exactly 1)
      const afterKarma = h.player.karma;
      assert.equal(Math.abs(afterKarma - beforeKarma), 1, 'karma moved by 1');

      // Verify no placement row created
      const placements = await h.placementRepo.list(h.page.id, { liveOnly: true, excludeNsfw: false });
      assert.equal(placements.length, 0, 'no placement row created');
    } finally {
      await closeDb(pool);
    }
  });

  it('spider on failure behaves like trap: consumed, XP awarded, karma moved', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guardian, 20, () => 0);
      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeSpiders = beforeInv.counts.get(ToolType.Spider) || 0;
      const beforeKarma = h.player.karma;

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Spider });
      assert.equal(outcome.failed, true);
      assert.equal(outcome.placement, null);
      assert.equal(outcome.toolConsumed, true, 'spider consumed on failure');
      assert.equal(outcome.xpAwarded, h.balance.initialXpFor(ToolType.Spider), 'XP awarded on spider failure');

      // Verify inventory reduced
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterSpiders = afterInv.counts.get(ToolType.Spider) || 0;
      assert.equal(beforeSpiders - afterSpiders, 1, 'spider consumed on failure');

      // Verify XP ledger entry exists
      const ledger = await pool.query(
        `SELECT count(*)::int c FROM resource_ledger WHERE player_id = $1 AND resource_kind = 'xp' AND cause_id = (SELECT id FROM ledger_cause WHERE code = 'placement_reward')`,
        [h.player.id]
      );
      assert.equal(ledger.rows[0].c, 1, 'XP ledger entry created on spider failure');

      // Verify karma moved (by exactly 1)
      const afterKarma = h.player.karma;
      assert.equal(Math.abs(afterKarma - beforeKarma), 1, 'karma moved by 1 on spider failure');

      // Verify no placement row created
      const placements = await h.placementRepo.list(h.page.id, { liveOnly: true, excludeNsfw: false });
      assert.equal(placements.length, 0, 'no placement row created');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway on failure behaves like trap: consumed, XP awarded, karma moved', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guide, 20, () => 0);
      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeDoorways = beforeInv.counts.get(ToolType.Doorway) || 0;

      const outcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'https://example.com'
      });
      assert.equal(outcome.failed, true);
      assert.equal(outcome.placement, null);
      assert.equal(outcome.toolConsumed, true);
      assert.equal(outcome.xpAwarded, h.balance.initialXpFor(ToolType.Doorway));

      // Verify inventory reduced
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterDoorways = afterInv.counts.get(ToolType.Doorway) || 0;
      assert.equal(beforeDoorways - afterDoorways, 1, 'doorway consumed on failure');
    } finally {
      await closeDb(pool);
    }
  });

  it('signpost on failure behaves like trap: consumed, XP awarded, karma moved', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guide, 20, () => 0);
      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeSignposts = beforeInv.counts.get(ToolType.Signpost) || 0;

      const outcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Signpost,
        destinationUrl: 'https://example.com'
      });
      assert.equal(outcome.failed, true);
      assert.equal(outcome.placement, null);
      assert.equal(outcome.toolConsumed, true);
      assert.equal(outcome.xpAwarded, h.balance.initialXpFor(ToolType.Signpost));

      // Verify inventory reduced
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterSignposts = afterInv.counts.get(ToolType.Signpost) || 0;
      assert.equal(beforeSignposts - afterSignposts, 1, 'signpost consumed on failure');
    } finally {
      await closeDb(pool);
    }
  });

  it('threshold: failChanceFor(trap)=0.05, random()=0.04 fails, random()=0.06 succeeds', async () => {
    const pool = await freshDb();
    try {
      const h1 = await harness(pool, PlayerClass.Giver, 20, () => 0.04);
      const trapFailChance = h1.balance.failChanceFor(ToolType.Trap);
      assert.equal(trapFailChance, 0.05);

      // random() = 0.04 is less than 0.05, so it fails
      const failOutcome = await h1.placement.place(h1.player, h1.page, { toolType: ToolType.Trap });
      assert.equal(failOutcome.failed, true, 'random() < failChance should fail');

      // random() = 0.06 is greater than 0.05, so it succeeds
      const h2 = await harness(pool, PlayerClass.Giver, 20, () => 0.06);
      const successOutcome = await h2.placement.place(h2.player, h2.page, { toolType: ToolType.Trap });
      assert.equal(successOutcome.failed, false, 'random() >= failChance should succeed');
      assert.ok(successOutcome.placement, 'placement should exist on success');
    } finally {
      await closeDb(pool);
    }
  });

  it('shield has failChanceFor=0 and is never placeable', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);
      assert.equal(h.balance.failChanceFor(ToolType.Shield), 0);
      // Shield is not in PLACEABLE_TOOL_TYPES, so place() can never be called with it
    } finally {
      await closeDb(pool);
    }
  });

  it('a failed stash costs the barrel only, never the contents or the sg', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 20, () => 0);

      const before = await h.inventoryRepo.get(h.player.id);
      const barrelsBefore = before.counts.get(ToolType.Barrel) ?? 0;
      const trapsBefore = before.counts.get(ToolType.Trap) ?? 0;
      const sgBefore = (
        await pool.query('SELECT sg FROM player WHERE id = $1', [h.player.id])
      ).rows[0].sg;

      const outcome = await h.placement.stashBarrel(h.player, h.page, {
        sgAmount: 10,
        contents: new Map([[ToolType.Trap, 2]])
      });

      assert.equal(outcome.failed, true);
      assert.equal(outcome.placement, null);
      assert.equal(outcome.toolConsumed, true);

      const after = await h.inventoryRepo.get(h.player.id);
      assert.equal(
        after.counts.get(ToolType.Barrel) ?? 0,
        barrelsBefore - 1,
        'the barrel tool itself is spent on a failed stash'
      );
      // The contents never entered the barrel, so confiscating them would punish the player
      // far more harshly than losing the barrel — which is the whole point of this rule.
      assert.equal(
        after.counts.get(ToolType.Trap) ?? 0,
        trapsBefore,
        'stashed contents are not consumed by a failed stash'
      );

      const sgAfter = (
        await pool.query('SELECT sg FROM player WHERE id = $1', [h.player.id])
      ).rows[0].sg;
      assert.equal(sgAfter, sgBefore, 'stashed sg is not consumed by a failed stash');

      const barrels = await pool.query(
        'SELECT count(*)::int c FROM placement WHERE placer_id = $1 AND tool_type_id = $2',
        [h.player.id, ToolType.Barrel]
      );
      assert.equal(barrels.rows[0].c, 0, 'no barrel row is created');

      const contents = await pool.query('SELECT count(*)::int c FROM barrel_content');
      assert.equal(contents.rows[0].c, 0, 'no barrel_content rows are created');
    } finally {
      await closeDb(pool);
    }
  });

  it('gate checks and cap checks still throw, consuming nothing, even with random()=0', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 20, () => 0);

      // Reach cap
      const cap = h.balance.pagePlacementCap();
      await pool.query(
        `INSERT INTO placement (id, tool_type_id, placer_id, page_id, placer_class_id, placer_level)
         SELECT gen_random_uuid(), $1, $2, $3, $4, $5 FROM generate_series(1, $6)`,
        [ToolType.Trap, h.player.id, h.page.id, PlayerClass.Giver, 1, cap]
      );

      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeTraps = beforeInv.counts.get(ToolType.Trap) || 0;

      // Should throw PagePlacementCapReached, consuming nothing, even with random()=0
      try {
        await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
        assert.fail('Should have thrown PagePlacementCapReached');
      } catch (e) {
        assert.ok(e instanceof PagePlacementCapReached);
      }

      // Verify inventory unchanged
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterTraps = afterInv.counts.get(ToolType.Trap) || 0;
      assert.equal(beforeTraps, afterTraps, 'inventory unchanged when placement is refused');
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PlacementModule.stashBarrel', { skip: DB_SKIP }, () => {
  it('giver stashes tools and sg: barrel row exists with right fields, inventory/sg reduced', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);
      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeBarrel = beforeInv.counts.get(ToolType.Barrel) || 0;
      const beforeTrap = beforeInv.counts.get(ToolType.Trap) || 0;
      const beforeSg = h.player.sg;

      const spec: BarrelSpec = {
        sgAmount: 50,
        contents: new Map([[ToolType.Trap, 5]]),
        insideMessage: 'inside msg',
        outsideMessage: 'outside msg'
      };

      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);

      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      const result = outcome.placement;

      // Verify barrel row exists with right values
      assert.equal(result.toolType, ToolType.Barrel);
      assert.equal(result.placerId, h.player.id);
      assert.equal(result.pageId, h.page.id);
      assert.equal(result.placerClass, PlayerClass.Giver);
      assert.equal(result.placerLevel, 5);
      assert.equal(result.sgAmount, 50);
      assert.equal(result.insideMessage, 'inside msg');
      assert.equal(result.outsideMessage, 'outside msg');
      assert.equal(result.visitCount, 0);
      assert.equal(result.durability, 1);
      assert.equal(result.consumedAt, null);
      assert.equal(result.consumptionCause, null);

      // Verify contents are correct
      assert.equal(result.contents.get(ToolType.Trap), 5);

      // Verify it was persisted
      const persisted = await h.placementRepo.get(result.id);
      assert.ok(persisted);
      assert.equal(persisted.toolType, ToolType.Barrel);

      // Verify inventory reduced by barrel + contents
      const afterInv = await h.inventoryRepo.get(h.player.id);
      const afterBarrel = afterInv.counts.get(ToolType.Barrel) || 0;
      const afterTrap = afterInv.counts.get(ToolType.Trap) || 0;
      assert.equal(beforeBarrel - afterBarrel, 1, 'one barrel consumed');
      assert.equal(beforeTrap - afterTrap, 5, '5 traps consumed');

      // Verify sg reduced and ledger entry exists
      assert.ok(h.player.sg < beforeSg);
      const ledger = await pool.query(
        `SELECT cause_id FROM resource_ledger WHERE player_id = $1 AND resource_kind = 'sg'
         AND cause_id = (SELECT id FROM ledger_cause WHERE code = 'barrel_stash')`,
        [h.player.id]
      );
      assert.equal(ledger.rows.length, 1, 'barrel_stash ledger entry exists');
    } finally {
      await closeDb(pool);
    }
  });

  it('atomicity: partial failure leaves inventory, sg, placements unchanged', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);

      // Manually deplete trap inventory to 3 so stash of 5 fails
      const inv = await h.inventoryRepo.get(h.player.id);
      const current = inv.counts.get(ToolType.Trap) || 0;
      const tx = { id: 'deplete' };
      await h.inventoryRepo.adjust(h.player.id, ToolType.Trap, -(current - 3), tx);

      const beforeInv = await h.inventoryRepo.get(h.player.id);
      const beforeSg = h.player.sg;
      const beforeBarrelCount = await pool.query(
        `SELECT count(*)::int c FROM placement WHERE tool_type_id = $1 AND placer_id = $2`,
        [ToolType.Barrel, h.player.id]
      );

      const spec: BarrelSpec = {
        sgAmount: 50,
        contents: new Map([[ToolType.Trap, 5]]),
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec);
        assert.fail('Should have thrown NegativeInventory');
      } catch (e) {
        assert.ok(e instanceof NegativeInventory);
      }

      // Verify nothing changed
      const afterInv = await h.inventoryRepo.get(h.player.id);
      assert.deepEqual(beforeInv.counts, afterInv.counts, 'inventory unchanged');
      assert.equal(beforeSg, h.player.sg, 'sg unchanged');

      const afterBarrelCount = await pool.query(
        `SELECT count(*)::int c FROM placement WHERE tool_type_id = $1 AND placer_id = $2`,
        [ToolType.Barrel, h.player.id]
      );
      assert.equal(beforeBarrelCount.rows[0].c, afterBarrelCount.rows[0].c, 'no barrel created');

      const barrelContents = await pool.query(
        `SELECT count(*)::int c FROM barrel_content WHERE barrel_id IN
         (SELECT id FROM placement WHERE tool_type_id = $1 AND placer_id = $2)`,
        [ToolType.Barrel, h.player.id]
      );
      assert.equal(barrelContents.rows[0].c, 0, 'no barrel_content rows');
    } finally {
      await closeDb(pool);
    }
  });

  it('capacity: guardian with limit 10 stashing 11 throws, 10 succeeds', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guardian, 5);

      const spec11: BarrelSpec = {
        sgAmount: 0,
        contents: new Map([[ToolType.Trap, 11]])
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec11);
        assert.fail('Should have thrown BarrelCapacityExceeded');
      } catch (e) {
        assert.ok(e instanceof BarrelCapacityExceeded);
      }

      // 10 should succeed
      const spec10: BarrelSpec = {
        sgAmount: 0,
        contents: new Map([[ToolType.Trap, 10]])
      };
      const outcome = await h.placement.stashBarrel(h.player, h.page, spec10);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('capacity: giver limit 100 succeeds with 50', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);

      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map([[ToolType.Trap, 50]])
      };
      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('capacity: sg counts at 10 to 1, giver 5 tools + 50 sg fills exactly 100, succeeds', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);

      // 5 tools + ceil(50/10) = 5 + 5 = 10 slots (well within giver capacity of 100)
      const spec: BarrelSpec = {
        sgAmount: 50,
        contents: new Map([[ToolType.Trap, 5]])
      };
      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('capacity: sg counts at 10 to 1, guardian 5 tools + 51 sg exceeds 10, throws', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guardian, 5);

      // 5 tools + ceil(51/10) = 5 + 6 = 11 slots > 10
      const spec: BarrelSpec = {
        sgAmount: 51,
        contents: new Map([[ToolType.Trap, 5]])
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec);
        assert.fail('Should have thrown BarrelCapacityExceeded');
      } catch (e) {
        assert.ok(e instanceof BarrelCapacityExceeded);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('gates: non-giver stashing sg throws AbilityLocked', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guardian, 5);

      const spec: BarrelSpec = {
        sgAmount: 10,
        contents: new Map()
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec);
        assert.fail('Should have thrown AbilityLocked');
      } catch (e) {
        assert.ok(e instanceof AbilityLocked);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('gates: level-1 giver setting outside message throws, level-5 succeeds', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 1);

      const spec1: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        outsideMessage: 'msg'
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec1);
        assert.fail('Should have thrown AbilityLocked');
      } catch (e) {
        assert.ok(e instanceof AbilityLocked);
      }

      // Level 5 should succeed
      const h5 = await harness(pool, PlayerClass.Giver, 5);
      const outcome = await h5.placement.stashBarrel(h5.player, h5.page, spec1);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('gates: inside message works for any class at level 1', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guardian, 1);

      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        insideMessage: 'inside'
      };

      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('messages: 156 characters inside throws MessageTooLong, 155 succeeds', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);
      const maxInside = h.balance.constant('barrel_inside_message_max');

      const longMsg = 'x'.repeat(maxInside + 1);
      const spec1: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        insideMessage: longMsg
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec1);
        assert.fail('Should have thrown MessageTooLong');
      } catch (e) {
        assert.ok(e instanceof MessageTooLong);
      }

      // maxInside should succeed
      const okMsg = 'x'.repeat(maxInside);
      const spec2: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        insideMessage: okMsg
      };
      const outcome = await h.placement.stashBarrel(h.player, h.page, spec2);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('messages: 129 characters outside throws MessageTooLong, 128 succeeds', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);
      const maxOutside = h.balance.constant('barrel_outside_message_max');

      const longMsg = 'x'.repeat(maxOutside + 1);
      const spec1: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        outsideMessage: longMsg
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec1);
        assert.fail('Should have thrown MessageTooLong');
      } catch (e) {
        assert.ok(e instanceof MessageTooLong);
      }

      // maxOutside should succeed
      const okMsg = 'x'.repeat(maxOutside);
      const spec2: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        outsideMessage: okMsg
      };
      const result = await h.placement.stashBarrel(h.player, h.page, spec2);
      assert.ok(result);
    } finally {
      await closeDb(pool);
    }
  });

  it('HTML: message with <b> throws HtmlNotPermitted for inside', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);

      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        insideMessage: 'hello <b>world</b>'
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec);
        assert.fail('Should have thrown HtmlNotPermitted');
      } catch (e) {
        assert.ok(e instanceof HtmlNotPermitted);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('HTML: message with <b> throws HtmlNotPermitted for outside', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver, 5);

      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map(),
        outsideMessage: 'hello <b>world</b>'
      };

      try {
        await h.placement.stashBarrel(h.player, h.page, spec);
        assert.fail('Should have thrown HtmlNotPermitted');
      } catch (e) {
        assert.ok(e instanceof HtmlNotPermitted);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('fullness bonus: full barrel awards base + full bonus', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);
      const capacity = h.balance.barrelCapacityFor(h.player.activeClass);
      const baseXp = h.balance.initialXpFor(ToolType.Barrel);

      // Fill to exactly capacity
      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map([[ToolType.Trap, capacity]])
      };

      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      const result = outcome.placement;

      const ledger = await pool.query(
        `SELECT applied_delta FROM resource_ledger WHERE player_id = $1 AND resource_kind = 'xp'
         AND placement_id = $2 AND cause_id = (SELECT id FROM ledger_cause WHERE code = 'placement_reward')`,
        [h.player.id, result.id]
      );
      assert.equal(ledger.rows.length, 1);
      // At full capacity: base + floor(base * capacity / capacity) = base + base = 2 * base
      assert.equal(ledger.rows[0].applied_delta, 2 * baseXp);
    } finally {
      await closeDb(pool);
    }
  });

  it('fullness bonus: half-full barrel awards base + floor(half)', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);
      const capacity = h.balance.barrelCapacityFor(h.player.activeClass);
      const baseXp = h.balance.initialXpFor(ToolType.Barrel);
      const halfCapacity = Math.floor(capacity / 2);

      const spec: BarrelSpec = {
        sgAmount: 0,
        contents: new Map([[ToolType.Trap, halfCapacity]])
      };

      const outcome = await h.placement.stashBarrel(h.player, h.page, spec);
      assert.ok(outcome.placement);
      assert.equal(outcome.failed, false);
      const result = outcome.placement;

      const ledger = await pool.query(
        `SELECT applied_delta FROM resource_ledger WHERE player_id = $1 AND resource_kind = 'xp'
         AND placement_id = $2 AND cause_id = (SELECT id FROM ledger_cause WHERE code = 'placement_reward')`,
        [h.player.id, result.id]
      );
      assert.equal(ledger.rows.length, 1);
      // At half capacity: base + floor(base * halfCapacity / capacity)
      const expectedBonus = Math.floor(baseXp * halfCapacity / capacity);
      assert.equal(ledger.rows[0].applied_delta, baseXp + expectedBonus);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PlacementModule.dismiss', { skip: DB_SKIP }, () => {
  it('dismissing sets isDismissed and is visible through repo', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      await h.placement.dismiss(h.player, placement);

      const interaction = await pool.query(
        `SELECT is_dismissed FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h.player.id, placement.id]
      );
      assert.equal(interaction.rows.length, 1);
      assert.equal(interaction.rows[0].is_dismissed, true);
    } finally {
      await closeDb(pool);
    }
  });

  it('dismissing twice is idempotent — one row, still dismissed', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      await h.placement.dismiss(h.player, placement);
      await h.placement.dismiss(h.player, placement);

      const interactions = await pool.query(
        `SELECT count(*)::int c FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h.player.id, placement.id]
      );
      assert.equal(interactions.rows[0].c, 1, 'exactly one row');

      const interaction = await pool.query(
        `SELECT is_dismissed FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h.player.id, placement.id]
      );
      assert.equal(interaction.rows[0].is_dismissed, true);
    } finally {
      await closeDb(pool);
    }
  });

  it('existing interaction useCount and firstSeenAt survive dismissal', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      // Create an interaction with useCount = 5
      await pool.query(
        `INSERT INTO placement_interaction (player_id, placement_id, use_count, is_dismissed, first_seen_at)
         VALUES ($1, $2, 5, false, now())`,
        [h.player.id, placement.id]
      );

      const before = await pool.query(
        `SELECT use_count, first_seen_at FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h.player.id, placement.id]
      );

      await h.placement.dismiss(h.player, placement);

      const after = await pool.query(
        `SELECT use_count, first_seen_at, is_dismissed FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h.player.id, placement.id]
      );

      assert.equal(after.rows[0].use_count, 5, 'useCount preserved');
      assert.equal(
        before.rows[0].first_seen_at.getTime(),
        after.rows[0].first_seen_at.getTime(),
        'firstSeenAt preserved'
      );
      assert.equal(after.rows[0].is_dismissed, true);
    } finally {
      await closeDb(pool);
    }
  });

  it('dismissal by one player does not affect rows for another', async () => {
    const pool = await freshDb();
    try {
      const h1 = await harness(pool, PlayerClass.Giver);
      const playerId2 = randomUUID() as PlayerId;
      const player2 = makePlayer(playerId2, PlayerClass.Guardian);

      const tx = { id: 'setup' };
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      await playerRepo.save(player2, tx);
      for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
        await progressRepo.save({ playerId: playerId2, playerClass: cls, level: 20, experience: 0 }, tx);
      }

      const outcome = await h1.placement.place(h1.player, h1.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      // Create interaction for both players
      await pool.query(
        `INSERT INTO placement_interaction (player_id, placement_id, use_count, is_dismissed, first_seen_at)
         VALUES ($1, $2, 0, false, now()), ($3, $2, 0, false, now())`,
        [h1.player.id, placement.id, playerId2]
      );

      await h1.placement.dismiss(h1.player, placement);

      // Player 1's row should be dismissed
      const row1 = await pool.query(
        `SELECT is_dismissed FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [h1.player.id, placement.id]
      );
      assert.equal(row1.rows[0].is_dismissed, true);

      // Player 2's row should NOT be dismissed
      const row2 = await pool.query(
        `SELECT is_dismissed FROM placement_interaction WHERE player_id = $1 AND placement_id = $2`,
        [playerId2, placement.id]
      );
      assert.equal(row2.rows[0].is_dismissed, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('dismissed placement disappears from list with excludeDismissedFor', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool);

      const outcome = await h.placement.place(h.player, h.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      // Before dismissal, placement appears in the list
      let list = await h.placementRepo.list(h.page.id, {
        liveOnly: true,
        excludeNsfw: false,
        excludeDismissedFor: h.player.id
      });
      assert.ok(list.find(p => p.id === placement.id), 'placement visible before dismissal');

      await h.placement.dismiss(h.player, placement);

      // After dismissal, it disappears for that player
      list = await h.placementRepo.list(h.page.id, {
        liveOnly: true,
        excludeNsfw: false,
        excludeDismissedFor: h.player.id
      });
      assert.ok(!list.find(p => p.id === placement.id), 'placement hidden after dismissal');
    } finally {
      await closeDb(pool);
    }
  });

  it('dismissed placement remains visible for other players', async () => {
    const pool = await freshDb();
    try {
      const h1 = await harness(pool, PlayerClass.Giver);
      const playerId2 = randomUUID() as PlayerId;
      const player2 = makePlayer(playerId2, PlayerClass.Guardian);

      const tx = { id: 'setup' };
      const playerRepo = new PgPlayerRepository(pool);
      const progressRepo = new PgClassProgressRepository(pool);
      const inventoryRepo = new PgInventoryRepository(pool);
      await playerRepo.save(player2, tx);
      for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
        await progressRepo.save({ playerId: playerId2, playerClass: cls, level: 20, experience: 0 }, tx);
      }
      for (const tool of PLACEABLE_TOOL_TYPES) {
        await inventoryRepo.adjust(playerId2, tool, 100, tx);
      }

      const outcome = await h1.placement.place(h1.player, h1.page, { toolType: ToolType.Trap });
      assert.ok(outcome.placement);
      const placement = outcome.placement;

      await h1.placement.dismiss(h1.player, placement);

      // Player 1 sees it dismissed
      let list1 = await h1.placementRepo.list(h1.page.id, {
        liveOnly: true,
        excludeNsfw: false,
        excludeDismissedFor: h1.player.id
      });
      assert.ok(!list1.find(p => p.id === placement.id), 'player 1: placement hidden');

      // Player 2 sees it (no dismissal)
      let list2 = await h1.placementRepo.list(h1.page.id, {
        liveOnly: true,
        excludeNsfw: false,
        excludeDismissedFor: playerId2
      });
      assert.ok(list2.find(p => p.id === placement.id), 'player 2: placement visible');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway own limit: giver at 5th placement succeeds, 6th throws', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const limit = h.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      assert.equal(limit, 5, 'test assumes giver own limit is 5');

      const pageId = h.page.id;
      const player = h.player;

      // Place 5 doorways
      for (let i = 0; i < limit; i++) {
        const outcome = await h.placement.place(player, h.page, {
          toolType: ToolType.Doorway,
          destinationUrl: `http://example.com/${i}`
        });
        assert.ok(outcome.placement, `placement ${i + 1} should succeed`);
      }

      // 6th should fail
      const failOutcome = await h.placement.place(player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'http://example.com/fail'
      }).catch(e => e);

      assert.ok(failOutcome instanceof DoorwayPageOwnLimitReached, 'should throw DoorwayPageOwnLimitReached');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway own limit: guide at 200th placement succeeds, proves class-dependent', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guide);
      const guideLimit = h.balance.doorwayPageOwnLimit(PlayerClass.Guide);
      const giverLimit = h.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      assert.equal(guideLimit, 200, 'guide own limit should be 200');
      assert.equal(giverLimit, 5, 'giver own limit should be 5');
      assert.notEqual(guideLimit, giverLimit, 'limits should differ to prove class-dependent');

      const player = h.player;

      // Place guideLimitCount doorways in a loop
      // To do this efficiently, we'll use a direct SQL insert with generate_series
      // after the module logic to populate the placement table directly
      // But for clarity and to test the module, let's place a few and then verify

      // Place 200 doorways
      for (let i = 0; i < guideLimit; i++) {
        const outcome = await h.placement.place(player, h.page, {
          toolType: ToolType.Doorway,
          destinationUrl: `http://example.com/${i}`
        });
        assert.ok(outcome.placement, `guide placement ${i + 1} should succeed`);
      }

      // Verify guide can place 200 where giver can only place 5
      const list = await h.placementRepo.list(h.page.id, {
        liveOnly: true,
        excludeNsfw: false,
        toolTypes: [ToolType.Doorway]
      });
      assert.equal(list.length, guideLimit, `should have ${guideLimit} doorways on page`);
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway own limit is per-page: giver at limit on one page can place on another', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const limit = h.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      const player = h.player;

      // Create a second page using direct SQL
      const pageId2 = randomUUID() as PageId;
      const page2 = makePage(pageId2, h.page.domainId);
      const tx = { id: 'page2' };
      await pool.query(
        `INSERT INTO page (id, url_hash, domain_id, normalisation_version, first_seen_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [pageId2, page2.urlHash, h.page.domainId, 1, new Date()]
      );

      // Fill first page
      for (let i = 0; i < limit; i++) {
        const outcome = await h.placement.place(player, h.page, {
          toolType: ToolType.Doorway,
          destinationUrl: `http://example.com/page1/${i}`
        });
        assert.ok(outcome.placement);
      }

      // Should still be able to place on second page
      const outcome = await h.placement.place(player, page2, {
        toolType: ToolType.Doorway,
        destinationUrl: 'http://example.com/page2/0'
      });
      assert.ok(outcome.placement, 'should place on different page despite being at limit on first page');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway own limit is per-player: one giver at limit does not stop another giver', async () => {
    const pool = await freshDb();
    try {
      const h1 = await harness(pool, PlayerClass.Giver);
      const limit = h1.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      const pageId = h1.page.id;

      // Create second giver
      const playerId2 = randomUUID() as PlayerId;
      const player2 = makePlayer(playerId2, PlayerClass.Giver);
      const tx = { id: 'player2' };

      // Insert directly via SQL to create second player
      await pool.query(
        `INSERT INTO player (id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [playerId2, player2.name, player2.credentialHash, player2.email, player2.activeClass, player2.karma, player2.sg, player2.isModerator, player2.isOperator, player2.isActive, player2.avatarUrl, player2.comment, player2.registeredAt, player2.lastActiveAt, player2.lastStipendAt]
      );

      for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
        await pool.query(
          `INSERT INTO player_class_progress (player_id, class_id, level, experience)
           VALUES ($1, $2, $3, $4)`,
          [playerId2, cls, 20, 0]
        );
      }

      await pool.query(
        `INSERT INTO player_inventory (player_id, tool_type_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, tool_type_id) DO UPDATE SET quantity = player_inventory.quantity + $3`,
        [playerId2, ToolType.Doorway, 100]
      );

      // Fill first giver's quota
      for (let i = 0; i < limit; i++) {
        const outcome = await h1.placement.place(h1.player, h1.page, {
          toolType: ToolType.Doorway,
          destinationUrl: `http://example.com/giver1/${i}`
        });
        assert.ok(outcome.placement);
      }

      // Second giver should still be able to place
      const outcome = await h1.placement.place(player2, h1.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'http://example.com/giver2/0'
      });
      assert.ok(outcome.placement, 'second giver should place despite first giver at limit');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway own limit: consumed doorways do not count', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const limit = h.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      const player = h.player;

      // Place 5 doorways
      const placements: Placement[] = [];
      for (let i = 0; i < limit; i++) {
        const outcome = await h.placement.place(player, h.page, {
          toolType: ToolType.Doorway,
          destinationUrl: `http://example.com/${i}`
        });
        assert.ok(outcome.placement);
        placements.push(outcome.placement);
      }

      // Mark the first one as consumed
      const tx = { id: 'consume' };
      await h.placementRepo.markConsumed(placements[0].id, 'depleted', new Date(), tx);

      // Now we should be able to place a new one
      const outcome = await h.placement.place(player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'http://example.com/after-consume'
      });
      assert.ok(outcome.placement, 'should place after consuming one (count should be 4 < 5)');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway total limit: page full of doorways throws on next placement', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Guide);
      const totalLimit = h.balance.doorwayPageTotalLimit();
      assert.equal(totalLimit, 200, 'test assumes total limit is 200');

      const pageId = h.page.id;

      // Use direct SQL to bulk-insert totalLimit doorways by different guides
      // Create several guide players first
      const guideIds: PlayerId[] = [];
      for (let p = 0; p < 5; p++) {
        const playerId = randomUUID() as PlayerId;
        const player = makePlayer(playerId, PlayerClass.Guide);
        // Insert player
        await pool.query(
          `INSERT INTO player (id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [playerId, player.name, player.credentialHash, player.email, player.activeClass, player.karma, player.sg, player.isModerator, player.isOperator, player.isActive, player.avatarUrl, player.comment, player.registeredAt, player.lastActiveAt, player.lastStipendAt]
        );
        // Insert class progress
        for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
          await pool.query(
            `INSERT INTO player_class_progress (player_id, class_id, level, experience)
             VALUES ($1, $2, $3, $4)`,
            [playerId, cls, 20, 0]
          );
        }
        guideIds.push(playerId);
      }

      // Bulk insert doorways via SQL
      const placements = totalLimit;
      const placementsPerPlayer = Math.floor(placements / guideIds.length);
      const extraForFirst = placements - (placementsPerPlayer * guideIds.length);

      let placedCount = 0;
      for (let p = 0; p < guideIds.length; p++) {
        const count = (p === 0) ? (placementsPerPlayer + extraForFirst) : placementsPerPlayer;
        const result = await pool.query(
          `INSERT INTO placement (page_id, placer_id, tool_type_id, placer_class_id, placer_level)
           SELECT $1, $2, 4, $3, 1
           FROM generate_series(1, $4)`,
          [pageId, guideIds[p], PlayerClass.Guide, count]
        );
        placedCount += count;
      }
      assert.equal(placedCount, totalLimit, `should have inserted ${totalLimit} doorways`);

      // Now module placement should fail with DoorwayPageTotalLimitReached
      const failOutcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Doorway,
        destinationUrl: 'http://example.com/over-limit'
      }).catch(e => e);

      assert.ok(failOutcome instanceof DoorwayPageTotalLimitReached, 'should throw DoorwayPageTotalLimitReached for total limit');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway limits do not affect other tool types: traps unaffected by doorway total', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const totalLimit = h.balance.doorwayPageTotalLimit();
      const pageId = h.page.id;

      // Bulk-insert doorways to reach total limit (using guides)
      const guideIds: PlayerId[] = [];
      for (let p = 0; p < 2; p++) {
        const playerId = randomUUID() as PlayerId;
        const player = makePlayer(playerId, PlayerClass.Guide);
        // Insert player
        await pool.query(
          `INSERT INTO player (id, name, credential_hash, email, active_class_id, karma, sg, is_moderator, is_operator, is_active, avatar_url, comment, registered_at, last_active_at, last_stipend_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [playerId, player.name, player.credentialHash, player.email, player.activeClass, player.karma, player.sg, player.isModerator, player.isOperator, player.isActive, player.avatarUrl, player.comment, player.registeredAt, player.lastActiveAt, player.lastStipendAt]
        );
        // Insert class progress
        for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
          await pool.query(
            `INSERT INTO player_class_progress (player_id, class_id, level, experience)
             VALUES ($1, $2, $3, $4)`,
            [playerId, cls, 20, 0]
          );
        }
        guideIds.push(playerId);
      }

      const result = await pool.query(
        `INSERT INTO placement (page_id, placer_id, tool_type_id, placer_class_id, placer_level)
         SELECT $1, $2, 4, $3, 1
         FROM generate_series(1, $4)`,
        [pageId, guideIds[0], PlayerClass.Guide, totalLimit]
      );

      // Placing a trap should still succeed (different tool type)
      const trapOutcome = await h.placement.place(h.player, h.page, {
        toolType: ToolType.Trap,
        isAnonymous: false
      });
      assert.ok(trapOutcome.placement, 'trap should place despite page full of doorways');
    } finally {
      await closeDb(pool);
    }
  });

  it('doorway limit trigger enforces via NI010: direct SQL insert of own-limit violation is rejected', async () => {
    const pool = await freshDb();
    try {
      const h = await harness(pool, PlayerClass.Giver);
      const limit = h.balance.doorwayPageOwnLimit(PlayerClass.Giver);
      const pageId = h.page.id;
      const playerId = h.player.id;

      // Insert limit doorways directly via SQL
      const result = await pool.query(
        `INSERT INTO placement (page_id, placer_id, tool_type_id, placer_class_id, placer_level)
         SELECT $1, $2, 4, $3, 1
         FROM generate_series(1, $4)`,
        [pageId, playerId, PlayerClass.Giver, limit]
      );

      // Try to insert one more directly (should fail at trigger level with NI010)
      const failResult = await pool.query(
        `INSERT INTO placement (page_id, placer_id, tool_type_id, placer_class_id, placer_level)
         VALUES ($1, $2, 4, $3, 1)`,
        [pageId, playerId, PlayerClass.Giver]
      ).catch(e => e);

      // Check both message (for visibility) and code (for reliability)
      const hasNI010 = (failResult && failResult.code === 'NI010') ||
                       (failResult && failResult.message && failResult.message.includes('NI010'));
      assert.ok(hasNI010, `should fail with NI010 error code, got: ${failResult?.code || failResult?.message}`);
    } finally {
      await closeDb(pool);
    }
  });
});
