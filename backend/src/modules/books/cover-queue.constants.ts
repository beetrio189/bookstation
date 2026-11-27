export const COVER_QUEUE = 'cover';

export enum CoverJob {
  DESTROY = 'destroy',
}

export interface CoverDestroyJobData {
  publicId: string;
}
