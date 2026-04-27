import 'server-only';

import { prisma } from './prisma';
import { ensureWhatsAppStarted, getWhatsAppStatus, sendWhatsAppText } from './whatsapp';
import { adminPhoneSet, normalizePhone } from './phone';
import { getRemindersEnabled } from './settings';

/**
 * Daily WhatsApp reminders.
 *
 * Runs every day at 08:00 local time (`REMINDER_TZ`, default
 * `America/Managua`). For each "event happening today":
 *   - Watchman shift → reminds the watchman
 *   - Volunteer arrival → welcomes the volunteer + digests to admins
 *   - Volunteer departure → reminds the volunteer + digests to admins
 *
 * Every send is recorded in `ReminderLog` with a unique constraint on
 * (kind, recipientPhone, referenceId), so running the job twice on the
 * same day is a no-op.
 */

// ── Types (minimal, local — avoids leaking Prisma's regenerated enum shape)

type Language = 'EN' | 'ES';
type ShiftSlot = 'EVENING' | 'OVERNIGHT' | 'MORNING' | 'AFTERNOON';
type ReminderKind =
    | 'WATCHMAN_SHIFT'
    | 'VOLUNTEER_ARRIVAL'
    | 'VOLUNTEER_DEPARTURE'
    | 'ADMIN_DAILY_DIGEST';

const DEFAULT_TZ = process.env.REMINDER_TZ || 'America/Managua';
const DEFAULT_LANG: Language = 'ES';

// ── Timezone helpers ──────────────────────────────────────────

/**
 * Return a Date at UTC-midnight representing "today" in the given
 * timezone. Matches how `WatchmanShift.date` and Assignment dates are
 * stored (UTC-midnight for a calendar day).
 */
export function todayDateOnlyInTz(tz: string = DEFAULT_TZ, now: Date = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === 'year')!.value);
    const m = Number(parts.find((p) => p.type === 'month')!.value);
    const d = Number(parts.find((p) => p.type === 'day')!.value);
    return new Date(Date.UTC(y, m - 1, d));
}

function dateKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatLongDate(d: Date, lang: Language): string {
    return new Intl.DateTimeFormat(lang === 'ES' ? 'es-NI' : 'en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC', // dates are stored as UTC-midnight date-only values
    }).format(d);
}

// ── Message templates ─────────────────────────────────────────

function slotLabel(slot: ShiftSlot, lang: Language): string {
    const map: Record<ShiftSlot, { en: string; es: string }> = {
        EVENING: { en: 'Evening (5:00 pm – 12:30 am)', es: 'Tarde-Noche (5:00 pm – 12:30 am)' },
        OVERNIGHT: { en: 'Overnight (12:30 am – 8:00 am)', es: 'Madrugada (12:30 am – 8:00 am)' },
        MORNING: { en: 'Morning (8:00 am – 12:30 pm)', es: 'Mañana (8:00 am – 12:30 pm)' },
        AFTERNOON: { en: 'Afternoon (12:30 pm – 5:00 pm)', es: 'Tarde (12:30 pm – 5:00 pm)' },
    };
    return lang === 'ES' ? map[slot].es : map[slot].en;
}

function msgWatchmanShift(params: {
    name: string;
    date: Date;
    slot: ShiftSlot;
    lang: Language;
}): string {
    const { name, date, slot, lang } = params;
    const when = formatLongDate(date, lang);
    if (lang === 'ES') {
        return (
            `👷 *Recordatorio de turno* — Hola ${name}!\n\n` +
            `Tienes tu turno de vigilancia *hoy (${when})*.\n` +
            `Horario: ${slotLabel(slot, lang)}.\n\n` +
            `Gracias por tu servicio. — Corn Island Hospitality`
        );
    }
    return (
        `👷 *Shift reminder* — Hi ${name}!\n\n` +
        `You have a night-watch shift *today (${when})*.\n` +
        `Slot: ${slotLabel(slot, lang)}.\n\n` +
        `Thanks for serving. — Corn Island Hospitality`
    );
}

function msgVolunteerArrival(params: {
    name: string;
    houseName: string;
    houseAddress: string;
    roomName: string;
    endDate: Date;
    lang: Language;
}): string {
    const { name, houseName, houseAddress, roomName, endDate, lang } = params;
    const until = formatLongDate(endDate, lang);
    if (lang === 'ES') {
        return (
            `🏠 *¡Bienvenido/a, ${name}!*\n\n` +
            `Hoy comienza tu estadía en *${houseName}* (${houseAddress}).\n` +
            `Habitación: *${roomName}*.\n` +
            `Fecha de salida prevista: *${until}*.\n\n` +
            `Si necesitas ayuda, contacta a tu coordinador. — Corn Island Hospitality`
        );
    }
    return (
        `🏠 *Welcome, ${name}!*\n\n` +
        `Your stay at *${houseName}* (${houseAddress}) starts today.\n` +
        `Room: *${roomName}*.\n` +
        `Scheduled checkout: *${until}*.\n\n` +
        `If you need anything, reach out to your coordinator. — Corn Island Hospitality`
    );
}

