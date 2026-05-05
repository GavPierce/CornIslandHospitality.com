import 'server-only';

import { prisma } from './prisma';
import { ensureWhatsAppStarted, getWhatsAppStatus, sendWhatsAppText, sendWhatsAppImage } from './whatsapp';
import fs from 'fs';
import path from 'path';
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
type ShiftSlot = 'EVENING' | 'OVERNIGHT' | 'MORNING' | 'AFTERNOON' | 'LUNCH';
type ReminderKind =
    | 'WATCHMAN_SHIFT'
    | 'VOLUNTEER_ARRIVAL'
    | 'VOLUNTEER_DEPARTURE'
    | 'ADMIN_DAILY_DIGEST'
    | 'ASSIGNMENT_CONFIRMATION'
    | 'HOSPITALITY_PAIRING'
    | 'HOSPITALITY_CANCELLATION'
    | 'HOSPITALITY_ARRIVAL'
    | 'ASSIGNMENT_FAQ_MAP';

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

import { getMessageTemplate } from '@/lib/settings';

function slotLabel(slot: ShiftSlot, lang: Language): string {
    const map: Record<ShiftSlot, { en: string; es: string }> = {
        EVENING: { en: 'Evening (5:00 pm – 12:30 am)', es: 'Tarde-Noche (5:00 pm – 12:30 am)' },
        OVERNIGHT: { en: 'Overnight (12:30 am – 8:00 am)', es: 'Madrugada (12:30 am – 8:00 am)' },
        MORNING: { en: 'Morning (8:00 am – 12:30 pm)', es: 'Mañana (8:00 am – 12:30 pm)' },
        AFTERNOON: { en: 'Afternoon (12:30 pm – 5:00 pm)', es: 'Tarde (12:30 pm – 5:00 pm)' },
        LUNCH: { en: 'Lunch (12:00 pm – 1:00 pm)', es: 'Almuerzo (12:00 pm – 1:00 pm)' },
    };
    return lang === 'ES' ? map[slot].es : map[slot].en;
}

async function msgWatchmanShift(params: {
    name: string;
    date: Date;
    slot: ShiftSlot;
    lang: Language;
}): Promise<string> {
    const { name, date, slot, lang } = params;
    const when = formatLongDate(date, lang);
    const slotText = slotLabel(slot, lang);
    
    let template = await getMessageTemplate(`template.WATCHMAN_SHIFT.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `👷 *Recordatorio de turno* — Hola {name}!\n\nTienes tu turno de vigilancia *hoy ({date})*.\nHorario: {slot}.\n\nGracias por tu servicio. — Corn Island Hospitality`
            : `👷 *Shift reminder* — Hi {name}!\n\nYou have a shift *today ({date})*.\nSlot: {slot}.\n\nThanks for serving. — Corn Island Hospitality`;
    }
    
    return template
        .replace(/{name}/g, name)
        .replace(/{date}/g, when)
        .replace(/{slot}/g, slotText);
}

async function msgVolunteerArrival(params: {
    name: string;
    houseName: string;
    houseAddress: string;
    roomName: string;
    endDate: Date;
    lang: Language;
}): Promise<string> {
    const { name, houseName, houseAddress, roomName, endDate, lang } = params;
    const until = formatLongDate(endDate, lang);
    
    let template = await getMessageTemplate(`template.VOLUNTEER_ARRIVAL.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `🏠 *¡Bienvenido/a, {name}!*\n\nHoy comienza tu estadía en *{houseName}* ({houseAddress}).\nHabitación: *{roomName}*.\nFecha de salida prevista: *{endDate}*.\n\nSi necesitas ayuda, contacta a tu coordinador. — Corn Island Hospitality`
            : `🏠 *Welcome, {name}!*\n\nYour stay at *{houseName}* ({houseAddress}) starts today.\nRoom: *{roomName}*.\nScheduled checkout: *{endDate}*.\n\nIf you need anything, reach out to your coordinator. — Corn Island Hospitality`;
    }

    return template
        .replace(/{name}/g, name)
        .replace(/{houseName}/g, houseName)
        .replace(/{houseAddress}/g, houseAddress)
        .replace(/{roomName}/g, roomName)
        .replace(/{endDate}/g, until);
}

