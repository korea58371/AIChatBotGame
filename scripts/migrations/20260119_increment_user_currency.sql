-- Function to safely increment user currency (atomic update)
-- Prevents race conditions and ensures updates happen server-side

create or replace function increment_user_currency(
  p_user_id uuid,
  p_tokens int,
  p_fate_points int
)
returns json
language plpgsql
security definer -- Runs with privileges of creator (admin)
as $$
declare
  v_new_coins int;
  v_new_fp int;
begin
  -- Update the profile and return the new values
  update profiles
  set 
    coins = coalesce(coins, 0) + p_tokens,
    fate_points = coalesce(fate_points, 0) + p_fate_points,
    updated_at = now()
  where id = p_user_id
  returning coins, fate_points into v_new_coins, v_new_fp;

  -- Create a JSON response
  return json_build_object(
    'success', found, -- 'found' is true if a row was updated
    'new_coins', v_new_coins,
    'new_fate_points', v_new_fp
  );
end;
$$;
