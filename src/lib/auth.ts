import { cookies } from 'next/headers';

export type UserRole = 'admin' | 'viewer';

export async function getUserRole(): Promise<UserRole> {
    const cookieStore = await cookies();
    const role = cookieStore.get('ci_auth')?.value;
    return role === 'admin' ? 'admin' : 'viewer';
}

export async function requireAdmin(): Promise<string | null> {
    const role = await getUserRole();
    if (role !== 'admin') {
        return 'Permission denied. Admin access required.';
    }
    return null;
}
