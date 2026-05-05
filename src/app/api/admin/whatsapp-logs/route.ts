import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { clearWaLogs, getWaLogs } from '@/lib/wa-logs';

/**
 * Return buffered WhatsApp transport logs. Admin-only.
 *
 * Used by the admin /admin/whatsapp-setup page to surface delivery
 * diagnostics without needing to tail Docker logs in Coolify.
 *
 * Optional `?since=<epoch-ms>` query param returns only entries newer
 * than the timestamp, so the client can poll incrementally.
 */
export async function GET(req: Request) {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const sinceRaw = url.searchParams.get('since');
    const since = sinceRaw ? Number(sinceRaw) : undefined;
    const entries = getWaLogs(Number.isFinite(since) ? since : undefined);
    return NextResponse.json({ entries });
}

/** Clear the buffer. Used by the admin "clear logs" button. */
export async function DELETE() {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    clearWaLogs();
    return NextResponse.json({ ok: true });
}
