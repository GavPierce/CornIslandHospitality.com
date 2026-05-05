import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserRole } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ user: null });
    }
    const role = await getUserRole();
    return NextResponse.json({
        user: {
            name: session.name,
            phone: session.phone,
            isAdmin: session.isAdmin,
            identityType: session.identityType,
            isHospitality: role === 'hospitality',
        },
    });
}

