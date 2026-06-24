import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBearerToken } from '../../adminAuth.js';
import { verifyFirebaseToken } from '../../apiAuth.js';
import {
  getSupabaseAdmin,
  RESUME_BUCKET,
  resumeObjectPath,
} from '../../supabaseAdmin.js';

export async function handleResumeUploadUrl(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let uid: string;
  try {
    const decoded = await verifyFirebaseToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const fileName = String(req.body?.fileName || 'resume.pdf').trim();
  const contentType = String(req.body?.contentType || 'application/octet-stream').trim();

  try {
    const supabase = getSupabaseAdmin();
    const path = resumeObjectPath(uid, fileName);

    const { data, error } = await supabase.storage
      .from(RESUME_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Failed to create upload URL.' });
    }

    return res.status(200).json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      bucket: RESUME_BUCKET,
      contentType,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}

export async function handleResumeDownloadUrl(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing authorization token.' });

  let uid: string;
  try {
    const decoded = await verifyFirebaseToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid authorization token.' });
  }

  const path = String(req.body?.path || '').trim();
  if (!path || !path.startsWith(`${uid}/`)) {
    return res.status(403).json({ error: 'Invalid resume path.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(RESUME_BUCKET)
      .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) {
      return res.status(500).json({ error: error?.message || 'Failed to create download URL.' });
    }

    return res.status(200).json({ signedUrl: data.signedUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message });
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(404).json({ error: 'Use /api/storage/resume-upload-url or /api/storage/resume-download-url' });
}
