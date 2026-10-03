import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { verifySupabaseToken } from './supabaseAuth.ts';
import {
  createVideoRecord,
  getUserVideos,
  getVideoById,
  deleteVideo,
  processVideoJob,
  askVideoQuestion,
  isValidYouTubeUrl,
  extractYouTubeId,
  type VideoRecord,
  type TranscriptSegment,
} from './videoService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const VIDEO_UPLOADS_DIR = path.join(PROJECT_ROOT, 'server', 'uploads', 'videos');

// Configurable video upload size limit (default 100MB)
export const MAX_VIDEO_SIZE_BYTES = Number(process.env.MAX_VIDEO_SIZE_MB || 100) * 1024 * 1024;
export const ALLOWED_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);

type HeaderValue = string | string[] | undefined;

export interface VideoApiRequest {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, string | undefined>;
  url?: string;
  body?: any;
}

export interface VideoApiResponse {
  status: (code: number) => VideoApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string | number) => void;
  end: (body?: any) => void;
}

export async function resolveAuthenticatedUserId(req: VideoApiRequest): Promise<string> {
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const user = await verifySupabaseToken(authHeader);
      if (user?.id) return user.id;
    } catch {
      // Fall through to header/param check
    }
  }

  const customHeader = req.headers['x-user-id'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  const queryUserId = req.query?.userId || req.query?.user_id;
  if (queryUserId && typeof queryUserId === 'string' && queryUserId.trim()) {
    return queryUserId.trim();
  }

  const bodyUserId = req.body?.userId || req.body?.user_id;
  if (bodyUserId && typeof bodyUserId === 'string' && bodyUserId.trim()) {
    return bodyUserId.trim();
  }

  return 'default_user';
}

