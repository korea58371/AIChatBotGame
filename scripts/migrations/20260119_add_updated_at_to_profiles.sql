-- Add updated_at column to profiles table if it doesn't exist
alter table profiles 
add column if not exists updated_at timestamptz default now();

-- Optional: Verify it was added
select * from profiles limit 1;
