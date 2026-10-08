import 'dotenv/config';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import resourcesHandler from '../api/resources.ts';
import { ragHandler } from './ragHandler.ts';
import { learnerHandler } from './learnerHandler.ts';
import { studyAgentHandler } from './studyAgentHandler.ts';
import { evaluationHandler } from './evaluationHandler.ts';
import { videoHandler } from './videoHandler.ts';
import { dagHandler } from './dagHandler.ts';

import crypto from 'node:crypto';
import fs from 'node:fs';
import { handleAiGenerate } from './aiProxyHandler.ts';
import { prisma } from './prisma.ts';
import {
  getLivenessStatus,
  getReadinessStatus,
  getComprehensiveHealth,
  logStructured,
  safeUserId,
} from './observability.ts';
import { assertValidConfiguration } from './configValidator.ts';

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '127.0.0.1';
const SERVER_START_TIME = Date.now();

type HeaderValue = string | string[] | undefined;

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ming-test-key, x-ming-user-id, x-dev-user-id, x-request-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
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
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const startTime = Date.now();

  res.setHeader('x-request-id', requestId);

  // Structured request completion logging (excluding sensitive payloads)
  const originalEnd = res.end;
  let logged = false;
  res.end = function (...args: any[]) {
    if (!logged) {
      logged = true;
      const durationMs = Date.now() - startTime;
      if (url.pathname !== '/api/health') {
        console.log(
          JSON.stringify({
            level: 'info',
            timestamp: new Date().toISOString(),
            requestId,
            method: req.method,
            path: url.pathname,
            statusCode: res.statusCode,
            durationMs,
          }),
        );
      }
    }
    return originalEnd.apply(this, args);
  } as any;

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 1. Liveness Probe
  if (req.method === 'GET' && url.pathname === '/api/health/live') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(getLivenessStatus()));
    return;
  }

  // 2. Readiness Probe
  if (req.method === 'GET' && url.pathname === '/api/health/ready') {
    const readiness = await getReadinessStatus();
    res.statusCode = readiness.statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(readiness));
    return;
  }

  // 3. Comprehensive Health Diagnostic
  if (req.method === 'GET' && url.pathname === '/api/health') {
    const health = await getComprehensiveHealth();
    res.statusCode = health.status === 'healthy' ? 200 : 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(health));
    return;
  }

  // Secure Server-side AI Proxy Gateway
  if (url.pathname === '/api/ai/generate') {
    const body = await readBody(req);
    await handleAiGenerate(
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

  if (url.pathname.startsWith('/api/rag')) {
    const body = await readBody(req);
    await ragHandler(
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

  if (url.pathname.startsWith('/api/learner')) {
    const body = await readBody(req);
    await learnerHandler(
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

  if (url.pathname.startsWith('/api/agent')) {
    const body = await readBody(req);
    await studyAgentHandler(
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

  if (url.pathname.startsWith('/api/evaluation')) {
    const body = await readBody(req);
    await evaluationHandler(
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

  if (url.pathname.startsWith('/api/videos')) {
    const body = await readBody(req);
    await videoHandler(
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

  if (url.pathname.startsWith('/api/dag')) {
    const body = await readBody(req);
    await dagHandler(
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
  assertValidConfiguration();

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
