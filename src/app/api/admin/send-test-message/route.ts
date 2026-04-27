import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/phone';

/**
 * Manually send a one-off WhatsApp message. Admin-only.
 *
 * Useful for:
 *   - Verifying the Baileys socket is actually delivering messages.
 *   - Ad-hoc testing of new templates or troubleshooting a recipient.
 *
 * This endpoint **bypasses** the reminders kill switch on purpose — the
 * switch is meant to silence the scheduled daily job, not to block an
 * admin from manually messaging someone.
 */
export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let body: { phone?: string; text?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid json' }, { status: 400 });
    }

    const text = (body.text ?? '').trim();
    if (!text) {
        return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (text.length > 1000) {
        return NextResponse.json(
            { error: 'text is too long (max 1000 chars)' },
            { status: 400 },
        );
    }

    const phoneE164 = normalizePhone(body.phone ?? '');
    if (!phoneE164) {
        return NextResponse.json(
            { error: 'phone is invalid; use E.164 like +50588881111' },
            { status: 400 },
        );
    }

    try {
        await sendWhatsAppText(phoneE164, text);
        return NextResponse.json({ ok: true, phone: phoneE164 });
    } catch (err) {
        console.error('[api/send-test-message] failed', err);
        return NextResponse.json(
            { error: (err as Error).message ?? 'unknown error' },
            { status: 500 },
        );
    }
}
