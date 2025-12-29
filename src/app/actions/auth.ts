'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function deleteAccount() {
    console.log("[AuthAction] Deleting Account...");

    // 1. Get Session
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error("Delete Account: No user found", userError);
        return { success: false, error: 'User not authenticated' };
    }

    // 2. Delete Public Data (Attempt via RLS first)
    const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

    if (profileError) {
        console.warn("Profile delete failed (RLS?):", profileError);
    }

    // 3. Hard Delete Auth User
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
        // Use Admin Client
        const { createClient: createAdminClient } = await import('@supabase/supabase-js');
        const adminClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // [CLEANUP] Force delete related data (FK Constraints often block deleteUser)
        console.log(`[AuthAction] Cleaning up data for ${user.id}...`);

        // 1. Profiles (Most common blocker)
        const { error: profileDelError } = await adminClient.from('profiles').delete().eq('id', user.id);
        if (profileDelError) console.warn("Admin Profile Delete Error:", profileDelError);

        // 2. Gameplay Logs (If linked) - Try 'user_id' or 'player_id'
        await adminClient.from('gameplay_logs').delete().eq('user_id', user.id).then(res => {
            if (res.error) console.log("Log cleanup skipped/failed (user_id):", res.error.message);
        });

        // 3. Saves (If any cloud saves exist) - Check common table names
        await adminClient.from('saves').delete().eq('user_id', user.id).then(res => {
            if (res.error) console.log("Save cleanup skipped/failed:", res.error.message);
        });

        // 4. Delete Auth User
        const { error: adminError } = await adminClient.auth.admin.deleteUser(user.id);

        if (adminError) {
            console.error("Admin Delete Failed:", adminError);
            return {
                success: false,
                error: `Auth Deletion Failed: ${adminError.message} (Status: ${adminError.status || 'Unknown'})`,
                debug: { hasServiceKey: true }
            };
        }

        // [PARANOID VERIFICATION]
        const { data: checkUser } = await adminClient.auth.admin.getUserById(user.id);
        if (checkUser && checkUser.user) {
            console.error("[CRITICAL] User still exists after delete call!", checkUser.user.id);
            return {
                success: false,
                error: "CRITICAL: Deletion reported success but User still exists in database. Contact Administrator.",
                debug: { userStillExists: true }
            };
        }
        console.log("[AuthAction] User successfully purged from Auth DB.");

    } else {
        console.warn("No Service Role Key. Skipping Auth User Hard Delete.");
        return {
            success: false,
            error: "Server Configuration Error: Missing Service Role Key. Account data was cleared but login credentials remain.",
            debug: { hasServiceKey: false }
        };
    }

    // 4. Sign Out (Server Side cookie clear)
    await supabase.auth.signOut();

    return { success: true };
}
