import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IPageRepository } from '../contracts/repositories.js';
import type { DomainId, PageId } from '../domain/ids.js';
import type { Page } from '../domain/geography.js';
import { executor } from './PgUnitOfWork.js';

function dbToPage(row: {
  id: string;
  url_hash: string;
  domain_id: string;
  normalisation_version: number;
  first_seen_at: Date;
}): Page {
  return {
    id: row.id as PageId,
    urlHash: row.url_hash,
    domainId: row.domain_id as DomainId,
    normalisationVersion: row.normalisation_version,
    firstSeenAt: row.first_seen_at
  };
}

export class PgPageRepository implements IPageRepository {
  constructor(private readonly pool: Pool) {}

  async get(id: PageId): Promise<Page | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, url_hash, domain_id, normalisation_version, first_seen_at
       FROM page WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToPage(result.rows[0]);
  }

  async getByHash(
    urlHash: string,
    normalisationVersion: number
  ): Promise<Page | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, url_hash, domain_id, normalisation_version, first_seen_at
       FROM page WHERE url_hash = $1 AND normalisation_version = $2`,
      [urlHash, normalisationVersion]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToPage(result.rows[0]);
  }

  async save(page: Page, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO page (id, url_hash, domain_id, normalisation_version, first_seen_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (url_hash, normalisation_version) DO NOTHING`,
      [
        page.id,
        page.urlHash,
        page.domainId,
        page.normalisationVersion,
        page.firstSeenAt
      ]
    );
  }

  async listInDomain(domainId: DomainId, excluding: PageId): Promise<Page[]> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, url_hash, domain_id, normalisation_version, first_seen_at
       FROM page WHERE domain_id = $1 AND id != $2
       ORDER BY first_seen_at ASC`,
      [domainId, excluding]
    );

    return result.rows.map(dbToPage);
  }
}