async function msgVolunteerDeparture(params: {
    name: string;
    houseName: string;
    roomName: string;
    lang: Language;
}): Promise<string> {
    const { name, houseName, roomName, lang } = params;
    
    let template = await getMessageTemplate(`template.VOLUNTEER_DEPARTURE.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `👋 *Último día* — Hola {name}!\n\nHoy es tu último día en *{houseName}* (habitación {roomName}).\nPor favor, deja la habitación limpia antes de salir. ¡Gracias por tu visita!\n\n— Corn Island Hospitality`
            : `👋 *Checkout day* — Hi {name}!\n\nToday is your last day at *{houseName}* (room {roomName}).\nPlease leave the room tidy before you go. Thanks for staying with us!\n\n— Corn Island Hospitality`;
    }

    return template
        .replace(/{name}/g, name)
        .replace(/{houseName}/g, houseName)
        .replace(/{roomName}/g, roomName);
}

async function msgAssignmentConfirmation(params: {
    volunteerName: string;
    houseName: string;
    houseAddress: string;
    roomName: string;
    startDate: Date;
    endDate: Date;
    lang: Language;
    hospitalityContact?: { name: string; phone: string | null } | null;
}): Promise<string> {
    const { volunteerName, houseName, houseAddress, roomName, startDate, endDate, lang, hospitalityContact } = params;
    const from = formatLongDate(startDate, lang);
    const to = formatLongDate(endDate, lang);
    
    let template = await getMessageTemplate(`template.ASSIGNMENT_CONFIRMATION.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `🏠 *Alojamiento confirmado — ¡Hola {volunteerName}!*\n\nSe te ha asignado una habitación en *{houseName}* ({houseAddress}).\nHabitación: *{roomName}*.\nFechas: {startDate} → {endDate}.{hospitalityBlock}\n\nSi tienes alguna pregunta, comunícate con tu coordinador.\n— Corn Island Hospitality`
            : `🏠 *Housing confirmed — Hi {volunteerName}!*\n\nYou've been assigned a room at *{houseName}* ({houseAddress}).\nRoom: *{roomName}*.\nDates: {startDate} → {endDate}.{hospitalityBlock}\n\nIf you have any questions, reach out to your coordinator.\n— Corn Island Hospitality`;
    }

    const hospitalityBlock = hospitalityContact
        ? lang === 'ES'
            ? `\n\n🤝 *Tu contacto de hospitalidad:* ${hospitalityContact.name}${hospitalityContact.phone ? ` · 📞 ${hospitalityContact.phone}` : ''}`
            : `\n\n🤝 *Your hospitality contact:* ${hospitalityContact.name}${hospitalityContact.phone ? ` · 📞 ${hospitalityContact.phone}` : ''}`
        : '';

    return template
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName)
        .replace(/{houseAddress}/g, houseAddress)
        .replace(/{roomName}/g, roomName)
        .replace(/{startDate}/g, from)
        .replace(/{endDate}/g, to)
        .replace(/{hospitalityBlock}/g, hospitalityBlock);
}

