-- Add fate_points column to profiles table if it doesn't exist
alter table profiles 
add column if not exists fate_points int default 0;

-- Optional: Verify it was added
select * from profiles limit 1;
