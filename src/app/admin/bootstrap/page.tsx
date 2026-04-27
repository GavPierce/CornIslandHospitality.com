import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import BootstrapClient from './BootstrapClient';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams: Promise<{ token?: string }> };

/**
 * First-run admin bootstrap page.
 *
 * This page lets the operator create the very first Watchman row
 * without needing Prisma Studio or direct DB access. Once any user
 * exists, this page locks itself permanently — all further admin
 * management happens through the regular UI.
 *
 * Access:
 *   - `?token=<WA_SETUP_TOKEN>` query param (matches env var), OR
 *   - active admin session.
 */
export default async function BootstrapPage({ searchParams }: PageProps) {
    const session = await getSession();
    const { token } = await searchParams;
    const expected = process.env.WA_SETUP_TOKEN;
    const tokenOk = Boolean(expected && token && token === expected);
    const authorized = (session?.isAdmin ?? false) || tokenOk;

    if (!authorized) {
        return (
            <div style={{ maxWidth: 540, margin: '60px auto', padding: 24 }}>
                <h1 style={{ marginBottom: 8 }}>Admin bootstrap</h1>
                <p style={{ color: 'var(--text-tertiary)' }}>
                    You must visit this page with a valid <code>?token=…</code>{' '}
                    query parameter matching the <code>WA_SETUP_TOKEN</code>{' '}
                    environment variable, or be signed in as an administrator.
                </p>
            </div>
        );
    }

    // Lock the page once any user exists — the system has moved past
    // first-run and the regular UI should be used.
    const [watchmanCount, volunteerCount] = await Promise.all([
        prisma.watchman.count(),
        prisma.volunteer.count(),
    ]);
    const alreadyInitialized = watchmanCount + volunteerCount > 0;

    return (
        <BootstrapClient
            token={tokenOk ? (token ?? null) : null}
            alreadyInitialized={alreadyInitialized}
        />
    );
}