async function msgOwnerNotification(params: {
    ownerName: string;
    volunteerName: string;
    houseName: string;
    roomName: string;
    startDate: Date;
    endDate: Date;
    lang: Language;
}): Promise<string> {
    const { ownerName, volunteerName, houseName, roomName, startDate, endDate, lang } = params;
    const from = formatLongDate(startDate, lang);
    const to = formatLongDate(endDate, lang);
    
    let template = await getMessageTemplate(`template.OWNER_NOTIFICATION.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `🏡 *Nuevo huésped — Hola {ownerName}!*\n\n*{volunteerName}* ha sido asignado/a a una habitación en tu casa (*{houseName}*).\nHabitación: *{roomName}*.\nFechas: {startDate} → {endDate}.\n\n— Corn Island Hospitality`
            : `🏡 *New guest arriving — Hi {ownerName}!*\n\n*{volunteerName}* has been assigned a room in your home (*{houseName}*).\nRoom: *{roomName}*.\nDates: {startDate} → {endDate}.\n\n— Corn Island Hospitality`;
    }

    return template
        .replace(/{ownerName}/g, ownerName)
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName)
        .replace(/{roomName}/g, roomName)
        .replace(/{startDate}/g, from)
        .replace(/{endDate}/g, to);
}

async function msgFaqMap(params: {
    volunteerName: string;
    houseName: string;
    lang: Language;
}): Promise<string> {
    const { volunteerName, houseName, lang } = params;
    
    let template = await getMessageTemplate(`template.FAQ_MAP.${lang}`);
    if (!template) {
        template = lang === 'ES'
            ? `¡Bienvenido/a a Corn Island, {volunteerName}!\n\nAquí tienes un mapa de la isla para ayudarte a ubicar *{houseName}* y otros lugares importantes.\n\n*Recordatorios básicos:*\n• Por favor trae tu propia botella de agua reusable.\n• Mantén las puertas de tu habitación cerradas cuando no estés.\n• ¡Disfruta tu estadía!`
            : `Welcome to Corn Island, {volunteerName}!\n\nHere is a map of the island to help you locate *{houseName}* and other key spots.\n\n*Basic reminders:*\n• Please bring your own reusable water bottle.\n• Keep your room doors locked when you are out.\n• Enjoy your stay!`;
    }

    return template
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName);
}

// ── Hospitality message templates ────────────────────────────

async function msgHospitalityPairing(params: {
    hospitalityName: string;
    volunteerName: string;
    houseName: string;
    houseAddress: string;
    roomName: string;
    startDate: Date;
    endDate: Date;
    lang: Language;
}): Promise<string> {
    const { hospitalityName, volunteerName, houseName, houseAddress, roomName, startDate, endDate, lang } = params;
    const from = formatLongDate(startDate, lang);
    const to = formatLongDate(endDate, lang);
    const template = lang === 'ES'
        ? `🤝 *¡Hola {hospitalityName}!* Has sido asignado/a para dar la bienvenida a *{volunteerName}*, quien se alojará en *{houseName}* ({houseAddress}), habitación *{roomName}*, del {startDate} al {endDate}.\n\nPor favor, comunícate con él/ella para darle la bienvenida.\n— Corn Island Hospitality`
        : `🤝 *Hi {hospitalityName}!* You've been assigned to welcome *{volunteerName}*, who will be staying at *{houseName}* ({houseAddress}), Room *{roomName}*, from {startDate} to {endDate}.\n\nPlease reach out to greet them on arrival!\n— Corn Island Hospitality`;
    return template
        .replace(/{hospitalityName}/g, hospitalityName)
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName)
        .replace(/{houseAddress}/g, houseAddress)
        .replace(/{roomName}/g, roomName)
        .replace(/{startDate}/g, from)
        .replace(/{endDate}/g, to);
}

async function msgHospitalityCancellation(params: {
    hospitalityName: string;
    volunteerName: string;
    houseName: string;
    lang: Language;
}): Promise<string> {
    const { hospitalityName, volunteerName, houseName, lang } = params;
    const template = lang === 'ES'
        ? `🔔 *Hola {hospitalityName}* — Tu asignación para dar la bienvenida a *{volunteerName}* en *{houseName}* ha sido cancelada. No se requiere ninguna acción adicional.\n— Corn Island Hospitality`
        : `🔔 *Hi {hospitalityName}* — Your hospitality assignment for *{volunteerName}* at *{houseName}* has been cancelled. No further action is needed.\n— Corn Island Hospitality`;
    return template
        .replace(/{hospitalityName}/g, hospitalityName)
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName);
}