export async function videoHandler(req: VideoApiRequest, res: VideoApiResponse): Promise<void> {
  const method = req.method?.toUpperCase() || 'GET';
  const urlObj = new URL(req.url || '/', 'http://127.0.0.1:3001');
  const pathname = urlObj.pathname.replace(/\/+$/, '');

  const segments = pathname.split('/').filter(Boolean); // e.g. ['api', 'videos', ':id', 'action']
  const videoId = segments[2];
  const subAction = segments[3];

  const userId = await resolveAuthenticatedUserId(req);

  // 1. POST /api/videos - Add YouTube video or Uploaded video
  if (method === 'POST' && pathname === '/api/videos') {
    try {
      const body = req.body || {};
      const title = String(body.title || '').trim();
      const sourceType = String(body.sourceType || (body.youtubeUrl ? 'youtube' : 'upload')).toLowerCase();

      if (!title) {
        res.status(400).json({ error: 'Video title is required' });
        return;
      }

      if (sourceType === 'youtube') {
        const youtubeUrl = String(body.youtubeUrl || '').trim();
        if (!youtubeUrl) {
          res.status(400).json({ error: 'YouTube URL is required' });
          return;
        }

        if (!isValidYouTubeUrl(youtubeUrl)) {
          res.status(400).json({ error: 'Invalid YouTube URL or video ID format' });
          return;
        }

        const video = await createVideoRecord({
          userId,
          title,
          sourceType: 'youtube',
          youtubeUrl,
          thumbnailUrl: body.thumbnailUrl,
          transcript: body.transcript,
        });

        res.status(201).json({ success: true, video });
        return;
      }

      if (sourceType === 'upload') {
        const fileName = String(body.fileName || 'uploaded_video.mp4');
        const ext = path.extname(fileName).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(ext)) {
          res.status(400).json({
            error: `Unsupported video format: "${ext}". Supported formats: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
          });
          return;
        }

        if (!body.base64Data && !body.filePath) {
          res.status(400).json({ error: 'Missing video file data or storage path' });
          return;
        }

        let storagePath = body.filePath;
        let fileSize = 0;

        if (body.base64Data) {
          const buffer = Buffer.from(body.base64Data, 'base64');
          fileSize = buffer.length;

          if (fileSize > MAX_VIDEO_SIZE_BYTES) {
            res.status(413).json({
              error: `Video file exceeds maximum allowed size of ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)}MB`,
            });
            return;
          }

          const userUploadDir = path.join(VIDEO_UPLOADS_DIR, userId);
          await fs.mkdir(userUploadDir, { recursive: true });

          const safeId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
          const sanitizedFileName = `${Date.now()}_${safeId}${ext}`;
          storagePath = path.join(userUploadDir, sanitizedFileName);

          await fs.writeFile(storagePath, buffer);
        }

        const video = await createVideoRecord({
          userId,
          title,
          sourceType: 'upload',
          storagePath,
          fileUrl: `/api/videos/placeholder/stream`, // dynamic endpoint
          durationSeconds: body.durationSeconds || 0,
          transcript: body.transcript,
        });

        // Trigger asynchronous background processing job if not already ready
        if (video.status !== 'ready' || video.transcriptStatus !== 'ready') {
          processVideoJob(video.id, userId, body.transcript).catch((err) => {
            console.error(`Background video processing failed for ${video.id}:`, err);
          });
        }

        res.status(201).json({ success: true, video });
        return;
      }

      res.status(400).json({ error: `Invalid sourceType: ${sourceType}. Must be 'youtube' or 'upload'.` });
      return;
    } catch (err: any) {
      console.error('Create video error:', err);
      res.status(500).json({ error: err.message || 'Failed to create video' });
      return;
    }
  }

  // 2. GET /api/videos - List all videos for the authenticated user
  if (method === 'GET' && pathname === '/api/videos') {
    try {
      const videos = await getUserVideos(userId);
      res.status(200).json({ success: true, videos });
      return;
    } catch (err: any) {
      console.error('List videos error:', err);
      res.status(500).json({ error: err.message || 'Failed to list videos' });
      return;
    }
  }

  // 3. GET /api/videos/:id - Retrieve video details
  if (method === 'GET' && videoId && !subAction) {
    try {
      const video = await getVideoById(videoId, userId);
      if (!video) {
        res.status(404).json({ error: 'Video not found or access denied' });
        return;
      }
      res.status(200).json({ success: true, video });
      return;
    } catch (err: any) {
      console.error('Get video error:', err);
      res.status(500).json({ error: err.message || 'Failed to get video' });
      return;
    }
  }

  // 4. DELETE /api/videos/:id - Delete video
  if (method === 'DELETE' && videoId && !subAction) {
    try {
      const success = await deleteVideo(videoId, userId);
      if (!success) {
        res.status(404).json({ error: 'Video not found or access denied' });
        return;
      }
      res.status(200).json({ success: true, message: 'Video deleted successfully' });
      return;
    } catch (err: any) {
      console.error('Delete video error:', err);
      res.status(500).json({ error: err.message || 'Failed to delete video' });
      return;
    }
  }

  // 5. POST /api/videos/:id/process - Trigger/re-trigger processing & transcription
  if (method === 'POST' && videoId && subAction === 'process') {
    try {
      const body = req.body || {};
      const updated = await processVideoJob(videoId, userId, body.transcript);
      res.status(200).json({ success: true, video: updated });
      return;
    } catch (err: any) {
      console.error('Process video error:', err);
      const isNotFound = err.message?.includes('not found') || err.message?.includes('access denied');
      res.status(isNotFound ? 404 : 500).json({ error: err.message || 'Failed to process video' });
      return;
    }
  }

  // 6. GET /api/videos/:id/transcript - Get timestamped transcript segments
  if (method === 'GET' && videoId && subAction === 'transcript') {
    try {
      const video = await getVideoById(videoId, userId);
      if (!video) {
        res.status(404).json({ error: 'Video not found or access denied' });
        return;
      }

      let segments: TranscriptSegment[] = [];
      if (video.transcriptJson) {
        try {
          segments = JSON.parse(video.transcriptJson);
        } catch {
          segments = [];
        }
      }

      res.status(200).json({
        success: true,
        videoId: video.id,
        transcriptStatus: video.transcriptStatus,
        segments,
      });
      return;
    } catch (err: any) {
      console.error('Get transcript error:', err);
      res.status(500).json({ error: err.message || 'Failed to get transcript' });
      return;
    }
  }

  // 7. POST /api/videos/:id/ask - Grounded AI Tutor Q&A based strictly on video transcript
  if (method === 'POST' && videoId && subAction === 'ask') {
    try {
      const body = req.body || {};
      const question = String(body.question || body.query || body.message || '').trim();

      if (!question) {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      const history = Array.isArray(body.conversationHistory || body.history)
        ? (body.conversationHistory || body.history)
        : [];
      const language = String(body.language || 'english');

      const answer = await askVideoQuestion(videoId, userId, question, history, language);

      res.status(200).json({
        success: true,
        videoId,
        question,
        ...answer,
      });
      return;
    } catch (err: any) {
      console.error('Ask video question error:', err);
      const isNotFound = err.message?.includes('not found') || err.message?.includes('access denied');
      res.status(isNotFound ? 404 : 500).json({ error: err.message || 'Failed to answer question' });
      return;
    }
  }

  // 8. GET /api/videos/:id/stream - Stream uploaded video file securely with HTTP Range support
  if (method === 'GET' && videoId && subAction === 'stream') {
    try {
      const video = await getVideoById(videoId, userId);
      if (!video) {
        res.status(404).json({ error: 'Video not found or access denied' });
        return;
      }

      if (!video.storagePath || !existsSync(video.storagePath)) {
        res.status(404).json({ error: 'Video media file not found on storage' });
        return;
      }

      const stat = statSync(video.storagePath);
      const fileSize = stat.size;
      const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
      const ext = path.extname(video.storagePath).toLowerCase();
      const contentType = ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4';

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const fileStream = createReadStream(video.storagePath, { start, end });

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.setHeader('Content-Type', contentType);
        fileStream.pipe(res as any);
        return;
      } else {
        res.status(200);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Type', contentType);
        const fileStream = createReadStream(video.storagePath);
        fileStream.pipe(res as any);
        return;
      }
    } catch (err: any) {
      console.error('Stream video error:', err);
      res.status(500).json({ error: err.message || 'Streaming failed' });
      return;
    }
  }

  res.status(404).json({ error: 'Video route not found' });
}
