import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { todayDateOnlyInTz } from '@/lib/reminders';

const SLOT_START_LOCAL: Record<string, [number, number]> = {
    MORNING:   [8,  0],
    LUNCH:     [12, 0],
    AFTERNOON: [12, 30],
    EVENING:   [17, 0],
    OVERNIGHT: [0,  30],
};

function fmtUtc(d: Date): string {
    return d.toISOString();
}

function fmtLocal(d: Date, tz: string): string {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).format(d);
}

/**
 * Timezone diagnostic. Returns the server's view of right now vs the
 * configured REMINDER_TZ, so the admin can verify the offset is correct
 * before relying on the daily/hour-before crons.
 *
 * GET /api/admin/tz-debug
 */
export async function GET() {
    const session = await getSession();
    if (!session?.isAdmin) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const tz = process.env.REMINDER_TZ || 'America/Managua';
    const reminderHour = Number(process.env.REMINDER_HOUR ?? '8');
    const now = new Date();
    const todayUtcMidnight = todayDateOnlyInTz(tz, now);

    // For each slot compute its UTC start instant today.
    const slotTimes: Record<string, { localTime: string; utcInstant: string; minsUntil: number }> = {};
    for (const [slot, [h, m]] of Object.entries(SLOT_START_LOCAL)) {
        // Build the local instant using the same localDateTimeToUtc logic (inline).
        const y = todayUtcMidnight.getUTCFullYear();
        const mo = todayUtcMidnight.getUTCMonth() + 1;
        const d = todayUtcMidnight.getUTCDate();
        const guess = new Date(Date.UTC(y, mo - 1, d, h, m));
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        }).formatToParts(guess);
        const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
        const rawH = get('hour');
        const localH = rawH === 24 ? 0 : rawH;
        const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), localH, get('minute'), get('second'));
        const offsetMs = guess.getTime() - localAsUtc;
        const startUtc = new Date(guess.getTime() + offsetMs);
        slotTimes[slot] = {
            localTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${tz}`,
            utcInstant: fmtUtc(startUtc),
            minsUntil: Math.round((startUtc.getTime() - now.getTime()) / 60_000),
        };
    }

    return NextResponse.json({
        serverUtcNow: fmtUtc(now),
        configuredTz: tz,
        localNow: fmtLocal(now, tz),
        todayInTz: todayUtcMidnight.toISOString().slice(0, 10),
        dailyCronFiresAt: `${String(reminderHour).padStart(2, '0')}:00 ${tz}`,
        slotStartsToday: slotTimes,
    });
}
