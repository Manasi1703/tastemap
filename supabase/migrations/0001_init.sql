-- TasteMap initial schema
create extension if not exists vector;

create table if not exists captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  domain text not null,
  title text,
  screenshot_path text,
  note text,
  tags text[] default '{}',
  category text,
  mood text,
  summary text,
  embedding vector(1536),
  status text not null default 'pending', -- pending | tagged | failed
  created_at timestamptz not null default now()
);

create index if not exists captures_user_id_idx on captures(user_id);
create index if not exists captures_created_at_idx on captures(created_at);
create index if not exists captures_embedding_idx on captures using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table captures enable row level security;

create policy "Users can view own captures"
  on captures for select
  using (auth.uid() = user_id);

create policy "Users can insert own captures"
  on captures for insert
  with check (auth.uid() = user_id);

create policy "Users can update own captures"
  on captures for update
  using (auth.uid() = user_id);

create policy "Users can delete own captures"
  on captures for delete
  using (auth.uid() = user_id);

-- storage bucket for screenshots
insert into storage.buckets (id, name, public)
values ('captures', 'captures', false)
on conflict (id) do nothing;

create policy "Users can upload own screenshots"
  on storage.objects for insert
  with check (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can view own screenshots"
  on storage.objects for select
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = auth.uid()::text);
