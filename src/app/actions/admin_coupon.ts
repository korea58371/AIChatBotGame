'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// We usage Service Role Key for ADMIN actions to bypass RLS logic that might restrict 'coupons' table write access.
// Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type GenerateCouponParams = {
    prefix: string;
    count: number;
    type: string;
    rewards: any;
};

export async function generateCouponsAction(params: GenerateCouponParams) {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
        return { success: false, message: 'Server Configuration Error: Missing Service Role Key' };
    }

    // [SECURITY] Only allow in Development Mode to prevent public access in Production
    if (process.env.NODE_ENV !== 'development') {
        return { success: false, message: 'Security Block: Admin actions are only allowed in Development mode (Localhost).' };
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { prefix, count, type, rewards } = params;

    // Validation
    if (count > 10000) {
        return { success: false, message: 'Max 10,000 coupons per batch.' };
    }

    const coupons = [];
    const codesToReturn = [];

    for (let i = 0; i < count; i++) {
        // Generate Code: PREFIX-XXXX-XXXX
        const block = () => Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `${prefix}-${block()}-${block()}`;

        coupons.push({
            code,
            type,
            value: rewards,
            max_uses: 1,
            used_count: 0
        });
        codesToReturn.push(code);
    }

    // Batch Insert (Chunking 1000)
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < coupons.length; i += CHUNK_SIZE) {
        const chunk = coupons.slice(i, i + CHUNK_SIZE);
        const { error } = await supabaseAdmin.from('coupons').insert(chunk);
        if (error) {
            console.error("Coupon Insert Error:", error);
            return { success: false, message: `DB Insert Failed: ${error.message}` };
        }
    }

    return { success: true, codes: codesToReturn };
}
