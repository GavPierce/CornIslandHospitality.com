import 'server-only';

import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * WhatsApp transport using Baileys (a headless WhatsApp Web client).
 *
 * Design notes
 * ─────────────
 * - A single WhatsApp socket is kept alive for the lifetime of the Node
 *   process. It's stashed on `globalThis` so that Next.js dev HMR doesn't
 *   spawn multiple concurrent sockets (which WhatsApp would reject).
 * - Authentication state lives in `WA_AUTH_DIR` (default `./wa-auth`).
 *   Mount this directory as a persistent volume in production; losing it
 *   means you have to re-scan the QR code to re-link the device.
 * - On first run the socket has no credentials. It emits a QR string via
 *   `connection.update`; we cache it and expose it through
 *   `getWhatsAppStatus()` so the admin setup page can render it.
 * - Disconnects auto-reconnect after a short delay unless WhatsApp tells
 *   us the session was logged out (in which case the stored creds are
 *   discarded and the next connect will show a fresh QR).
 */

// ── Types & module-singleton state ────────────────────────────
type ConnState = 'disconnected' | 'connecting' | 'qr' | 'connected';

type BaileysSocket = {
    ev: {
        on: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
    logout: () => Promise<void>;
    end: (err?: Error) => void;
};

type ConnectionUpdate = {
    connection?: 'open' | 'connecting' | 'close';
    qr?: string;
    lastDisconnect?: { error?: { message?: string; output?: { statusCode?: number } } };
};

type SockHolder = {
    sock: BaileysSocket | null;
    state: ConnState;
    qr: string | null;
    lastError: string | null;
    connectedAt: number | null;
    startPromise: Promise<void> | null;
};

const g = globalThis as unknown as { __cihWa?: SockHolder };
if (!g.__cihWa) {
    g.__cihWa = {
        sock: null,
        state: 'disconnected',
        qr: null,
        lastError: null,
        connectedAt: null,
        startPromise: null,
    };
}
const holder = g.__cihWa;

const AUTH_DIR = process.env.WA_AUTH_DIR || join(process.cwd(), 'wa-auth');

// ── Baileys expects a pino-like logger. We stub out every method so
//    the server console isn't flooded with protocol chatter.
function silentLogger(): unknown {
    const noop = () => {};
    const base: Record<string, unknown> = {
        level: 'silent',
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
        fatal: noop,
    };
    base.child = () => base;
    return base;
}

async function startSocket(): Promise<void> {
    // Dynamic import: keeps Baileys out of any non-node bundle (the Edge
    // middleware in particular).
    const baileys = await import('@whiskeysockets/baileys');
    // The package uses a CJS default export; both shapes are possible
    // depending on bundler, so fall back to the namespace itself.
    const makeWASocket =
        (baileys as unknown as { default?: unknown }).default ??
        (baileys as unknown as { makeWASocket?: unknown }).makeWASocket ??
        baileys;
    const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
        baileys as unknown as {
            useMultiFileAuthState: (dir: string) => Promise<{
                state: unknown;
                saveCreds: () => Promise<void>;
            }>;
            DisconnectReason: { loggedOut: number };
            fetchLatestBaileysVersion: () => Promise<{
                version: [number, number, number];
                isLatest: boolean;
            }>;
        };

    mkdirSync(AUTH_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // WhatsApp rejects outdated web-client protocol versions with a 405
    // close code. Pulling the current version from Baileys' hosted JSON
    // fixes that without requiring constant dependency bumps.
    let version: [number, number, number] | undefined;
    try {
        const v = await fetchLatestBaileysVersion();
        version = v.version;
        console.log(
            `[whatsapp] Using WA Web version ${version.join('.')} (latest=${v.isLatest}).`,
        );
    } catch (err) {
        console.warn('[whatsapp] fetchLatestBaileysVersion failed, using built-in default.', err);
    }

    const sock = (makeWASocket as (opts: unknown) => BaileysSocket)({
        auth: state,
        logger: silentLogger(),
        printQRInTerminal: false,
        browser: ['Corn Island Hospitality', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        ...(version ? { version } : {}),
    });

    holder.sock = sock;

    sock.ev.on('creds.update', () => {
        saveCreds().catch((err) => {
            console.error('[whatsapp] saveCreds failed', err);
        });
    });

    sock.ev.on('connection.update', (...args: unknown[]) => {
        const u = args[0] as ConnectionUpdate;
        if (u.qr) {
            holder.qr = u.qr;
            holder.state = 'qr';
        }
        if (u.connection === 'open') {
            holder.state = 'connected';
            holder.qr = null;
            holder.lastError = null;
            holder.connectedAt = Date.now();
            console.log('[whatsapp] Connected.');
        } else if (u.connection === 'close') {
            const code = u.lastDisconnect?.error?.output?.statusCode;
            const message = u.lastDisconnect?.error?.message ?? null;
            const loggedOut = code === DisconnectReason.loggedOut;
            holder.sock = null;
            holder.state = 'disconnected';
            holder.lastError = message;
            holder.connectedAt = null;
            console.warn(`[whatsapp] Disconnected (code=${code}, loggedOut=${loggedOut}).`);
            if (!loggedOut) {
                // Auto-reconnect after a short backoff.
                setTimeout(() => {
                    ensureWhatsAppStarted().catch((err) => {
                        console.error('[whatsapp] Reconnect failed', err);
                    });
                }, 3000);
            } else {
                // Session invalidated on the phone side. Drop the QR so
                // the admin page will request a fresh one next start.
                holder.qr = null;
            }
        }
    });
}

/**
 * Start the socket if it isn't already. Idempotent & safe to call from
 * many places concurrently.
 */
export async function ensureWhatsAppStarted(): Promise<void> {
    if (holder.sock || holder.state === 'connected') return;
    if (holder.startPromise) {
        await holder.startPromise;
        return;
    }
    holder.state = 'connecting';
    holder.startPromise = startSocket()
        .catch((err) => {
            console.error('[whatsapp] Failed to start socket', err);
            holder.state = 'disconnected';
            holder.lastError = (err as Error)?.message ?? 'unknown error';
        })
        .finally(() => {
            holder.startPromise = null;
        });
    await holder.startPromise;
}

export type WhatsAppStatus = {
    state: ConnState;
    qr: string | null;
    lastError: string | null;
    connectedAt: number | null;
};

export function getWhatsAppStatus(): WhatsAppStatus {
    return {
        state: holder.state,
        qr: holder.qr,
        lastError: holder.lastError,
        connectedAt: holder.connectedAt,
    };
}

/**
 * Force the socket to log out (invalidates stored credentials) and reset
 * state. The next `ensureWhatsAppStarted()` will produce a fresh QR.
 */
export async function resetWhatsApp(): Promise<void> {
    if (holder.sock) {
        try {
            await holder.sock.logout();
        } catch {
            // ignore — we're tearing it down anyway
        }
        try {
            holder.sock.end(new Error('manual reset'));
        } catch {
            // ignore
        }
    }
    holder.sock = null;
    holder.state = 'disconnected';
    holder.qr = null;
    holder.connectedAt = null;
}

/**
 * Low-level send. Dispatches arbitrary text to a phone via WhatsApp.
 * Throws if the socket isn't connected or the send fails — callers that
 * want a fallback (like the OTP flow) should wrap this in a try/catch.
 */
export async function sendWhatsAppText(toPhone: string, text: string): Promise<void> {
    await ensureWhatsAppStarted();
    if (holder.state !== 'connected' || !holder.sock) {
        throw new Error(`WhatsApp not connected (state=${holder.state})`);
    }
    const jid = toPhone.replace(/^\+/, '') + '@s.whatsapp.net';
    await holder.sock.sendMessage(jid, { text });
}

/**
 * Send the login OTP to the given phone. If the socket isn't connected
 * (e.g. WhatsApp is mid-reconnect or hasn't been paired yet) the code is
 * logged to the server console as a fallback so the admin can still get
 * in.
 */
export async function sendWhatsAppOtp(toPhone: string, code: string): Promise<void> {
    const body =
        `Corn Island Hospitality — your verification code is ${code}. ` +
        `It expires in 10 minutes. If you didn't request this, you can ignore this message.`;
    try {
        await sendWhatsAppText(toPhone, body);
    } catch (err) {
        console.warn(
            `[whatsapp] OTP send failed (${(err as Error).message}); logging instead.\n` +
                `           to=${toPhone} code=${code}`,
        );
    }
}
