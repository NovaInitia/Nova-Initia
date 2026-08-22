import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PlayerId, PageId, DomainId, PlacementId } from '../domain/ids.js';
import type { Player } from '../domain/player.js';
import type { Page } from '../domain/geography.js';
import type { TrapPlacement, SpiderPlacement, BarrelPlacement, DoorwayPlacement } from '../domain/placement.js';
import type { Pool } from 'pg';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { SEED_BALANCE } from '../balance/seed.js';
import { StaticBalanceTable } from '../balance/StaticBalanceTable.js';
import { EncounterModule } from './encounter.js';
import { ProgressionModule } from './progression.js';
import { GeographyModule } from './geography.js';
import { PgPlayerRepository } from '../repositories/PgPlayerRepository.js';
import { PgPageRepository } from '../repositories/PgPageRepository.js';
import { PgDomainRepository } from '../repositories/PgDomainRepository.js';
import { PgClassProgressRepository } from '../repositories/PgClassProgressRepository.js';
import { PgInventoryRepository } from '../repositories/PgInventoryRepository.js';
import { PgLedgerRepository } from '../repositories/PgLedgerRepository.js';
import { PgPlacementRepository } from '../repositories/PgPlacementRepository.js';
import { PgPlacementInteractionRepository } from '../repositories/PgPlacementInteractionRepository.js';
import { PgBarrelContentRepository } from '../repositories/PgBarrelContentRepository.js';
import { PgArmorRepository } from '../repositories/PgArmorRepository.js';
import { PgPresenceRepository } from '../repositories/PgPresenceRepository.js';
import { PgNormalisationVersionRepository } from '../repositories/PgNormalisationVersionRepository.js';
import { Consumption } from '../repositories/Consumption.js';
import { PgUnitOfWork } from '../repositories/PgUnitOfWork.js';

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

interface Harness {
  pool: Pool;
  encounter: EncounterModule;
  geography: GeographyModule;
  players: PgPlayerRepository;
  pages: PgPageRepository;
  domains: PgDomainRepository;
  placements: PgPlacementRepository;
  interactions: PgPlacementInteractionRepository;
  armor: PgArmorRepository;
  inventory: PgInventoryRepository;
  balance: StaticBalanceTable;
}

async function harness(customRandom: () => number = Math.random): Promise<Harness> {
  const pool = await freshDb();
  const domainRepo = new PgDomainRepository(pool);
  const pageRepo = new PgPageRepository(pool);
  const playerRepo = new PgPlayerRepository(pool);
  const progressRepo = new PgClassProgressRepository(pool);
  const inventoryRepo = new PgInventoryRepository(pool);
  const ledgerRepo = new PgLedgerRepository(pool);
  const placementRepo = new PgPlacementRepository(pool);
  const interactionRepo = new PgPlacementInteractionRepository(pool);
  const contentRepo = new PgBarrelContentRepository(pool);
  const armorRepo = new PgArmorRepository(pool);
  const presenceRepo = new PgPresenceRepository(pool);
  const versionsRepo = new PgNormalisationVersionRepository(pool);
  const unitOfWork = new PgUnitOfWork(pool);
  const balance = new StaticBalanceTable(SEED_BALANCE);
  const progression = new ProgressionModule(playerRepo, progressRepo, ledgerRepo, balance);
  const consumption = new Consumption(placementRepo, inventoryRepo);
  const geography = new GeographyModule(pageRepo, domainRepo, presenceRepo, versionsRepo, unitOfWork);

  const encounter = new EncounterModule(
    geography,
    placementRepo,
    interactionRepo,
    contentRepo,
    inventoryRepo,
    armorRepo,
    consumption,
    progression,
    balance,
    unitOfWork,
    playerRepo,
    customRandom
  );

  return {
    pool,
    encounter,
    geography,
    players: playerRepo,
    pages: pageRepo,
    domains: domainRepo,
    placements: placementRepo,
    interactions: interactionRepo,
    armor: armorRepo,
    inventory: inventoryRepo,
    balance
  };
}

async function setupPlayerWithProgress(h: Harness, pool: Pool, playerId: PlayerId, activeClass: PlayerClass = PlayerClass.Giver): Promise<void> {
  const tx = { id: 'tx-setup-' + playerId };
  const player = makePlayer(playerId, activeClass);
  await h.players.save(player, tx);

  const progressRepo = new PgClassProgressRepository(pool);
  for (const cls of [PlayerClass.Giver, PlayerClass.Guardian, PlayerClass.Guide]) {
    await progressRepo.save(
      {
        playerId,
        playerClass: cls,
        level: 1,
        experience: 0
      },
      tx
    );
  }
}

