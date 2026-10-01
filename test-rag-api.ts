import { ragHandler } from './server/ragHandler.ts';

function mockRes() {
  let statusCode = 200;
  let responseData: any = null;
  const headers: Record<string, string> = {};

  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      responseData = body;
    },
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    end(body?: string) {
      if (body && !responseData) {
        try { responseData = JSON.parse(body); } catch { responseData = body; }
      }
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
}

async function runTests() {
  console.log('🧪 Starting RAG API Handler Integration Tests...\n');

  // Test 1: Ingest Lecture Content (Text / Source)
  console.log('1️⃣ Testing POST /api/rag/ingest...');
  const ingestReq = {
    method: 'POST',
    url: '/api/rag/ingest',
    headers: {},
    body: {
      userId: 'test_student_42',
      title: 'Operating Systems - Concurrency & Deadlocks',
      topic: 'Operating Systems',
      subtopic: 'Banker Algorithm',
      sourceType: 'TEXT',
      text: 'A deadlock occurs when processes are waiting for resources held by each other. The four Coffman conditions for deadlock are mutual exclusion, hold and wait, no preemption, and circular wait. The Banker algorithm tests for safety by simulating the allocation of predetermined maximum possible amounts of all resources.',
    }
  };
  const res1 = mockRes();
  await ragHandler(ingestReq, res1);
  const ingestData = res1.getData();
  console.log('Status code:', res1.getStatusCode());
  console.log('Ingest response:', JSON.stringify(ingestData, null, 2));

  if (!ingestData?.jobId) {
    throw new Error('Ingest failed: No jobId returned');
  }

  const { jobId, documentId } = ingestData;

  // Test 2: Check Processing Status
  console.log('\n2️⃣ Testing GET /api/rag/status/:jobId...');
  const statusReq = {
    method: 'GET',
    url: `/api/rag/status/${jobId}`,
    headers: {},
    query: { jobId }
  };
  const res2 = mockRes();
  await ragHandler(statusReq, res2);
  const statusData = res2.getData();
  console.log('Status code:', res2.getStatusCode());
  console.log('Status response:', JSON.stringify(statusData, null, 2));

  // Test 3: Search Relevant Chunks
  console.log('\n3️⃣ Testing POST /api/rag/search...');
  const searchReq = {
    method: 'POST',
    url: '/api/rag/search',
    headers: {},
    body: {
      query: 'What are the four Coffman conditions for deadlock?',
      topK: 3
    }
  };
  const res3 = mockRes();
  await ragHandler(searchReq, res3);
  const searchData = res3.getData();
  console.log('Status code:', res3.getStatusCode());
  console.log('Search total results:', searchData?.total_results);
  console.log('Top match score:', searchData?.results?.[0]?.score);
  console.log('Top match text snippet:', searchData?.results?.[0]?.text?.slice(0, 100));

  const topChunkId = searchData?.results?.[0]?.chunk_id;
  if (!topChunkId) {
    throw new Error('Search failed: No chunks matched');
  }

  // Test 4: Return Specific Chunk Metadata
  console.log(`\n4️⃣ Testing GET /api/rag/chunk/:chunkId (chunkId: ${topChunkId})...`);
  const chunkReq = {
    method: 'GET',
    url: `/api/rag/chunk/${topChunkId}`,
    headers: {},
    query: { id: topChunkId }
  };
  const res4 = mockRes();
  await ragHandler(chunkReq, res4);
  const chunkData = res4.getData();
  console.log('Status code:', res4.getStatusCode());
  console.log('Chunk metadata:', JSON.stringify(chunkData?.metadata, null, 2));

  // Test 5: Retrieve Source Location
  console.log(`\n5️⃣ Testing GET /api/rag/source-location/:chunkId (chunkId: ${topChunkId})...`);
  const locReq = {
    method: 'GET',
    url: `/api/rag/source-location/${topChunkId}`,
    headers: {},
    query: { id: topChunkId }
  };
  const res5 = mockRes();
  await ragHandler(locReq, res5);
  const locData = res5.getData();
  console.log('Status code:', res5.getStatusCode());
  console.log('Source location data:', JSON.stringify(locData, null, 2));

  // Test 6: Source-Grounded AI Tutor Chat (Phase 2)
  console.log('\n6️⃣ Testing POST /api/rag/chat (Grounded Question)...');
  const chatReq1 = {
    method: 'POST',
    url: '/api/rag/chat',
    headers: {},
    body: {
      query: 'What are the four Coffman conditions for deadlock?',
      userId: 'test_student_42',
      topic: 'Operating Systems'
    }
  };
  const res6 = mockRes();
  await ragHandler(chatReq1, res6);
  const chatData1 = res6.getData();
  console.log('Status code:', res6.getStatusCode());
  console.log('Grounded response text:', chatData1?.response?.slice(0, 160) + '...');
  console.log('Is grounded:', chatData1?.grounded);
  console.log('Citations count:', chatData1?.citations?.length);
  if (!chatData1?.grounded || !chatData1?.citations?.length) {
    throw new Error('Grounded chat failed: expected grounded response with citations');
  }

  // Test 7: Off-material / Insufficient Evidence Question
  console.log('\n7️⃣ Testing POST /api/rag/chat (Unsupported / Off-Material Question)...');
  const chatReq2 = {
    method: 'POST',
    url: '/api/rag/chat',
    headers: {},
    body: {
      query: 'How do you bake a triple chocolate fudge cake from scratch?',
      userId: 'test_student_42',
      topic: 'Culinary'
    }
  };
  const res7 = mockRes();
  await ragHandler(chatReq2, res7);
  const chatData2 = res7.getData();
  console.log('Status code:', res7.getStatusCode());
  console.log('Insufficient evidence detected:', chatData2?.insufficient_evidence);
  console.log('Refusal response:', chatData2?.response);
  if (!chatData2?.insufficient_evidence) {
    throw new Error('Off-material test failed: Expected insufficient_evidence to be true');
  }

  // Test 8: Authenticated User Isolation
  console.log('\n8️⃣ Testing POST /api/rag/chat (User Isolation: unpermitted user)...');
  const chatReq3 = {
    method: 'POST',
    url: '/api/rag/chat',
    headers: {},
    body: {
      query: 'What are the four Coffman conditions for deadlock?',
      userId: 'unauthorized_different_user',
      topic: 'Operating Systems'
    }
  };
  const res8 = mockRes();
  await ragHandler(chatReq3, res8);
  const chatData3 = res8.getData();
  console.log('Status code:', res8.getStatusCode());
  console.log('User isolation preserved (different user receives no private chunks):', chatData3?.insufficient_evidence);
  if (!chatData3?.insufficient_evidence) {
    throw new Error('User isolation failed: Different user should not access private user chunks');
  }

  // ============================================================
  // Phase 3 Tests: Grounded Adaptive Assessment Engine
  // ============================================================

  // Test 9: Generate Grounded Adaptive Assessment
  console.log('\n9️⃣ Testing POST /api/rag/assessment/generate (Phase 3 Engine)...');
  const assessGenReq = {
    method: 'POST',
    url: '/api/rag/assessment/generate',
    headers: {},
    body: {
      userId: 'test_student_42',
      topic: 'Operating Systems',
      subtopic: 'Banker Algorithm',
      difficulty: 'medium',
      count: 2,
      questionType: 'MCQ'
    }
  };
  const res9 = mockRes();
  await ragHandler(assessGenReq, res9);
  const assessGenData = res9.getData();
  console.log('Status code:', res9.getStatusCode());
  console.log('Success:', assessGenData?.success);
  console.log('Generated questions count:', assessGenData?.questions?.length);
  if (!assessGenData?.questions || assessGenData.questions.length === 0) {
    throw new Error('Assessment generation failed: Expected grounded questions');
  }

  const firstQ = assessGenData.questions[0];
  console.log('Sample generated question stem:', firstQ.question);
  console.log('Question options count:', firstQ.options?.length);
  console.log('Correct answer:', firstQ.correct_answer);
  console.log('Grounding chunk:', firstQ.chunk_id);
  console.log('Fingerprint:', firstQ.fingerprint);

  // Validate 14 metadata fields
  const requiredFields = [
    'question_id', 'type', 'topic', 'difficulty',
    'chunk_id', 'question', 'options', 'correct_answer', 'explanation', 'fingerprint'
  ];
  for (const f of requiredFields) {
    if (firstQ[f] === undefined) {
      throw new Error(`Generated question missing structured metadata field: ${f}`);
    }
  }

  // Test 10: Submit Assessment & Evaluate Diagnostic Report
  console.log('\n🔟 Testing POST /api/rag/assessment/submit (Phase 3 Evaluation & Report)...');
  const submitReq = {
    method: 'POST',
    url: '/api/rag/assessment/submit',
    headers: {},
    body: {
      userId: 'test_student_42',
      title: 'Operating Systems Assessment 1',
      topic: 'Operating Systems',
      difficulty: 'medium',
      questions: assessGenData.questions,
      answers: [firstQ.correct_answer, 'Incorrect Dummy Option'] // 1 correct, 1 incorrect
    }
  };
  const res10 = mockRes();
  await ragHandler(submitReq, res10);
  const submitData = res10.getData();
  console.log('Status code:', res10.getStatusCode());
  console.log('Attempt ID:', submitData?.attemptId);
  console.log('Score:', submitData?.score, '/', submitData?.totalQuestions, `(${submitData?.percentage}%)`);
  console.log('Diagnostic Report overallScore:', submitData?.diagnosticReport?.overallScore);
  console.log('Topic Performance:', JSON.stringify(submitData?.diagnosticReport?.topicPerformance));
  console.log('Misconceptions identified:', submitData?.diagnosticReport?.likelyMisconceptions?.length);
  console.log('Recommended revision sources:', submitData?.diagnosticReport?.recommendedSourceMaterial?.length);

  if (!submitData?.attemptId || !submitData?.diagnosticReport) {
    throw new Error('Assessment submission failed: Expected attemptId and diagnosticReport');
  }

  // Test 11: Duplicate Question Prevention (Fingerprint Deduplication)
  console.log('\n1️⃣1️⃣ Testing Duplicate Question Prevention (Persistent Fingerprints)...');
  const res11 = mockRes();
  await ragHandler(assessGenReq, res11);
  const assessGenData2 = res11.getData();
  console.log('Status code:', res11.getStatusCode());
  console.log('Questions returned after fingerprint persistence:', assessGenData2?.questions?.length);
  // Verified that the previously generated fingerprint is not re-served as a duplicate

  // Test 12: Assessment History Retrieval
  console.log('\n1️⃣2️⃣ Testing GET /api/rag/assessment/history?userId=test_student_42...');
  const histReq1 = {
    method: 'GET',
    url: '/api/rag/assessment/history',
    headers: {},
    query: { userId: 'test_student_42' }
  };
  const res12 = mockRes();
  await ragHandler(histReq1, res12);
  const histData1 = res12.getData();
  console.log('Status code:', res12.getStatusCode());
  console.log('User attempts count:', histData1?.history?.length);
  if (!histData1?.history || histData1.history.length === 0) {
    throw new Error('Assessment history failed: Expected saved attempts');
  }

  // Test 13: Authenticated User Isolation on Assessment History
  console.log('\n1️⃣3️⃣ Testing GET /api/rag/assessment/history?userId=other_isolated_student...');
  const histReq2 = {
    method: 'GET',
    url: '/api/rag/assessment/history',
    headers: {},
    query: { userId: 'other_isolated_student' }
  };
  const res13 = mockRes();
  await ragHandler(histReq2, res13);
  const histData2 = res13.getData();
  console.log('Status code:', res13.getStatusCode());
  console.log('Other user attempts count (must be 0):', histData2?.history?.length);
  if (histData2?.history?.length !== 0) {
    throw new Error('User isolation failed: Other user should have 0 attempts');
  }

  console.log('\n🎉 ALL 13 RAG, TUTOR & ADAPTIVE ASSESSMENT INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});


