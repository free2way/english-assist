import type { IncomingMessage, ServerResponse } from 'node:http';
import { initializeDatabase } from '../server/db';
import { app } from '../server/app';

const ready = initializeDatabase();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  return app(req as any, res as any);
}
