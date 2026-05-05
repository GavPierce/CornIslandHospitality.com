'use server';

import { requireElevatedAccess } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { VolunteerType, Language } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { sendAssignmentConfirmation, sendHospitalityPairingNotification, sendHospitalityCancellationNotification } from '@/lib/reminders';

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
                        include: {
                            volunteer: true,
                            hospitalityMember: {
                                select: { id: true, name: true, phone: true },
                            },
                        },
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
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    const name = formData.get('name') as string;
    const address = formData.get('address') as string;
    const acceptedTypes = formData.getAll('acceptedTypes') as VolunteerType[];
    const ownerIds = formData.getAll('ownerIds') as string[];

    if (!name || !address || acceptedTypes.length === 0) {
        return { error: 'All fields are required.' };
    }

    await prisma.house.create({
        data: {
            name,
            address,
            acceptedTypes,
            owners: ownerIds.length > 0
                ? { create: ownerIds.map((volunteerId) => ({ volunteerId })) }
                : undefined,
        },
    });

    revalidatePath('/planning');
    return { success: true };
}

export async function deleteHouse(id: string) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    await prisma.house.delete({ where: { id } });
    revalidatePath('/planning');
    return { success: true };
}

export async function addHouseOwner(houseId: string, volunteerId: string) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    await prisma.houseOwner.upsert({
        where: { houseId_volunteerId: { houseId, volunteerId } },
        create: { houseId, volunteerId },
        update: {},
    });

    revalidatePath('/planning');
    return { success: true };
}

export async function removeHouseOwner(houseId: string, volunteerId: string) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    await prisma.houseOwner.delete({
        where: { houseId_volunteerId: { houseId, volunteerId } },
    });

    revalidatePath('/planning');
    return { success: true };
}

// ─── Rooms ───────────────────────────────────────────

export async function createRoom(formData: FormData) {
    const authError = await requireElevatedAccess();
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
    const authError = await requireElevatedAccess();
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
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    const name = formData.get('name') as string;
    const email = (formData.get('email') as string) || null;
    const phone = (formData.get('phone') as string) || null;
    const type = formData.get('type') as VolunteerType;
    const isWatchman = formData.get('isWatchman') === 'on'
        || formData.get('isWatchman') === 'true';
    const isHospitality = formData.get('isHospitality') === 'on'
        || formData.get('isHospitality') === 'true';

    if (!name || !type) {
        return { error: 'Name and type are required.' };
    }

    await prisma.volunteer.create({
        data: { name, email, phone, type, isWatchman, isHospitality },
    });

    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

export async function updateVolunteer(formData: FormData) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    const id = (formData.get('id') as string)?.trim();
    const name = (formData.get('name') as string)?.trim();
    const email = ((formData.get('email') as string) || '').trim() || null;
    const phone = ((formData.get('phone') as string) || '').trim() || null;
    const type = (formData.get('type') as VolunteerType) || undefined;

    const isWatchmanPresent = formData.get('isWatchmanPresent') != null;
    const isWatchman = formData.get('isWatchman') === 'on'
        || formData.get('isWatchman') === 'true';

    const isHospitalityPresent = formData.get('isHospitalityPresent') != null;
    const isHospitality = formData.get('isHospitality') === 'on'
        || formData.get('isHospitality') === 'true';

    const languageRaw = ((formData.get('language') as string) || '').trim();
    const languagePresent = formData.get('languagePresent') != null;
    const language: Language | null | undefined = languagePresent
        ? languageRaw === 'EN' || languageRaw === 'ES'
            ? (languageRaw as Language)
            : null
        : undefined;

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
            ...(isHospitalityPresent ? { isHospitality } : {}),
            ...(languagePresent ? { language } : {}),
        },
    });

    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

export async function deleteVolunteer(id: string) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    await prisma.volunteer.delete({ where: { id } });
    revalidatePath('/volunteers');
    revalidatePath('/planning');
    revalidatePath('/watchman');
    return { success: true };
}

// ─── Assignments ─────────────────────────────────────

export async function createAssignment(formData: FormData) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    const volunteerId = formData.get('volunteerId') as string;
    const roomId = formData.get('roomId') as string;
    const startDate = new Date(formData.get('startDate') as string);
    const endDate = new Date(formData.get('endDate') as string);
    const hospitalityMemberId = (formData.get('hospitalityMemberId') as string | null) || null;

    if (!volunteerId || !roomId || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return { error: 'All fields are required.' };
    }

    if (endDate <= startDate) {
        return { error: 'End date must be after start date.' };
    }

    const volunteer = await prisma.volunteer.findUnique({ where: { id: volunteerId } });
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { house: true },
    });

    if (!volunteer || !room) {
        return { error: 'Volunteer or room not found.' };
    }

    if (!room.house.acceptedTypes.includes(volunteer.type)) {
        return { error: `This house does not accept ${volunteer.type.replace('_', ' ').toLowerCase()}s.` };
    }

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

    if (existingAssignments.length >= room.capacity) {
        return { error: 'This room is already at full capacity for the selected dates.' };
    }

    const newAssignment = await prisma.assignment.create({
        data: {
            volunteerId,
            roomId,
            startDate,
            endDate,
            ...(hospitalityMemberId ? { hospitalityMemberId } : {}),
        },
    });

    // Fire-and-forget notifications
    sendAssignmentConfirmation(newAssignment.id).catch((err) =>
        console.error('[createAssignment] confirmation send failed', err)
    );

    revalidatePath('/planning');
    return { success: true };
}

/**
 * Change (or clear) the hospitality member for an existing assignment.
 * Sends a cancellation to the old member (if any) and a pairing
 * notification to the new member (if any). Fire-and-forget.
 */
export async function updateAssignmentHospitality(
    assignmentId: string,
    hospitalityMemberId: string | null,
) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    // Fetch the current assignment to get the old hospitality member
    const current = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
            hospitalityMember: { select: { id: true, name: true, phone: true, language: true } },
            volunteer: { select: { name: true } },
            room: { include: { house: { select: { name: true, address: true } } } },
        },
    });
    if (!current) return { error: 'Assignment not found.' };

    // Persist the change
    await prisma.assignment.update({
        where: { id: assignmentId },
        data: { hospitalityMemberId },
    });

    // Notify old member of cancellation (fire-and-forget)
    if (current.hospitalityMember?.phone && current.hospitalityMember.id !== hospitalityMemberId) {
        sendHospitalityCancellationNotification({
            assignmentId,
            hospitalityMember: current.hospitalityMember as { id: string; name: string; phone: string; language: string | null },
            volunteerName: current.volunteer.name,
            houseName: current.room.house.name,
        }).catch((err) => console.error('[updateAssignmentHospitality] cancellation send failed', err));
    }

    // Notify new member of pairing (fire-and-forget)
    if (hospitalityMemberId) {
        sendHospitalityPairingNotification(assignmentId).catch((err) =>
            console.error('[updateAssignmentHospitality] pairing send failed', err)
        );
    }

    revalidatePath('/planning');
    return { success: true };
}

export async function deleteAssignment(id: string) {
    const authError = await requireElevatedAccess();
    if (authError) return { error: authError };

    await prisma.assignment.delete({ where: { id } });
    revalidatePath('/');
    revalidatePath('/planning');
    return { success: true };
}
