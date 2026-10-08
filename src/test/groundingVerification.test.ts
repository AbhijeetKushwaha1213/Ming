/**
 * Canonical Phase 3 — Step 3
 * Deterministic Citation & Claim Verification Engine Test Suite
 * 
 * Verifies all 30 canonical grounding invariants:
 * 1. Single valid evidence citation -> VERIFIED
 * 2. Multiple valid evidence citations -> VERIFIED
 * 3. Missing citation for factual claim -> UNVERIFIED
 * 4. Fabricated EVIDENCE ID -> UNVERIFIED
 * 5. Fabricated chunk ID -> UNVERIFIED
 * 6. Citation references evidence not present in current retrieval set -> UNVERIFIED
 * 7. Correct PDF page coordinate -> VERIFIED
 * 8. Wrong PDF page coordinate -> COORDINATE_MISMATCH
 * 9. Correct PPT slide coordinate -> VERIFIED
 * 10. Wrong PPT slide coordinate -> COORDINATE_MISMATCH
 * 11. Correct video timestamp -> VERIFIED
 * 12. Wrong video timestamp -> COORDINATE_MISMATCH
 * 13. Correct audio timestamp -> VERIFIED
 * 14. Cross-tenant evidence -> CROSS_TENANT_REJECTED
 * 15. Deleted resource -> SOURCE_UNAVAILABLE
 * 16. Missing resource -> SOURCE_UNAVAILABLE
 * 17. SYSTEM_PUBLIC evidence -> follows existing public-access policy
 * 18. OCR evidence -> VERIFIED when provenance matches
 * 19. Vision evidence -> VERIFIED when provenance matches
 * 20. Malicious/fabricated excerpt -> PARTIALLY_VERIFIED or UNVERIFIED
 * 21. Valid chunk ID from another retrieval context -> UNVERIFIED
 * 22. LLM attempts arbitrary resource ID -> rejected
 * 23. Claim with partially supporting evidence -> PARTIALLY_VERIFIED
 * 24. No blind top-3 fallback occurs
 * 25. Multiple claims with mixed verification statuses
 * 26. Verification result is deterministic across repeated runs
 * 27. Client-supplied userId cannot alter verification result
 * 28. Client-supplied tenant metadata cannot alter verification result
 * 29. Coordinate mismatch cannot be silently corrected
 * 30. VerifiedCitation retains canonical navigation metadata
 */

import { describe, it, expect } from 'vitest';
import {
  buildCanonicalEvidenceIndex,
  verifyCitation,
  verifyGroundedAnswer,
  verifyCoordinates,
  checkExcerptAlignment,
  extractClaimsFromAnswer,
  type VerificationContext,
  type ResourceVerificationRecord,
} from '../../server/citationVerifier.ts';

