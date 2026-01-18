-- ==========================================
-- Supabase Cloud Save Schema
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create the game_saves table
-- Using Compound Primary Key (user_id, game_id) to ensure one save per game mode per user.
create table if not exists game_saves (
  user_id uuid references auth.users not null,
  game_id text not null, -- 'wuxia' or 'god_bless_you'
  save_data jsonb not null, -- Compressed (LZString) or Raw JSON
  turn_count int default 0, -- Meta-data for display
  play_time int default 0, -- Meta-data for display (seconds)
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  primary key (user_id, game_id)
);

-- 2. Enable Row Level Security (RLS)
alter table game_saves enable row level security;

-- 3. Create Policies
-- Allow users to SELECT their own saves
create policy "Users can view their own saves"
  on game_saves for select
  using (auth.uid() = user_id);

-- Allow users to INSERT their own saves
create policy "Users can insert their own saves"
  on game_saves for insert
  with check (auth.uid() = user_id);

-- Allow users to UPDATE their own saves
create policy "Users can update their own saves"
  on game_saves for update
  using (auth.uid() = user_id);

-- 4. Set delete cascade
-- Ensure saves are deleted when the user is deleted from auth.users
alter table game_saves
  drop constraint if exists game_saves_user_id_fkey,
  add constraint game_saves_user_id_fkey
  foreign key (user_id)
  references auth.users (id)
  on delete cascade;

-- Index for faster lookups (optional given PK, but good for filtering)
create index if not exists game_saves_user_id_idx on game_saves (user_id);
