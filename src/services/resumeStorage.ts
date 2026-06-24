import { getAiAuthToken } from './aiAuth';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

export interface ResumeUploadResult {
  path: string;
  bucket: string;
}

function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  );
}

export async function uploadResumeFileToSupabase(file: File): Promise<ResumeUploadResult | null> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured — skipping resume file upload.');
    return null;
  }

  const authToken = await getAiAuthToken();
  if (!authToken) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/storage/resume-upload-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Upload URL request failed (${response.status})`);
  }

  const { path, token, bucket } = payload as {
    path: string;
    token: string;
    bucket: string;
  };

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Resume upload to Supabase failed.');
  }

  return { path, bucket };
}

export async function getResumeDownloadUrl(storagePath: string): Promise<string | null> {
  if (!storagePath?.trim() || !isSupabaseConfigured()) return null;

  const authToken = await getAiAuthToken();
  if (!authToken) return null;

  const response = await fetch('/api/storage/resume-download-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ path: storagePath }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return (payload as { signedUrl?: string }).signedUrl || null;
}
