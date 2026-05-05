import { getSession, type Session } from '@/lib/session';

import { prisma } from '@/lib/prisma';

export type UserRole = 'admin' | 'hospitality' | 'viewer';

/**
 * Return the current user's role. Users without a valid session are
 * treated as `viewer` (middleware already redirects them to `/login`
 * before a page ever calls this, so this is only a safety net).
 */
export async function getUserRole(): Promise<UserRole> {
    const session = await getSession();
    if (!session) return 'viewer';
    if (session.isAdmin) return 'admin';
    if (session.identityType === 'VOLUNTEER') {
        const v = await prisma.volunteer.findUnique({
            where: { id: session.identityId },
            select: { isHospitality: true }
        });
        if (v?.isHospitality) return 'hospitality';
    }
    return 'viewer';
}

/**
 * Return the current session, or `null` if the user is not logged in.
 */
export async function getCurrentUser(): Promise<Session | null> {
    return getSession();
}

export async function requireAdmin(): Promise<string | null> {
    const role = await getUserRole();
    if (role !== 'admin') {
        return 'Permission denied. Admin access required.';
    }
    return null;
}

export async function requireElevatedAccess(): Promise<string | null> {
    const role = await getUserRole();
    if (role === 'viewer') {
        return 'Permission denied. Elevated access required.';
    }
    return null;
}
