import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { DomainId, PageId, PlayerId } from '../domain/ids.js';
import type { WebDomain, Page, Presence } from '../domain/geography.js';
import { PlayerClass } from '../domain/enums.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { PgDomainRepository } from './PgDomainRepository.js';
import { PgPageRepository } from './PgPageRepository.js';
import { PgPresenceRepository } from './PgPresenceRepository.js';
import { PgNormalisationVersionRepository } from './PgNormalisationVersionRepository.js';

function makeDomain(id?: DomainId): WebDomain {
  return {
    id: id || (randomUUID() as DomainId),
    domainHash: `hash-${randomUUID()}`,
    normalisationVersion: 1,
    uri: null,
    hitCount: 0,
    firstSeenAt: new Date('2024-01-01T00:00:00Z')
  };
}

function makePage(id?: PageId, domainId?: DomainId): Page {
  return {
    id: id || (randomUUID() as PageId),
    urlHash: `url-${randomUUID()}`,
    domainId: domainId || (randomUUID() as DomainId),
    normalisationVersion: 1,
    firstSeenAt: new Date('2024-01-01T00:00:00Z')
  };
}

function makePresence(playerId?: PlayerId, pageId?: PageId): Presence {
  return {
    playerId: playerId || (randomUUID() as PlayerId),
    pageId: pageId || (randomUUID() as PageId),
    arrivedAt: new Date('2024-01-01T00:00:00Z'),
    lastSeenAt: new Date('2024-01-01T01:00:00Z')
  };
}

async function insertPlayer(pool: Pool, playerId: PlayerId): Promise<void> {
  await pool.query(
    `INSERT INTO player (id, name, credential_hash, email, active_class_id, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      playerId,
      `player-${playerId}`,
      'hash',
      'test@example.com',
      PlayerClass.Giver,
      new Date('2024-01-01T00:00:00Z')
    ]
  );
}

async function insertPageForPresence(pool: Pool, pageId: PageId): Promise<void> {
  // First insert a domain
  const domainId = randomUUID() as DomainId;
  await pool.query(
    `INSERT INTO domain (id, domain_hash, normalisation_version, first_seen_at)
     VALUES ($1, $2, $3, $4)`,
    [
      domainId,
      `domain-${pageId}`,
      1,
      new Date('2024-01-01T00:00:00Z')
    ]
  );

  // Then insert the page
  await pool.query(
    `INSERT INTO page (id, url_hash, domain_id, normalisation_version, first_seen_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      pageId,
      `url-${pageId}`,
      domainId,
      1,
      new Date('2024-01-01T00:00:00Z')
    ]
  );
}

