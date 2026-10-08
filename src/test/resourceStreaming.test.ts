import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import resourcesHandler, {
  handleStreamResourceFile,
  checkIsSystemPublic,
  extractResourceIdFromFileRoute,
  type ApiRequest,
  type ApiResponse,
} from '../../api/resources.ts';
import { ensureResourceSchema, prisma } from '../../server/prisma.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_DIR = path.join(PROJECT_ROOT, 'server', 'uploads', 'test_fixtures');

// Helper to create mock request and response
function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}) {
  const req: ApiRequest = {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3001/api/resources',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
  };

  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string | number) {
      this.headers[name.toLowerCase()] = String(value);
      this.headers[name] = String(value);
    },
    write(chunk: any) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (!this.body) {
        this.body = buf;
      } else if (Buffer.isBuffer(this.body)) {
        this.body = Buffer.concat([this.body, buf]);
      }
    },
    end(data?: any) {
      if (data && !this.body) {
        if (Buffer.isBuffer(data)) {
          this.body = data;
        } else {
          try {
            this.body = JSON.parse(data);
          } catch {
            this.body = data;
          }
        }
      }
    },
  };

  return { req, res: res as unknown as ApiResponse & typeof res };
}

describe('CANONICAL PHASE 3 STEP 2: SECURE RESOURCE STREAMING & SOURCE ACCESS API', () => {
  const pdfFixturePath = path.join(FIXTURES_DIR, 'test_sample.pdf');
  const pngFixturePath = path.join(FIXTURES_DIR, 'test_sample.png');
  const mp4FixturePath = path.join(FIXTURES_DIR, 'test_sample.mp4');
  const mp3FixturePath = path.join(FIXTURES_DIR, 'test_sample.mp3');
  const pptxFixturePath = path.join(FIXTURES_DIR, 'test_sample.pptx');

  let pdfBytes: Buffer;
  let pngBytes: Buffer;
  let mp4Bytes: Buffer;
  let mp3Bytes: Buffer;

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEV_AUTH_BYPASS = 'false';
    process.env.MING_TEST_SECRET = 'test-secret-key-123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role-key-never-leak-999';

    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }

    // 1. PDF fixture: valid %PDF- magic signature
    pdfBytes = Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\n'),
      Buffer.alloc(500, 0x20),
      Buffer.from('\n%%EOF\n'),
    ]);
    fs.writeFileSync(pdfFixturePath, pdfBytes);

    // 2. PNG fixture: valid 8-byte magic signature 0x89 50 4E 47 0D 0A 1A 0A
    pngBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(300, 0x55),
    ]);
    fs.writeFileSync(pngFixturePath, pngBytes);

    // 3. MP4 fixture: ftyp at byte offset 4
    const mp4Header = Buffer.alloc(12);
    mp4Header.writeUInt32BE(12, 0);
    mp4Header.write('ftyp', 4, 'ascii');
    mp4Header.write('isom', 8, 'ascii');
    mp4Bytes = Buffer.concat([mp4Header, Buffer.alloc(1024, 0x42)]);
    fs.writeFileSync(mp4FixturePath, mp4Bytes);

    // 4. MP3 fixture: ID3 signature
    mp3Bytes = Buffer.concat([
      Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      Buffer.alloc(500, 0x33),
    ]);
    fs.writeFileSync(mp3FixturePath, mp3Bytes);

    // 5. PPTX fixture: PK\x03\x04 zip signature
    const pptxBytes = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(400, 0x11),
    ]);
    fs.writeFileSync(pptxFixturePath, pptxBytes);

    await ensureResourceSchema();

    // Clean up existing test resources
    await prisma.resource.deleteMany({
      where: {
        id: {
          in: [
            'res_user_a_pdf',
            'res_user_a_png',
            'res_user_a_video',
            'res_user_a_audio',
            'res_user_a_pptx',
            'res_user_a_note',
            'res_user_b_pdf',
            'res_system_public_pdf',
            'res_user_a_deleted',
            'res_missing_file',
            'res_traversal_attack',
            'res_user_a_secret_citation',
          ],
        },
      },
    });

    // Seed test resources
    await prisma.resource.createMany({
      data: [
        {
          id: 'res_user_a_pdf',
          userId: 'user_a',
          title: 'User A PDF Guide',
          type: 'PDF',
          storagePath: pdfFixturePath,
        },
        {
          id: 'res_user_a_png',
          userId: 'user_a',
          title: 'User A Diagram',
          type: 'PNG',
          storagePath: pngFixturePath,
        },
        {
          id: 'res_user_a_video',
          userId: 'user_a',
          title: 'User A Lecture Video',
          type: 'VIDEO',
          storagePath: mp4FixturePath,
        },
        {
          id: 'res_user_a_audio',
          userId: 'user_a',
          title: 'User A Podcast Audio',
          type: 'AUDIO',
          storagePath: mp3FixturePath,
        },
        {
          id: 'res_user_a_pptx',
          userId: 'user_a',
          title: 'User A Slide Deck',
          type: 'PPTX',
          storagePath: pptxFixturePath,
        },
        {
          id: 'res_user_a_note',
          userId: 'user_a',
          title: 'User A Quick Notes',
          type: 'NOTE',
          noteContent: 'Important notes on distributed transactions and 2PC.',
        },
        {
          id: 'res_user_b_pdf',
          userId: 'user_b',
          title: 'User B Confidential Document',
          type: 'PDF',
          storagePath: pdfFixturePath,
        },
        {
          id: 'res_system_public_pdf',
          userId: 'system_public',
          title: 'Verified Curriculum Standard (Public)',
          type: 'PDF',
          storagePath: pdfFixturePath,
          tagsJson: JSON.stringify(['SYSTEM_PUBLIC', 'Curriculum']),
        },
        {
          id: 'res_missing_file',
          userId: 'user_a',
          title: 'Missing File Resource',
          type: 'PDF',
          storagePath: path.join(FIXTURES_DIR, 'nonexistent_file_ghost.pdf'),
        },
        {
          id: 'res_traversal_attack',
          userId: 'user_a',
          title: 'Malicious Traversal Resource',
          type: 'PDF',
          storagePath: '/etc/passwd',
        },
        {
          id: 'res_user_a_secret_citation',
          userId: 'user_a',
          title: 'User A Grounded Tutor Citation Target',
          type: 'PDF',
          storagePath: pdfFixturePath,
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.resource.deleteMany({
        where: {
          id: {
            in: [
              'res_user_a_pdf',
              'res_user_a_png',
              'res_user_a_video',
              'res_user_a_audio',
              'res_user_a_pptx',
              'res_user_a_note',
              'res_user_b_pdf',
              'res_system_public_pdf',
              'res_user_a_deleted',
              'res_missing_file',
              'res_traversal_attack',
              'res_user_a_secret_citation',
            ],
          },
        },
      });
      if (fs.existsSync(FIXTURES_DIR)) {
        fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  // 1. Authenticated owner can access resource
  it('1. Authenticated owner can access resource', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-length']).toBe(String(pdfBytes.length));
    expect(res.headers['cache-control']).toContain('private');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.equals(pdfBytes)).toBe(true);
  });

  // 2. Unauthenticated request returns 401
  it('2. Unauthenticated request returns 401', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {},
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toMatch(/Authentication required|Unauthorized/i);
  });

  // 3. User B cannot access User A's resource
  it("3. User B cannot access User A's resource", async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_b',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toMatch(/Forbidden|denied/i);
  });

  // 4. Spoofed userId does not bypass authorization
  it('4. Spoofed userId does not bypass authorization', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file?userId=user_a',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_b',
        'x-user-id': 'user_a',
        'x-dev-user-id': 'user_a',
      },
      body: {
        userId: 'user_a',
      },
    });

    await resourcesHandler(req, res);

    // Authenticated identity is user_b, spoofing user_a is ignored -> 403 Forbidden
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toMatch(/Forbidden|denied/i);
  });

  // 5. Fake resource ID returns 404
  it('5. Fake resource ID returns 404', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_nonexistent_ghost_9999/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.error).toMatch(/Resource not found/i);
  });

  // 6. Deleted resource returns 404
  it('6. Deleted resource returns 404', async () => {
    // Create and then immediately delete a resource
    const deletedRes = await prisma.resource.create({
      data: {
        id: 'res_temp_deleted_resource',
        userId: 'user_a',
        title: 'Temporary Resource To Delete',
        type: 'PDF',
        storagePath: pdfFixturePath,
      },
    });

    await prisma.resource.delete({
      where: { id: deletedRes.id },
    });

    const { req, res } = createMockReqRes({
      method: 'GET',
      url: `http://localhost:3001/api/resources/${deletedRes.id}/file`,
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.error).toMatch(/Resource not found|deleted/i);
  });

  // 7. SYSTEM_PUBLIC resource follows existing public policy
  it('7. SYSTEM_PUBLIC resource follows existing public policy', async () => {
    // 7A: Authenticated user (user_b) can access SYSTEM_PUBLIC resource
    const { req: reqAuth, res: resAuth } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_system_public_pdf/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_b',
      },
    });

    await resourcesHandler(reqAuth, resAuth);
    expect(resAuth.statusCode).toBe(200);
    expect(resAuth.headers['content-type']).toBe('application/pdf');

    // 7B: Unauthenticated request to SYSTEM_PUBLIC resource is rejected with 401
    const { req: reqUnauth, res: resUnauth } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_system_public_pdf/file',
      headers: {},
    });

    await resourcesHandler(reqUnauth, resUnauth);
    expect(resUnauth.statusCode).toBe(401);
  });

  // 8. Correct Content-Type for PDF
  it('8. Correct Content-Type for PDF', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });

  // 9. Correct Content-Type for image
  it('9. Correct Content-Type for image', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_png/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  // 10. Correct Content-Type for video
  it('10. Correct Content-Type for video', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_video/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
  });

  // 11. Correct Content-Type for audio
  it('11. Correct Content-Type for audio', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_audio/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mpeg');
  });

  // 12. Video Range request returns 206
  it('12. Video Range request returns 206 Partial Content', async () => {
    const start = 0;
    const end = 499;
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_video/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
        range: `bytes=${start}-${end}`,
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes ${start}-${end}/${mp4Bytes.length}`);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe(String(end - start + 1));
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBe(end - start + 1);
    expect(res.body.equals(mp4Bytes.subarray(start, end + 1))).toBe(true);
  });

  // 13. Audio Range request returns 206
  it('13. Audio Range request returns 206 Partial Content', async () => {
    const start = 50;
    const end = 199;
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_audio/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
        range: `bytes=${start}-${end}`,
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes ${start}-${end}/${mp3Bytes.length}`);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe(String(end - start + 1));
    expect(res.headers['content-type']).toBe('audio/mpeg');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBe(end - start + 1);
    expect(res.body.equals(mp3Bytes.subarray(start, end + 1))).toBe(true);
  });

  // 14. Invalid Range is handled safely
  it('14. Invalid Range is handled safely', async () => {
    // 14A: Range start exceeds file size
    const { req: reqExceed, res: resExceed } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_video/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
        range: `bytes=999999-`,
      },
    });

    await resourcesHandler(reqExceed, resExceed);
    expect(resExceed.statusCode).toBe(416);
    expect(resExceed.headers['content-range']).toBe(`bytes */${mp4Bytes.length}`);

    // 14B: Range start greater than end
    const { req: reqInverted, res: resInverted } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_video/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
        range: `bytes=500-200`,
      },
    });

    await resourcesHandler(reqInverted, resInverted);
    expect(resInverted.statusCode).toBe(416);

    // 14C: Non-numeric / malformed range
    const { req: reqMalformed, res: resMalformed } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_video/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
        range: `characters=0-100`,
      },
    });

    await resourcesHandler(reqMalformed, resMalformed);
    expect(resMalformed.statusCode).toBe(416);
  });

  // 15. Path traversal attempt fails
  it('15. Path traversal attempt fails', async () => {
    // Resource pointing to /etc/passwd outside allowed boundary
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_traversal_attack/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toMatch(/Access denied.*permitted storage|outside/i);
  });

  // 16. Arbitrary filesystem path cannot be requested
  it('16. Arbitrary filesystem path cannot be requested', async () => {
    // Client sends ?path=/etc/passwd or ?file=/etc/shadow
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file?path=/etc/passwd&file=/etc/shadow',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
      query: {
        path: '/etc/passwd',
        file: '/etc/shadow',
      },
    });

    await resourcesHandler(req, res);

    // Endpoint must ignore client query paths and only stream authorized resource bytes
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.equals(pdfBytes)).toBe(true);
    expect(res.body.toString('utf8')).not.toContain('root:');
  });

  // 17. Private resource is not exposed through a public URL
  it('17. Private resource is not exposed through a public URL', async () => {
    // Attempting unauthenticated access or fake credentials to private resource
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {
        authorization: 'Bearer invalid.fake.token',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toMatch(/Invalid or expired|Unauthorized/i);
  });

  // 18. Service-role credentials are never returned
  it('18. Service-role credentials are never returned', async () => {
    const serviceSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || 'super-secret';

    const testRequests = [
      createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
        headers: { 'x-ming-test-key': 'test-secret-key-123', 'x-ming-user-id': 'user_a' },
      }),
      createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
        headers: { 'x-ming-test-key': 'test-secret-key-123', 'x-ming-user-id': 'user_b' },
      }),
      createMockReqRes({
        method: 'GET',
        url: 'http://localhost:3001/api/resources/res_missing_file/file',
        headers: { 'x-ming-test-key': 'test-secret-key-123', 'x-ming-user-id': 'user_a' },
      }),
    ];

    for (const { req, res } of testRequests) {
      await resourcesHandler(req, res);
      const rawHeaders = JSON.stringify(res.headers);
      const rawBody = Buffer.isBuffer(res.body) ? res.body.toString('utf8') : JSON.stringify(res.body || {});

      expect(rawHeaders).not.toContain(serviceSecret);
      expect(rawBody).not.toContain(serviceSecret);
    }
  });

  // 19. Missing storage object produces a controlled error
  it('19. Missing storage object produces a controlled error', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_missing_file/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body?.error).toBe('Source media file not found on storage');
    // Ensure raw disk paths are not leaked in the client-facing error
    expect(JSON.stringify(res.body)).not.toContain('/Users/');
    expect(JSON.stringify(res.body)).not.toContain('/server/uploads/');
  });

  // 20. Resource ID from citation cannot cross tenant boundaries
  it('20. Resource ID from citation cannot cross tenant boundaries', async () => {
    // Simulated citation produced for User A:
    const citation = {
      citation_id: 'cit_test_101',
      resource_id: 'res_user_a_secret_citation',
      source_title: 'User A Secret Citation Document',
      location: { page_number: 1 },
    };

    // User B tries to follow and stream the citation's resourceId:
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: `http://localhost:3001/api/resources/${citation.resource_id}/file`,
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_b',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toMatch(/Forbidden: Access to this resource is denied/i);
  });

  // Supplementary test: In-memory NOTE resource access
  it('21. Supplementary: NOTE resources return text/plain with correct content', async () => {
    const { req, res } = createMockReqRes({
      method: 'GET',
      url: 'http://localhost:3001/api/resources/res_user_a_note/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.body.toString('utf8')).toContain('distributed transactions and 2PC');
  });

  // Supplementary test: HEAD request support
  it('22. Supplementary: HEAD request returns metadata headers without body', async () => {
    const { req, res } = createMockReqRes({
      method: 'HEAD',
      url: 'http://localhost:3001/api/resources/res_user_a_pdf/file',
      headers: {
        'x-ming-test-key': 'test-secret-key-123',
        'x-ming-user-id': 'user_a',
      },
    });

    await resourcesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-length']).toBe(String(pdfBytes.length));
    expect(res.body).toBeNull();
  });
});
