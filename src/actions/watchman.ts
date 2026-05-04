'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShiftSlot } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// ─── Watchmen (People) ──────────────────────────────────
//
// Watchmen are just Volunteers with `isWatchman = true`. People CRUD
// lives on the Volunteers page (`/volunteers`); this helper exists so
// the schedule UI can fetch just the watchman-flagged subset with a
// familiar name.

export async function getWatchmen() {
    return prisma.volunteer.findMany({
        where: { isWatchman: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, phone: true },
    });
}

// ─── Watchman Shifts (Schedule) ─────────────────────────

/**
 * Parse a YYYY-MM-DD string as a UTC midnight Date.
 */
function parseDateOnly(value: string): Date | null {
    if (!value) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (isNaN(date.getTime())) return null;
    return date;
}

/**
 * Get all shifts that fall within the given month (year + 0-based month).
 */
export async function getWatchmanShifts(year: number, month: number) {
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    const rows = await prisma.watchmanShift.findMany({
        where: { date: { gte: start, lt: end } },
        include: { volunteer: { select: { id: true, name: true } } },
        orderBy: { date: 'asc' },
    });
    // Expose the volunteer as `watchman` on the client so existing UI
    // code that reads `.watchman.name` keeps working without churn.
    return rows.map((r) => ({
        id: r.id,
        volunteerId: r.volunteerId,
        watchmanId: r.volunteerId, // legacy alias for client code
        date: r.date,
        slot: r.slot,
        notes: r.notes,
        watchman: r.volunteer,
    }));
}

export async function createWatchmanShift(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    // The form still posts the field as `watchmanId` (the user-facing
    // label is “watchman”), but internally it is a Volunteer id.
    const volunteerId =
        (formData.get('volunteerId') as string | null) ??
        (formData.get('watchmanId') as string | null) ??
        '';
    const dateStr = formData.get('date') as string;
    const slotStr = formData.get('slot') as string;
    const notes = ((formData.get('notes') as string) || '').trim() || null;

    if (!volunteerId || !dateStr || !slotStr) {
        return { error: 'Watchman, date, and shift are required.' };
    }

    const date = parseDateOnly(dateStr);
    if (!date) return { error: 'Invalid date.' };

    // Validate slot value. Admins may assign any of the four shifts to any
    // day of the week — the calendar's weekday defaults are only guidance for
    // coverage warnings, not a hard server-side restriction.
    const validSlots: ShiftSlot[] = ['EVENING', 'OVERNIGHT', 'MORNING', 'AFTERNOON', 'LUNCH'] as ShiftSlot[];
    if (!validSlots.includes(slotStr as ShiftSlot)) {
        return { error: 'Invalid shift.' };
    }
    const slot = slotStr as ShiftSlot;

    const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    if (!volunteer) return { error: 'Watchman not found.' };
    if (!volunteer.isWatchman) {
        return { error: 'This person is not flagged as a watchman.' };
    }

    // Prevent the same watchman from being double-assigned to the same shift
    const existing = await prisma.watchmanShift.findUnique({
        where: { volunteerId_date_slot: { volunteerId, date, slot } },
    });
    if (existing) {
        return { error: 'This watchman is already assigned to that shift.' };
    }

    await prisma.watchmanShift.create({ data: { volunteerId, date, slot, notes } });

    revalidatePath('/watchman');
    return { success: true };
}

export async function deleteWatchmanShift(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.watchmanShift.delete({ where: { id } });
    revalidatePath('/watchman');
    return { success: true };
}
