import { supabase } from '@/integrations/supabase/client';
import type { VideoRecord, TranscriptSegment, VideoAskResponse } from '@/types/video';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return {
        Authorization: `Bearer ${data.session.access_token}`,
      };
    }
  } catch {
    // Session retrieval skipped in offline/test mode
  }
  return {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const errMsg = data?.error || res.statusText || 'Request failed';
    throw new Error(errMsg);
  }

  return data as T;
}

export async function fetchUserVideos(): Promise<VideoRecord[]> {
  const data = await request<{ success: boolean; videos: VideoRecord[] }>('/api/videos');
  return data.videos || [];
}

export async function fetchVideoById(id: string): Promise<VideoRecord> {
  const data = await request<{ success: boolean; video: VideoRecord }>(`/api/videos/${encodeURIComponent(id)}`);
  return data.video;
}

export async function addYouTubeVideo(
  title: string,
  youtubeUrl: string,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  const data = await request<{ success: boolean; video: VideoRecord }>('/api/videos', {
    method: 'POST',
    body: JSON.stringify({
      title,
      sourceType: 'youtube',
      youtubeUrl,
      transcript,
    }),
  });
  return data.video;
}

export async function uploadVideoFile(
  title: string,
  file: File,
  onProgress?: (progressPercent: number) => void,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  // Read file as base64 with progress tracking
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 90);
        onProgress(percent);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read video file for upload'));
    };

    reader.onload = async () => {
      try {
        const resultStr = reader.result as string;
        // Strip data:video/mp4;base64, header
        const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;

        if (onProgress) onProgress(95);

        const data = await request<{ success: boolean; video: VideoRecord }>('/api/videos', {
          method: 'POST',
          body: JSON.stringify({
            title,
            sourceType: 'upload',
            fileName: file.name,
            base64Data,
            transcript,
          }),
        });

        if (onProgress) onProgress(100);
        resolve(data.video);
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsDataURL(file);
  });
}

export async function deleteVideoById(id: string): Promise<boolean> {
  const data = await request<{ success: boolean }>(`/api/videos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return Boolean(data.success);
}

export async function processVideoById(
  id: string,
  transcript?: string | TranscriptSegment[]
): Promise<VideoRecord> {
  const data = await request<{ success: boolean; video: VideoRecord }>(
    `/api/videos/${encodeURIComponent(id)}/process`,
    {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }
  );
  return data.video;
}

export async function fetchVideoTranscript(id: string): Promise<TranscriptSegment[]> {
  const data = await request<{ success: boolean; segments: TranscriptSegment[] }>(
    `/api/videos/${encodeURIComponent(id)}/transcript`
  );
  return data.segments || [];
}

export async function askVideoQuestion(
  id: string,
  question: string,
  history: Array<{ role: string; content: string }> = [],
  language: string = 'english'
): Promise<VideoAskResponse> {
  const data = await request<VideoAskResponse>(
    `/api/videos/${encodeURIComponent(id)}/ask`,
    {
      method: 'POST',
      body: JSON.stringify({
        question,
        conversationHistory: history,
        language,
      }),
    }
  );
  return data;
}
