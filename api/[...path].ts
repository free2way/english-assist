import type { IncomingMessage, ServerResponse } from 'node:http';
import { initializeDatabase } from '../server/db';
import { app } from '../server/app';

let ready: Promise<void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!ready) {
      ready = initializeDatabase();
    }
    await ready;
    return app(req as any, res as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server initialization failed';
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: false,
      error: message,
      hint: 'Check Vercel runtime logs and environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN',
    }));
  }
}
