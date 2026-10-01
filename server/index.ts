import 'dotenv/config';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import resourcesHandler from '../api/resources.ts';

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '127.0.0.1';

type HeaderValue = string | string[] | undefined;

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

function createRouteResponse(res: ServerResponse) {
  return {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(body));
    },
    setHeader(name: string, value: string) {
      res.setHeader(name, value);
    },
    end(body?: string) {
      res.end(body);
    },
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  if (!req.url || !req.method) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/resources') {
    const body = await readBody(req);
    await resourcesHandler(
      {
        method: req.method,
        headers: req.headers as Record<string, HeaderValue>,
        query: Object.fromEntries(url.searchParams.entries()),
        url: url.toString(),
        body,
      },
      createRouteResponse(res),
    );
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}

async function start() {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error('API server error:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(
        JSON.stringify({
          error:
            process.env.NODE_ENV === 'production'
              ? 'Internal server error'
              : error instanceof Error
                ? error.message
                : 'Internal server error',
        }),
      );
    });
  });

  server.listen(PORT, HOST, () => {
    console.log(`API server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});