function msgVolunteerDeparture(params: {
    name: string;
    houseName: string;
    roomName: string;
    lang: Language;
}): string {
    const { name, houseName, roomName, lang } = params;
    if (lang === 'ES') {
        return (
            `👋 *Último día* — Hola ${name}!\n\n` +
            `Hoy es tu último día en *${houseName}* (habitación ${roomName}).\n` +
            `Por favor, deja la habitación limpia antes de salir. ¡Gracias por tu visita!\n\n` +
            `— Corn Island Hospitality`
        );
    }
    return (
        `👋 *Checkout day* — Hi ${name}!\n\n` +
        `Today is your last day at *${houseName}* (room ${roomName}).\n` +
        `Please leave the room tidy before you go. Thanks for staying with us!\n\n` +
        `— Corn Island Hospitality`
    );
}

type DigestEntry = {
    arrivals: Array<{ name: string; house: string; room: string }>;
    departures: Array<{ name: string; house: string; room: string }>;
    shifts: Array<{ name: string; slot: ShiftSlot }>;
};

function msgAdminDigest(params: {
    date: Date;
    data: DigestEntry;
    lang: Language;
}): string {
    const { date, data, lang } = params;
    const when = formatLongDate(date, lang);
    const none = lang === 'ES' ? '—' : '—';
    const lines: string[] = [];
    if (lang === 'ES') {
        lines.push(`📋 *Resumen diario* — ${when}`);
        lines.push('');
        lines.push(
            `*Llegadas (${data.arrivals.length}):*\n` +
                (data.arrivals.length
                    ? data.arrivals.map((a) => `  • ${a.name} → ${a.house} · ${a.room}`).join('\n')
                    : `  ${none}`),
        );
        lines.push('');
        lines.push(
            `*Salidas (${data.departures.length}):*\n` +
                (data.departures.length
                    ? data.departures.map((a) => `  • ${a.name} ← ${a.house} · ${a.room}`).join('\n')
                    : `  ${none}`),
        );
        lines.push('');
        lines.push(
            `*Turnos de vigilancia (${data.shifts.length}):*\n` +
                (data.shifts.length
                    ? data.shifts.map((s) => `  • ${s.name} — ${slotLabel(s.slot, lang)}`).join('\n')
                    : `  ${none}`),
        );
    } else {
        lines.push(`📋 *Daily digest* — ${when}`);
        lines.push('');
        lines.push(
            `*Arrivals (${data.arrivals.length}):*\n` +
                (data.arrivals.length
                    ? data.arrivals.map((a) => `  • ${a.name} → ${a.house} · ${a.room}`).join('\n')
                    : `  ${none}`),
        );
        lines.push('');
        lines.push(
            `*Departures (${data.departures.length}):*\n` +
                (data.departures.length
                    ? data.departures.map((a) => `  • ${a.name} ← ${a.house} · ${a.room}`).join('\n')
                    : `  ${none}`),
        );
        lines.push('');
        lines.push(
            `*Night watch shifts (${data.shifts.length}):*\n` +
                (data.shifts.length
                    ? data.shifts.map((s) => `  • ${s.name} — ${slotLabel(s.slot, lang)}`).join('\n')
                    : `  ${none}`),
        );
    }
    return lines.join('\n');
}

// ── Send helper ───────────────────────────────────────────────

/**
 * Direct sender — bypasses the OTP wrapper so we can send arbitrary
 * text. Does nothing if the socket isn't connected (logged instead of
 * sent), and skips the send + log if the ReminderLog row already
 * exists for this (kind, phone, reference) triple.
 */
