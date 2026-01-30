'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Top-level adminClient removed to prevent init crash
// const adminClient = ... 

export async function deductCoins(amount: number) {
    if (amount <= 0) return { success: false, error: "Invalid amount" };

    try {
        // 1. Verify User Identity
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: "Unauthorized" };
        }

        const userId = user.id;

        // 2. Lazy Init Admin Client (Safeguard against missing Env)
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
            console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
            return { success: false, error: "Server Error: Missing Database URL" };
        }

        if (!serviceKey) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            return { success: false, error: "Server Error: Missing SUPABASE_SERVICE_ROLE_KEY" };
        }

        const adminClient = createAdminClient(supabaseUrl, serviceKey);

        // 3. Perform Transaction (using Admin Client)
        // Fetch current balance first to prevent negative
        const { data: profile, error: fetchError } = await adminClient
            .from('profiles')
            .select('coins')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            return { success: false, error: "Profile not found" };
        }

        if (profile.coins < amount) {
            return { success: false, error: "Not enough coins" };
        }

        const newBalance = profile.coins - amount;

        // Update
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ coins: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error("Coin update failed:", updateError);
            return { success: false, error: "Update failed" };
        }

        return { success: true, newBalance };

    } catch (e: any) {
        console.error("deductCoins Exception:", e);
        return { success: false, error: e.message || "Internal Server Error" };
    }
}

export async function addCoins(amount: number) {
    if (amount <= 0) return { success: false, error: "Invalid amount" };

    try {
        // 1. Verify User Identity
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: "Unauthorized" };
        }

        const userId = user.id;

        // 2. Lazy Init Admin Client
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !supabaseUrl) {
            console.error("Missing Server Env Variables");
            return { success: false, error: "Server Configuration Error" };
        }

        const adminClient = createAdminClient(supabaseUrl, serviceKey);

        // 3. Perform Transaction (Admin Client)
        const { data: profile, error: fetchError } = await adminClient
            .from('profiles')
            .select('coins')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            return { success: false, error: "Profile not found" };
        }

        const newBalance = profile.coins + amount;

        // Update
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ coins: newBalance })
            .eq('id', userId);

        if (updateError) {
            console.error("Coin add failed:", updateError);
            return { success: false, error: "Add failed" };
        }

        return { success: true, newBalance };

    } catch (e: any) {
        console.error("addCoins Exception:", e);
        return { success: false, error: e.message || "Internal Server Error" };
    }
}


// [NEW] Fate Points Server Actions

export async function addFatePoints(amount: number) {
    if (amount <= 0) return { success: false, error: "Invalid amount" };

    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) return { success: false, error: "Unauthorized" };

        const userId = user.id;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !supabaseUrl) return { success: false, error: "Server Config Error" };

        const adminClient = createAdminClient(supabaseUrl, serviceKey);

        const { data: profile, error: fetchError } = await adminClient
            .from('profiles')
            .select('fate_points')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) return { success: false, error: "Profile not found" };

        const currentFate = profile.fate_points || 0;
        const newBalance = currentFate + amount;

        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ fate_points: newBalance })
            .eq('id', userId);

        if (updateError) return { success: false, error: "Update failed" };

        return { success: true, newBalance };

    } catch (e: any) {
        console.error("addFatePoints Exception:", e);
        return { success: false, error: e.message };
    }
}

export async function deductFatePoints(amount: number) {
    if (amount <= 0) return { success: false, error: "Invalid amount" };

    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) return { success: false, error: "Unauthorized" };

        const userId = user.id;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceKey || !supabaseUrl) return { success: false, error: "Server Config Error" };

        const adminClient = createAdminClient(supabaseUrl, serviceKey);

        const { data: profile, error: fetchError } = await adminClient
            .from('profiles')
            .select('fate_points')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) return { success: false, error: "Profile not found" };

        const currentFate = profile.fate_points || 0;
        if (currentFate < amount) return { success: false, error: "Not enough fate points" };

        const newBalance = currentFate - amount;

        const { error: updateError } = await adminClient
            .from('profiles')
            .update({ fate_points: newBalance })
            .eq('id', userId);

        if (updateError) return { success: false, error: "Update failed" };

        return { success: true, newBalance };

    } catch (e: any) {
        console.error("deductFatePoints Exception:", e);
        return { success: false, error: e.message };
    }
}
