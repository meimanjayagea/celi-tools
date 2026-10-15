-- Jalankan di Supabase SQL Editor (setelah schema.sql)

create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('diagram', 'api-spec', 'json')),
  title text not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index saved_items_user_idx on public.saved_items (user_id, updated_at desc);

alter table public.saved_items enable row level security;

create policy "Owner can select" on public.saved_items
  for select using (auth.uid() = user_id);

create policy "Owner can insert" on public.saved_items
  for insert with check (auth.uid() = user_id);

create policy "Owner can update" on public.saved_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Owner can delete" on public.saved_items
  for delete using (auth.uid() = user_id);
