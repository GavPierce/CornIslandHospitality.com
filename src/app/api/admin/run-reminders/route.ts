import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { runDailyReminders } from '@/lib/reminders';

/**
 * Manually trigger the daily reminder job. Admin-only.
 *
 * Useful for:
 *   - Smoke-testing the reminder flow without waiting for 08:00.
 *   - Re-running after a deploy if the cron was missed.
 *
 * The ReminderLog unique-index guarantees this is idempotent within the
 * same day — calling it twice won't double-send.
 */
export async function POST() {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    try {
        const summary = await runDailyReminders();
        return NextResponse.json({ ok: true, summary });
    } catch (err) {
        console.error('[api/run-reminders] failed', err);
        return NextResponse.json(
            { error: (err as Error).message ?? 'unknown error' },
            { status: 500 },
        );
    }
}
