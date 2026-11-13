import { Request } from 'express';
import { ThrottleByKey } from './throttle-by-key.decorator';

export const readIpEmail = (request: Request): string | undefined => {
  const email = (request.body as { email?: unknown } | undefined)?.email;
  
  return typeof email === 'string'
    ? `${request.ip}:${email.trim().toLowerCase()}`
    : undefined;
};

export const ThrottleByIpEmail = (options: { limit: number; ttl: number }) =>
  ThrottleByKey({ ...options, name: 'ip-email', getKey: readIpEmail });
