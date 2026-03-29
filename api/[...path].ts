import type { IncomingMessage, ServerResponse } from 'node:http';

type RuntimeModules = {
  initializeDatabase: () => Promise<void>;
  app: (req: IncomingMessage, res: ServerResponse) => unknown;
};

let runtimePromise: Promise<RuntimeModules> | null = null;
let ready: Promise<void> | null = null;

const loadRuntime = async (): Promise<RuntimeModules> => {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import('../server/db.ts'),
      import('../server/app.ts'),
    ]).then(([dbModule, appModule]) => ({
      initializeDatabase: dbModule.initializeDatabase,
      app: appModule.app,
    }));
  }

  return runtimePromise;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const runtime = await loadRuntime();
    if (!ready) {
      ready = runtime.initializeDatabase();
    }
    await ready;
    return runtime.app(req as any, res as any);
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
