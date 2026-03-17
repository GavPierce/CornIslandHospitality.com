import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { password } = await request.json();
    const correctPassword = process.env.ADMIN_PASSWORD || 'cornisland';

    if (password === correctPassword) {
        const cookieStore = await cookies();
        cookieStore.set('ci_auth', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });
        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}
