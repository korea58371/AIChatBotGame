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
