import { searchChunks, ingestSource } from '@/api/ragAPI';
import { exportPageToMarkdown } from '@/api/exportAPI';
import { cleanAiResponseToReadableNotes } from '@/utils/notesFormatter';
import type { CourseResourceItem } from '@/hooks/useCourseResources';

export interface GroundedRetrievalResult {
  groundedContext: string;
  sourceTitles: string[];
  chunksCount: number;
  hasGroundedContent: boolean;
  topicRecommendation?: string;
}

export async function retrieveGroundedResourceContent(params: {
  selectedSourceIds: string[];
  resources: CourseResourceItem[];
  topic?: string;
  subtopic?: string;
  userId?: string;
}): Promise<GroundedRetrievalResult> {
  const { selectedSourceIds, resources, topic, subtopic, userId = 'default_user' } = params;

  const isAll = selectedSourceIds.length === 0 || selectedSourceIds.includes('all');
  const targetResources = isAll
    ? resources
    : resources.filter((r) => selectedSourceIds.includes(r.id));

  const sourceTitles: string[] = [];
  const gatheredExcerpts: string[] = [];
  let totalChunks = 0;

  for (const res of targetResources) {
    sourceTitles.push(res.title);

    // 1. If Notion Page, fetch its full note content
    if (res.isNotionPage && res.pageData) {
      try {
        let pageMarkdown = '';
        try {
          pageMarkdown = await exportPageToMarkdown(res.pageData.id, true);
        } catch {
          // fallback to noteContent or properties
          pageMarkdown = res.pageData.content || res.pageData.title || '';
        }

        if (pageMarkdown && pageMarkdown.trim()) {
          const cleanText = cleanAiResponseToReadableNotes(pageMarkdown);
          gatheredExcerpts.push(`### Source Note: ${res.title} (Workspace Note)\n${cleanText.slice(0, 3000)}`);
          totalChunks++;

          // Ensure it's indexed in Chroma in background
          ingestSource({
            text: cleanText,
            title: res.title,
            topic: topic || res.folder || 'General',
            subtopic: subtopic || res.rawTitle,
            userId,
            sourceType: 'NOTE',
            sourceId: res.pageData.id,
            documentId: res.pageData.id,
          }).catch((err) => console.warn('Background page indexing warning:', err));
        }
      } catch (err) {
        console.warn(`Could not extract notes from Notion page ${res.title}:`, err);
      }
    }

    // 2. If Resource NOTE has noteContent
    if (!res.isNotionPage && res.resourceData?.noteContent) {
      const noteText = res.resourceData.noteContent.trim();
      if (noteText) {
        gatheredExcerpts.push(`### Source Material: ${res.title} (Study Note)\n${noteText.slice(0, 3000)}`);
        totalChunks++;
      }
    }
  }

  // 3. Retrieve chunks from ChromaDB vector index
  try {
    const searchQuery = [
      topic,
      subtopic,
      targetResources.length === 1 ? targetResources[0].rawTitle : '',
      'core concepts key definitions principles formulas steps overview summary',
    ]
      .filter(Boolean)
      .join(' ');

    const sourceIdArg = isAll
      ? undefined
      : targetResources
          .map((r) => (r.isNotionPage && r.pageData ? r.pageData.id : r.id))
          .filter(Boolean)
          .join(',');

    const searchRes = await searchChunks(searchQuery, {
      topK: Math.min(20, Math.max(8, targetResources.length * 4)),
      userId,
      sourceId: sourceIdArg || undefined,
      topic: topic || (targetResources.length === 1 ? targetResources[0].folder : undefined),
    });

    if (searchRes && Array.isArray(searchRes.results) && searchRes.results.length > 0) {
      searchRes.results.forEach((chunk, idx) => {
        const loc = chunk.location;
        let coord = '';
        if (loc?.page_number) coord = ` [Page ${loc.page_number}]`;
        else if (loc?.slide_number) coord = ` [Slide ${loc.slide_number}]`;
        else if (loc?.timestamp_start !== undefined && loc?.timestamp_start !== null) {
          const mins = Math.floor((loc.timestamp_start || 0) / 60);
          const secs = Math.floor((loc.timestamp_start || 0) % 60);
          coord = ` [Timestamp ${mins}:${secs < 10 ? '0' : ''}${secs}]`;
        }

        const sourceLabel = chunk.topic || (targetResources[0]?.title) || 'Course Document';
        gatheredExcerpts.push(
          `--- Excerpt ${idx + 1}: ${sourceLabel}${coord} ---\n${chunk.text.trim()}`
        );
        totalChunks++;
      });
    }
  } catch (chromaErr) {
    console.warn('Vector search retrieval encountered fallback:', chromaErr);
  }

  // If no chunks were retrieved but we have resource titles/folders, provide a structured reference
  if (gatheredExcerpts.length === 0 && targetResources.length > 0) {
    targetResources.forEach((r) => {
      gatheredExcerpts.push(
        `### Source Material: ${r.title}\nSubject / Focus: ${r.folder || topic || 'General Coursework'}\nType: ${r.type}`
      );
    });
  }

  const topicRecommendation =
    targetResources.length === 1 && targetResources[0].folder
      ? targetResources[0].folder
      : targetResources.length === 1
      ? targetResources[0].rawTitle
      : undefined;

  const groundedContext = gatheredExcerpts.join('\n\n');

  return {
    groundedContext,
    sourceTitles,
    chunksCount: totalChunks,
    hasGroundedContent: gatheredExcerpts.length > 0,
    topicRecommendation,
  };
}
