import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ user: null });
    }
    return NextResponse.json({
        user: {
            name: session.name,
            phone: session.phone,
            isAdmin: session.isAdmin,
            identityType: session.identityType,
        },
    });
}
