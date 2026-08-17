import { Pool } from 'pg';
import type { Transaction } from '../contracts/unitOfWork.js';
import type { IDomainRepository } from '../contracts/repositories.js';
import type { DomainId } from '../domain/ids.js';
import type { WebDomain } from '../domain/geography.js';
import { executor } from './PgUnitOfWork.js';

function dbToDomain(row: {
  id: string;
  domain_hash: string;
  normalisation_version: number;
  uri: string | null;
  hit_count: string;
  first_seen_at: Date;
}): WebDomain {
  return {
    id: row.id as DomainId,
    domainHash: row.domain_hash,
    normalisationVersion: row.normalisation_version,
    uri: row.uri,
    hitCount: Number(row.hit_count),
    firstSeenAt: row.first_seen_at
  };
}

export class PgDomainRepository implements IDomainRepository {
  constructor(private readonly pool: Pool) {}

  async get(id: DomainId): Promise<WebDomain | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, domain_hash, normalisation_version, uri, hit_count, first_seen_at
       FROM domain WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToDomain(result.rows[0]);
  }

  async getByHash(
    domainHash: string,
    normalisationVersion: number
  ): Promise<WebDomain | null> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT id, domain_hash, normalisation_version, uri, hit_count, first_seen_at
       FROM domain WHERE domain_hash = $1 AND normalisation_version = $2`,
      [domainHash, normalisationVersion]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return dbToDomain(result.rows[0]);
  }

  async save(domain: WebDomain, _tx: Transaction): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `INSERT INTO domain (id, domain_hash, normalisation_version, uri, hit_count, first_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (domain_hash, normalisation_version) DO NOTHING`,
      [
        domain.id,
        domain.domainHash,
        domain.normalisationVersion,
        domain.uri,
        domain.hitCount,
        domain.firstSeenAt
      ]
    );
  }
}
