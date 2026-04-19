import { ShiftSlot } from '@prisma/client';

export type ShiftSlotValue = `${ShiftSlot}`;

export const SHIFT_SLOT_ORDER: ShiftSlot[] = [
    'MORNING' as ShiftSlot,
    'AFTERNOON' as ShiftSlot,
    'EVENING' as ShiftSlot,
    'OVERNIGHT' as ShiftSlot,
];

export const SHIFT_SLOT_TIMES: Record<ShiftSlot, string> = {
    MORNING: '8:00 AM – 12:30 PM',
    AFTERNOON: '12:30 PM – 5:00 PM',
    EVENING: '5:00 PM – 12:30 AM',
    OVERNIGHT: '12:30 AM – 8:00 AM',
} as Record<ShiftSlot, string>;

/**
 * Return the shift slots that are allowed on a given weekday (in schedule order).
 * weekday: 0 = Sunday, 1 = Monday, … 6 = Saturday.
 * Every day has EVENING + OVERNIGHT; Sunday & Monday additionally have
 * MORNING + AFTERNOON daytime shifts.
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
    return ['EVENING' as ShiftSlot, 'OVERNIGHT' as ShiftSlot];
}
