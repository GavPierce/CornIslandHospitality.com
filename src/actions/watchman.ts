'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShiftSlot } from '@prisma/client';
import { revalidatePath } from 'next/cache';

// ─── Watchmen (People) ──────────────────────────────────

export async function getWatchmen() {
    return prisma.watchman.findMany({
        orderBy: { name: 'asc' },
    });
}

export async function createWatchman(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const name = (formData.get('name') as string)?.trim();
    const email = ((formData.get('email') as string) || '').trim() || null;
    const phone = ((formData.get('phone') as string) || '').trim() || null;

    if (!name) return { error: 'Name is required.' };

    await prisma.watchman.create({ data: { name, email, phone } });

    revalidatePath('/watchman');
    return { success: true };
}

export async function updateWatchman(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const id = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const email = ((formData.get('email') as string) || '').trim() || null;
    const phone = ((formData.get('phone') as string) || '').trim() || null;

    if (!id) return { error: 'Watchman id is required.' };
    if (!name) return { error: 'Name is required.' };

    await prisma.watchman.update({
        where: { id },
        data: { name, email, phone },
    });

    revalidatePath('/watchman');
    return { success: true };
}

export async function deleteWatchman(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.watchman.delete({ where: { id } });
    revalidatePath('/watchman');
    return { success: true };
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
    return prisma.watchmanShift.findMany({
        where: { date: { gte: start, lt: end } },
        include: { watchman: true },
        orderBy: { date: 'asc' },
    });
}

export async function createWatchmanShift(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const watchmanId = formData.get('watchmanId') as string;
    const dateStr = formData.get('date') as string;
    const slotStr = formData.get('slot') as string;
    const notes = ((formData.get('notes') as string) || '').trim() || null;

    if (!watchmanId || !dateStr || !slotStr) {
        return { error: 'Watchman, date, and shift are required.' };
    }

    const date = parseDateOnly(dateStr);
    if (!date) return { error: 'Invalid date.' };

    // Validate slot value. Admins may assign any of the four shifts to any
    // day of the week — the calendar's weekday defaults are only guidance for
    // coverage warnings, not a hard server-side restriction.
    const validSlots: ShiftSlot[] = ['EVENING', 'OVERNIGHT', 'MORNING', 'AFTERNOON'] as ShiftSlot[];
    if (!validSlots.includes(slotStr as ShiftSlot)) {
        return { error: 'Invalid shift.' };
    }
    const slot = slotStr as ShiftSlot;

    const watchman = await prisma.watchman.findUnique({ where: { id: watchmanId } });
    if (!watchman) return { error: 'Watchman not found.' };

    // Prevent the same watchman from being double-assigned to the same shift
    const existing = await prisma.watchmanShift.findUnique({
        where: { watchmanId_date_slot: { watchmanId, date, slot } },
    });
    if (existing) {
        return { error: 'This watchman is already assigned to that shift.' };
    }

    await prisma.watchmanShift.create({ data: { watchmanId, date, slot, notes } });

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
