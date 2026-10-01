import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { prisma, ensureResourceSchema } from './prisma.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PYTHON_PATH = path.join(PROJECT_ROOT, '.venv', 'bin', 'python');
const RAG_ENGINE_PATH = path.join(PROJECT_ROOT, 'server', 'rag_engine.py');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'server', 'uploads');

type HeaderValue = string | string[] | undefined;

export type RagApiRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, string | undefined>;
  url?: string;
  body?: any;
};

export type RagApiResponse = {
  status: (code: number) => RagApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

function runPythonCli(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_PATH,
      [RAG_ENGINE_PATH, ...args],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('RAG Engine error:', stderr || error.message);
          return reject(new Error(stderr || error.message));
        }

        try {
          // Extract JSON output (ignore warnings before JSON)
          const jsonStartIndex = stdout.indexOf('{');
          if (jsonStartIndex === -1) {
            return resolve({ raw: stdout.trim() });
          }
          const jsonText = stdout.slice(jsonStartIndex).trim();
          const parsed = JSON.parse(jsonText);
          resolve(parsed);
        } catch (parseError) {
          console.error('JSON parse error from RAG Engine output:', stdout);
          resolve({ raw: stdout.trim() });
        }
      }
    );
  });
}

export async function ragHandler(req: RagApiRequest, res: RagApiResponse) {
  const method = req.method?.toUpperCase() || 'GET';
  const urlObj = new URL(req.url || '/', 'http://127.0.0.1:3001');
  const pathname = urlObj.pathname.replace(/\/+$/, '');

  // 1. Ingest / Upload Source
  // POST /api/rag/ingest
  if (method === 'POST' && pathname === '/api/rag/ingest') {
    try {
      const body = req.body || {};
      const userId = body.userId || 'default_user';
      const topic = body.topic || 'General';
      const subtopic = body.subtopic || 'Main';
      let sourceType = (body.sourceType || body.type || 'TEXT').toUpperCase();
      let filePath = body.filePath || body.url || body.fileUrl;

      // If binary or base64 file provided
      if (body.base64Data && body.fileName) {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const ext = path.extname(body.fileName).toLowerCase();
        if (ext === '.pdf') sourceType = 'PDF';
        else if (ext === '.pptx' || ext === '.ppt') sourceType = 'PPTX';
        else if (['.mp4', '.webm', '.mp3', '.wav', '.m4a'].includes(ext)) sourceType = 'VIDEO';
        
        const tempName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext || '.bin'}`;
        filePath = path.join(UPLOADS_DIR, tempName);
        const buffer = Buffer.from(body.base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
      } else if (body.text) {
        // Plain text ingestion
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const tempName = `text_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.txt`;
        filePath = path.join(UPLOADS_DIR, tempName);
        await fs.writeFile(filePath, body.text, 'utf8');
        sourceType = 'TEXT';
      }

      if (!filePath) {
        res.status(400).json({ error: 'Missing file, filePath, base64Data, or source url' });
        return;
      }

      const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const sourceId = body.sourceId || `src_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const documentId = body.documentId || `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      // Save metadata in SQLite database via Prisma
      try {
        await ensureResourceSchema();
        await prisma.resource.create({
          data: {
            id: documentId,
            userId,
            title: body.title || path.basename(filePath),
            description: body.description || `Ingested ${sourceType} source for ${topic}`,
            type: sourceType,
            fileUrl: filePath.startsWith('http') ? filePath : null,
            storagePath: filePath,
            folder: topic,
            tagsJson: JSON.stringify([topic, subtopic, sourceType]),
          }
        });
      } catch (dbError) {
        console.warn('Could not record resource in local SQLite, continuing ingestion:', dbError);
      }

      // Execute ingestion
      const args = [
        'ingest',
        '--file', filePath,
        '--type', sourceType,
        '--user-id', userId,
        '--topic', topic,
        '--subtopic', subtopic,
        '--source-id', sourceId,
        '--document-id', documentId,
        '--job-id', jobId,
      ];

      if (body.transcript) {
        args.push('--transcript', String(body.transcript));
      }

      const result = await runPythonCli(args);
      res.status(200).json({
        success: result.status === 'completed',
        jobId,
        sourceId,
        documentId,
        sourceType,
        topic,
        subtopic,
        chunkCount: result.chunk_count || 0,
        previewChunks: result.preview_chunks || [],
        details: result,
      });
      return;
    } catch (err: any) {
      console.error('Ingest error:', err);
      res.status(500).json({ error: err.message || 'Ingestion failed' });
      return;
    }
  }

  // 2. Get Processing Status
  // GET /api/rag/status?jobId=... or /api/rag/status/:id
  if (method === 'GET' && pathname.startsWith('/api/rag/status')) {
    const segments = pathname.split('/').filter(Boolean);
    const jobId = segments[3] || req.query?.jobId || req.query?.id;
    if (!jobId) {
      res.status(400).json({ error: 'jobId query parameter is required' });
      return;
    }
    const statusData = await runPythonCli(['status', '--job-id', jobId]);
    res.status(200).json(statusData);
    return;
  }

  // 3. Search Relevant Chunks
  // POST /api/rag/search or GET /api/rag/search?query=...
  if ((method === 'POST' || method === 'GET') && pathname === '/api/rag/search') {
    const query = method === 'POST' ? req.body?.query : (req.query?.query || req.query?.q);
    if (!query) {
      res.status(400).json({ error: 'Query string is required' });
      return;
    }

    const userId = method === 'POST' ? req.body?.userId : req.query?.userId;
    const sourceId = method === 'POST' ? req.body?.sourceId : req.query?.sourceId;
    const topic = method === 'POST' ? req.body?.topic : req.query?.topic;
    const topK = method === 'POST' ? (req.body?.topK || 5) : (Number(req.query?.topK || 5));

    const args = ['search', '--query', String(query), '--top-k', String(topK)];
    if (userId) args.push('--user-id', String(userId));
    if (sourceId) args.push('--source-id', String(sourceId));
    if (topic) args.push('--topic', String(topic));

    const searchResults = await runPythonCli(args);
    res.status(200).json(searchResults);
    return;
  }

  // 4. Return Specific Chunk Metadata
  // GET /api/rag/chunk?id=... or /api/rag/chunk/:chunkId
  if (method === 'GET' && pathname.startsWith('/api/rag/chunk')) {
    const segments = pathname.split('/').filter(Boolean);
    const chunkId = segments[3] || req.query?.id || req.query?.chunkId;
    if (!chunkId) {
      res.status(400).json({ error: 'chunkId parameter is required' });
      return;
    }
    const chunkData = await runPythonCli(['chunk', '--id', String(chunkId)]);
    res.status(chunkData.found ? 200 : 404).json(chunkData);
    return;
  }

  // 5. Retrieve Source Location
  // GET /api/rag/source-location?id=... or /api/rag/source-location/:chunkId
  if (method === 'GET' && pathname.startsWith('/api/rag/source-location')) {
    const segments = pathname.split('/').filter(Boolean);
    const chunkId = segments[3] || req.query?.id || req.query?.chunkId;
    if (!chunkId) {
      res.status(400).json({ error: 'chunkId parameter is required' });
      return;
    }
    const locationData = await runPythonCli(['source-location', '--id', String(chunkId)]);
    res.status(locationData.error ? 404 : 200).json(locationData);
    return;
  }

  // 6. Source-Grounded AI Tutor Chat
  // POST /api/rag/chat or GET /api/rag/chat
  if ((method === 'POST' || method === 'GET') && pathname === '/api/rag/chat') {
    const query = method === 'POST' ? (req.body?.query || req.body?.message) : (req.query?.query || req.query?.q);
    if (!query) {
      res.status(400).json({ error: 'Query or message string is required' });
      return;
    }

    const userId = method === 'POST' ? (req.body?.userId || req.body?.user_id) : req.query?.userId;
    const topic = method === 'POST' ? req.body?.topic : req.query?.topic;
    const history = method === 'POST' ? (req.body?.conversationHistory || req.body?.history) : undefined;

    const args = ['chat', '--query', String(query)];
    if (userId) args.push('--user-id', String(userId));
    if (topic) args.push('--topic', String(topic));
    if (history) args.push('--history', JSON.stringify(history));

    const chatResponse = await runPythonCli(args);
    res.status(200).json(chatResponse);
    return;
  }

  res.status(404).json({ error: `RAG endpoint not found: ${method} ${pathname}` });
}
