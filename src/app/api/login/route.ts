import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { password } = await request.json();
    const adminPassword = process.env.ADMIN_PASSWORD || 'cornislandadmin';
    const viewerPassword = process.env.VIEWER_PASSWORD || 'cornisland';

    if (password === adminPassword) {
        const cookieStore = await cookies();
        cookieStore.set('ci_auth', 'admin', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });
        return NextResponse.json({ success: true, role: 'admin' });
    }

    if (password === viewerPassword) {
        const cookieStore = await cookies();
        cookieStore.set('ci_auth', 'viewer', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });
        return NextResponse.json({ success: true, role: 'viewer' });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}
