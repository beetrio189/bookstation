import { QueueOptions } from 'bullmq';
import { env } from '../config';

const DAY_SECONDS = 24 * 60 * 60;

export const BULLMQ_ROOT_OPTIONS: QueueOptions = {
  connection: { url: env.redisUrl },
};

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * DAY_SECONDS },
};
