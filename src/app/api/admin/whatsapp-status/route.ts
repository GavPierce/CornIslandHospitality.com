import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
    ensureWhatsAppStarted,
    getWhatsAppStatus,
    resetWhatsApp,
} from '@/lib/whatsapp';
import { startReminderScheduler } from '@/lib/reminders';
import QRCode from 'qrcode';

/**
 * Authorize the request. Either:
 *   1. The caller has an active admin session, OR
 *   2. They pass `?token=<WA_SETUP_TOKEN>` matching the env var.
 *
 * The token is the bootstrap path: before anyone can log in for the
 * first time, there is no admin session, so the operator needs a way
 * to reach the QR page. Once paired and an admin has logged in at
 * least once, the token becomes unnecessary.
 */
async function authorize(request: Request): Promise<{ ok: true } | { ok: false; status: number }> {
    const session = await getSession();
    if (session?.isAdmin) return { ok: true };

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const expected = process.env.WA_SETUP_TOKEN;
    if (expected && token && token === expected) return { ok: true };

    return { ok: false, status: 401 };
}

export async function GET(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
        return NextResponse.json({ error: 'unauthorized' }, { status: auth.status });
    }

    // Kick off the socket on first request so the QR appears without
    // the operator having to do anything else.
    await ensureWhatsAppStarted();

    // Ensure the reminder scheduler is running. Idempotent — safe to call
    // on every poll; the `started` guard inside makes it a no-op after the
    // first time. Done here because instrumentation.ts is not guaranteed to
    // run in all standalone-build deployment configurations.
    startReminderScheduler().catch((err) => {
        console.error('[whatsapp-status] reminder scheduler failed to start', err);
    });

    const status = getWhatsAppStatus();
    let qrDataUrl: string | null = null;
    if (status.qr) {
        try {
            qrDataUrl = await QRCode.toDataURL(status.qr, {
                margin: 1,
                width: 320,
                color: { dark: '#111827', light: '#ffffff' },
            });
        } catch (err) {
            console.error('[whatsapp-status] QR render failed', err);
        }
    }

    return NextResponse.json({
        state: status.state,
        lastError: status.lastError,
        connectedAt: status.connectedAt,
        qrDataUrl,
    });
}

export async function POST(request: Request) {
    const auth = await authorize(request);
    if (!auth.ok) {
        return NextResponse.json({ error: 'unauthorized' }, { status: auth.status });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'reset') {
        await resetWhatsApp();
        // Re-start so a new QR appears.
        ensureWhatsAppStarted().catch((err) => {
            console.error('[whatsapp-status] restart after reset failed', err);
        });
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
