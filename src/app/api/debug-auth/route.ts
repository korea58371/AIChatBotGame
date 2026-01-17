import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    return NextResponse.json({
        message: 'Auth Debug Report',
        timestamp: new Date().toISOString(),
        cookies: allCookies.map(c => ({ name: c.name, valueLength: c.value.length, secure: c.secure, httpOnly: c.httpOnly })),
        hasAuthToken: allCookies.some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token')),
        nodeEnv: process.env.NODE_ENV,
    }, { status: 200 });
}