describe('CANONICAL PHASE 3 STEP 3: DETERMINISTIC CITATION & CLAIM VERIFICATION ENGINE', () => {
  const USER_ALICE = 'user_alice_auth_123';
  const USER_BOB = 'user_bob_auth_456';
  const SYSTEM_PUBLIC_USER = 'system_public';

  // Standard mock resource checker simulating authoritative database state
  const mockResourceChecker = async (resourceId: string): Promise<ResourceVerificationRecord | null> => {
    if (resourceId === 'res_missing_404') {
      return null;
    }
    if (resourceId === 'res_deleted_500') {
      return { exists: true, isDeleted: true, userId: USER_ALICE, tenantType: 'USER_PRIVATE' };
    }
    if (resourceId === 'res_bob_private') {
      return { exists: true, isDeleted: false, userId: USER_BOB, tenantType: 'USER_PRIVATE' };
    }
    if (resourceId === 'res_public_curriculum') {
      return { exists: true, isDeleted: false, userId: SYSTEM_PUBLIC_USER, tenantType: 'SYSTEM_PUBLIC' };
    }
    // Default valid Alice resource
    return {
      exists: true,
      isDeleted: false,
      userId: USER_ALICE,
      tenantType: 'USER_PRIVATE',
    };
  };

  const samplePdfChunk = {
    chunk_id: 'chk_pdf_001',
    resource_id: 'res_os_textbook',
    source_id: 'res_os_textbook',
    document_id: 'res_os_textbook',
    user_id: USER_ALICE,
    tenant_type: 'USER_PRIVATE',
    source_type: 'PDF',
    page_number: 42,
    location: {
      source_type: 'PDF',
      page_number: 42,
    },
    text: 'A process is an instance of a program in execution containing program code and current activity.',
    extraction_method: 'NATIVE_TEXT',
    content_hash: 'hash_pdf_42',
    score: 0.95,
  };

  const sampleSlideChunk = {
    chunk_id: 'chk_slide_002',
    resource_id: 'res_lecture_slides',
    source_id: 'res_lecture_slides',
    document_id: 'res_lecture_slides',
    user_id: USER_ALICE,
    tenant_type: 'USER_PRIVATE',
    source_type: 'PPTX',
    slide_number: 14,
    location: {
      source_type: 'PPTX',
      slide_number: 14,
    },
    text: 'Context switching involves saving the state of the currently running process and restoring another.',
    extraction_method: 'NATIVE_TEXT',
    content_hash: 'hash_slide_14',
    score: 0.92,
  };

  const sampleVideoChunk = {
    chunk_id: 'chk_video_003',
    resource_id: 'res_lecture_video',
    source_id: 'res_lecture_video',
    document_id: 'res_lecture_video',
    user_id: USER_ALICE,
    tenant_type: 'USER_PRIVATE',
    source_type: 'VIDEO',
    timestamp_start: 120,
    timestamp_end: 180,
    location: {
      source_type: 'VIDEO',
      timestamp_start: 120,
      timestamp_end: 180,
    },
    text: 'Here in this segment we illustrate how the CPU scheduler selects a process from the ready queue.',
    extraction_method: 'AUDIO_TRANSCRIPT',
    content_hash: 'hash_video_120',
    score: 0.88,
  };

  const sampleAudioChunk = {
    chunk_id: 'chk_audio_004',
    resource_id: 'res_lecture_audio',
    source_id: 'res_lecture_audio',
    document_id: 'res_lecture_audio',
    user_id: USER_ALICE,
    tenant_type: 'USER_PRIVATE',
    source_type: 'AUDIO',
    timestamp_start: 300,
    timestamp_end: 360,
    location: {
      source_type: 'AUDIO',
      timestamp_start: 300,
      timestamp_end: 360,
    },
    text: 'Deadlock occurs when four conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait.',
    extraction_method: 'AUDIO_TRANSCRIPT',
    content_hash: 'hash_audio_300',
    score: 0.89,
  };

  // Helper to build context
  const createTestContext = (chunks: any[] = [samplePdfChunk, sampleSlideChunk]): VerificationContext => {
    const evidenceIndex = buildCanonicalEvidenceIndex(chunks, USER_ALICE);
    return {
      authenticatedUserId: USER_ALICE,
      evidenceIndex,
      resourceChecker: mockResourceChecker,
    };
  };

  // 1. Correct single evidence citation -> VERIFIED
  it('1. Correct single evidence citation -> VERIFIED', async () => {
    const context = createTestContext();
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 42,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
    expect(result.chunk_id).toBe('chk_pdf_001');
    expect(result.location.page_number).toBe(42);
  });

  // 2. Multiple valid evidence citations -> VERIFIED
  it('2. Multiple valid evidence citations -> VERIFIED', async () => {
    const context = createTestContext([samplePdfChunk, sampleSlideChunk]);
    const answer = await verifyGroundedAnswer(
      {
        answer: 'Processes execute in memory [EVIDENCE_1]. Switching between them requires context switching [EVIDENCE_2].',
      },
      context
    );

    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBe(2);
    expect(answer.citations[0].verification_status).toBe('VERIFIED');
    expect(answer.citations[1].verification_status).toBe('VERIFIED');
    expect(answer.claims.length).toBe(2);
    expect(answer.claims[0].support_status).toBe('VERIFIED');
    expect(answer.claims[1].support_status).toBe('VERIFIED');
  });

  // 3. Missing citation for factual claim -> UNVERIFIED
  it('3. Missing citation for factual claim -> UNVERIFIED', async () => {
    const context = createTestContext();
    const answer = await verifyGroundedAnswer(
      {
        answer: 'Operating systems also manage secondary storage and filesystems.',
        claims: [
          {
            claim_id: 'claim_1',
            text: 'Operating systems also manage secondary storage and filesystems.',
            evidence_ids: [],
          },
        ],
      },
      context
    );

    expect(answer.claims[0].support_status).toBe('UNVERIFIED');
    expect(answer.grounded).toBe(false);
    expect(answer.unsupported_claims.length).toBe(1);
    expect(answer.coverage_score).toBe(0.0);
  });

  // 4. Fabricated EVIDENCE ID -> UNVERIFIED
  it('4. Fabricated EVIDENCE ID -> UNVERIFIED', async () => {
    const context = createTestContext();
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_999',
      },
      context
    );

    expect(result.verification_status).toBe('UNVERIFIED');
  });

  // 5. Fabricated chunk ID -> UNVERIFIED
  it('5. Fabricated chunk ID -> UNVERIFIED', async () => {
    const context = createTestContext();
    const result = await verifyCitation(
      {
        chunk_id: 'chk_fake_nonexistent',
      },
      context
    );

    expect(result.verification_status).toBe('UNVERIFIED');
  });

  // 6. Citation references evidence not present in current retrieval set -> UNVERIFIED
  it('6. Citation references evidence not present in current retrieval set -> UNVERIFIED', async () => {
    // Current retrieval set only has PDF chunk
    const context = createTestContext([samplePdfChunk]);
    // LLM attempts to cite chunk 2 which is elsewhere in DB but NOT retrieved
    const result = await verifyCitation(
      {
        chunk_id: 'chk_slide_002',
      },
      context
    );

    expect(result.verification_status).toBe('UNVERIFIED');
  });

  // 7. Correct PDF page coordinate -> VERIFIED
  it('7. Correct PDF page coordinate -> VERIFIED', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 42,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
    expect(result.location.page_number).toBe(42);
  });

  // 8. Wrong PDF page coordinate -> COORDINATE_MISMATCH
  it('8. Wrong PDF page coordinate -> COORDINATE_MISMATCH', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 99, // Canonical is 42
      },
      context
    );

    expect(result.verification_status).toBe('COORDINATE_MISMATCH');
  });

  // 9. Correct PPT slide coordinate -> VERIFIED
  it('9. Correct PPT slide coordinate -> VERIFIED', async () => {
    const context = createTestContext([sampleSlideChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        slide_number: 14,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
    expect(result.location.slide_number).toBe(14);
  });

  // 10. Wrong PPT slide coordinate -> COORDINATE_MISMATCH
  it('10. Wrong PPT slide coordinate -> COORDINATE_MISMATCH', async () => {
    const context = createTestContext([sampleSlideChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        slide_number: 88, // Canonical is 14
      },
      context
    );

    expect(result.verification_status).toBe('COORDINATE_MISMATCH');
  });

  // 11. Correct video timestamp -> VERIFIED
  it('11. Correct video timestamp -> VERIFIED', async () => {
    const context = createTestContext([sampleVideoChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        timestamp_start: 140, // Within [120, 180] window
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
  });

  // 12. Wrong video timestamp -> COORDINATE_MISMATCH
  it('12. Wrong video timestamp -> COORDINATE_MISMATCH', async () => {
    const context = createTestContext([sampleVideoChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        timestamp_start: 900, // Way outside [120, 180] window
      },
      context
    );

    expect(result.verification_status).toBe('COORDINATE_MISMATCH');
  });

  // 13. Correct audio timestamp -> VERIFIED
  it('13. Correct audio timestamp -> VERIFIED', async () => {
    const context = createTestContext([sampleAudioChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        timestamp_start: 320, // Within [300, 360] window
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
  });

  // 14. Cross-tenant evidence -> CROSS_TENANT_REJECTED
  it('14. Cross-tenant evidence -> CROSS_TENANT_REJECTED', async () => {
    const bobPrivateChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_bob_private_1',
      resource_id: 'res_bob_private',
      user_id: USER_BOB,
      tenant_type: 'USER_PRIVATE',
    };
    // Even if somehow retrieved or passed in index, context user is Alice
    const context = createTestContext([bobPrivateChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
      },
      context
    );

    expect(result.verification_status).toBe('CROSS_TENANT_REJECTED');
  });

  // 15. Deleted resource -> SOURCE_UNAVAILABLE
  it('15. Deleted resource -> SOURCE_UNAVAILABLE', async () => {
    const deletedResourceChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_deleted_res_1',
      resource_id: 'res_deleted_500',
    };
    const context = createTestContext([deletedResourceChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
      },
      context
    );

    expect(result.verification_status).toBe('SOURCE_UNAVAILABLE');
  });

  // 16. Missing resource -> SOURCE_UNAVAILABLE
  it('16. Missing resource -> SOURCE_UNAVAILABLE', async () => {
    const missingResourceChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_missing_res_1',
      resource_id: 'res_missing_404',
    };
    const context = createTestContext([missingResourceChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
      },
      context
    );

    expect(result.verification_status).toBe('SOURCE_UNAVAILABLE');
  });

  // 17. SYSTEM_PUBLIC evidence -> follows existing public-access policy
  it('17. SYSTEM_PUBLIC evidence -> follows existing public-access policy', async () => {
    const publicCurriculumChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_public_curriculum_1',
      resource_id: 'res_public_curriculum',
      user_id: SYSTEM_PUBLIC_USER,
      tenant_type: 'SYSTEM_PUBLIC',
    };
    // Alice accesses public curriculum
    const context = createTestContext([publicCurriculumChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 42,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
  });

  // 18. OCR evidence -> VERIFIED when provenance matches
  it('18. OCR evidence -> VERIFIED when provenance matches', async () => {
    const ocrChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_scanned_ocr_1',
      extraction_method: 'OCR',
      text: 'Scanned document text verified via Tesseract OCR engine.',
    };
    const context = createTestContext([ocrChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 42,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
  });

  // 19. Vision evidence -> VERIFIED when provenance matches
  it('19. Vision evidence -> VERIFIED when provenance matches', async () => {
    const visionChunk = {
      ...sampleSlideChunk,
      chunk_id: 'chk_vision_slide_1',
      extraction_method: 'VISION',
      text: 'Visual diagram depicting three-tier client-server architecture with state machine.',
    };
    const context = createTestContext([visionChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        slide_number: 14,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
  });

  // 20. Malicious/fabricated excerpt -> PARTIALLY_VERIFIED or UNVERIFIED
  it('20. Malicious/fabricated excerpt -> PARTIALLY_VERIFIED or UNVERIFIED', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        excerpt: 'Quantum entanglement instantly collapses macroscopic temporal wormholes into tachyons.',
      },
      context
    );

    expect(['PARTIALLY_VERIFIED', 'UNVERIFIED']).toContain(result.verification_status);
  });

  // 21. Valid chunk ID from another retrieval context -> UNVERIFIED
  it('21. Valid chunk ID from another retrieval context -> UNVERIFIED', async () => {
    // Only samplePdfChunk was retrieved in this specific query context
    const context = createTestContext([samplePdfChunk]);
    // Attacker cites a valid chunk ID from an earlier session:
    const result = await verifyCitation(
      {
        chunk_id: 'chk_slide_002',
      },
      context
    );

    expect(result.verification_status).toBe('UNVERIFIED');
  });

  // 22. LLM attempts arbitrary resource ID -> rejected
  it('22. LLM attempts arbitrary resource ID -> rejected', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        resource_id: 'res_arbitrary_spoofed_res_id', // Does not match canonical provenance
      },
      context
    );

    expect(result.verification_status).toBe('UNVERIFIED');
  });

  // 23. Claim with partially supporting evidence -> PARTIALLY_VERIFIED
  it('23. Claim with partially supporting evidence -> PARTIALLY_VERIFIED', async () => {
    const context = createTestContext([samplePdfChunk]);
    const answer = await verifyGroundedAnswer(
      {
        answer: 'Processes execute in memory and perhaps also execute in cosmic space [EVIDENCE_1].',
        claims: [
          {
            claim_id: 'claim_1',
            text: 'Processes execute in memory and perhaps also execute in cosmic space',
            evidence_ids: ['EVIDENCE_1'],
            support_level: 'PARTIAL',
          },
        ],
      },
      context
    );

    expect(answer.claims[0].support_status).toBe('PARTIALLY_VERIFIED');
    expect(answer.grounded).toBe(false);
  });

  // 24. No blind top-3 fallback occurs
  it('24. No blind top-3 fallback occurs', async () => {
    const context = createTestContext([samplePdfChunk, sampleSlideChunk]);
    // Answer text without any citation tags
    const answer = await verifyGroundedAnswer(
      {
        answer: 'Operating systems schedule threads across available CPU cores.',
      },
      context
    );

    // MUST NOT attach top 3 chunks automatically!
    expect(answer.citations).toEqual([]);
    expect(answer.grounded).toBe(false);
    expect(answer.coverage_score).toBe(0.0);
    expect(answer.claims[0].support_status).toBe('UNVERIFIED');
  });

  // 25. Multiple claims with mixed verification statuses
  it('25. Multiple claims with mixed verification statuses', async () => {
    const bobChunk = {
      ...sampleSlideChunk,
      chunk_id: 'chk_bob_leak',
      resource_id: 'res_bob_private',
      user_id: USER_BOB,
    };
    const context = createTestContext([samplePdfChunk, bobChunk]);

    const answer = await verifyGroundedAnswer(
      {
        answer: 'Claim 1 verified [EVIDENCE_1]. Claim 2 unsupported. Claim 3 cross-tenant [EVIDENCE_2].',
        claims: [
          {
            claim_id: 'c1',
            text: 'Claim 1 verified',
            evidence_ids: ['EVIDENCE_1'],
            proposed_coordinates: { page_number: 42 },
          },
          {
            claim_id: 'c2',
            text: 'Claim 2 unsupported',
            evidence_ids: [],
          },
          {
            claim_id: 'c3',
            text: 'Claim 3 cross-tenant',
            evidence_ids: ['EVIDENCE_2'],
          },
          {
            claim_id: 'c4',
            text: 'Claim 4 coordinate mismatch',
            evidence_ids: ['EVIDENCE_1'],
            proposed_coordinates: { page_number: 999 }, // Mismatch
          },
        ],
      },
      context
    );

    expect(answer.claims[0].support_status).toBe('VERIFIED');
    expect(answer.claims[1].support_status).toBe('UNVERIFIED');
    expect(answer.claims[2].support_status).toBe('CROSS_TENANT_REJECTED');
    expect(answer.claims[3].support_status).toBe('COORDINATE_MISMATCH');
    expect(answer.unsupported_claims.length).toBe(3);
    expect(answer.grounded).toBe(false);
  });

  // 26. Verification result is deterministic across repeated runs
  it('26. Verification result is deterministic across repeated runs', async () => {
    const context = createTestContext([samplePdfChunk, sampleSlideChunk]);
    const payload = {
      answer: 'Processes execute in memory [EVIDENCE_1]. Context switches occur [EVIDENCE_2].',
      claims: [
        { claim_id: 'c1', text: 'Processes execute in memory', evidence_ids: ['EVIDENCE_1'] },
        { claim_id: 'c2', text: 'Context switches occur', evidence_ids: ['EVIDENCE_2'] },
      ],
    };

    const run1 = await verifyGroundedAnswer(payload, context);
    const run2 = await verifyGroundedAnswer(payload, context);
    const run3 = await verifyGroundedAnswer(payload, context);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    expect(JSON.stringify(run2)).toBe(JSON.stringify(run3));
  });

  // 27. Client-supplied userId cannot alter verification result
  it('27. Client-supplied userId cannot alter verification result', async () => {
    const bobChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_bob_secret',
      resource_id: 'res_bob_private',
      user_id: USER_BOB,
    };
    const context = createTestContext([bobChunk]);

    // Attacker supplies userId: 'user_bob_auth_456' inside proposed citation
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        ...( { user_id: USER_BOB } as any), // Client attempts to override identity
      },
      context
    );

    expect(result.verification_status).toBe('CROSS_TENANT_REJECTED');
  });

  // 28. Client-supplied tenant metadata cannot alter verification result
  it('28. Client-supplied tenant metadata cannot alter verification result', async () => {
    const bobChunk = {
      ...samplePdfChunk,
      chunk_id: 'chk_bob_secret',
      resource_id: 'res_bob_private',
      user_id: USER_BOB,
      tenant_type: 'USER_PRIVATE',
    };
    const context = createTestContext([bobChunk]);

    // Attacker supplies tenant_type: 'SYSTEM_PUBLIC' inside proposed citation
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        ...( { tenant_type: 'SYSTEM_PUBLIC' } as any), // Client attempts to bypass tenant check
      },
      context
    );

    expect(result.verification_status).toBe('CROSS_TENANT_REJECTED');
  });

  // 29. Coordinate mismatch cannot be silently corrected
  it('29. Coordinate mismatch cannot be silently corrected', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 108, // Canonical is 42
      },
      context
    );

    // MUST NOT be silently corrected to VERIFIED
    expect(result.verification_status).toBe('COORDINATE_MISMATCH');
    expect(result.verification_status).not.toBe('VERIFIED');
  });

  // 30. VerifiedCitation retains canonical navigation metadata
  it('30. VerifiedCitation retains canonical navigation metadata', async () => {
    const context = createTestContext([samplePdfChunk]);
    const result = await verifyCitation(
      {
        evidence_id: 'EVIDENCE_1',
        page_number: 42,
      },
      context
    );

    expect(result.verification_status).toBe('VERIFIED');
    expect(result.resource_id).toBe('res_os_textbook');
    expect(result.source_type).toBe('PDF');
    expect(result.location.page_number).toBe(42);
    expect(result.chunk_id).toBe('chk_pdf_001');
    expect(result.excerpt).toBeDefined();
  });
});
