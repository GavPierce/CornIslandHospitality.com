import { getSession } from '@/lib/session';
import WhatsAppSetupClient from './WhatsAppSetupClient';

export const dynamic = 'force-dynamic';

type PageProps = { searchParams: Promise<{ token?: string }> };

/**
 * WhatsApp pairing page. Access requires either:
 *   - An active admin session, OR
 *   - `?token=<WA_SETUP_TOKEN>` matching the env var.
 *
 * The second path is the first-run bootstrap: before any phone number is
 * paired and anyone can log in, the operator needs a way to reach this
 * page. Set `WA_SETUP_TOKEN` to a long random string (e.g. `openssl rand
 * -hex 24`) in Coolify and visit
 * `https://your-site/admin/whatsapp-setup?token=<value>`.
 */
export default async function WhatsAppSetupPage({ searchParams }: PageProps) {
    const session = await getSession();
    const { token } = await searchParams;
    const expected = process.env.WA_SETUP_TOKEN;
    const tokenOk = Boolean(expected && token && token === expected);
    const authorized = (session?.isAdmin ?? false) || tokenOk;

    if (!authorized) {
        return (
            <div style={{ maxWidth: 540, margin: '60px auto', padding: 24 }}>
                <h1 style={{ marginBottom: 8 }}>WhatsApp setup</h1>
                <p style={{ color: 'var(--text-tertiary)' }}>
                    You must be signed in as an administrator, or visit this
                    page with a valid <code>?token=…</code> query parameter
                    matching the <code>WA_SETUP_TOKEN</code> environment
                    variable.
                </p>
            </div>
        );
    }

    // Pass the token through so the client can include it in its polling
    // requests (needed when there's no admin session yet).
    const apiToken = tokenOk ? token : null;
    // Only real admin sessions may trigger the reminder job — the
    // bootstrap token is scoped to WhatsApp pairing and nothing else.
    const canRunReminders = Boolean(session?.isAdmin);
    return (
        <WhatsAppSetupClient
            apiToken={apiToken ?? null}
            canRunReminders={canRunReminders}
        />
    );
}
