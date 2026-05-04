'use server';

import { createHash, randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';
import { adminPhoneSet, normalizePhone } from '@/lib/phone';
import { createSession, destroySession, type IdentityType } from '@/lib/session';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
}

function sixDigitCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

type OtpRow = {
    id: string;
    phone: string;
    codeHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    attempts: number;
    createdAt: Date;
};

// ─── Prisma access with loose types ────────────────────────────
// The generated Prisma client types aren't available in this checkout,
// so we access the new models via `any`-cast wrappers. The runtime
// behaviour matches the schema defined in prisma/schema.prisma.

function authOtp() {
    return (prisma as unknown as {
        authOtp: {
            create: (args: { data: Record<string, unknown> }) => Promise<OtpRow>;
            findFirst: (args: {
                where: Record<string, unknown>;
                orderBy?: Record<string, unknown>;
            }) => Promise<OtpRow | null>;
            update: (args: {
                where: { id: string };
                data: Record<string, unknown>;
            }) => Promise<OtpRow>;
        };
    }).authOtp;
}

// ─── Identity lookup ───────────────────────────────────────────

type Identity = {
    type: IdentityType;
    id: string;
    name: string;
};

/**
 * Look up a person by phone in the Volunteer table. Stored phones are
 * normalized before comparison so values like "+505 8888-6666" or
 * "(505) 8888-6666" still match.
 *
 * Watchmen are represented as Volunteers with `isWatchman = true`, so
 * there is only one table to search here.
 */
async function findIdentityByPhone(phoneE164: string): Promise<Identity | null> {
    const volunteers = await prisma.volunteer.findMany({
        where: { phone: { not: null } },
        select: { id: true, name: true, phone: true },
    });
    for (const v of volunteers) {
        if (normalizePhone(v.phone) === phoneE164) {
            return { type: 'VOLUNTEER', id: v.id, name: v.name };
        }
    }

    return null;
}

// ─── Server actions ────────────────────────────────────────────

export async function requestOtp(
    rawPhone: string,
): Promise<{ error?: string; phone?: string }> {
    const phone = normalizePhone(rawPhone);
    if (!phone) {
        return { error: 'Please enter a valid phone number.' };
    }

    const identity = await findIdentityByPhone(phone);
    if (!identity) {
        return {
            error:
                "We couldn't find that phone number. Ask your administrator to add you first.",
        };
    }

    // Rate-limit: if a code was issued within the cooldown window, reject.
    const recent = await authOtp().findFirst({
        where: { phone, consumedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    if (
        recent &&
        Date.now() - recent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
        const secs = Math.ceil(
            (OTP_RESEND_COOLDOWN_MS -
                (Date.now() - recent.createdAt.getTime())) /
                1000,
        );
        return {
            error: `Please wait ${secs} seconds before requesting another code.`,
        };
    }

    const code = sixDigitCode();
    await authOtp().create({
        data: {
            phone,
            codeHash: hashCode(code),
            expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
    });

    // Send via WhatsApp (or log to console if Twilio env vars are missing).
    const { sendWhatsAppOtp } = await import('@/lib/whatsapp');
    try {
        await sendWhatsAppOtp(phone, code);
    } catch (err) {
        console.error('[auth] Failed to send WhatsApp OTP', err);
        return {
            error: 'We could not send the code right now. Please try again shortly.',
        };
    }

    return { phone };
}

export async function verifyOtp(
    rawPhone: string,
    rawCode: string,
): Promise<{ error?: string; success?: boolean }> {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { error: 'Invalid phone number.' };

    const code = (rawCode || '').trim();
    if (!/^\d{6}$/.test(code)) {
        return { error: 'Enter the 6-digit code from WhatsApp.' };
    }

    const otp = await authOtp().findFirst({
        where: { phone, consumedAt: null },
        orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
        return { error: 'No active code. Request a new one.' };
    }
    if (otp.expiresAt.getTime() <= Date.now()) {
        return { error: 'This code has expired. Request a new one.' };
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        return { error: 'Too many attempts. Request a new code.' };
    }

    if (hashCode(code) !== otp.codeHash) {
        await authOtp().update({
            where: { id: otp.id },
            data: { attempts: otp.attempts + 1 },
        });
        return { error: 'Incorrect code. Please try again.' };
    }

    // Mark consumed + resolve identity.
    await authOtp().update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
    });

    const identity = await findIdentityByPhone(phone);
    if (!identity) {
        // Admin removed the phone between request and verify.
        return {
            error:
                'Your access was removed. Please contact your administrator.',
        };
    }

    const admins = adminPhoneSet();
    await createSession({
        phone,
        name: identity.name,
        identityType: identity.type,
        identityId: identity.id,
        isAdmin: admins.has(phone),
    });

    return { success: true };
}

export async function logout(): Promise<void> {
    await destroySession();
}
