import { getSession, type Session } from '@/lib/session';

export type UserRole = 'admin' | 'viewer';

/**
 * Return the current user's role. Users without a valid session are
 * treated as `viewer` (middleware already redirects them to `/login`
 * before a page ever calls this, so this is only a safety net).
 */
export async function getUserRole(): Promise<UserRole> {
    const session = await getSession();
    if (!session) return 'viewer';
    return session.isAdmin ? 'admin' : 'viewer';
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
