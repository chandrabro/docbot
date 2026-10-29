-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  char_count int not null,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  ip text not null,
  day date not null,
  count int not null default 0,
  primary key (ip, day)
);

create table if not exists answer_cache (
  key text primary key,
  answer jsonb not null,
  created_at timestamptz not null default now()
);

-- Lock the tables: only the server (service role key) can read/write them.
alter table documents enable row level security;
alter table rate_limits enable row level security;
alter table answer_cache enable row level security;