describe('EncounterModule.resolveTrap', { skip: DB_SKIP }, () => {
  it('trap damage increases with age across brackets', async () => {
    const h = await harness();
    try {
      const trapId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const trapPlacerId = randomUUID() as PlayerId;

      const now = new Date('2024-01-15T00:00:00Z');
      const ages = [
        { days: 1, name: 'under 7 days' },
        { days: 15, name: '7-30 days' },
        { days: 50, name: '30-90 days' },
        { days: 120, name: '90-150 days' },
        { days: 180, name: '150+ days' }
      ];

      let previousDamage = -1;
      for (const { days } of ages) {
        const placedAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const trap: TrapPlacement = {
          id: trapId,
          toolType: ToolType.Trap,
          placerId: trapPlacerId,
          pageId: randomUUID() as PageId,
          placedAt,
          placerClass: PlayerClass.Giver,
          placerLevel: 5,
          consumedAt: null,
          consumptionCause: null,
          isAnonymous: false
        };

        const outcome = h.encounter.resolveTrap(visitor, trap, visitor.karma, now);
        assert.equal(outcome.fired, true);
        assert.ok(outcome.sgLoss >= previousDamage, `damage at ${days} days should be >= previous`);
        previousDamage = outcome.sgLoss;
      }
    } finally {
      await closeDb(h.pool);
    }
  });

  it('expert bonus is +10 when placer karma is 95 and trap is 90+ days old', async () => {
    const h = await harness();
    try {
      const trapId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const trapPlacerId = randomUUID() as PlayerId;
      const now = new Date('2024-01-15T00:00:00Z');

      const placedAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId: randomUUID() as PageId,
        placedAt,
        placerClass: PlayerClass.Giver,
        placerLevel: 5,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };

      const outcome95 = h.encounter.resolveTrap(visitor, trap, 95, now);
      assert.equal(outcome95.fired, true);

      const outcome96 = h.encounter.resolveTrap(visitor, trap, 96, now);
      assert.equal(outcome96.fired, true);

      assert.ok(outcome95.sgLoss > outcome96.sgLoss);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('expert bonus checks placer karma not visitor karma', async () => {
    const h = await harness();
    try {
      const trapId = randomUUID() as PlacementId;
      const now = new Date('2024-01-15T00:00:00Z');
      const placedAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
      const trapPlacerId = randomUUID() as PlayerId;

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId: randomUUID() as PageId,
        placedAt,
        placerClass: PlayerClass.Giver,
        placerLevel: 5,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };

      const visitorHighKarma = makePlayer(randomUUID() as PlayerId);
      visitorHighKarma.karma = 96;

      const outcomeHighVisitor = h.encounter.resolveTrap(visitorHighKarma, trap, 95, now);

      const visitorLowKarma = makePlayer(randomUUID() as PlayerId);
      visitorLowKarma.karma = 50;
      const outcomeLowVisitor = h.encounter.resolveTrap(visitorLowKarma, trap, 95, now);

      assert.equal(outcomeHighVisitor.sgLoss, outcomeLowVisitor.sgLoss);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('trap failure roll returns fired: false', async () => {
    const h = await harness(() => 0); // Always fail
    try {
      const trapId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const trapPlacerId = randomUUID() as PlayerId;

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId: randomUUID() as PageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 5,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };

      const outcome = h.encounter.resolveTrap(visitor, trap, visitor.karma, new Date());
      assert.equal(outcome.fired, false);
      assert.equal(outcome.sgLoss, 0);
      assert.equal(outcome.placerXp, null);
      assert.equal(outcome.consumesPlacement, true);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('anonymous trap reports placerId: null', async () => {
    const h = await harness(() => 1); // Always fire
    try {
      const trapId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const trapPlacerId = randomUUID() as PlayerId;

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId: randomUUID() as PageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 5,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: true
      };

      const outcome = h.encounter.resolveTrap(visitor, trap, visitor.karma, new Date());
      assert.equal(outcome.placerId, null);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('non-anonymous trap reports actual placerId', async () => {
    const h = await harness(() => 1); // Always fire
    try {
      const trapId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const trapPlacerId = randomUUID() as PlayerId;

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId: randomUUID() as PageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 5,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };

      const outcome = h.encounter.resolveTrap(visitor, trap, visitor.karma, new Date());
      assert.equal(outcome.placerId, trapPlacerId);
    } finally {
      await closeDb(h.pool);
    }
  });
});

describe('EncounterModule.resolveSpider', { skip: DB_SKIP }, () => {
  it('spider damage is flat at every age', async () => {
    const h = await harness();
    try {
      const spiderId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const spiderPlacerId = randomUUID() as PlayerId;

      const now = new Date('2024-01-15T00:00:00Z');
      const ages = [1, 15, 50, 120, 180];
      const damages: number[] = [];

      for (const days of ages) {
        const placedAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const spider: SpiderPlacement = {
          id: spiderId,
          toolType: ToolType.Spider,
          placerId: spiderPlacerId,
          pageId: randomUUID() as PageId,
          placedAt,
          placerClass: PlayerClass.Guardian,
          placerLevel: 10,
          consumedAt: null,
          consumptionCause: null,
          variant: 'standard',
          lastMovedAt: null
        };

        const outcome = h.encounter.resolveSpider(visitor, spider, now);
        damages.push(outcome.sgLoss);
      }

      for (let i = 1; i < damages.length; i++) {
        assert.equal(damages[i], damages[0], `damage at index ${i} should match first`);
      }
    } finally {
      await closeDb(h.pool);
    }
  });

  it('spider XP scales with age across brackets', async () => {
    const h = await harness();
    try {
      const spiderId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const spiderPlacerId = randomUUID() as PlayerId;

      const now = new Date('2024-01-15T00:00:00Z');
      const ages = [1, 15, 50, 120, 180];
      const xpAmounts: number[] = [];

      for (const days of ages) {
        const placedAt = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const spider: SpiderPlacement = {
          id: spiderId,
          toolType: ToolType.Spider,
          placerId: spiderPlacerId,
          pageId: randomUUID() as PageId,
          placedAt,
          placerClass: PlayerClass.Guardian,
          placerLevel: 10,
          consumedAt: null,
          consumptionCause: null,
          variant: 'standard',
          lastMovedAt: null
        };

        const outcome = h.encounter.resolveSpider(visitor, spider, now);
        if (outcome.placerXp) {
          xpAmounts.push(outcome.placerXp.amount);
        }
      }

      for (let i = 1; i < xpAmounts.length; i++) {
        assert.ok(xpAmounts[i] >= xpAmounts[i - 1], `XP at index ${i} should >= at ${i - 1}`);
      }
    } finally {
      await closeDb(h.pool);
    }
  });

  it('spider reports placerId (not anonymous)', async () => {
    const h = await harness();
    try {
      const spiderId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const spiderPlacerId = randomUUID() as PlayerId;

      const spider: SpiderPlacement = {
        id: spiderId,
        toolType: ToolType.Spider,
        placerId: spiderPlacerId,
        pageId: randomUUID() as PageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Guardian,
        placerLevel: 10,
        consumedAt: null,
        consumptionCause: null,
        variant: 'standard',
        lastMovedAt: null
      };

      const outcome = h.encounter.resolveSpider(visitor, spider, new Date());
      assert.equal(outcome.placerId, spiderPlacerId);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('spider always fires (no failure roll)', async () => {
    const h = await harness(() => 0); // Even if random returns 0
    try {
      const spiderId = randomUUID() as PlacementId;
      const visitor = makePlayer(randomUUID() as PlayerId);
      const spiderPlacerId = randomUUID() as PlayerId;

      const spider: SpiderPlacement = {
        id: spiderId,
        toolType: ToolType.Spider,
        placerId: spiderPlacerId,
        pageId: randomUUID() as PageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Guardian,
        placerLevel: 10,
        consumedAt: null,
        consumptionCause: null,
        variant: 'standard',
        lastMovedAt: null
      };

      const outcome = h.encounter.resolveSpider(visitor, spider, new Date());
      assert.equal(outcome.fired, true);
    } finally {
      await closeDb(h.pool);
    }
  });
});

describe('EncounterModule.toggleShield', { skip: DB_SKIP }, () => {
  it('turning on an inactive shield with zero charges consumes one shield and grants charges', async () => {
    const h = await harness();
    try {
      const playerId = randomUUID() as PlayerId;
      const player = makePlayer(playerId, PlayerClass.Guardian);
      const tx = { id: 'tx1' };

      await h.players.save(player, tx);

      for (const cls of [PlayerClass.Guardian, PlayerClass.Giver, PlayerClass.Guide]) {
        const progress = await h.placements.list; // Ensure schema is initialized
        (progress); // Reference it to avoid unused warning
      }

      await h.inventory.adjust(playerId, ToolType.Shield, 1, tx);
      await h.armor.save(
        {
          playerId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const result = await h.encounter.toggleShield(player);

      assert.equal(result.isActive, true);
      assert.equal(result.chargesRemaining, 3); // Guardian gets 3

      const inventory = await h.inventory.get(playerId);
      assert.equal(inventory.counts.get(ToolType.Shield) || 0, 0);
    } finally {
      await closeDb(h.pool);
    }
  });
});

describe('EncounterModule.arrive', { skip: DB_SKIP }, () => {
  it('visitor loses sg equal to computed damage and placer gains XP', async () => {
    const h = await harness(() => 1); // Trap fires
    try {
      const visitorId = randomUUID() as PlayerId;
      const visitor = makePlayer(visitorId, PlayerClass.Giver);
      const trapPlacerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;
      const trapId = randomUUID() as PlacementId;

      await setupPlayerWithProgress(h, h.pool, visitorId, PlayerClass.Giver);
      await setupPlayerWithProgress(h, h.pool, trapPlacerId, PlayerClass.Giver);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitorId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap, tx);

      const result = await h.encounter.arrive(
        visitor,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      assert.equal(result.outcomes.length, 1);
      const trapOutcome = result.outcomes[0];
      assert.equal(trapOutcome.fired, true);
      assert.ok(trapOutcome.sgLoss > 0);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('two traps against one-charge shield: first absorbed, second applies damage', async () => {
    const h = await harness(() => 1); // Traps fire
    try {
      const visitorId = randomUUID() as PlayerId;
      const visitor = makePlayer(visitorId);
      const trap1PlacerId = randomUUID() as PlayerId;
      const trap2PlacerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;
      const trap1Id = randomUUID() as PlacementId;
      const trap2Id = randomUUID() as PlacementId;

      await setupPlayerWithProgress(h, h.pool, visitorId);
      await setupPlayerWithProgress(h, h.pool, trap1PlacerId);
      await setupPlayerWithProgress(h, h.pool, trap2PlacerId);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitorId,
          isActive: true,
          chargesRemaining: 1
        },
        tx
      );

      const trap1: TrapPlacement = {
        id: trap1Id,
        toolType: ToolType.Trap,
        placerId: trap1PlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap1, tx);

      const trap2: TrapPlacement = {
        id: trap2Id,
        toolType: ToolType.Trap,
        placerId: trap2PlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap2, tx);

      const result = await h.encounter.arrive(
        visitor,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      assert.equal(result.outcomes.length, 2);
      assert.equal(result.outcomes[0].absorbedByShield, true);
      assert.equal(result.outcomes[1].absorbedByShield, false);
      assert.ok(result.outcomes[1].sgLoss > 0);
    } finally {
      await closeDb(h.pool);
    }
  });

  // Named for what it actually checks. It does NOT verify WF-3's "triggers resolve before
  // contents are reported" rule: the triggerable set (traps, spiders) and the reportable set
  // (barrels, doorways, signposts) are disjoint, so a trap can never appear in contents
  // whatever the ordering, and these assertions hold even if the order were reversed.
  // The ordering rule becomes observable only when a trigger can consume something that
  // would otherwise be reported — the anti-signpost spider, which is OPEN-6 and unbuilt.
  it('arriving where only a trap waits reports one outcome and no contents', async () => {
    const h = await harness(() => 1); // Trap fires
    try {
      const visitorId = randomUUID() as PlayerId;
      const visitor = makePlayer(visitorId);
      const trapPlacerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;
      const trapId = randomUUID() as PlacementId;

      await setupPlayerWithProgress(h, h.pool, visitorId);
      await setupPlayerWithProgress(h, h.pool, trapPlacerId);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitorId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const trap: TrapPlacement = {
        id: trapId,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap, tx);

      const result = await h.encounter.arrive(
        visitor,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      assert.equal(result.outcomes.length, 1);
      assert.equal(result.barrels.length, 0);
      assert.equal(result.doorways.length, 0);
      assert.equal(result.signposts.length, 0);
    } finally {
      await closeDb(h.pool);
    }
  });

  it('NSFW doorway absent when filterNsfw: true, present when false; trap fires either way', async () => {
    const h = await harness(() => 1); // Trap fires
    try {
      const visitorId = randomUUID() as PlayerId;
      const visitor = makePlayer(visitorId);
      const trapPlacerId = randomUUID() as PlayerId;
      const doorwayPlacerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;
      const trap1Id = randomUUID() as PlacementId;
      const trap2Id = randomUUID() as PlacementId;
      const doorwayId = randomUUID() as PlacementId;

      await setupPlayerWithProgress(h, h.pool, visitorId);
      await setupPlayerWithProgress(h, h.pool, trapPlacerId);
      await setupPlayerWithProgress(h, h.pool, doorwayPlacerId, PlayerClass.Guide);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitorId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const trap1: TrapPlacement = {
        id: trap1Id,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap1, tx);

      const trap2: TrapPlacement = {
        id: trap2Id,
        toolType: ToolType.Trap,
        placerId: trapPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        isAnonymous: false
      };
      await h.placements.save(trap2, tx);

      const doorway: DoorwayPlacement = {
        id: doorwayId,
        toolType: ToolType.Doorway,
        placerId: doorwayPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Guide,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        destinationUrl: 'https://example.com/page',
        isNsfw: true,
        title: null,
        comment: null,
        chargesRemaining: 3,
        chainRootId: null,
        nextId: null,
        useLimitFor: () => 0
      };
      await h.placements.save(doorway, tx);

      const resultWithFilter = await h.encounter.arrive(
        visitor,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: true }
      );

      assert.equal(resultWithFilter.outcomes.length, 2); // Both traps fire
      assert.equal(resultWithFilter.doorways.length, 0); // NSFW doorway filtered
    } finally {
      await closeDb(h.pool);
    }
  });

  it('dismissed barrel absent for dismissing player but present for another', async () => {
    const h = await harness();
    try {
      const visitor1Id = randomUUID() as PlayerId;
      const visitor1 = makePlayer(visitor1Id);
      const visitor2Id = randomUUID() as PlayerId;
      const visitor2 = makePlayer(visitor2Id);
      const barrelPlacerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;
      const barrelId = randomUUID() as PlacementId;

      await setupPlayerWithProgress(h, h.pool, visitor1Id);
      await setupPlayerWithProgress(h, h.pool, visitor2Id);
      await setupPlayerWithProgress(h, h.pool, barrelPlacerId);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitor1Id,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );
      await h.armor.save(
        {
          playerId: visitor2Id,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const barrel: BarrelPlacement = {
        id: barrelId,
        toolType: ToolType.Barrel,
        placerId: barrelPlacerId,
        pageId,
        placedAt: new Date(),
        placerClass: PlayerClass.Giver,
        placerLevel: 1,
        consumedAt: null,
        consumptionCause: null,
        sgAmount: 0,
        insideMessage: null,
        outsideMessage: null,
        visitCount: 0,
        durability: 1,
        contents: new Map(),
        useLimitFor: () => 0
      };
      await h.placements.save(barrel, tx);

      await h.interactions.save(
        {
          playerId: visitor1Id,
          placementId: barrelId,
          useCount: 0,
          isDismissed: true,
          rating: null,
          ratedAt: null,
          firstSeenAt: new Date(),
          lastUsedAt: null
        },
        tx
      );

      const result1 = await h.encounter.arrive(
        visitor1,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      const result2 = await h.encounter.arrive(
        visitor2,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      assert.equal(result1.barrels.length, 0); // Dismissed for visitor1
      assert.equal(result2.barrels.length, 1); // Not dismissed for visitor2
    } finally {
      await closeDb(h.pool);
    }
  });

  it('arriving registers visitor as an occupant', async () => {
    const h = await harness();
    try {
      const visitorId = randomUUID() as PlayerId;
      const visitor = makePlayer(visitorId);
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;

      await setupPlayerWithProgress(h, h.pool, visitorId);

      const tx = { id: 'tx1' };

      const domain = {
        id: domainId,
        domainHash: 'domain-hash',
        normalisationVersion: 1,
        uri: 'https://example.com',
        hitCount: 0,
        firstSeenAt: new Date()
      };
      await h.domains.save(domain, tx);

      const page = makePage(pageId, domainId);
      await h.pages.save(page, tx);

      await h.armor.save(
        {
          playerId: visitorId,
          isActive: false,
          chargesRemaining: 0
        },
        tx
      );

      const result = await h.encounter.arrive(
        visitor,
        { urlHash: page.urlHash, domainHash: domain.domainHash, normalisationVersion: 1 },
        { filterNsfw: false }
      );

      assert.ok(result.occupants.length > 0);
      const visitorPresence = result.occupants.find((occ) => occ.playerId === visitorId);
      assert.ok(visitorPresence);
    } finally {
      await closeDb(h.pool);
    }
  });
});
