import { Pool } from 'pg';
import type { IAdvisoryLock } from '../contracts/unitOfWork.js';
import { executor } from './PgUnitOfWork.js';

export class PgAdvisoryLock implements IAdvisoryLock {
  constructor(private readonly pool: Pool) {}

  async tryAcquire(key: string): Promise<boolean> {
    const exec = executor(this.pool);

    const result = await exec.query(
      `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
      [key]
    );

    return result.rows[0].acquired as boolean;
  }

  async release(key: string): Promise<void> {
    const exec = executor(this.pool);

    await exec.query(
      `SELECT pg_advisory_unlock(hashtext($1))`,
      [key]
    );
  }
}
