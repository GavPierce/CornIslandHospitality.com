'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VolunteerType, Language } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { sendAssignmentConfirmation } from '@/lib/reminders';

// ─── Houses ──────────────────────────────────────────

export async function getHouses() {
    return prisma.house.findMany({
        include: {
            owners: {
                include: {
                    volunteer: { select: { id: true, name: true, phone: true, language: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
            rooms: {
                include: {
                    assignments: {
                        include: { volunteer: true },
                        where: {
                            endDate: { gte: new Date() },
                        },
                    },
                },
            },
        },
        orderBy: { name: 'asc' },
    });
}

export async function createHouse(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const name = formData.get('name') as string;
    const address = formData.get('address') as string;
    const acceptedTypes = formData.getAll('acceptedTypes') as VolunteerType[];
    const ownerIds = formData.getAll('ownerIds') as string[];

    if (!name || !address || acceptedTypes.length === 0) {
        return { error: 'All fields are required.' };
    }

    const house = await prisma.house.create({
        data: {
            name,
            address,
            acceptedTypes,
            owners: ownerIds.length > 0
                ? { create: ownerIds.map((volunteerId) => ({ volunteerId })) }
                : undefined,
        },
    });

    void house; // suppress unused var warning
    revalidatePath('/planning');
    return { success: true };
}

export async function deleteHouse(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.house.delete({ where: { id } });
    revalidatePath('/planning');
    return { success: true };
}

/**
 * Add a single volunteer as a co-owner of a house.
 * Idempotent — silently succeeds if the row already exists.
 */
export async function addHouseOwner(houseId: string, volunteerId: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.houseOwner.upsert({
        where: { houseId_volunteerId: { houseId, volunteerId } },
        create: { houseId, volunteerId },
        update: {},
    });

    revalidatePath('/planning');
    return { success: true };
}

/**
 * Remove a volunteer from a house's owner list.
 */
export async function removeHouseOwner(houseId: string, volunteerId: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.houseOwner.delete({
        where: { houseId_volunteerId: { houseId, volunteerId } },
    });

    revalidatePath('/planning');
    return { success: true };
}

// ─── Rooms ───────────────────────────────────────────

export async function createRoom(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const name = formData.get('name') as string;
    const capacity = parseInt(formData.get('capacity') as string, 10);
    const houseId = formData.get('houseId') as string;

    if (!name || !capacity || !houseId) {
        return { error: 'All fields are required.' };
    }

    await prisma.room.create({
        data: { name, capacity, houseId },
    });

    revalidatePath('/');
    revalidatePath('/planning');
    return { success: true };
}

export async function deleteRoom(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.room.delete({ where: { id } });
    revalidatePath('/planning');
    return { success: true };
}

// ─── Volunteers ──────────────────────────────────────

export async function getVolunteers() {
    return prisma.volunteer.findMany({
        include: {
            assignments: {
                include: { room: { include: { house: true } } },
                where: { endDate: { gte: new Date() } },
            },
        },
        orderBy: { name: 'asc' },
    });
}

export async function createVolunteer(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const name = formData.get('name') as string;
    const email = (formData.get('email') as string) || null;
    const phone = (formData.get('phone') as string) || null;
    const type = formData.get('type') as VolunteerType;
    const isWatchman = formData.get('isWatchman') === 'on'
        || formData.get('isWatchman') === 'true';

    if (!name || !type) {
        return { error: 'Name and type are required.' };
    }

    await prisma.volunteer.create({
        data: { name, email, phone, type, isWatchman },
    });

    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

export async function updateVolunteer(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const id = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const email = ((formData.get('email') as string) || '').trim() || null;
    const phone = ((formData.get('phone') as string) || '').trim() || null;
    const type = (formData.get('type') as VolunteerType) || undefined;
    // The checkbox is only present in the form when edited, so treat
    // its absence as "no change" rather than "set to false". The form
    // always includes a hidden `isWatchmanPresent=1` so we can tell the
    // difference between "not rendered" and "rendered + unchecked".
    const isWatchmanPresent = formData.get('isWatchmanPresent') != null;
    const isWatchman = formData.get('isWatchman') === 'on'
        || formData.get('isWatchman') === 'true';

    // Language override — admin can set or clear a volunteer's preferred language.
    // Value is 'EN', 'ES', or '' (clear/null).
    const languageRaw = ((formData.get('language') as string) || '').trim();
    const languagePresent = formData.get('languagePresent') != null;
    const language: Language | null | undefined = languagePresent
        ? languageRaw === 'EN' || languageRaw === 'ES'
            ? (languageRaw as Language)
            : null          // empty → clear the preference
        : undefined;        // field not rendered → no change

    if (!id) return { error: 'Volunteer id is required.' };
    if (!name) return { error: 'Name is required.' };

    await prisma.volunteer.update({
        where: { id },
        data: {
            name,
            email,
            phone,
            ...(type ? { type } : {}),
            ...(isWatchmanPresent ? { isWatchman } : {}),
            ...(languagePresent ? { language } : {}),
        },
    });

    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

export async function deleteVolunteer(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.volunteer.delete({ where: { id } });
    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

// ─── Assignments ─────────────────────────────────────

export async function createAssignment(formData: FormData) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    const volunteerId = formData.get('volunteerId') as string;
    const roomId = formData.get('roomId') as string;
    const startDate = new Date(formData.get('startDate') as string);
    const endDate = new Date(formData.get('endDate') as string);

    if (!volunteerId || !roomId || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { error: 'All fields are required.' };
    }

    if (endDate <= startDate) {
        return { error: 'End date must be after start date.' };
    }

    // Fetch the volunteer + room with house
    const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { house: true },
    });

    if (!volunteer || !room) {
        return { error: 'Volunteer or room not found.' };
    }

    // Validate house accepts this volunteer type
    if (!room.house.acceptedTypes.includes(volunteer.type)) {
        return { error: `This house does not accept ${volunteer.type.replace('_', ' ').toLowerCase()}s.` };
    }

    // Validate gender mixing: no SINGLE_BROTHER + SINGLE_SISTER in same room during overlapping dates
    const existingAssignments = await prisma.assignment.findMany({
        where: {
            roomId,
            startDate: { lt: endDate },
            endDate: { gt: startDate },
        },
        include: { volunteer: true },
    });

    const conflictingTypes = new Set(existingAssignments.map((a) => a.volunteer.type));
    conflictingTypes.add(volunteer.type);

    if (conflictingTypes.has('SINGLE_BROTHER') && conflictingTypes.has('SINGLE_SISTER')) {
        return { error: 'Single brothers and single sisters cannot share the same room.' };
    }

    // Check room capacity
    if (existingAssignments.length >= room.capacity) {
        return { error: 'This room is already at full capacity for the selected dates.' };
    }

    const newAssignment = await prisma.assignment.create({
        data: { volunteerId, roomId, startDate, endDate },
    });

    // Fire-and-forget: notify the volunteer and the house owners via WhatsApp.
    // A WhatsApp failure must never block the assignment from being saved.
    sendAssignmentConfirmation(newAssignment.id).catch((err) =>
        console.error('[createAssignment] confirmation send failed', err)
    );

    revalidatePath('/planning');
    return { success: true };
}

export async function deleteAssignment(id: string) {
    const authError = await requireAdmin();
    if (authError) return { error: authError };

    await prisma.assignment.delete({ where: { id } });
    revalidatePath('/');
    revalidatePath('/planning');
    return { success: true };
}
