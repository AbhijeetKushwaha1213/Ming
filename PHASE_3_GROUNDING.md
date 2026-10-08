# CANONICAL PHASE 3 — GROUNDING
## Exact Evidence, Citation Verification & Source Navigation

Phase 3 builds the canonical grounding layer for Ming, ensuring that every AI tutor response, flashcard, and diagnostic answer is backed by authentic, verifiable evidence retrieved from ingested course materials with exact source coordinates and zero-trust security.

---

## STEP 1 — DATA CONTRACTS & CANONICAL TYPES (VERIFIED)

Established canonical grounding types in [server/groundingTypes.ts](file:///Users/abhijeetkushwaha/Hackathon/StudyMate-Multimodal-AI-Hackathon-2026/server/groundingTypes.ts) and [src/types/resource.ts](file:///Users/abhijeetkushwaha/Hackathon/StudyMate-Multimodal-AI-Hackathon-2026/src/types/resource.ts), reusing Phase 2 multimodal provenance contracts:

1. **`CanonicalEvidence`**: Normalized atomic evidence unit containing `evidence_id`, `chunk_id`, `resource_id`, `source_type`, `text`, exact coordinates (`page_number`, `slide_number`, `timestamp_start`, `timestamp_end`), `extraction_method`, `content_hash`, and `relevance_score`.
2. **`GroundedClaim`**: Atomic assertion linked to supporting evidence IDs with `ClaimSupportStatus` (`SUPPORTED` | `PARTIALLY_SUPPORTED` | `UNSUPPORTED`).
3. **`VerifiedCitation`**: Application-verified citation reference with exact `SourceLocation` and `CitationVerificationStatus` (`VERIFIED` | `PARTIALLY_VERIFIED` | `UNVERIFIED` | `SOURCE_UNAVAILABLE` | `CROSS_TENANT_REJECTED` | `COORDINATE_MISMATCH`).
4. **`GroundedAnswerContract`**: Structured AI answer schema guaranteeing claims, verified citations, refusal classification, and refusal explanations.

---

## STEP 2 — SECURE RESOURCE STREAMING & SOURCE ACCESS API (VERIFIED)

Step 2 establishes a single canonical, authenticated endpoint allowing the frontend to securely access original resource bytes for citation viewing, media playback, and document inspection.

### 1. Storage Backend Architecture
- **Discovered Storage Mechanism**:
  - **Local Filesystem Storage (Authoritative in Dev/Test/Hackathon)**: Original uploaded files are placed in owner-scoped directories:
    - Documents & images: `server/uploads/{userId}/{filename}`
    - Video uploads: `server/uploads/videos/{filename}`
    - SQLite / LibSQL & PostgreSQL store the metadata in `resources` (`id`, `userId`, `storagePath`, `fileUrl`, `type`, `tagsJson`).
  - **Supabase Storage (Production Object Store)**:
    - Resources can alternatively reference the `resource-files` bucket via `storagePath` and authenticated URLs.
  - **Single Point of Truth**: No second storage system created. The resource `id` is the authoritative key linking vectors, citations, and original files.

### 2. Canonical Authenticated Endpoint
- **Endpoint**: `GET /api/resources/:id/file` (implemented in [api/resources.ts](file:///Users/abhijeetkushwaha/Hackathon/StudyMate-Multimodal-AI-Hackathon-2026/api/resources.ts), routed via [server/index.ts](file:///Users/abhijeetkushwaha/Hackathon/StudyMate-Multimodal-AI-Hackathon-2026/server/index.ts)).
- **Client Helper**: `getResourceFileUrl(resourceId)` in [src/api/resourceAPI.ts](file:///Users/abhijeetkushwaha/Hackathon/StudyMate-Multimodal-AI-Hackathon-2026/src/api/resourceAPI.ts).

### 3. Zero-Trust Authorization & Authentication Rules
1. **Mandatory Server-Side Authentication**:
   - Requires a valid Supabase JWT Bearer token or HMAC-signed test key (`x-ming-test-key` matching `MING_TEST_SECRET`).
   - Unauthenticated requests immediately reject with **`HTTP 401 Unauthorized`**.
2. **Never Trust Client Identity**:
   - The endpoint strictly rejects identity spoofing. Identity is never extracted from `req.query`, `req.body`, or client headers.
3. **Resource Existence & Deletion Invariant**:
   - Non-existent resource IDs return **`HTTP 404 Not Found`**.
   - Deleted resources (`prisma.resource.delete` or soft-deleted records) return **`HTTP 404 Not Found`**.
4. **Ownership & Tenant Boundary Enforcement**:
   - Access permitted **only** if:
     $$\text{resource.userId} = \text{authenticatedUser.id} \quad \lor \quad \text{resource.tenantType} = \text{SYSTEM\_PUBLIC}$$
   - Any access attempt by User B to User A's private resource returns **`HTTP 403 Forbidden`**.
   - Preserves `SYSTEM_PUBLIC` accessibility for authenticated students while preventing unauthenticated leakage.

### 4. Content-Type Determination & Magic Byte Inspection
Content-Type is resolved from actual file bytes using Phase 2 magic byte inspection (`detectMagicSignature`):
- **PDF**: `application/pdf`
- **PNG**: `image/png`
- **JPEG**: `image/jpeg`
- **WEBP**: `image/webp`
- **MP4**: `video/mp4`
- **WEBM**: `video/webm`
- **WAV**: `audio/wav`
- **MP3**: `audio/mpeg`
- **PPTX**: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- **PPT**: `application/vnd.ms-powerpoint`
- **NOTE**: `text/plain; charset=utf-8`

### 5. HTTP Range Streaming (Media Seeking)
For video and audio streaming, HTTP Range requests are fully supported for browser seeking:
- **Header**: `Range: bytes=start-end`
- **Response**: **`HTTP 206 Partial Content`**
- **Response Headers**:
  - `Content-Range: bytes start-end/fileSize`
  - `Accept-Ranges: bytes`
  - `Content-Length: chunkSize`
  - `Content-Type: video/mp4` (or audio MIME)
  - `Cache-Control: private, no-cache, no-store, must-revalidate`
  - `X-Content-Type-Options: nosniff`
- **Invalid Range**: Handled safely with **`HTTP 416 Range Not Satisfiable`** with `Content-Range: bytes */fileSize`.
- Large media files are streamed via `fs.createReadStream` chunks, preventing out-of-memory loading.

### 6. Storage Security & Path Traversal Controls
- **Client controls only**: `resourceId`.
- **Server determines**: Actual storage location, file validation, and authorization.
- **Path Traversal Protection**:
  - Rejects null bytes in paths (`HTTP 400`).
  - Verifies that resolved file path resides strictly within `PROJECT_ROOT` or allowed tenant storage.
  - Blocks `/etc/passwd`, relative `../`, and arbitrary file reads with **`HTTP 403 Forbidden`**.
  - Missing storage objects return a controlled **`HTTP 404 Not Found`** without leaking server filesystem paths.
- **Secret Protection**:
  - Service-role keys (`SUPABASE_SERVICE_ROLE_KEY`), storage credentials, and tokens are never returned in response headers or error bodies.

---

## VERIFICATION & TEST RESULTS

### 1. Test Suite: `src/test/resourceStreaming.test.ts`
All 22 test cases pass cleanly:
- ✓ 1. Authenticated owner can access resource (`HTTP 200`, authentic bytes)
- ✓ 2. Unauthenticated request returns `HTTP 401 Unauthorized`
- ✓ 3. User B cannot access User A's resource (`HTTP 403 Forbidden`)
- ✓ 4. Spoofed userId query/body does not bypass authorization (`HTTP 403 Forbidden`)
- ✓ 5. Fake resource ID returns `HTTP 404 Not Found`
- ✓ 6. Deleted resource returns `HTTP 404 Not Found`
- ✓ 7. SYSTEM_PUBLIC resource follows existing public policy (User B -> 200, Unauthenticated -> 401)
- ✓ 8. Correct Content-Type for PDF (`application/pdf`)
- ✓ 9. Correct Content-Type for image (`image/png`)
- ✓ 10. Correct Content-Type for video (`video/mp4`)
- ✓ 11. Correct Content-Type for audio (`audio/mpeg`)
- ✓ 12. Video Range request returns `HTTP 206 Partial Content` with `Content-Range`
- ✓ 13. Audio Range request returns `HTTP 206 Partial Content` with `Content-Range`
- ✓ 14. Invalid Range is handled safely (`HTTP 416 Range Not Satisfiable`)
- ✓ 15. Path traversal attempt fails (`HTTP 403 Forbidden`)
- ✓ 16. Arbitrary filesystem path cannot be requested (`?path=/etc/passwd` ignored)
- ✓ 17. Private resource is not exposed through a public URL
- ✓ 18. Service-role credentials are never returned in headers or bodies
- ✓ 19. Missing storage object produces a controlled error (`HTTP 404`, no path leak)
- ✓ 20. Resource ID from citation cannot cross tenant boundaries (`HTTP 403 Forbidden`)
- ✓ 21. Supplementary: NOTE resources return `text/plain` with correct content
- ✓ 22. Supplementary: HEAD request returns metadata headers without body

### 2. Security Regression Test Pipeline
- `src/test/resourceStreaming.test.ts`: **22/22 PASSED**
- `src/test/productionSecurityAndIsolation.test.ts`: **23/23 PASSED**
- `src/test/multimodalIngestion.test.ts`: **24/24 PASSED**
- `src/test/productionSmokeIntegration.test.ts`: **17/17 PASSED**
- `src/test/ragVectorStoreEquivalence.test.ts`: **8/8 PASSED**
- **TypeScript (`npx tsc --noEmit`)**: **0 errors**
- **Production Build (`npm run build`)**: **SUCCESS** (10.59s)

---

## REMAINING WORK FOR CANONICAL PHASE 3 STEP 3

1. **Citation Verification Pipeline**: Deterministic claim-to-evidence verification and coordinate matching (`page_number`, `slide_number`, `timestamp`).
2. **Verification State Classifier**: Classifying citations into `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `SOURCE_UNAVAILABLE`, `CROSS_TENANT_REJECTED`, or `COORDINATE_MISMATCH`.
3. **Frontend Citation Viewers (Subsequent Step)**:
   - PDF page canvas viewer consuming `GET /api/resources/:id/file#page=N`.
   - Slide presentation viewer navigating to exact `slide_number`.
   - Video/Audio seeking controller consuming HTTP 206 stream at `timestamp_start`.
