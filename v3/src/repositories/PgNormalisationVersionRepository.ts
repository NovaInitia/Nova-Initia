import { Pool } from 'pg';
import type { INormalisationVersionRepository } from '../contracts/repositories.js';
import { executor } from './PgUnitOfWork.js';

export class PgNormalisationVersionRepository implements INormalisationVersionRepository {
  constructor(private readonly pool: Pool) {}

  async isAcceptable(version: number): Promise<boolean> {
    const exec = executor(this.pool);
    const result = await exec.query(
      `SELECT 1 FROM normalisation_version WHERE version = $1 AND retired_at IS NULL`,
      [version]
    );
    return result.rows.length > 0;
  }
}
