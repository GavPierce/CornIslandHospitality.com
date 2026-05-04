'use server';

import { prisma } from '@/lib/prisma';
import { adminPhoneSet, normalizePhone } from '@/lib/phone';
import { getSession } from '@/lib/session';

/**
 * First-run admin bootstrap. Creates the very first `Volunteer` row
 * (flagged `isWatchman`) so the operator can log in via WhatsApp OTP.
 *
 * Authorization is the same as `/admin/whatsapp-setup`:
 *   - active admin session, OR
 *   - `token` matching the `WA_SETUP_TOKEN` env var.
 *
 * As an additional safety net, this action **refuses to run once any
 * Volunteer already exists** — at that point the regular admin UI
 * should be used. This means an attacker who somehow learns the token
 * can't sneak in a new admin row to escalate privileges after the
 * system is in use.
 */
export async function bootstrapFirstAdmin(input: {
    name: string;
    phone: string;
    token: string;
}): Promise<
    | { ok: true; phoneE164: string; isAdmin: boolean }
    | { error: string }
> {
    const name = input.name.trim();
    if (!name) return { error: 'Name is required.' };

    const phoneE164 = normalizePhone(input.phone);
    if (!phoneE164) {
        return { error: 'Phone number is invalid. Use E.164 format like +50588881111.' };
    }

    // Authorization — same rules as the WhatsApp setup page.
    const session = await getSession();
    const expected = process.env.WA_SETUP_TOKEN;
    const tokenOk = Boolean(expected && input.token && input.token === expected);
    if (!session?.isAdmin && !tokenOk) {
        return { error: 'Unauthorized.' };
    }

    // Hard refusal once the system has any users — the bootstrap door
    // is closed for good and they should use the normal UI.
    const volunteerCount = await prisma.volunteer.count();
    if (volunteerCount > 0) {
        return {
            error:
                'System is already initialized. Use the regular admin UI to add users.',
        };
    }

    // Create the row. Phone is stored in E.164 so it matches what the
    // login flow normalizes to. Default to SINGLE_BROTHER + isWatchman
    // so the first user can sign in and manage everything else.
    await prisma.volunteer.create({
        data: {
            name,
            phone: phoneE164,
            type: 'SINGLE_BROTHER',
            isWatchman: true,
        },
    });

    const isAdmin = adminPhoneSet().has(phoneE164);
    return { ok: true, phoneE164, isAdmin };
}
