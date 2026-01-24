'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Admin Client to bypass RLS for Coin Updates
const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function deductCoins(amount: number) {
    if (amount <= 0) throw new Error("Invalid amount");

    // 1. Verify User Identity
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Unauthorized");
    }

    const userId = user.id;

    // 2. Perform Transaction (using Admin Client)
    // Fetch current balance first to prevent negative
    const { data: profile, error: fetchError } = await adminClient
        .from('profiles')
        .select('coins')
        .eq('id', userId)
        .single();

    if (fetchError || !profile) {
        throw new Error("Profile not found");
    }

    if (profile.coins < amount) {
        throw new Error("Not enough coins");
    }

    const newBalance = profile.coins - amount;

    // Update
    const { error: updateError } = await adminClient
        .from('profiles')
        .update({ coins: newBalance })
        .eq('id', userId);

    if (updateError) {
        console.error("Coin update failed:", updateError);
        throw new Error("Update failed");
    }

    return { success: true, newBalance };
}

export async function addCoins(amount: number) {
    if (amount <= 0) throw new Error("Invalid amount");

    // 1. Verify User Identity
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw new Error("Unauthorized");
    }

    const userId = user.id;

    // 2. Perform Transaction (Admin Client)
    const { data: profile, error: fetchError } = await adminClient
        .from('profiles')
        .select('coins')
        .eq('id', userId)
        .single();

    if (fetchError || !profile) {
        throw new Error("Profile not found");
    }

    const newBalance = profile.coins + amount;

    // Update
    const { error: updateError } = await adminClient
        .from('profiles')
        .update({ coins: newBalance })
        .eq('id', userId);

    if (updateError) {
        console.error("Coin add failed:", updateError);
        throw new Error("Add failed");
    }

    return { success: true, newBalance };
}
