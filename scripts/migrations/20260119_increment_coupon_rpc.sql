-- RPC for incrementing coupon usage safely
create or replace function increment_coupon_usage(coupon_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update coupons
  set used_count = used_count + 1
  where id = coupon_id;
end;
$$;
