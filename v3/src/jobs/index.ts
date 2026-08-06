import { NotImplemented } from '../domain/errors.js';
import { EconomyModule } from '../modules/economy.js';
import { GeographyModule } from '../modules/geography.js';
import { WorldModule } from '../modules/world.js';
import type { IAdvisoryLock, Transaction } from '../contracts/unitOfWork.js';
import type { IJobRunner, ScheduledJob } from '../contracts/jobs.js';
import type { IJobRunRepository } from '../contracts/repositories.js';
import type { JobName } from '../domain/enums.js';
import type { JobResult, JobRunRecord } from '../domain/progression.js';

export class StipendJob implements ScheduledJob {
  readonly name: JobName = 'stipend';
  readonly intervalMs: number = 3_600_000;

  constructor(private readonly economy: EconomyModule) {}

  async run(now: Date, tx: Transaction): Promise<JobResult> {
    await this.economy.runStipend(now, {} as never, this.intervalMs, this.intervalMs);
    void tx;
    throw new NotImplemented('StipendJob.run');
  }
}

export class SpiderMovementJob implements ScheduledJob {
  readonly name: JobName = 'spider_movement';
  readonly intervalMs: number = 3_600_000;

  constructor(private readonly world: WorldModule) {}

  async run(now: Date, tx: Transaction): Promise<JobResult> {
    await this.world.moveWanderingSpiders(now);
    void tx;
    throw new NotImplemented('SpiderMovementJob.run');
  }
}

export class PresenceExpiryJob implements ScheduledJob {
  readonly name: JobName = 'presence_expiry';
  readonly intervalMs: number = 300_000;

  constructor(private readonly geography: GeographyModule) {}

  async run(now: Date, tx: Transaction): Promise<JobResult> {
    await this.geography.expireStalePresence(now);
    void tx;
    throw new NotImplemented('PresenceExpiryJob.run');
  }
}

export class JobRunner implements IJobRunner {
  constructor(
    private readonly jobs: ReadonlyMap<JobName, ScheduledJob>,
    private readonly runs: IJobRunRepository,
    private readonly lock: IAdvisoryLock
  ) {}

  async invoke(name: JobName, now: Date): Promise<JobRunRecord> {
    const acquired = await this.lock.tryAcquire(`job:${name}`);
    const runId = await this.runs.open(name, now);
    const job = this.jobs.get(name);

    if (acquired && job) {
      await job.run(now, {} as Transaction);
    }

    await this.runs.close(runId, {});
    await this.lock.release(`job:${name}`);

    throw new NotImplemented('JobRunner.invoke');
  }
}
