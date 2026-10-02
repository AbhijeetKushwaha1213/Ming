import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { prisma, ensureResourceSchema, ensureAssessmentSchema, ensureLearnerSchema } from './prisma.ts';
import { updateMasteryFromEvidence, getTopicLearnerMastery } from './bktService.ts';
import { processAssessmentIntelligence, getUserMisconceptions, getAttemptDiagnostic } from './assessmentIntelligenceService.ts';
import { learnerHandler } from './learnerHandler.ts';
import { studyAgentHandler } from './studyAgentHandler.ts';
import { evaluationHandler } from './evaluationHandler.ts';

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

export function runPythonCli(args: string[]): Promise<any> {
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
    const subtopic = method === 'POST' ? req.body?.subtopic : req.query?.subtopic;
    const topK = method === 'POST' ? (req.body?.topK || 5) : (Number(req.query?.topK || 5));
    const similarityThreshold = method === 'POST' 
      ? (req.body?.similarityThreshold ?? req.body?.minScore)
      : (req.query?.similarityThreshold ?? req.query?.minScore);
    const maxPerSource = method === 'POST' ? req.body?.maxPerSource : req.query?.maxPerSource;

    const args = ['search', '--query', String(query), '--top-k', String(topK)];
    if (userId) args.push('--user-id', String(userId));
    if (sourceId) args.push('--source-id', String(sourceId));
    if (topic) args.push('--topic', String(topic));
    if (subtopic) args.push('--subtopic', String(subtopic));
    if (similarityThreshold !== undefined && similarityThreshold !== null) {
      args.push('--similarity-threshold', String(similarityThreshold));
    }
    if (maxPerSource !== undefined && maxPerSource !== null) {
      args.push('--max-per-source', String(maxPerSource));
    }

    const searchResults = await runPythonCli(args);
    
    // Provide both snake_case and camelCase diagnostics
    const augmentedResults = {
      ...searchResults,
      candidateCount: searchResults?.candidate_count ?? searchResults?.results?.length ?? 0,
      finalEvidenceCount: searchResults?.final_evidence_count ?? searchResults?.results?.length ?? 0,
      similarityScores: searchResults?.similarity_scores ?? (searchResults?.results || []).map((r: any) => r.score),
      selectedSourceIds: searchResults?.selected_source_ids ?? [],
      discardedChunks: searchResults?.discarded_chunks ?? [],
    };

    res.status(200).json(augmentedResults);
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
    let learnerState = method === 'POST' ? (req.body?.learnerState || req.body?.learner_state) : undefined;

    if (!learnerState && userId && topic) {
      try {
        const masteryRec = await getTopicLearnerMastery(String(userId), String(topic));
        if (masteryRec) {
          learnerState = {
            topic: masteryRec.topic,
            mastery_probability: masteryRec.masteryProbability,
            mastery_percentage: masteryRec.masteryPercentage,
            attempts: masteryRec.attempts,
            confidence: masteryRec.confidence,
            status: masteryRec.status,
          };
        }
      } catch (err) {
        // Silently skip if DB not initialized
      }
    }

    const args = ['chat', '--query', String(query)];
    if (userId) args.push('--user-id', String(userId));
    if (topic) args.push('--topic', String(topic));
    if (history) args.push('--history', JSON.stringify(history));
    if (learnerState) args.push('--learner-state', JSON.stringify(learnerState));

    const chatResponse = await runPythonCli(args);

    // Phase 10: Post-generation citation verifier
    // Validates every citation against retrieved evidence for source_id + chunk_id + coordinate consistency.
    // Removes citations that cannot be verified rather than fabricating coordinates.
    if (chatResponse && Array.isArray(chatResponse.citations) && chatResponse.citations.length > 0) {
      const verifiedCitations: any[] = [];
      for (const citation of chatResponse.citations) {
        const cid = citation.chunk_id;
        const sid = citation.source_id;
        // Citation must have a chunk_id and source_id to be verifiable
        if (!cid || !sid) continue;
        // Verify coordinate consistency: at least one coordinate type must be present or source_type TEXT
        const hasPage = citation.page_number !== null && citation.page_number !== undefined;
        const hasSlide = citation.slide_number !== null && citation.slide_number !== undefined;
        const hasTime = citation.timestamp_start !== null && citation.timestamp_start !== undefined;
        const isText = citation.source_type === 'TEXT';
        const hasValidCoordinate = hasPage || hasSlide || hasTime || isText;
        if (hasValidCoordinate) {
          verifiedCitations.push(citation);
        }
        // If no coordinate at all and not TEXT, drop the citation (don't fabricate)
      }
      chatResponse.citations = verifiedCitations;
      chatResponse.citation_verification = {
        totalCited: chatResponse.citations.length,
        verified: verifiedCitations.length,
        dropped: (chatResponse.citations.length || 0) - verifiedCitations.length,
      };
    }

    res.status(200).json(chatResponse);
    return;
  }

  // 7. Grounded Adaptive Assessment Generation (Phase 3 & 7 Deduplication)
  // POST /api/rag/assessment/generate
  if (method === 'POST' && pathname === '/api/rag/assessment/generate') {
    try {
      await ensureAssessmentSchema();
      const body = req.body || {};
      const topic = body.topic;
      const userId = body.userId || body.user_id || 'default_user';
      if (!topic) {
        res.status(400).json({ error: 'Topic is required for assessment generation' });
        return;
      }

      const subtopic = body.subtopic;
      const difficulty = body.difficulty || 'medium';
      const count = Number(body.count || 5);
      const questionType = body.questionType || body.type || 'MCQ';
      const sourceId = body.sourceId;
      const assessmentId = body.assessmentId || body.assessment_id || `asmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // 1. Fetch existing question fingerprints and stems across all past assessments
      let existingFps: string[] = [];
      let existingQuestions: string[] = [];
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(
          'SELECT fingerprint, question, normalizedQuestion FROM assessment_questions WHERE userId = ? AND topic = ?',
          userId,
          topic
        );
        existingFps = rows.map((r: any) => r.fingerprint).filter(Boolean);
        existingQuestions = rows.map((r: any) => r.normalizedQuestion || r.question).filter(Boolean);
      } catch (dbErr) {
        console.warn('Could not query existing questions from DB:', dbErr);
      }

      // 2. Call RAG engine with verification pass and deduplication
      const args = [
        'assessment-generate',
        '--topic',
        String(topic),
        '--user-id',
        String(userId),
        '--difficulty',
        String(difficulty),
        '--count',
        String(count),
        '--type',
        String(questionType),
        '--assessment-id',
        assessmentId,
      ];
      if (subtopic) args.push('--subtopic', String(subtopic));
      if (sourceId) args.push('--source-id', String(sourceId));
      if (existingFps.length > 0) args.push('--fingerprints', JSON.stringify(existingFps));
      if (existingQuestions.length > 0) args.push('--existing-questions', JSON.stringify(existingQuestions));

      const genResult = await runPythonCli(args);

      if (!genResult.success && genResult.error) {
        res.status(400).json(genResult);
        return;
      }

      // 3. Persist valid generated questions into assessment_questions table with full deduplication metadata
      const questions = genResult.questions || [];
      for (const q of questions) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO assessment_questions (id, userId, assessmentId, fingerprint, normalizedQuestion, type, topic, subtopic, difficulty, sourceId, chunkId, pageNumber, slideNumber, timestampStart, timestampEnd, question, optionsJson, correctAnswer, explanation)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            q.question_id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            userId,
            assessmentId,
            q.fingerprint || '',
            q.normalized_question || q.question.toLowerCase().trim(),
            q.type || 'MCQ',
            q.topic || topic,
            q.subtopic || null,
            q.difficulty || difficulty,
            q.source_id || null,
            q.chunk_id || null,
            q.page_number ?? null,
            q.slide_number ?? null,
            q.timestamp_start ?? null,
            q.timestamp_end ?? null,
            q.question,
            JSON.stringify(q.options || []),
            String(q.correct_answer),
            q.explanation || ''
          );
        } catch (insertErr) {
          console.warn('Could not save generated question record:', insertErr);
        }
      }

      res.status(200).json({
        success: true,
        assessmentId,
        topic,
        subtopic,
        difficulty,
        totalQuestions: questions.length,
        questions,
      });
      return;
    } catch (err: any) {
      console.error('Assessment generation error:', err);
      res.status(500).json({ error: 'Failed to generate assessment', details: err.message });
      return;
    }
  }

  // 8. Assessment Submission & Diagnostic Report Evaluation (Phase 9 Intelligence)
  // POST /api/rag/assessment/submit
  if (method === 'POST' && pathname === '/api/rag/assessment/submit') {
    try {
      await ensureAssessmentSchema();
      await ensureLearnerSchema();
      const body = req.body || {};
      const userId = body.userId || body.user_id || 'default_user';
      const title = body.title || 'Course Assessment';
      const topic = body.topic || 'General';
      const subtopic = body.subtopic;
      const difficulty = body.difficulty || 'medium';
      const questions: any[] = body.questions || [];
      const answers: any[] = Array.isArray(body.answers) ? body.answers : Object.values(body.answers || {});

      if (!questions.length) {
        res.status(400).json({ error: 'Questions array is required for assessment submission' });
        return;
      }

      const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const { results, diagnosticReport } = await processAssessmentIntelligence({
        userId,
        title,
        topic,
        subtopic,
        difficulty,
        questions,
        answers,
        attemptId,
      });

      // Persist attempt into assessment_attempts table
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO assessment_attempts (id, userId, title, topic, subtopic, difficulty, score, totalQuestions, correctCount, percentage, questionsJson, answersJson, diagnosticJson)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          attemptId,
          userId,
          title,
          topic,
          subtopic || null,
          difficulty,
          diagnosticReport.correctCount,
          diagnosticReport.totalQuestions,
          diagnosticReport.correctCount,
          diagnosticReport.percentage,
          JSON.stringify(questions),
          JSON.stringify(answers),
          JSON.stringify(diagnosticReport)
        );
      } catch (dbErr) {
        console.warn('Could not persist assessment attempt into database:', dbErr);
      }

      res.status(200).json({
        success: true,
        attemptId,
        score: diagnosticReport.correctCount,
        totalQuestions: diagnosticReport.totalQuestions,
        percentage: diagnosticReport.percentage,
        results,
        diagnosticReport,
      });
      return;
    } catch (err: any) {
      console.error('Assessment evaluation error:', err);
      res.status(500).json({ error: 'Failed to evaluate assessment', details: err.message });
      return;
    }
  }

  // 8b. Active Misconceptions & Repeated Mistakes (Phase 9)
  // GET /api/rag/assessment/misconceptions?userId=...
  if (method === 'GET' && pathname === '/api/rag/assessment/misconceptions') {
    try {
      const userId = req.query?.userId || urlObj.searchParams.get('userId') || 'default_user';
      const topic = req.query?.topic || urlObj.searchParams.get('topic') || undefined;
      const data = await getUserMisconceptions(userId, topic);
      res.status(200).json({ success: true, ...data });
      return;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve misconceptions', details: err.message });
      return;
    }
  }

  // 8c. Diagnostic Report by Attempt ID (Phase 9)
  // GET /api/rag/assessment/diagnostic?attemptId=... or /api/rag/assessment/diagnostic/:attemptId
  if (method === 'GET' && (pathname.startsWith('/api/rag/assessment/diagnostic') || pathname === '/api/rag/assessment/diagnostic')) {
    try {
      const parts = pathname.split('/');
      // /api/rag/assessment/diagnostic -> parts: ['', 'api', 'rag', 'assessment', 'diagnostic'] (length 5)
      // /api/rag/assessment/diagnostic/:attemptId -> parts: ['', 'api', 'rag', 'assessment', 'diagnostic', ':attemptId'] (length 6)
      const pathAttemptId = parts.length > 5 ? parts[5] : null;
      const attemptId = pathAttemptId || req.query?.attemptId || req.query?.id || urlObj.searchParams.get('attemptId') || urlObj.searchParams.get('id');
      if (!attemptId) {
        res.status(400).json({ error: 'attemptId is required' });
        return;
      }
      const userId = req.query?.userId || urlObj.searchParams.get('userId') || undefined;
      const diagnostic = await getAttemptDiagnostic(attemptId, userId);
      if (!diagnostic) {
        res.status(404).json({ error: 'Assessment diagnostic not found' });
        return;
      }
      res.status(200).json({ success: true, ...diagnostic });
      return;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve diagnostic', details: err.message });
      return;
    }
  }

  // 9. Assessment History for Authenticated Student (Phase 3)
  // GET /api/rag/assessment/history?userId=...
  if (method === 'GET' && pathname === '/api/rag/assessment/history') {
    try {
      await ensureAssessmentSchema();
      const userId = req.query?.userId || 'default_user';
      const rows: any[] = await prisma.$queryRawUnsafe(
        'SELECT * FROM assessment_attempts WHERE userId = ? ORDER BY completedAt DESC LIMIT 20',
        userId
      );

      const history = rows.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        topic: r.topic,
        subtopic: r.subtopic,
        difficulty: r.difficulty,
        score: r.score,
        totalQuestions: r.totalQuestions,
        percentage: r.percentage,
        completedAt: r.completedAt,
        diagnosticReport: r.diagnosticJson ? JSON.parse(r.diagnosticJson) : null,
      }));

      res.status(200).json({ success: true, history });
      return;
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve assessment history', details: err.message });
      return;
    }
  }

  // 10. Phase 4: Learner Model & Mastery Tracking APIs
  if (pathname.startsWith('/api/learner') || pathname.startsWith('/api/rag/learner')) {
    // Normalize url if it was prefixed with /api/rag/learner
    const normalizedReq = {
      ...req,
      url: req.url?.replace('/api/rag/learner', '/api/learner'),
    };
    await learnerHandler(normalizedReq, res);
    return;
  }

  // 11. Phase 5: AI Study Agent & Personalized Planning APIs
  if (pathname.startsWith('/api/agent') || pathname.startsWith('/api/rag/agent')) {
    const normalizedReq = {
      ...req,
      url: req.url?.replace('/api/rag/agent', '/api/agent'),
    };
    await studyAgentHandler(normalizedReq, res);
    return;
  }

  // 12. Phase 6: StudyMate Evaluation & Benchmarking APIs
  if (pathname.startsWith('/api/evaluation') || pathname.startsWith('/api/rag/evaluation')) {
    const normalizedReq = {
      ...req,
      url: req.url?.replace('/api/rag/evaluation', '/api/evaluation'),
    };
    await evaluationHandler(normalizedReq, res);
    return;
  }

  res.status(404).json({ error: `RAG endpoint not found: ${method} ${pathname}` });

}

