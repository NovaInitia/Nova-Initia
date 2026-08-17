import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { PlayerClass, ToolType } from '../domain/enums.js';
import type { PageId, PlacementId, PlayerId } from '../domain/ids.js';
import type { Placement } from '../domain/placement.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { PgPlacementRepository } from './PgPlacementRepository.js';
import { PgPlacementInteractionRepository } from './PgPlacementInteractionRepository.js';
import { PgBarrelContentRepository } from './PgBarrelContentRepository.js';

const tx = { id: 'placement-repo-test' };

interface Fixtures {
  playerId: PlayerId;
  pageId: PageId;
  otherPageId: PageId;
}

async function fixtures(pool: Pool): Promise<Fixtures> {
  const playerId = randomUUID() as PlayerId;
  await pool.query(
    `INSERT INTO player (id, name, credential_hash, active_class_id) VALUES ($1, $2, 'h', 1)`,
    [playerId, `player-${playerId}`]
  );

  const domainId = randomUUID();
  await pool.query(
    `INSERT INTO domain (id, domain_hash, normalisation_version) VALUES ($1, $2, 1)`,
    [domainId, `domain-${domainId}`]
  );

  const pageId = randomUUID() as PageId;
  const otherPageId = randomUUID() as PageId;
  for (const id of [pageId, otherPageId]) {
    await pool.query(
      `INSERT INTO page (id, url_hash, domain_id, normalisation_version) VALUES ($1, $2, $3, 1)`,
      [id, `url-${id}`, domainId]
    );
  }

  return { playerId, pageId, otherPageId };
}

function base(f: Fixtures, pageId?: PageId) {
  return {
    id: randomUUID() as PlacementId,
    placerId: f.playerId,
    pageId: pageId ?? f.pageId,
    placedAt: new Date('2024-03-01T12:00:00Z'),
    placerClass: PlayerClass.Giver,
    placerLevel: 7,
    consumedAt: null,
    consumptionCause: null
  };
}

