import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PlayerId, DomainId, PageId } from '../domain/ids.js';
import type { Player } from '../domain/player.js';
import type { PageCoordinates } from '../domain/geography.js';
import { PlayerClass } from '../domain/enums.js';
import { DB_SKIP, freshDb, closeDb } from '../db/testDb.js';
import { UnknownNormalisationVersion } from '../domain/errors.js';
import { GeographyModule } from './geography.js';
import { PgPageRepository } from '../repositories/PgPageRepository.js';
import { PgDomainRepository } from '../repositories/PgDomainRepository.js';
import { PgPresenceRepository } from '../repositories/PgPresenceRepository.js';
import { PgNormalisationVersionRepository } from '../repositories/PgNormalisationVersionRepository.js';
import { PgUnitOfWork } from '../repositories/PgUnitOfWork.js';

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

function makePlayer(id?: PlayerId): Player {
  return {
    id: id || (randomUUID() as PlayerId),
    name: `player-${randomUUID()}`,
    credentialHash: 'hash',
    email: 'test@example.com',
    activeClass: PlayerClass.Giver,
    karma: 50,
    sg: 1000,
    isModerator: false,
    isOperator: false,
    isActive: true,
    avatarUrl: null,
    comment: null,
    registeredAt: new Date('2024-01-01T00:00:00Z'),
    lastActiveAt: null,
    lastStipendAt: null
  };
}

function makeCoordinates(): PageCoordinates {
  return {
    urlHash: `url-${randomUUID()}`,
    domainHash: `domain-${randomUUID()}`,
    normalisationVersion: 1
  };
}

