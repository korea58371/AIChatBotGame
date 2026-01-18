import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        // [AuthDebug] Log Code Exchange Start
        console.log("[AuthDebug] Callback: Received code", code.substring(0, 5) + "...");

        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        console.log(`[AuthDebug] Callback: Setting Cookie ${name}, Secure=${options.secure}, Path=${options.path}`);
                        try {
                            // [Fix] Force secure: false in development to ensure cookies are set on localhost
                            if (process.env.NODE_ENV === 'development') {
                                options.secure = false;
                            }
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            // The `set` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        console.log(`[AuthDebug] Callback: Removing Cookie ${name}`);
                        try {
                            cookieStore.delete({ name, ...options });
                        } catch (error) {
                            // The `delete` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        );
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            console.log("[AuthDebug] Callback: Login Success, Redirecting to", next);

            // [Bonus Logic] Check for New Identity (Creation or Link)
            // Grant 50 Tokens if a new identity was just linked/created (within 1 min)
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user && !user.is_anonymous && user.identities) {
                    const OneMinute = 60 * 1000;
                    const now = new Date().getTime();

                    // Find any identity created within the last minute
                    // This covers: 
                    // 1. New Sign Up (Identity created now)
                    // 2. Guest Linking to Google (Google Identity created now)
                    const recentIdentity = user.identities.find(id => {
                        if (!id.created_at) return false;
                        const created = new Date(id.created_at).getTime();
                        return (now - created) < OneMinute;
                    });

                    if (recentIdentity) {
                        console.log(`[AuthBonus] Detected new identity (${recentIdentity.provider}), Granting 50 coins.`);

                        // Check Profile
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('coins')
                            .eq('id', user.id)
                            .single();

                        if (profile) {
                            // Update
                            const { error: updateError } = await supabase
                                .from('profiles')
                                .update({ coins: (profile.coins || 0) + 50 })
                                .eq('id', user.id);

                            if (updateError) {
                                console.error("[AuthBonus] Failed to update coins:", updateError);
                            } else {
                                console.log("[AuthBonus] Successfully granted 50 coins.");
                            }
                        } else {
                            console.warn("[AuthBonus] Profile not found. Trigger may be delayed.");
                            // Optional: Retry or Insert? 
                            // Assuming Trigger handles creation. If trigger is slow, we might miss this.
                            // But usually trigger is immediate in Postgres.
                        }
                    }
                }
            } catch (bonusError) {
                console.error("[AuthBonus] Error processing bonus:", bonusError);
            }

            return NextResponse.redirect(`${origin}${next}`);
        } else {
            console.error("[AuthDebug] Callback: Login Error", error.message);
        }
    } else {
        console.warn("[AuthDebug] Callback: No code found in URL");
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
