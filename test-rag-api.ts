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

  console.log('\n🎉 ALL 8 RAG API & GROUNDED TUTOR INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});

