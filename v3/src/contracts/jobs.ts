import type { Transaction } from './unitOfWork.js';
import type { JobName } from '../domain/enums.js';
import type { JobResult, JobRunRecord } from '../domain/progression.js';

export interface ScheduledJob {
  readonly name: JobName;
  readonly intervalMs: number;
  run(now: Date, tx: Transaction): Promise<JobResult>;
}

export interface IJobRunner {
  invoke(name: JobName, now: Date): Promise<JobRunRecord>;
}