async function msgHospitalityArrival(params: {
    hospitalityName: string;
    volunteerName: string;
    houseName: string;
    houseAddress: string;
    roomName: string;
    lang: Language;
}): Promise<string> {
    const { hospitalityName, volunteerName, houseName, houseAddress, roomName, lang } = params;
    const template = lang === 'ES'
        ? `🤝 *Recordatorio — ¡Hola {hospitalityName}!* *{volunteerName}* llega hoy a *{houseName}* ({houseAddress}), habitación *{roomName}*. ¡Hoy es el día de darle la bienvenida!\n— Corn Island Hospitality`
        : `🤝 *Reminder — Hi {hospitalityName}!* *{volunteerName}* arrives today at *{houseName}* ({houseAddress}), Room *{roomName}*. Today's the day to welcome them!\n— Corn Island Hospitality`;
    return template
        .replace(/{hospitalityName}/g, hospitalityName)
        .replace(/{volunteerName}/g, volunteerName)
        .replace(/{houseName}/g, houseName)
        .replace(/{houseAddress}/g, houseAddress)
        .replace(/{roomName}/g, roomName);
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
    
    // Group shifts by slot
    const slotOrder: ShiftSlot[] = ['MORNING', 'LUNCH', 'AFTERNOON', 'EVENING', 'OVERNIGHT'];
    const groupedShifts = new Map<ShiftSlot, string[]>();
    for (const s of data.shifts) {
        if (!groupedShifts.has(s.slot)) groupedShifts.set(s.slot, []);
        groupedShifts.get(s.slot)!.push(s.name);
    }
    
    let shiftsText = '';
    if (data.shifts.length === 0) {
        shiftsText = `  ${none}`;
    } else {
        const sortedSlots = slotOrder.filter(slot => groupedShifts.has(slot));
        for (const slot of sortedSlots) {
            shiftsText += `  *${slotLabel(slot, lang)}:*\n`;
            shiftsText += groupedShifts.get(slot)!.map((name) => `    • ${name}`).join('\n') + '\n';
        }
        shiftsText = shiftsText.trimEnd();
    }

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
        lines.push(`*Turnos de vigilancia (${data.shifts.length}):*\n${shiftsText}`);
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
        lines.push(`*Shifts (${data.shifts.length}):*\n${shiftsText}`);
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
    kind: ReminderKind | 'ASSIGNMENT_FAQ_MAP';
    phone: string;
    referenceId: string;
    text: string;
    imagePath?: string;
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

    // ensureWhatsAppStarted() resolves once the socket is *created*, but
    // the actual connection ('open' event) fires asynchronously after.
    // Wait up to 15 seconds for the state to leave 'connecting'.
    const MAX_WAIT_MS = 15_000;
    const POLL_MS = 500;
    let waited = 0;
    while (getWhatsAppStatus().state === 'connecting' && waited < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        waited += POLL_MS;
    }

    const status = getWhatsAppStatus();
    if (status.state !== 'connected') {
        console.warn(
            `[reminders] Skipping send, WA not connected (state=${status.state}, waited=${waited}ms). ` +
                `kind=${params.kind} to=${phone}`,
        );
        return { sent: false, skipped: 'not-connected' };
    }
    try {
        if (params.imagePath) {
            await sendWhatsAppImage(phone, params.imagePath, params.text);
        } else {
            await sendWhatsAppText(phone, params.text);
        }
        return { sent: true };
    } catch (err) {
        console.error('[reminders] send failed', err);
        return { sent: false };
    }
}

// ── The actual job ────────────────────────────────────────────

/**
 * Send an instant WhatsApp confirmation when an assignment is created.
 * Notifies the volunteer (their room details) and the house owner
 * (new guest arriving). Both sends are idempotent via ReminderLog.
 */
