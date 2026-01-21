-- Creates feedback table to collect user submissions from the extension popup.
create table if not exists public.slop_feedback (
  id uuid primary key default uuid_generate_v4(),
  feedback text not null,
  reporter_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Index to query by reporter_hash for moderation/debugging.
create index if not exists idx_slop_feedback_reporter_hash on public.slop_feedback (reporter_hash);

-- Basic RLS scaffold; adjust policies to your security model.
alter table public.slop_feedback enable row level security;

-- Allow anonymous inserts (only text + reporter hash). Tighten if you add auth.
create policy "Allow insert feedback"
  on public.slop_feedback
  for insert
  to anon
  with check (true);
