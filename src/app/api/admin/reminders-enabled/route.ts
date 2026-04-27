import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRemindersEnabled, setRemindersEnabled } from '@/lib/settings';

/**
 * Read or update the reminders kill switch. Admin-only.
 *
 *   GET  → { enabled: boolean }
 *   POST { enabled: boolean } → { enabled: boolean }
 */
export async function GET() {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const enabled = await getRemindersEnabled();
    return NextResponse.json({ enabled });
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let body: { enabled?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }
    if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
            { error: 'enabled (boolean) is required' },
            { status: 400 },
        );
    }

    await setRemindersEnabled(body.enabled);
    return NextResponse.json({ enabled: body.enabled });
}
