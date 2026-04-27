import 'server-only';

import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export const SESSION_COOKIE = 'ci_session';
const SESSION_TTL_DAYS = 30;

export type IdentityType = 'WATCHMAN' | 'VOLUNTEER';

export type Session = {
    token: string;
    phone: string;
    name: string;
    identityType: IdentityType;
    identityId: string;
    isAdmin: boolean;
    expiresAt: Date;
};

function generateToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Create a fresh session row for the given identity, set the cookie, and
 * return the session. Older sessions for the same phone are left in place
 * intentionally (users may log in from multiple devices).
 */
export async function createSession(data: {
    phone: string;
    name: string;
    identityType: IdentityType;
    identityId: string;
    isAdmin: boolean;
}): Promise<Session> {
    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // Cast to `any` because the Prisma client types aren't regenerated in
    // this environment yet. The runtime model is correct.
    await (prisma as unknown as {
        authSession: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
    }).authSession.create({
        data: {
            token,
            phone: data.phone,
            name: data.name,
            identityType: data.identityType,
            identityId: data.identityId,
            isAdmin: data.isAdmin,
            expiresAt,
        },
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
    });

    return { token, ...data, expiresAt };
}

/**
 * Look up the current session from the cookie. Returns `null` if there
 * is no cookie, the session is unknown, or it has expired.
 */
export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const row = await (prisma as unknown as {
        authSession: { findUnique: (args: { where: { token: string } }) => Promise<{
            token: string;
            phone: string;
            name: string;
            identityType: IdentityType;
            identityId: string;
            isAdmin: boolean;
            expiresAt: Date;
        } | null> };
    }).authSession.findUnique({ where: { token } });

    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;

    return {
        token: row.token,
        phone: row.phone,
        name: row.name,
        identityType: row.identityType,
        identityId: row.identityId,
        isAdmin: row.isAdmin,
        expiresAt: row.expiresAt,
    };
}

/**
 * Delete the current session (both DB row and cookie).
 */
export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) {
        try {
            await (prisma as unknown as {
                authSession: { deleteMany: (args: { where: { token: string } }) => Promise<unknown> };
            }).authSession.deleteMany({ where: { token } });
        } catch {
            // ignore — cookie cleanup is still valuable
        }
    }
    cookieStore.delete(SESSION_COOKIE);
}
