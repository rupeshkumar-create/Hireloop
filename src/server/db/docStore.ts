import { getSupabaseAdmin } from '../supabaseAdmin.js';

export async function getDoc(collection: string, docId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('firestore_docs')
    .select('data')
    .eq('collection', collection)
    .eq('doc_id', docId)
    .maybeSingle();

  if (error) throw error;
  return {
    exists: Boolean(data),
    id: docId,
    data: (data?.data || null) as Record<string, unknown> | null,
  };
}

export async function setDoc(
  collection: string,
  docId: string,
  payload: Record<string, unknown>,
  merge = false
) {
  let data = payload;
  if (merge) {
    const existing = await getDoc(collection, docId);
    data = { ...(existing.data || {}), ...payload };
  }

  const { error } = await getSupabaseAdmin()
    .from('firestore_docs')
    .upsert({
      collection,
      doc_id: docId,
      data,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

export async function deleteDoc(collection: string, docId: string) {
  const { error } = await getSupabaseAdmin()
    .from('firestore_docs')
    .delete()
    .eq('collection', collection)
    .eq('doc_id', docId);

  if (error) throw error;
}

export async function queryDocs(
  collection: string,
  options?: {
    where?: Array<{ field: string; op: 'eq' | 'lte' | 'gte'; value: unknown }>;
    orderBy?: { field: string; ascending?: boolean };
    limit?: number;
  }
) {
  let query = getSupabaseAdmin()
    .from('firestore_docs')
    .select('doc_id, data')
    .eq('collection', collection);

  for (const clause of options?.where || []) {
    const path = `data->>${clause.field}`;
    if (clause.op === 'eq') query = query.eq(path, clause.value as string);
    if (clause.op === 'lte') query = query.lte(path, clause.value as string);
    if (clause.op === 'gte') query = query.gte(path, clause.value as string);
  }

  if (options?.orderBy) {
    query = query.order(`data->>${options.orderBy.field}`, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.doc_id as string,
    data: row.data as Record<string, unknown>,
  }));
}

export async function addDoc(collection: string, payload: Record<string, unknown>) {
  const docId = crypto.randomUUID();
  await setDoc(collection, docId, payload, false);
  return docId;
}

export async function insertAiLog(userId: string | null, payload: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from('ai_logs').insert({
    user_id: userId,
    data: payload,
  });
  if (error) throw error;
}

export async function insertAdminLog(payload: Record<string, unknown>) {
  const { error } = await getSupabaseAdmin().from('admin_logs').insert({ data: payload });
  if (error) throw error;
}

/** Slash path like content_growth/state → collection + doc_id */
export function parseDocPath(path: string): { collection: string; docId: string } {
  const parts = path.split('/');
  if (parts.length === 1) return { collection: parts[0], docId: 'default' };
  return { collection: parts[0], docId: parts.slice(1).join('/') };
}

export async function getDocByPath(path: string) {
  const { collection, docId } = parseDocPath(path);
  return getDoc(collection, docId);
}

export async function setDocByPath(path: string, payload: Record<string, unknown>, merge = false) {
  const { collection, docId } = parseDocPath(path);
  return setDoc(collection, docId, payload, merge);
}