async function sendReminder(params: {
    kind: ReminderKind;
    phone: string;
    referenceId: string;
    text: string;
}): Promise<{ sent: boolean; skipped?: 'duplicate' | 'no-phone' | 'not-connected' }> {
    const phone = normalizePhone(params.phone);
    if (!phone) return { sent: false, skipped: 'no-phone' };

    // Claim the slot in the log first. If another concurrent run (or a
    // prior run today) already inserted this row, the unique constraint
    // throws and we skip sending.
    try {
        await (
            prisma as unknown as {
                reminderLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> };
            }
        ).reminderLog.create({
            data: {
                kind: params.kind,
                recipientPhone: phone,
                referenceId: params.referenceId,
            },
        });
    } catch {
        return { sent: false, skipped: 'duplicate' };
    }

    await ensureWhatsAppStarted();
    const status = getWhatsAppStatus();
    if (status.state !== 'connected') {
        console.warn(
            `[reminders] Skipping send, WA not connected (state=${status.state}). ` +
                `kind=${params.kind} to=${phone}`,
        );
        return { sent: false, skipped: 'not-connected' };
    }
    try {
        await sendWhatsAppText(phone, params.text);
        return { sent: true };
    } catch (err) {
        console.error('[reminders] send failed', err);
        return { sent: false };
    }
}

// ── The actual job ────────────────────────────────────────────

export type ReminderRunSummary = {
    date: string;
    sent: number;
    skipped: number;
    errors: number;
    disabled?: boolean;
    details: Array<{ kind: ReminderKind; phone: string; result: string }>;
};