describe('GeographyModule.resolvePage', { skip: DB_SKIP }, () => {
  it('creates domain and page on first sight', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      assert.ok(page);
      assert.equal(page.urlHash, coords.urlHash);
      assert.equal(page.normalisationVersion, coords.normalisationVersion);

      const domain = await domains.get(page.domainId);
      assert.ok(domain);
      assert.equal(domain.domainHash, coords.domainHash);
      assert.equal(domain.normalisationVersion, coords.normalisationVersion);
    } finally {
      await closeDb(pool);
    }
  });

  it('returns same ids on second call with same coordinates', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords = makeCoordinates();
      const page1 = await geo.resolvePage(coords);
      const page2 = await geo.resolvePage(coords);

      assert.equal(page1.id, page2.id);
      assert.equal(page1.domainId, page2.domainId);
    } finally {
      await closeDb(pool);
    }
  });

  it('different normalisation version yields different page', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords1: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash: `domain-${randomUUID()}`,
        normalisationVersion: 1
      };

      const coords2: PageCoordinates = {
        urlHash: coords1.urlHash,
        domainHash: coords1.domainHash,
        normalisationVersion: 2
      };

      // Version 2 has to be committed: resolvePage reads through the pool and would
      // never see it inside a transaction. normalisation_version is reference data and
      // exempt from freshDb() truncation, so the finally below is what keeps a leaked
      // row from corrupting every later run.
      try {
        await pool.query(
          `INSERT INTO normalisation_version (version, description) VALUES (2, $1)`,
          ['cycle-8 test fixture']
        );

        const page1 = await geo.resolvePage(coords1);
        const page2 = await geo.resolvePage(coords2);

        assert.notEqual(page1.id, page2.id);
        assert.equal(page1.normalisationVersion, 1);
        assert.equal(page2.normalisationVersion, 2);

        const rows = await pool.query(
          `SELECT normalisation_version FROM page WHERE url_hash = $1 ORDER BY normalisation_version`,
          [coords1.urlHash]
        );
        assert.deepEqual(rows.rows.map((r) => r.normalisation_version), [1, 2]);
      } finally {
        await pool.query('DELETE FROM page WHERE normalisation_version = 2');
        await pool.query('DELETE FROM domain WHERE normalisation_version = 2');
        await pool.query('DELETE FROM normalisation_version WHERE version = 2');
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('throws UnknownNormalisationVersion for unknown version', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash: `domain-${randomUUID()}`,
        normalisationVersion: 999
      };

      try {
        await geo.resolvePage(coords);
        assert.fail('Should have thrown UnknownNormalisationVersion');
      } catch (e) {
        assert.ok(e instanceof UnknownNormalisationVersion);
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('throws UnknownNormalisationVersion for retired version', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash: `domain-${randomUUID()}`,
        normalisationVersion: 1
      };

      // BEGIN/ROLLBACK through the pool would be unsound: each pool.query may take a
      // different connection, so the UPDATE can land outside the transaction and commit,
      // permanently retiring version 1 for every later test. Commit the retirement and
      // restore it in the finally instead.
      await pool.query(
        `UPDATE normalisation_version SET retired_at = now() WHERE version = 1`
      );
      try {
        await geo.resolvePage(coords);
        assert.fail('Should have thrown UnknownNormalisationVersion');
      } catch (e) {
        assert.ok(e instanceof UnknownNormalisationVersion);
      } finally {
        await pool.query(
          `UPDATE normalisation_version SET retired_at = NULL WHERE version = 1`
        );
      }
    } finally {
      await closeDb(pool);
    }
  });

  it('concurrent resolvePage calls create one page and return same id to both', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords = makeCoordinates();

      // Start both promises concurrently
      const [page1, page2] = await Promise.all([
        geo.resolvePage(coords),
        geo.resolvePage(coords)
      ]);

      assert.equal(page1.id, page2.id);
      assert.equal(page1.domainId, page2.domainId);

      // Verify only one page row exists
      const allPages = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM page WHERE url_hash = $1 AND normalisation_version = $2`,
        [coords.urlHash, coords.normalisationVersion]
      );
      assert.equal(allPages.rows[0].cnt, 1);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.enter', { skip: DB_SKIP }, () => {
  it('creates presence on page entry', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      await geo.enter(actor, page);

      const pres = await presence.get(actor.id);
      assert.ok(pres);
      assert.equal(pres.playerId, actor.id);
      assert.equal(pres.pageId, page.id);
    } finally {
      await closeDb(pool);
    }
  });

  it('moving to different page updates arrived_at', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords1 = makeCoordinates();
      const coords2 = makeCoordinates();
      const page1 = await geo.resolvePage(coords1);
      const page2 = await geo.resolvePage(coords2);

      // Enter first page
      await geo.enter(actor, page1);
      const pres1 = await presence.get(actor.id);
      assert.ok(pres1);
      const arrived1 = pres1.arrivedAt;

      // Wait a bit and enter second page
      await new Promise(resolve => setTimeout(resolve, 10));
      await geo.enter(actor, page2);
      const pres2 = await presence.get(actor.id);
      assert.ok(pres2);
      const arrived2 = pres2.arrivedAt;

      // Verify page changed and arrived_at advanced
      assert.equal(pres2.pageId, page2.id);
      assert.ok(arrived2.getTime() > arrived1.getTime());

      // Verify only one presence row for the player
      const allPres = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM presence WHERE player_id = $1`,
        [actor.id]
      );
      assert.equal(allPres.rows[0].cnt, 1);
    } finally {
      await closeDb(pool);
    }
  });

  it('re-entering same page advances last_seen_at but not arrived_at', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      await geo.enter(actor, page);
      const pres1 = await presence.get(actor.id);
      assert.ok(pres1);
      const arrived1 = pres1.arrivedAt;
      const seen1 = pres1.lastSeenAt;

      // Wait and re-enter same page
      await new Promise(resolve => setTimeout(resolve, 10));
      await geo.enter(actor, page);
      const pres2 = await presence.get(actor.id);
      assert.ok(pres2);
      const arrived2 = pres2.arrivedAt;
      const seen2 = pres2.lastSeenAt;

      assert.equal(arrived1.getTime(), arrived2.getTime());
      assert.ok(seen2.getTime() > seen1.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('increments domain hit_count on entry', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor1 = makePlayer();
      const actor2 = makePlayer();
      await insertPlayer(pool, actor1.id);
      await insertPlayer(pool, actor2.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      const domain1 = await domains.get(page.domainId);
      assert.ok(domain1);
      const hitCount1 = domain1.hitCount;

      await geo.enter(actor1, page);
      const domain2 = await domains.get(page.domainId);
      assert.ok(domain2);
      assert.equal(domain2.hitCount, hitCount1 + 1);

      await geo.enter(actor2, page);
      const domain3 = await domains.get(page.domainId);
      assert.ok(domain3);
      assert.equal(domain3.hitCount, hitCount1 + 2);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.leave', { skip: DB_SKIP }, () => {
  it('removes presence', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      await geo.enter(actor, page);
      const pres1 = await presence.get(actor.id);
      assert.ok(pres1);

      await geo.leave(actor);
      const pres2 = await presence.get(actor.id);
      assert.equal(pres2, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('is idempotent when called twice', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      await geo.enter(actor, page);
      await geo.leave(actor);
      await geo.leave(actor); // Should not throw
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.touch', { skip: DB_SKIP }, () => {
  it('advances last_seen_at for player with presence', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const actor = makePlayer();
      await insertPlayer(pool, actor.id);
      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      await geo.enter(actor, page);
      const pres1 = await presence.get(actor.id);
      assert.ok(pres1);
      const seen1 = pres1.lastSeenAt;

      const newTime = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));
      await geo.touch(actor.id, newTime);

      const pres2 = await presence.get(actor.id);
      assert.ok(pres2);
      assert.ok(pres2.lastSeenAt.getTime() > seen1.getTime());
    } finally {
      await closeDb(pool);
    }
  });

  it('is no-op for player without presence', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const playerId = randomUUID() as PlayerId;
      // Player never entered any page
      await geo.touch(playerId, new Date()); // Should not throw

      // Verify no presence row was created
      const pres = await presence.get(playerId);
      assert.equal(pres, null);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.listOccupants', { skip: DB_SKIP }, () => {
  it('returns all players on a page', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords = makeCoordinates();
      const page = await geo.resolvePage(coords);

      const actor1 = makePlayer();
      const actor2 = makePlayer();
      await insertPlayer(pool, actor1.id);
      await insertPlayer(pool, actor2.id);

      await geo.enter(actor1, page);
      await geo.enter(actor2, page);

      const occupants = await geo.listOccupants(page.id);
      assert.equal(occupants.length, 2);
      const playerIds = occupants.map(p => p.playerId);
      assert.ok(playerIds.includes(actor1.id));
      assert.ok(playerIds.includes(actor2.id));
    } finally {
      await closeDb(pool);
    }
  });

  it('does not include players on other pages', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const coords1 = makeCoordinates();
      const coords2 = makeCoordinates();
      const page1 = await geo.resolvePage(coords1);
      const page2 = await geo.resolvePage(coords2);

      const actor1 = makePlayer();
      const actor2 = makePlayer();
      await insertPlayer(pool, actor1.id);
      await insertPlayer(pool, actor2.id);

      await geo.enter(actor1, page1);
      await geo.enter(actor2, page2);

      const occupants = await geo.listOccupants(page1.id);
      assert.equal(occupants.length, 1);
      assert.equal(occupants[0].playerId, actor1.id);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.expireStalePresence', { skip: DB_SKIP }, () => {
  it('removes only rows older than cutoff', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      // Manually insert old presence rows since we can't control the exact timestamp
      const oldTime = new Date('2024-01-01T00:00:00Z');
      const recentTime = new Date('2025-08-17T12:00:00Z');

      const p1: PlayerId = randomUUID() as PlayerId;
      const p2: PlayerId = randomUUID() as PlayerId;
      const p3: PlayerId = randomUUID() as PlayerId;
      const pageId = randomUUID() as PageId;
      const domainId = randomUUID() as DomainId;

      // Insert domain and page first
      await pool.query(
        `INSERT INTO domain (id, domain_hash, normalisation_version, first_seen_at)
         VALUES ($1, $2, $3, $4)`,
        [domainId, `domain-${pageId}`, 1, new Date('2024-01-01T00:00:00Z')]
      );

      await pool.query(
        `INSERT INTO page (id, url_hash, domain_id, normalisation_version, first_seen_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [pageId, `url-${pageId}`, domainId, 1, new Date('2024-01-01T00:00:00Z')]
      );

      // Insert players
      await insertPlayer(pool, p1);
      await insertPlayer(pool, p2);
      await insertPlayer(pool, p3);

      await pool.query(
        `INSERT INTO presence (player_id, page_id, arrived_at, last_seen_at)
         VALUES ($1, $2, $3, $3)`,
        [p1, pageId, oldTime]
      );

      await pool.query(
        `INSERT INTO presence (player_id, page_id, arrived_at, last_seen_at)
         VALUES ($1, $2, $3, $3)`,
        [p2, pageId, oldTime]
      );

      await pool.query(
        `INSERT INTO presence (player_id, page_id, arrived_at, last_seen_at)
         VALUES ($1, $2, $3, $3)`,
        [p3, pageId, recentTime]
      );

      const cutoff = new Date('2024-01-01T01:00:00Z');
      const deleted = await geo.expireStalePresence(cutoff);

      assert.equal(deleted, 2);

      const remaining = await presence.get(p3);
      assert.ok(remaining);

      const gone1 = await presence.get(p1);
      assert.equal(gone1, null);
    } finally {
      await closeDb(pool);
    }
  });

  it('returns 0 on second run', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const futureTime = new Date('2099-01-01T00:00:00Z');
      const deleted1 = await geo.expireStalePresence(futureTime);
      assert.equal(deleted1, 0);

      const deleted2 = await geo.expireStalePresence(futureTime);
      assert.equal(deleted2, 0);
    } finally {
      await closeDb(pool);
    }
  });
});

describe('GeographyModule.listPagesInDomain', { skip: DB_SKIP }, () => {
  it('returns pages in domain excluding specified page', async () => {
    const pool = await freshDb();
    try {
      const pages = new PgPageRepository(pool);
      const domains = new PgDomainRepository(pool);
      const presence = new PgPresenceRepository(pool);
      const versions = new PgNormalisationVersionRepository(pool);
      const uow = new PgUnitOfWork(pool);
      const geo = new GeographyModule(pages, domains, presence, versions, uow);

      const domainHash = `domain-${randomUUID()}`;
      const coords1: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash,
        normalisationVersion: 1
      };
      const coords2: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash,
        normalisationVersion: 1
      };
      const coords3: PageCoordinates = {
        urlHash: `url-${randomUUID()}`,
        domainHash,
        normalisationVersion: 1
      };

      const page1 = await geo.resolvePage(coords1);
      const page2 = await geo.resolvePage(coords2);
      const page3 = await geo.resolvePage(coords3);

      const result = await geo.listPagesInDomain(page1.domainId, page1.id);

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