export async function sendAssignmentConfirmation(assignmentId: string): Promise<void> {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
            volunteer: { select: { name: true, phone: true, language: true } },
            hospitalityMember: { select: { id: true, name: true, phone: true, language: true } },
            room: {
                include: {
                    house: {
                        include: {
                            owners: {
                                include: {
                                    volunteer: { select: { id: true, name: true, phone: true, language: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!assignment) return;

    const { volunteer, room } = assignment as unknown as {
        volunteer: { name: string; phone: string | null; language: Language | null };
        room: {
            name: string;
            house: {
                name: string;
                address: string;
                owners: Array<{
                    volunteer: { id: string; name: string; phone: string | null; language: Language | null };
                }>;
            };
        };
    };
    const hospitalityMember = assignment.hospitalityMember as unknown as {
        id: string; name: string; phone: string | null; language: Language | null;
    } | null;

    const house = room.house;

    // ── Volunteer confirmation (includes hospitality contact if set) ──
    if (volunteer.phone) {
        const lang = volunteer.language ?? DEFAULT_LANG;
        const text = await msgAssignmentConfirmation({
            volunteerName: volunteer.name,
            houseName: house.name,
            houseAddress: house.address,
            roomName: room.name,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            lang,
            hospitalityContact: hospitalityMember,
        });
        await sendReminder({
            kind: 'ASSIGNMENT_CONFIRMATION',
            phone: volunteer.phone,
            referenceId: assignmentId,
            text,
        });

        // Immediately send the FAQ/Map if it exists
        const authDir = process.env.WA_AUTH_DIR || path.join(process.cwd(), 'wa-auth');
        const mapImagePath = path.join(authDir, 'uploads', 'faq-map.jpg');
        
        if (fs.existsSync(mapImagePath)) {
            const faqText = await msgFaqMap({
                volunteerName: volunteer.name,
                houseName: house.name,
                lang,
            });
            await sendReminder({
                kind: 'ASSIGNMENT_FAQ_MAP',
                phone: volunteer.phone,
                referenceId: assignmentId,
                text: faqText,
                imagePath: mapImagePath,
            });
        }
    }

    // ── House owner notifications (one per co-owner) ─────────
    for (const ownerRow of house.owners) {
        const owner = ownerRow.volunteer;
        if (!owner.phone) continue;
        const lang = owner.language ?? DEFAULT_LANG;
        const text = await msgOwnerNotification({
            ownerName: owner.name,
            volunteerName: volunteer.name,
            houseName: house.name,
            roomName: room.name,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            lang,
        });
        await sendReminder({
            kind: 'ASSIGNMENT_CONFIRMATION',
            phone: owner.phone,
            referenceId: `owner-${owner.id}-${assignmentId}`,
            text,
        });
    }

    // ── Hospitality member pairing notification ────────────
    if (hospitalityMember?.phone) {
        const lang = hospitalityMember.language ?? DEFAULT_LANG;
        const text = await msgHospitalityPairing({
            hospitalityName: hospitalityMember.name,
            volunteerName: volunteer.name,
            houseName: house.name,
            houseAddress: house.address,
            roomName: room.name,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            lang,
        });
        // Use a timestamp-based referenceId: pairings are event-driven, not once-per-day idempotent
        await sendReminder({
            kind: 'HOSPITALITY_PAIRING',
            phone: hospitalityMember.phone,
            referenceId: `pairing-${assignmentId}-${hospitalityMember.id}-${Date.now()}`,
            text,
        });
    }
}

/**
 * Send a HOSPITALITY_PAIRING notification to the currently-assigned
 * hospitality member for an assignment. Used when the member is changed
 * after creation.
 */
export async function sendHospitalityPairingNotification(assignmentId: string): Promise<void> {
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
            volunteer: { select: { name: true } },
            hospitalityMember: { select: { id: true, name: true, phone: true, language: true } },
            room: { include: { house: { select: { name: true, address: true } } } },
        },
    });
    if (!assignment?.hospitalityMember?.phone) return;

    const hm = assignment.hospitalityMember as unknown as { id: string; name: string; phone: string; language: Language | null };
    const lang = hm.language ?? DEFAULT_LANG;
    const text = await msgHospitalityPairing({
        hospitalityName: hm.name,
        volunteerName: (assignment.volunteer as unknown as { name: string }).name,
        houseName: (assignment.room as unknown as { house: { name: string; address: string } }).house.name,
        houseAddress: (assignment.room as unknown as { house: { name: string; address: string } }).house.address,
        roomName: (assignment.room as unknown as { name: string }).name,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        lang,
    });
    await sendReminder({
        kind: 'HOSPITALITY_PAIRING',
        phone: hm.phone,
        referenceId: `pairing-${assignmentId}-${hm.id}-${Date.now()}`,
        text,
    });
}

/**
 * Send a HOSPITALITY_CANCELLATION notification to the previously-assigned
 * hospitality member when they are replaced on an assignment.
 */
export async function sendHospitalityCancellationNotification(params: {
    assignmentId: string;
    hospitalityMember: { id: string; name: string; phone: string; language: string | null };
    volunteerName: string;
    houseName: string;
}): Promise<void> {
    const { assignmentId, hospitalityMember: hm, volunteerName, houseName } = params;
    const lang = (hm.language as Language | null) ?? DEFAULT_LANG;
    const text = await msgHospitalityCancellation({
        hospitalityName: hm.name,
        volunteerName,
        houseName,
        lang,
    });
    await sendReminder({
        kind: 'HOSPITALITY_CANCELLATION',
        phone: hm.phone,
        referenceId: `cancel-${assignmentId}-${hm.id}-${Date.now()}`,
        text,
    });
}

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
            include: { volunteer: true },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.assignment.findMany({
            where: { startDate: today },
            include: {
                volunteer: true,
                hospitalityMember: { select: { id: true, name: true, phone: true, language: true } },
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
        volunteer: { name: string; phone: string | null; language: Language | null };
    }>) {
        if (!s.volunteer.phone) continue;
        const lang = s.volunteer.language ?? DEFAULT_LANG;
        const text = await msgWatchmanShift({
            name: s.volunteer.name,
            date: today,
            slot: s.slot,
            lang,
        });
        const r = await sendReminder({
            kind: 'WATCHMAN_SHIFT',
            phone: s.volunteer.phone,
            referenceId: s.id,
            text,
        });
        trackResult(summary, 'WATCHMAN_SHIFT', s.volunteer.phone, r);
    }

    // ── Volunteer arrival ────────────────────────────────────
    const arrivalDigest: DigestEntry['arrivals'] = [];
    for (const a of arrivals as unknown as Array<{
        id: string;
        endDate: Date;
        volunteer: { name: string; phone: string | null; language: Language | null };
        hospitalityMember: { id: string; name: string; phone: string | null; language: Language | null } | null;
        room: { name: string; house: { name: string; address: string } };
    }>) {
        arrivalDigest.push({
            name: a.volunteer.name,
            house: a.room.house.name,
            room: a.room.name,
        });
        if (a.volunteer.phone) {
            const lang = a.volunteer.language ?? DEFAULT_LANG;
            const text = await msgVolunteerArrival({
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
        // ── Hospitality member arrival reminder ────────────────
        if (a.hospitalityMember?.phone) {
            const hm = a.hospitalityMember;
            const lang = hm.language ?? DEFAULT_LANG;
            const text = await msgHospitalityArrival({
                hospitalityName: hm.name,
                volunteerName: a.volunteer.name,
                houseName: a.room.house.name,
                houseAddress: a.room.house.address,
                roomName: a.room.name,
                lang,
            });
            const r = await sendReminder({
                kind: 'HOSPITALITY_ARRIVAL',
                phone: hm.phone as string,
                referenceId: `hospitality-arrival-${a.id}`,
                text,
            });
            trackResult(summary, 'HOSPITALITY_ARRIVAL', hm.phone as string, r);
        }
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
        const text = await msgVolunteerDeparture({
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
            volunteer: { name: string };
        }>).map((s) => ({ name: s.volunteer.name, slot: s.slot })),
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
    const vols = await prisma.volunteer.findMany({
        where: { phone: { not: null } },
        select: { phone: true, language: true },
    });
    for (const v of vols) {
        if (normalizePhone(v.phone) === phone && v.language)
            return v.language as Language;
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