describe('PgDomainRepository', { skip: DB_SKIP }, () => {
  it('get by id returns null for unknown id', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgDomainRepository(pool);
      const result = await repo.get(randomUUID() as DomainId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('round-trip: save and get returns all fields', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgDomainRepository(pool);
      const tx = { id: 'tx1' };

      const domain = makeDomain();
      await repo.save(domain, tx);
      const retrieved = await repo.get(domain.id);

      assert.ok(retrieved);
      assert.equal(retrieved.id, domain.id);
      assert.equal(retrieved.domainHash, domain.domainHash);
      assert.equal(retrieved.normalisationVersion, domain.normalisationVersion);
      assert.equal(retrieved.uri, domain.uri);
      assert.equal(retrieved.hitCount, domain.hitCount);
      assert.equal(retrieved.firstSeenAt.getTime(), domain.firstSeenAt.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('getByHash returns null for unknown hash', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgDomainRepository(pool);
      const result = await repo.getByHash('unknown-hash', 1);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('getByHash returns domain by natural key', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgDomainRepository(pool);
      const tx = { id: 'tx1' };

      const domain = makeDomain();
      await repo.save(domain, tx);

      const retrieved = await repo.getByHash(domain.domainHash, domain.normalisationVersion);
      assert.ok(retrieved);
      assert.equal(retrieved.id, domain.id);
      assert.equal(retrieved.domainHash, domain.domainHash);
    } finally {
      await closeDb(pool);
    }
  });

  it('same hash at different version is different entity', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgDomainRepository(pool);
      const tx = { id: 'tx1' };

      const hash = `hash-${randomUUID()}`;
      const domain1: WebDomain = {
        id: randomUUID() as DomainId,
        domainHash: hash,
        normalisationVersion: 1,
        uri: null,
        hitCount: 0,
        firstSeenAt: new Date('2024-01-01T00:00:00Z')
      };

      const domain2: WebDomain = { ...domain1, id: randomUUID() as DomainId, normalisationVersion: 2 };

      // Version 2 must exist for the foreign key, and must be removed again: this table is
      // reference data and survives freshDb() truncation.
      try {
        await pool.query(
          `INSERT INTO normalisation_version (version, description) VALUES (2, $1)`,
          ['cycle-8 test fixture']
        );
        await repo.save(domain1, tx);
        await repo.save(domain2, tx);

        const v1 = await repo.getByHash(hash, 1);
        const v2 = await repo.getByHash(hash, 2);
        assert.ok(v1);
        assert.ok(v2);
        assert.equal(v1.id, domain1.id);
        assert.equal(v2.id, domain2.id);
        assert.notEqual(v1.id, v2.id);
      } finally {
        await pool.query('DELETE FROM domain WHERE normalisation_version = 2');
        await pool.query('DELETE FROM normalisation_version WHERE version = 2');
      }
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgPageRepository', { skip: DB_SKIP }, () => {
  it('get by id returns null for unknown id', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPageRepository(pool);
      const result = await repo.get(randomUUID() as PageId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('round-trip: save and get returns all fields', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const tx = { id: 'tx1' };

      const domain = makeDomain();
      await domainRepo.save(domain, tx);

      const page = makePage(undefined, domain.id);
      await pageRepo.save(page, tx);
      const retrieved = await pageRepo.get(page.id);

      assert.ok(retrieved);
      assert.equal(retrieved.id, page.id);
      assert.equal(retrieved.urlHash, page.urlHash);
      assert.equal(retrieved.domainId, page.domainId);
      assert.equal(retrieved.normalisationVersion, page.normalisationVersion);
      assert.equal(retrieved.firstSeenAt.getTime(), page.firstSeenAt.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('getByHash returns null for unknown hash', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPageRepository(pool);
      const result = await repo.getByHash('unknown-hash', 1);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('getByHash returns page by natural key', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const tx = { id: 'tx1' };

      const domain = makeDomain();
      await domainRepo.save(domain, tx);

      const page = makePage(undefined, domain.id);
      await pageRepo.save(page, tx);

      const retrieved = await pageRepo.getByHash(page.urlHash, page.normalisationVersion);
      assert.ok(retrieved);
      assert.equal(retrieved.id, page.id);
      assert.equal(retrieved.urlHash, page.urlHash);
    } finally {
      await closeDb(pool);
    }
  });

  it('listInDomain returns pages in domain excluding specified', async () => {
    const pool = await freshDb();
    try {
      const domainRepo = new PgDomainRepository(pool);
      const pageRepo = new PgPageRepository(pool);
      const tx = { id: 'tx1' };

      const domain = makeDomain();
      await domainRepo.save(domain, tx);

      const page1 = makePage(undefined, domain.id);
      const page2 = makePage(undefined, domain.id);
      const page3 = makePage(undefined, domain.id);
      await pageRepo.save(page1, tx);
      await pageRepo.save(page2, tx);
      await pageRepo.save(page3, tx);

      const result = await pageRepo.listInDomain(domain.id, page1.id);
      assert.equal(result.length, 2);
      const ids = result.map(p => p.id);
      assert.ok(ids.includes(page2.id));
      assert.ok(ids.includes(page3.id));
      assert.ok(!ids.includes(page1.id));
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgPresenceRepository', { skip: DB_SKIP }, () => {
  it('get by playerId returns null for unknown player', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const result = await repo.get(randomUUID() as PlayerId);
      assert.equal(result, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('round-trip: save and get returns all fields', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const presence = makePresence();
      await insertPlayer(pool, presence.playerId);
      await insertPageForPresence(pool, presence.pageId);
      await repo.save(presence, tx);
      const retrieved = await repo.get(presence.playerId);

      assert.ok(retrieved);
      assert.equal(retrieved.playerId, presence.playerId);
      assert.equal(retrieved.pageId, presence.pageId);
      assert.equal(retrieved.arrivedAt.getTime(), presence.arrivedAt.getTime());
      assert.equal(retrieved.lastSeenAt.getTime(), presence.lastSeenAt.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('listOnPage returns all presences on page', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const pageId = randomUUID() as PageId;
      const page3Id = randomUUID() as PageId;
      const p1 = makePresence(undefined, pageId);
      const p2 = makePresence(undefined, pageId);
      const p3 = makePresence(undefined, page3Id);

      await insertPlayer(pool, p1.playerId);
      await insertPlayer(pool, p2.playerId);
      await insertPlayer(pool, p3.playerId);
      await insertPageForPresence(pool, pageId);
      await insertPageForPresence(pool, page3Id);

      await repo.save(p1, tx);
      await repo.save(p2, tx);
      await repo.save(p3, tx);

      const result = await repo.listOnPage(pageId);
      assert.equal(result.length, 2);
      const playerIds = result.map(p => p.playerId);
      assert.ok(playerIds.includes(p1.playerId));
      assert.ok(playerIds.includes(p2.playerId));
      assert.ok(!playerIds.includes(p3.playerId));
    } finally {
      await closeDb(pool);
    }
  });

  it('save with different page updates arrived_at and last_seen_at', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const page1 = randomUUID() as PageId;
      const page2 = randomUUID() as PageId;

      await insertPlayer(pool, playerId);
      await insertPageForPresence(pool, page1);
      await insertPageForPresence(pool, page2);

      const t1 = new Date('2024-01-01T00:00:00Z');
      const t2 = new Date('2024-01-01T01:00:00Z');
      const t3 = new Date('2024-01-01T02:00:00Z');

      const p1: Presence = {
        playerId,
        pageId: page1,
        arrivedAt: t1,
        lastSeenAt: t2
      };

      await repo.save(p1, tx);

      const p2: Presence = {
        playerId,
        pageId: page2,
        arrivedAt: t3,
        lastSeenAt: t3
      };

      await repo.save(p2, tx);

      const retrieved = await repo.get(playerId);
      assert.ok(retrieved);
      assert.equal(retrieved.pageId, page2);
      assert.equal(retrieved.arrivedAt.getTime(), t3.getTime()); // Should be updated
      assert.equal(retrieved.lastSeenAt.getTime(), t3.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('save on same page only updates last_seen_at', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;

      await insertPlayer(pool, playerId);
      await insertPageForPresence(pool, pageId);

      const t1 = new Date('2024-01-01T00:00:00Z');
      const t2 = new Date('2024-01-01T01:00:00Z');
      const t3 = new Date('2024-01-01T02:00:00Z');

      const p1: Presence = {
        playerId,
        pageId,
        arrivedAt: t1,
        lastSeenAt: t2
      };

      await repo.save(p1, tx);

      const p2: Presence = {
        playerId,
        pageId,
        arrivedAt: t3, // This should be ignored
        lastSeenAt: t3
      };

      await repo.save(p2, tx);

      const retrieved = await repo.get(playerId);
      assert.ok(retrieved);
      assert.equal(retrieved.pageId, pageId);
      assert.equal(retrieved.arrivedAt.getTime(), t1.getTime()); // Should NOT be updated
      assert.equal(retrieved.lastSeenAt.getTime(), t3.getTime()); // Should be updated
    } finally {
      await closeDb(pool);
    }
  });

  it('remove deletes presence', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const presence = makePresence();
      await insertPlayer(pool, presence.playerId);
      await insertPageForPresence(pool, presence.pageId);
      await repo.save(presence, tx);

      await repo.remove(presence.playerId, tx);

      const retrieved = await repo.get(presence.playerId);
      assert.equal(retrieved, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('remove is idempotent when player not present', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const playerId = randomUUID() as PlayerId;
      // Should not throw
      await repo.remove(playerId, tx);
      await repo.remove(playerId, tx);
    } finally {
      await closeDb(pool);
    }
  });

  it('removeStale deletes only older presences and returns count', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const t1 = new Date('2024-01-01T00:00:00Z');
      const t2 = new Date('2024-01-01T01:00:00Z');
      const t3 = new Date('2024-01-01T02:00:00Z');

      const p1: Presence = {
        playerId: randomUUID() as PlayerId,
        pageId: randomUUID() as PageId,
        arrivedAt: t1,
        lastSeenAt: t1 // Very old
      };

      const p2: Presence = {
        playerId: randomUUID() as PlayerId,
        pageId: randomUUID() as PageId,
        arrivedAt: t2,
        lastSeenAt: t2 // Still old
      };

      const p3: Presence = {
        playerId: randomUUID() as PlayerId,
        pageId: randomUUID() as PageId,
        arrivedAt: t3,
        lastSeenAt: t3 // Recent
      };

      await insertPlayer(pool, p1.playerId);
      await insertPlayer(pool, p2.playerId);
      await insertPlayer(pool, p3.playerId);
      await insertPageForPresence(pool, p1.pageId);
      await insertPageForPresence(pool, p2.pageId);
      await insertPageForPresence(pool, p3.pageId);

      await repo.save(p1, tx);
      await repo.save(p2, tx);
      await repo.save(p3, tx);

      const cutoff = new Date('2024-01-01T01:30:00Z');
      const deleted = await repo.removeStale(cutoff, tx);

      assert.equal(deleted, 2); // p1 and p2 should be deleted

      const remaining = await repo.get(p3.playerId);
      assert.ok(remaining);
      assert.equal(remaining.playerId, p3.playerId);

      const deleted1 = await repo.get(p1.playerId);
      assert.equal(deleted1, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('removeStale returns 0 on second run', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgPresenceRepository(pool);
      const tx = { id: 'tx1' };

      const presence = makePresence();
      await insertPlayer(pool, presence.playerId);
      await insertPageForPresence(pool, presence.pageId);
      await repo.save(presence, tx);

      const cutoff = new Date('2025-01-01T00:00:00Z');
      const deleted1 = await repo.removeStale(cutoff, tx);
      assert.ok(deleted1 > 0);

      const deleted2 = await repo.removeStale(cutoff, tx);
      assert.equal(deleted2, 0);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('PgNormalisationVersionRepository', { skip: DB_SKIP }, () => {
  it('isAcceptable returns true for version 1 (default)', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgNormalisationVersionRepository(pool);
      const result = await repo.isAcceptable(1);
      assert.equal(result, true);
    } finally {
      await closeDb(pool);
    }
  });

  it('isAcceptable returns false for unknown version', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgNormalisationVersionRepository(pool);
      const result = await repo.isAcceptable(999);
      assert.equal(result, false);
    } finally {
      await closeDb(pool);
    }
  });

  it('isAcceptable returns false for retired version', async () => {
    const pool = await freshDb();
    try {
      const repo = new PgNormalisationVersionRepository(pool);

      // First verify version 1 is acceptable
      let result = await repo.isAcceptable(1);
      assert.equal(result, true);

      // BEGIN/ROLLBACK issued through the pool is unsound: each pool.query may run on a
      // different connection, so the UPDATE can land outside the transaction and commit,
      // leaving version 1 permanently retired and breaking every later page resolution.
      // Commit the retirement and restore it in the finally instead.
      await pool.query(
        `UPDATE normalisation_version SET retired_at = now() WHERE version = 1`
      );
      try {
        result = await repo.isAcceptable(1);
        assert.equal(result, false);
      } finally {
        await pool.query(
          `UPDATE normalisation_version SET retired_at = NULL WHERE version = 1`
        );
      }

      result = await repo.isAcceptable(1);
      assert.equal(result, true);
    } finally {
      await closeDb(pool);
    }
  });
});