describe('PgPlacementRepository', { skip: DB_SKIP }, () => {
  it('get returns null for an unknown id', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      assert.equal(await repo.get(randomUUID() as PlacementId), null);
    } finally {
      await closeDb(pool);
    }
  });

  it('round-trips all five placeable subtypes', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      const f = await fixtures(pool);

      const all: Placement[] = [
        { ...base(f), toolType: ToolType.Trap, isAnonymous: true },
        { ...base(f), toolType: ToolType.Spider, variant: 'wandering', lastMovedAt: null },
        {
          ...base(f),
          toolType: ToolType.Barrel,
          sgAmount: 12,
          insideMessage: 'inside',
          outsideMessage: 'outside',
          durability: 3,
          visitCount: 1,
          contents: new Map(),
          useLimitFor: () => 1
        },
        {
          ...base(f),
          toolType: ToolType.Doorway,
          destinationUrl: 'https://example.com/x',
          isNsfw: true,
          title: 'a door',
          comment: 'mind the step',
          chargesRemaining: 50,
          chainRootId: null,
          nextId: null,
          useLimitFor: () => 1
        },
        {
          ...base(f),
          toolType: ToolType.Signpost,
          destinationUrl: 'https://example.com/y',
          isNsfw: false,
          title: 'this way',
          comment: null,
          tourRootId: null,
          branchAId: null,
          branchBId: null,
          branchCId: null,
          branchDId: null,
          useLimitFor: () => 1
        }
      ];

      for (const placement of all) {
        await repo.save(placement, tx);
        const back = await repo.get(placement.id);
        assert.ok(back, `expected to read back tool ${placement.toolType}`);
        assert.equal(back.toolType, placement.toolType);
        assert.equal(back.placerId, placement.placerId);
        assert.equal(back.pageId, placement.pageId);
        assert.equal(back.placerClass, placement.placerClass);
        assert.equal(back.placerLevel, placement.placerLevel);
        assert.equal(back.placedAt.getTime(), placement.placedAt.getTime());
        assert.equal(back.consumedAt, null);
        assert.equal(back.consumptionCause, null);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('save twice on the same id updates rather than duplicating', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      const f = await fixtures(pool);
      const trap = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;

      await repo.save(trap, tx);
      await repo.save({ ...trap, isAnonymous: true } as Placement, tx);

      const rows = await pool.query('SELECT count(*)::int c FROM placement WHERE id = $1', [
        trap.id
      ]);
      assert.equal(rows.rows[0].c, 1);

      const back = await repo.get(trap.id);
      assert.ok(back);
      assert.equal(back.toolType, ToolType.Trap);
      if (back.toolType !== ToolType.Trap) throw new Error('expected a trap');
      assert.equal(back.isAnonymous, true);
    } finally {
      await closeDb(pool);
    }
  });

  it('markConsumed sets both columns and the cause code round-trips', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      const f = await fixtures(pool);
      const trap = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;
      await repo.save(trap, tx);

      const at = new Date('2024-04-01T00:00:00Z');
      await repo.markConsumed(trap.id, 'triggered', at, tx);

      const back = await repo.get(trap.id);
      assert.ok(back);
      assert.ok(back.consumedAt);
      assert.equal(back.consumedAt.getTime(), at.getTime());
      // The schema stores a cause id; the domain speaks in codes. A null here would mean
      // the read path never resolved the lookup.
      assert.equal(back.consumptionCause, 'triggered');
    } finally {
      await closeDb(pool);
    }
  });

  it('countOnPageBy counts only live placements of that type, player and page', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      const f = await fixtures(pool);

      const live = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;
      const consumed = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;
      const otherTool = { ...base(f), toolType: ToolType.Barrel, sgAmount: 0, insideMessage: null, outsideMessage: null, durability: 1, visitCount: 0, contents: new Map(), useLimitFor: () => 1 } as Placement;
      const otherPage = { ...base(f, f.otherPageId), toolType: ToolType.Trap, isAnonymous: false } as Placement;

      for (const p of [live, consumed, otherTool, otherPage]) {
        await repo.save(p, tx);
      }
      await repo.markConsumed(consumed.id, 'triggered', new Date(), tx);

      assert.equal(await repo.countOnPageBy(f.pageId, f.playerId, ToolType.Trap), 1);
      assert.equal(await repo.countOnPageBy(f.otherPageId, f.playerId, ToolType.Trap), 1);
      assert.equal(await repo.countOnPageBy(f.pageId, f.playerId, ToolType.Barrel), 1);
      assert.equal(await repo.countOnPageBy(f.pageId, f.playerId, ToolType.Spider), 0);
    } finally {
      await closeDb(pool);
    }
  });

  it('list honours liveOnly, toolTypes, excludeNsfw and excludeDismissedFor', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPlacementRepository(pool);
      const interactions = new PgPlacementInteractionRepository(pool);
      const f = await fixtures(pool);

      const trap = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;
      const consumedTrap = { ...base(f), toolType: ToolType.Trap, isAnonymous: false } as Placement;
      const cleanDoor = {
        ...base(f), toolType: ToolType.Doorway, destinationUrl: 'https://a', isNsfw: false,
        title: null, comment: null, chargesRemaining: 50, chainRootId: null, nextId: null,
        useLimitFor: () => 1
      } as Placement;
      const nsfwDoor = {
        ...base(f), toolType: ToolType.Doorway, destinationUrl: 'https://b', isNsfw: true,
        title: null, comment: null, chargesRemaining: 50, chainRootId: null, nextId: null,
        useLimitFor: () => 1
      } as Placement;

      for (const p of [trap, consumedTrap, cleanDoor, nsfwDoor]) {
        await repo.save(p, tx);
      }
      await repo.markConsumed(consumedTrap.id, 'triggered', new Date(), tx);

      const liveIds = (
        await repo.list(f.pageId, { excludeNsfw: false, liveOnly: true })
      ).map((p) => p.id);
      assert.equal(liveIds.length, 3);
      assert.ok(!liveIds.includes(consumedTrap.id), 'consumed placements are not live');

      const traps = await repo.list(f.pageId, {
        excludeNsfw: false,
        liveOnly: true,
        toolTypes: [ToolType.Trap]
      });
      assert.deepEqual(traps.map((p) => p.id), [trap.id]);

      const sfw = (
        await repo.list(f.pageId, { excludeNsfw: true, liveOnly: true })
      ).map((p) => p.id);
      assert.ok(sfw.includes(cleanDoor.id), 'a non-NSFW doorway survives the filter');
      assert.ok(!sfw.includes(nsfwDoor.id), 'an NSFW doorway is filtered out');
      assert.ok(sfw.includes(trap.id), 'a trap carries no NSFW flag and is unaffected');

      await interactions.save(
        {
          playerId: f.playerId,
          placementId: trap.id,
          useCount: 0,
          isDismissed: true,
          rating: null,
          ratedAt: null,
          firstSeenAt: new Date(),
          lastUsedAt: null
        },
        tx
      );

      const undismissed = (
        await repo.list(f.pageId, {
          excludeNsfw: false,
          liveOnly: true,
          excludeDismissedFor: f.playerId
        })
      ).map((p) => p.id);
      assert.ok(!undismissed.includes(trap.id), 'dismissed placements are hidden from that player');
      assert.ok(undismissed.includes(cleanDoor.id), 'other placements are unaffected');
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgBarrelContentRepository', { skip: DB_SKIP }, () => {
  it('saves, reads and clears barrel contents', async () => {
    const pool = await freshDb();
    try {
      const placements = new PgPlacementRepository(pool);
      const contents = new PgBarrelContentRepository(pool);
      const f = await fixtures(pool);

      const barrel = {
        ...base(f), toolType: ToolType.Barrel, sgAmount: 0, insideMessage: null,
        outsideMessage: null, durability: 1, visitCount: 0, contents: new Map(),
        useLimitFor: () => 1
      } as Placement;
      await placements.save(barrel, tx);

      await contents.save(
        barrel.id,
        new Map([
          [ToolType.Trap, 3],
          [ToolType.Shield, 1]
        ]),
        tx
      );

      const read = await contents.get(barrel.id);
      assert.equal(read.get(ToolType.Trap), 3);
      assert.equal(read.get(ToolType.Shield), 1);

      await contents.clear(barrel.id, tx);
      assert.equal((await contents.get(barrel.id)).size, 0);
    } finally {
      await closeDb(pool);
    }
  });
});
