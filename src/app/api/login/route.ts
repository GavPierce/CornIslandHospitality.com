import { NextResponse } from 'next/server';

/**
 * Legacy password-login endpoint. The app now uses phone + WhatsApp OTP
 * (see `src/actions/auth.ts`). This route is kept only so any bookmarked
 * clients get a clear response instead of a 404.
 */
export async function POST() {
    return NextResponse.json(
        {
            error:
                'Password login is no longer supported. Please sign in with your phone number.',
        },
        { status: 410 },
    );
}

export async function GET() {
    return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 },
    );
}
