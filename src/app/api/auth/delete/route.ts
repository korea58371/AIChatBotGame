import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        // 1. Verify User from Request (Session)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // We need the service client to delete users
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Check authorization header to get the user ID to delete
        // OR we can rely on the client sending the access_token and validating it.
        // For simplicity/safety, we should validate the user's session first.

        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });
        }

        const userId = user.id;
        console.log(`[API] Deleting user account: ${userId}`);

        // 2. Delete User from Auth (Cascades to Tables if configured, otherwise we manual delete)
        // Supabase Admin Delete
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error("[API] Delete User Error:", deleteError);
            return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("[API] Exception:", e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
