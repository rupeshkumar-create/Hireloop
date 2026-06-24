-- Run in Supabase SQL Editor after creating bucket "resumes" (Storage → New bucket).
-- Bucket: resumes (private recommended — access via signed URLs from the app).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role bypasses RLS; these policies apply if you ever use the anon key directly.
create policy "Users read own resumes"
on storage.objects for select
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users upload own resumes"
on storage.objects for insert
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update own resumes"
on storage.objects for update
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete own resumes"
on storage.objects for delete
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