export async function runDailyReminders(now: Date = new Date()): Promise<ReminderRunSummary> {
    const today = todayDateOnlyInTz(DEFAULT_TZ, now);
    const todayKey = dateKey(today);
    const summary: ReminderRunSummary = {
        date: todayKey,
        sent: 0,
        skipped: 0,
        errors: 0,
        details: [],
    };

    // Honor the admin kill switch. When reminders are disabled the job
    // is a no-op — useful for testing or pausing the system without
    // redeploying.
    const enabled = await getRemindersEnabled();
    if (!enabled) {
        console.log('[reminders] Skipped — reminders are disabled.');
        summary.disabled = true;
        return summary;
    }

    // Collect everything happening today.
    const [shifts, arrivals, departures] = await Promise.all([
        prisma.watchmanShift.findMany({
            where: { date: today },
            include: { watchman: true },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.assignment.findMany({
            where: { startDate: today },
            include: {
                volunteer: true,
                room: { include: { house: true } },
            },
        }),
        prisma.assignment.findMany({
            where: { endDate: today },
            include: {
                volunteer: true,
                room: { include: { house: true } },
            },
        }),
    ]);

    // ── Watchman shift reminders ─────────────────────────────
    for (const s of shifts as unknown as Array<{
        id: string;
        date: Date;
        slot: ShiftSlot;
        watchman: { name: string; phone: string | null; language: Language | null };
    }>) {
        if (!s.watchman.phone) continue;
        const lang = s.watchman.language ?? DEFAULT_LANG;
        const text = msgWatchmanShift({
            name: s.watchman.name,
            date: today,
            slot: s.slot,
            lang,
        });
        const r = await sendReminder({
            kind: 'WATCHMAN_SHIFT',
            phone: s.watchman.phone,
            referenceId: s.id,
            text,
        });
        trackResult(summary, 'WATCHMAN_SHIFT', s.watchman.phone, r);
    }

    // ── Volunteer arrival ────────────────────────────────────
    const arrivalDigest: DigestEntry['arrivals'] = [];
    for (const a of arrivals as unknown as Array<{
        id: string;
        endDate: Date;
        volunteer: { name: string; phone: string | null; language: Language | null };
        room: { name: string; house: { name: string; address: string } };
    }>) {
        arrivalDigest.push({
            name: a.volunteer.name,
            house: a.room.house.name,
            room: a.room.name,
        });
        if (!a.volunteer.phone) continue;
        const lang = a.volunteer.language ?? DEFAULT_LANG;
        const text = msgVolunteerArrival({
            name: a.volunteer.name,
            houseName: a.room.house.name,
            houseAddress: a.room.house.address,
            roomName: a.room.name,
            endDate: a.endDate,
            lang,
        });
        const r = await sendReminder({
            kind: 'VOLUNTEER_ARRIVAL',
            phone: a.volunteer.phone,
            referenceId: a.id,
            text,
        });
        trackResult(summary, 'VOLUNTEER_ARRIVAL', a.volunteer.phone, r);
    }

    // ── Volunteer departure ──────────────────────────────────
    const departureDigest: DigestEntry['departures'] = [];
    for (const a of departures as unknown as Array<{
        id: string;
        volunteer: { name: string; phone: string | null; language: Language | null };
        room: { name: string; house: { name: string } };
    }>) {
        departureDigest.push({
            name: a.volunteer.name,
            house: a.room.house.name,
            room: a.room.name,
        });
        if (!a.volunteer.phone) continue;
        const lang = a.volunteer.language ?? DEFAULT_LANG;
        const text = msgVolunteerDeparture({
            name: a.volunteer.name,
            houseName: a.room.house.name,
            roomName: a.room.name,
            lang,
        });
        const r = await sendReminder({
            kind: 'VOLUNTEER_DEPARTURE',
            phone: a.volunteer.phone,
            referenceId: a.id,
            text,
        });
        trackResult(summary, 'VOLUNTEER_DEPARTURE', a.volunteer.phone, r);
    }

    // ── Admin daily digest ───────────────────────────────────
    const digestData: DigestEntry = {
        arrivals: arrivalDigest,
        departures: departureDigest,
        shifts: (shifts as unknown as Array<{
            slot: ShiftSlot;
            watchman: { name: string };
        }>).map((s) => ({ name: s.watchman.name, slot: s.slot })),
    };
    const adminPhones = [...adminPhoneSet()];
    for (const adminPhone of adminPhones) {
        // Per-admin language: look it up via the matching Watchman/Volunteer
        // row if present. Otherwise default.
        const lang = await lookupLanguage(adminPhone);
        const text = msgAdminDigest({ date: today, data: digestData, lang });
        const r = await sendReminder({
            kind: 'ADMIN_DAILY_DIGEST',
            phone: adminPhone,
            referenceId: todayKey,
            text,
        });
        trackResult(summary, 'ADMIN_DAILY_DIGEST', adminPhone, r);
    }

    console.log(
        `[reminders] ${todayKey}: sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors}`,
    );
    return summary;
}

function trackResult(
    summary: ReminderRunSummary,
    kind: ReminderKind,
    phone: string,
    r: { sent: boolean; skipped?: string },
) {
    if (r.sent) summary.sent += 1;
    else if (r.skipped) summary.skipped += 1;
    else summary.errors += 1;
    summary.details.push({ kind, phone, result: r.sent ? 'sent' : r.skipped ?? 'error' });
}

async function lookupLanguage(phoneE164: string): Promise<Language> {
    const phone = normalizePhone(phoneE164);
    if (!phone) return DEFAULT_LANG;
    const watchmen = await (
        prisma as unknown as {
            watchman: {
                findMany: (args: {
                    where: { phone: { not: null } };
                    select: { phone: true; language: true };
                }) => Promise<Array<{ phone: string | null; language: Language | null }>>;
            };
        }
    ).watchman.findMany({
        where: { phone: { not: null } },
        select: { phone: true, language: true },
    });
    for (const w of watchmen) {
        if (normalizePhone(w.phone) === phone && w.language) return w.language;
    }
    const vols = await (
        prisma as unknown as {
            volunteer: {
                findMany: (args: {
                    where: { phone: { not: null } };
                    select: { phone: true; language: true };
                }) => Promise<Array<{ phone: string | null; language: Language | null }>>;
            };
        }
    ).volunteer.findMany({
        where: { phone: { not: null } },
        select: { phone: true, language: true },
    });
    for (const v of vols) {
        if (normalizePhone(v.phone) === phone && v.language) return v.language;
    }
    return DEFAULT_LANG;
}

// ── Scheduler ─────────────────────────────────────────────────

let started = false;

/**
 * Start the daily cron. Idempotent — safe to call multiple times (e.g.
 * from Next.js `instrumentation.ts` which can fire more than once with
 * HMR). Respects `REMINDER_HOUR` (0-23, default 8) and `REMINDER_TZ`
 * (IANA name, default America/Managua).
 */
export async function startReminderScheduler(): Promise<void> {
    if (started) return;
    started = true;
    const hour = Number(process.env.REMINDER_HOUR ?? '8');
    const tz = DEFAULT_TZ;

    const cron = await import('node-cron');
    const schedule = (cron as unknown as {
        default?: {
            schedule: (expr: string, fn: () => void, opts?: { timezone?: string }) => unknown;
        };
        schedule?: (expr: string, fn: () => void, opts?: { timezone?: string }) => unknown;
    });
    const scheduleFn = schedule.default?.schedule ?? schedule.schedule;
    if (!scheduleFn) {
        console.error('[reminders] node-cron.schedule not found; cron disabled.');
        return;
    }

    const expr = `0 ${hour} * * *`;
    scheduleFn(
        expr,
        () => {
            runDailyReminders().catch((err) => {
                console.error('[reminders] daily run failed', err);
            });
        },
        { timezone: tz },
    );
    console.log(`[reminders] Scheduled daily run at ${hour}:00 ${tz} (cron: "${expr}").`);
}
