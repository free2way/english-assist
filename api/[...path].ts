import type { IncomingMessage, ServerResponse } from 'node:http';

let ready: Promise<{
  app: (req: IncomingMessage, res: ServerResponse) => unknown;
}> | null = null;

const loadServer = async () => {
  const [{ initializeDatabase }, { app }] = await Promise.all([
    import('../server/db'),
    import('../server/app'),
  ]);

  await initializeDatabase();
  return {
    app: app as unknown as (req: IncomingMessage, res: ServerResponse) => unknown,
  };
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!ready) {
      ready = loadServer();
    }
    const server = await ready;
    return server.app(req, res);
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
