import { ShiftSlot } from '@prisma/client';

export type ShiftSlotValue = `${ShiftSlot}`;

export const SHIFT_SLOT_ORDER: ShiftSlot[] = [
    'MORNING' as ShiftSlot,
    'LUNCH' as ShiftSlot,
    'AFTERNOON' as ShiftSlot,
    'EVENING' as ShiftSlot,
    'OVERNIGHT' as ShiftSlot,
];

export const SHIFT_SLOT_TIMES: Record<ShiftSlot, string> = {
    MORNING: '8:00 AM – 12:30 PM',
    LUNCH: '12:00 PM – 1:00 PM',
    AFTERNOON: '12:30 PM – 5:00 PM',
    EVENING: '5:00 PM – 12:30 AM',
    OVERNIGHT: '12:30 AM – 8:00 AM',
} as Record<ShiftSlot, string>;

/**
 * Return the shift slots that are expected (default) on a given weekday
 * (in schedule order). weekday: 0 = Sunday, 1 = Monday, … 6 = Saturday.
 * Every day has EVENING + OVERNIGHT.
 *  - Sunday & Monday additionally have MORNING + AFTERNOON daytime shifts
 *    by default (full-day coverage).
 *  - Tuesday through Saturday additionally have a LUNCH shift by default
 *    (workdays — short midday coverage only).
 * Admins may still assign any slot to any weekday — see {@link displaySlotsForDay}.
 */
export function allowedSlotsForWeekday(weekday: number): ShiftSlot[] {
    if (weekday === 0 || weekday === 1) {
        return [
            'MORNING' as ShiftSlot,
            'AFTERNOON' as ShiftSlot,
            'EVENING' as ShiftSlot,
            'OVERNIGHT' as ShiftSlot,
        ];
    }
    // Tuesday – Saturday: lunchtime + nights only.
    return [
        'LUNCH' as ShiftSlot,
        'EVENING' as ShiftSlot,
        'OVERNIGHT' as ShiftSlot,
    ];
}

/**
 * Return the slots to render for a given weekday, in schedule order, as the
 * union of the default expected slots and any extra slots that already have
 * shifts assigned on that day. This lets admins add an ad-hoc MORNING or
 * AFTERNOON shift to any weekday and have it surface on the calendar.
 */
export function displaySlotsForDay(
    weekday: number,
    slotsWithShifts: Iterable<ShiftSlot>,
): ShiftSlot[] {
    const base = new Set<ShiftSlot>(allowedSlotsForWeekday(weekday));
    for (const slot of slotsWithShifts) base.add(slot);
    return SHIFT_SLOT_ORDER.filter((s) => base.has(s));
}
