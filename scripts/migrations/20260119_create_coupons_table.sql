-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL, -- 'fixed_reward', 'beta_access', etc.
    value JSONB NOT NULL, -- e.g. { "tokens": 1000, "fate_points": 300 }
    max_uses INTEGER NOT NULL DEFAULT 1, -- 1 for unique keys, -1 for infinite
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create coupon_redemptions table to track usage
CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, coupon_id) -- Prevent users from redeeming the same coupon ID twice
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);

-- Optional: RLS Policies (if you want client-side read access, but we are doing server-action redemption so not strictly needed for security if all logic is server-side. However, good practice to secure tables.)
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Allow server service role full access (default), but restrict client access
-- Clients should NOT be able to read all coupons.
-- They can only see their own redemptions.
CREATE POLICY "Users can view their own redemptions" ON coupon_redemptions
    FOR SELECT USING (auth.uid() = user_id);

-- Coupons table is generally secret, users shouldn't be able to list it.
-- Redemption checks happen via Secure Server Action (Service Role) or RPC.
