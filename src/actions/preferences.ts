'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

type Language = 'EN' | 'ES';

/**
 * Persist the current user's preferred language on their Watchman or
 * Volunteer record. Used by the one-time prompt shown after first login
 * and (later) by any profile screen that lets the user change it.
 *
 * Returns `{ error }` on failure, `{ ok: true }` on success.
 */
export async function setMyLanguage(
    lang: Language,
): Promise<{ ok?: true; error?: string }> {
    if (lang !== 'EN' && lang !== 'ES') {
        return { error: 'Invalid language.' };
    }

    const session = await getSession();
    if (!session) return { error: 'Not signed in.' };

    const table = session.identityType === 'WATCHMAN' ? 'watchman' : 'volunteer';
    await (
        prisma as unknown as Record<
            string,
            {
                update: (args: {
                    where: { id: string };
                    data: { language: Language };
                }) => Promise<unknown>;
            }
        >
    )[table].update({
        where: { id: session.identityId },
        data: { language: lang },
    });

    // Revalidate the dashboard so the server-side language check runs
    // again and the prompt disappears.
    revalidatePath('/');
    return { ok: true };
}

/**
 * Look up the current user's saved language preference. Returns null
 * if no session, or if the field hasn't been set yet.
 */
export async function getMyLanguage(): Promise<Language | null> {
    const session = await getSession();
    if (!session) return null;

    const table = session.identityType === 'WATCHMAN' ? 'watchman' : 'volunteer';
    const row = await (
        prisma as unknown as Record<
            string,
            {
                findUnique: (args: {
                    where: { id: string };
                    select: { language: true };
                }) => Promise<{ language: Language | null } | null>;
            }
        >
    )[table].findUnique({
        where: { id: session.identityId },
        select: { language: true },
    });

    return row?.language ?? null;
}
