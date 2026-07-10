-- Single-user tool: drop per-user auth, keep everything behind the service role key.
alter table captures drop constraint if exists captures_user_id_fkey;
alter table captures alter column user_id drop not null;
alter table captures disable row level security;

drop policy if exists "Users can view own captures" on captures;
drop policy if exists "Users can insert own captures" on captures;
drop policy if exists "Users can update own captures" on captures;
drop policy if exists "Users can delete own captures" on captures;
drop policy if exists "Users can upload own screenshots" on storage.objects;
drop policy if exists "Users can view own screenshots" on storage.objects;

create policy "Service role only: screenshots"
  on storage.objects for all
  using (bucket_id = 'captures' and auth.role() = 'service_role')
  with check (bucket_id = 'captures' and auth.role() = 'service_role');
