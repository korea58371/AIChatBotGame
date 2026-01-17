import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    // [Fix] Skip middleware for auth callback to prevent race conditions
    if (request.nextUrl.pathname.startsWith('/auth/callback')) {
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    const val = request.cookies.get(name)?.value;
                    // console.log(`[AuthDebug] Middleware Get Cookie: ${name} = ${val ? 'Found' : 'Missing'}`);
                    return val;
                },
                set(name: string, value: string, options: CookieOptions) {
                    console.log(`[AuthDebug] Middleware Set Cookie: ${name}`);
                    // [Fix] Force secure: false in development for localhost
                    if (process.env.NODE_ENV === 'development') {
                        options.secure = false;
                    }

                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });

                    // [Fix] Preserve existing response cookies when refreshing response
                    // This handles chunked cookies (sb-auth-token-0, sb-auth-token-1)
                    // preventing race conditions where the first chunk is lost.
                    const previousCookies = response.cookies.getAll();

                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });

                    // Restore previous cookies
                    previousCookies.forEach(cookie => {
                        response.cookies.set(cookie);
                    });

                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    console.log(`[AuthDebug] Middleware Remove Cookie: ${name}`);
                    // [Fix] Force secure: false in development
                    if (process.env.NODE_ENV === 'development') {
                        options.secure = false;
                    }

                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });

                    const previousCookies = response.cookies.getAll();

                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });

                    previousCookies.forEach(cookie => {
                        response.cookies.set(cookie);
                    });

                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    await supabase.auth.getUser();

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
