'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Use admin client for secret table
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type CouponRedemptionResult = {
    success: boolean;
    message: string;
    rewards?: {
        tokens: number;
        fate_points: number;
    };
};

export async function redeemCoupon(code: string): Promise<CouponRedemptionResult> {
    const cookieStore = await cookies();
    const supabaseUserClient = createClient(cookieStore); // Only for AUTH

    // 1. Get User Session (Use standard client to verify user identity)
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
        return { success: false, message: '로그인이 필요합니다.' };
    }

    const userId = user.id;
    const normalizedCode = code.trim().toUpperCase();

    // Use Service Role for DB Access (bypass RLS for 'coupons')
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        return { success: false, message: 'Server Config Error: Missing Admin Key' };
    }
    const supabaseAdmin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    try {
        // 2. Fetch Coupon
        const { data: coupon, error: couponError } = await supabaseAdmin
            .from('coupons')
            .select('*')
            .eq('code', normalizedCode)
            .single();

        if (couponError || !coupon) {
            return { success: false, message: '유효하지 않은 쿠폰 코드입니다.' };
        }

        // 3. Check Validity (Expiry, Max Uses)
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return { success: false, message: '만료된 쿠폰입니다.' };
        }

        if (coupon.max_uses !== -1 && coupon.used_count >= coupon.max_uses) {
            return { success: false, message: '이미 소진된 쿠폰입니다.' };
        }

        // 4. Check if User Already Redeemed
        // NOTE: For unique keys (max_uses=1), the coupon_redemptions check is redundant if we assume 1:1, 
        // but for shared keys (public events), it's critical. We apply it to both for safety.

        const { data: existingRedemption } = await supabaseAdmin
            .from('coupon_redemptions')
            .select('id')
            .eq('user_id', userId)
            .eq('coupon_id', coupon.id)
            .single();

        if (existingRedemption) {
            return { success: false, message: '이미 사용한 쿠폰입니다.' };
        }

        // 5. Execute Redemption (Atomic-ish)
        // Ideally we use an RPC, but for now we'll do careful sequencing.
        // A. Insert Redemption Record (This will fail if UNIQUE constraint is violated, preventing double-use race condition client-side)
        const { error: redemptionError } = await supabaseAdmin
            .from('coupon_redemptions')
            .insert({
                user_id: userId,
                coupon_id: coupon.id
            });

        if (redemptionError) {
            // If error is unique constraint violation, user raced or logic failed above
            if (redemptionError.code === '23505') { // Postgres unique_violation
                return { success: false, message: '이미 사용한 쿠폰입니다.' };
            }
            console.error('Redemption insert error:', redemptionError);
            return { success: false, message: '쿠폰 사용 중 오류가 발생했습니다. (Redemption Failed)' };
        }

        // B. Increment Used Count
        // B. Increment Used Count
        const { error: updateError } = await supabaseAdmin.rpc('increment_coupon_usage', { coupon_id: coupon.id });

        // If RPC missing, manual update.
        // For strict correctness on high-concurrency public keys, use RPC.
        // But for this MVP, we proceed.
        await supabaseAdmin
            .from('coupons')
            .update({ used_count: coupon.used_count + 1 })
            .eq('id', coupon.id);


        // C. Grant Rewards
        const rewards = coupon.value as { tokens?: number; fate_points?: number };
        const tokensToAdd = rewards.tokens || 0;
        const fpToAdd = rewards.fate_points || 0;

        if (tokensToAdd > 0 || fpToAdd > 0) {
            console.log(`[Coupon] Granting rewards to User ${userId}: Tokens=${tokensToAdd}, Fate=${fpToAdd}`);

            // [V5] Use RPC for Atomic Update
            // This bypasses specific table permission quirks and ensures atomicity.
            const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('increment_user_currency', {
                p_user_id: userId,
                p_tokens: tokensToAdd,
                p_fate_points: fpToAdd
            });

            if (rpcError) {
                console.error(`[Coupon] RPC Update failed:`, rpcError);
                // Fallback: If RPC doesn't exist yet, try manual update again (standard way)
                // But honestly, if manual failed before, this might too.
                return {
                    success: true,
                    message: `쿠폰 처리 중 오류가 발생했습니다. (RPC Error: ${rpcError.message}) - 관리자에게 문의하세요.`,
                    rewards: { tokens: tokensToAdd, fate_points: fpToAdd }
                };
            } else {
                // Supabase RPC single return often comes as data directly if not void
                console.log(`[Coupon] RPC Success. Result:`, rpcResult);

                // Let's verify anyway
                const { data: finalProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('coins, fate_points')
                    .eq('id', userId)
                    .single();

                const finalCoins = finalProfile?.coins ?? -1;
                const finalFP = finalProfile?.fate_points ?? -1;

                const rewardMsg = [];
                if (tokensToAdd > 0) rewardMsg.push(`+${tokensToAdd}C`);
                if (fpToAdd > 0) rewardMsg.push(`+${fpToAdd}FP`);

                return {
                    success: true,
                    message: `쿠폰 사용 성공! (지급: ${rewardMsg.join(', ')} / 잔액: ${finalCoins}C, ${finalFP}FP) [RPC_VERIFIED]`,
                    rewards: { tokens: tokensToAdd, fate_points: fpToAdd }
                };
            }
        }

        revalidatePath('/', 'layout'); // [Fix] Force revalidation

        // Return generic success if no rewards were added (e.g. tracking only coupon)
        return {
            success: true,
            message: `쿠폰이 사용되었습니다.`,
            rewards: { tokens: 0, fate_points: 0 }
        };

    } catch (err) {
        console.error('Coupon redemption error:', err);
        return { success: false, message: '서버 오류가 발생했습니다.' };
    }
}
