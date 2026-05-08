import 'server-only';

import { mkdirSync } from 'fs';
import { join } from 'path';
import { waLog } from './wa-logs';

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

type WAMessageKey = { remoteJid?: string | null; id?: string | null; fromMe?: boolean | null };
type WAMessageContent = { conversation?: string | null } & Record<string, unknown>;
type WAMessage = {
    key: WAMessageKey;
    message?: WAMessageContent | null;
};

type BaileysSocket = {
    ev: {
        on: (event: string, listener: (...args: unknown[]) => void) => void;
    };
    sendMessage: (
        jid: string,
        content:
            | { text: string }
            | { image: { url: string } | Buffer; caption?: string },
    ) => Promise<WAMessage | undefined>;
    onWhatsApp: (
        ...jids: string[]
    ) => Promise<Array<{ jid: string; exists: boolean }>>;
    logout: () => Promise<void>;
    end: (err?: Error) => void;
};

type ConnectionUpdate = {
    connection?: 'open' | 'connecting' | 'close';
    qr?: string;
    lastDisconnect?: { error?: { message?: string; output?: { statusCode?: number } } };
};

// ── Send queue ────────────────────────────────────────────────
// All outbound WhatsApp messages flow through a single FIFO queue so
// large batches (e.g. assigning a 17-person group) cannot burst dozens
// of messages through the socket in a few seconds. WhatsApp's anti-spam
// flags exactly that pattern on non-business (Web/Baileys) accounts and
// will restrict the account + unlink devices.
//
// The worker waits a randomized delay between sends (and an extra pause
// before media). Delays are env-tunable; defaults are deliberately
// conservative.
type QueueJobKind = 'text' | 'image';
type QueueJob = {
    kind: QueueJobKind;
    toPhone: string;
    text: string;
    imagePath?: string;
    resolve: () => void;
    reject: (err: Error) => void;
};

type SockHolder = {
    sock: BaileysSocket | null;
    state: ConnState;
    qr: string | null;
    lastError: string | null;
    connectedAt: number | null;
    startPromise: Promise<void> | null;
    // Cache of recently sent message contents keyed by `${jid}|${id}`.
    // Baileys calls `getMessage(key)` when a recipient asks for a retry
    // (the "Waiting for this message" state on the recipient's side);
    // we have to hand back the original plaintext so it can re-encrypt
    // and resend with fresh ratchet keys.
    msgCache: Map<string, WAMessageContent>;
    // Serialized send queue (see comment above).
    queue: QueueJob[];
    workerRunning: boolean;
    lastSendAt: number; // epoch ms; 0 means "no prior send, skip inter-send delay"
    // Anti-ban auto-pause. Set when WhatsApp closes the socket with a
    // status code that suggests account restriction. While paused we
    // refuse to send and skip auto-reconnect.
    paused: boolean;
    pauseReason: string | null;
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
        msgCache: new Map(),
        queue: [],
        workerRunning: false,
        lastSendAt: 0,
        paused: false,
        pauseReason: null,
    };
}
const holder = g.__cihWa;
if (!holder.msgCache) holder.msgCache = new Map();
if (!holder.queue) holder.queue = [];
if (typeof holder.workerRunning !== 'boolean') holder.workerRunning = false;
if (typeof holder.lastSendAt !== 'number') holder.lastSendAt = 0;
if (typeof holder.paused !== 'boolean') holder.paused = false;
if (holder.pauseReason === undefined) holder.pauseReason = null;

// ── Throttle config (env-tunable) ─────────────────────────────
function envInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (!v) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}
const WA_MIN_DELAY_MS = envInt('WA_MIN_DELAY_MS', 8000);
const WA_MAX_DELAY_MS = envInt('WA_MAX_DELAY_MS', 15000);
const WA_MEDIA_EXTRA_MIN_MS = envInt('WA_MEDIA_EXTRA_MIN_MS', 3000);
const WA_MEDIA_EXTRA_MAX_MS = envInt('WA_MEDIA_EXTRA_MAX_MS', 5000);

function randBetween(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(min + Math.random() * (max - min));
}

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
        waLog.info(
            `[whatsapp] Using WA Web version ${version.join('.')} (latest=${v.isLatest}).`,
        );
    } catch (err) {
        waLog.warn('[whatsapp] fetchLatestBaileysVersion failed, using built-in default.', err);
    }

    const sock = (makeWASocket as (opts: unknown) => BaileysSocket)({
        auth: state,
        logger: silentLogger(),
        printQRInTerminal: false,
        browser: ['Corn Island Hospitality', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        // Without this callback, recipients (especially iPhones) get
        // stuck on "Waiting for this message" the second time we send
        // them anything: Baileys can't answer their retry receipts and
        // the message is dropped silently. Returning the cached payload
        // lets Baileys re-encrypt with fresh ratchet keys and resend.
        getMessage: async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
            // Key by message id alone. Retry receipts from iPhones often
            // arrive with the recipient's LID (`<lid>@lid`) rather than
            // the phone-number jid we originally sent to, so jid-based
            // keys always miss. Message ids are globally unique enough
            // on their own for our send volume.
            const cacheKey = key.id ?? '';
            const hit = cacheKey ? holder.msgCache.get(cacheKey) : undefined;
            waLog.info(
                `[whatsapp] getMessage retry-receipt jid=${key.remoteJid} id=${key.id} ` +
                    `cache=${hit ? 'HIT' : 'MISS'} cacheSize=${holder.msgCache.size}`,
            );
            return hit;
        },
        ...(version ? { version } : {}),
    });

    holder.sock = sock;

    sock.ev.on('creds.update', () => {
        saveCreds().catch((err) => {
            waLog.error('[whatsapp] saveCreds failed', err);
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
            waLog.info('[whatsapp] Connected.');
            // Kick the queue worker in case jobs were enqueued while we
            // were reconnecting.
            if (!holder.workerRunning && holder.queue.length > 0) {
                runQueueWorker().catch((err) => {
                    waLog.error('[whatsapp.queue] worker crashed', err);
                });
            }
        } else if (u.connection === 'close') {
            const code = u.lastDisconnect?.error?.output?.statusCode;
            const message = u.lastDisconnect?.error?.message ?? null;
            const loggedOut = code === DisconnectReason.loggedOut;
            // Suspicious close codes that often accompany account
            // restrictions / bans on Baileys (Web) sessions. We refuse
            // to auto-reconnect and refuse to keep sending so we don't
            // dig the hole deeper. Admin must manually reset.
            const SUSPICIOUS_CODES = new Set<number>([401, 403, 440]);
            const suspicious =
                loggedOut ||
                (typeof code === 'number' && SUSPICIOUS_CODES.has(code));
            holder.sock = null;
            holder.state = 'disconnected';
            holder.lastError = message;
            holder.connectedAt = null;
            waLog.warn(`[whatsapp] Disconnected (code=${code}, loggedOut=${loggedOut}).`);
            if (suspicious) {
                holder.paused = true;
                holder.pauseReason =
                    `Suspicious disconnect (code=${code}${loggedOut ? ', loggedOut' : ''}). ` +
                    `Sending paused to avoid ban escalation. Manual reset required.`;
                holder.qr = null;
                waLog.error(
                    `[whatsapp] PAUSED — ${holder.pauseReason} ` +
                        `Drained queue size=${holder.queue.length}.`,
                );
                // Reject all pending queued jobs so callers stop awaiting.
                const pending = holder.queue.splice(0, holder.queue.length);
                for (const job of pending) {
                    job.reject(
                        new Error(
                            `WhatsApp sending paused (suspicious disconnect, code=${code}).`,
                        ),
                    );
                }
            } else {
                // Auto-reconnect after a short backoff.
                setTimeout(() => {
                    ensureWhatsAppStarted().catch((err) => {
                        waLog.error('[whatsapp] Reconnect failed', err);
                    });
                }, 3000);
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
    // If sending is paused because of a suspicious disconnect, refuse
    // to auto-start. Otherwise the 2s status-page poll creates an
    // infinite reconnect → 401 → pause loop that spams the logs and
    // hammers WhatsApp with the banned credentials. Manual reset is
    // required to clear `paused` and proceed.
    if (holder.paused) {
        waLog.warn(
            `[whatsapp] ensureWhatsAppStarted refused — paused: ${holder.pauseReason ?? 'unknown'}`,
        );
        return;
    }
    if (holder.startPromise) {
        await holder.startPromise;
        return;
    }
    holder.state = 'connecting';
    holder.startPromise = startSocket()
        .catch((err) => {
            waLog.error('[whatsapp] Failed to start socket', err);
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
    paused: boolean;
    pauseReason: string | null;
    queueDepth: number;
};

export function getWhatsAppStatus(): WhatsAppStatus {
    return {
        state: holder.state,
        qr: holder.qr,
        lastError: holder.lastError,
        connectedAt: holder.connectedAt,
        paused: holder.paused,
        pauseReason: holder.pauseReason,
        queueDepth: holder.queue.length,
    };
}

/**
 * Force the socket to log out (invalidates stored credentials) and reset
 * state. The next `ensureWhatsAppStarted()` will produce a fresh QR.
 */
export async function resetWhatsApp(): Promise<void> {
    if (holder.sock) {
        // logout() can hang indefinitely if the socket is mid-handshake
        // (state='connecting' but not yet authenticated) — race it
        // against a short timeout so the admin "Unlink" button never
        // blocks the HTTP response.
        try {
            await Promise.race([
                holder.sock.logout(),
                new Promise<void>((resolve) => setTimeout(resolve, 2500)),
            ]);
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
    // Critical: clear any in-flight startPromise. Without this, a
    // subsequent ensureWhatsAppStarted() will await the old (possibly
    // rejected or already-resolved) promise and silently no-op instead
    // of spinning up a fresh socket — exactly what makes the "Unlink &
    // re-pair" button appear to do nothing.
    holder.startPromise = null;
    // Manual reset clears the anti-ban pause. Operator is asserting
    // they want a fresh session; let the queue start flowing again as
    // soon as we reconnect.
    holder.paused = false;
    holder.pauseReason = null;
    // Wipe persisted credentials on disk so the next start cannot
    // silently re-use the (now invalidated) session and skip the QR
    // step. Without this, after a soft-reset Baileys often re-loads
    // the cached creds and re-connects to the same restricted account.
    //
    // Delete the CONTENTS of the auth dir rather than the dir itself —
    // in Docker/Coolify deployments AUTH_DIR is typically a volume
    // mount point owned by root, so `rmdir` on it fails with EACCES
    // even though the files inside are writable by the app user.
    try {
        const { readdirSync, rmSync } = await import('fs');
        const { join: joinPath } = await import('path');
        let entries: string[] = [];
        try {
            entries = readdirSync(AUTH_DIR);
        } catch {
            // dir doesn't exist yet — nothing to clear
        }
        for (const name of entries) {
            try {
                rmSync(joinPath(AUTH_DIR, name), { recursive: true, force: true });
            } catch (err) {
                waLog.warn(
                    `[whatsapp] Could not remove ${name} from auth dir: ${(err as Error).message}`,
                );
            }
        }
        waLog.info(`[whatsapp] Cleared auth dir contents at ${AUTH_DIR} (${entries.length} entries).`);
    } catch (err) {
        waLog.warn(`[whatsapp] Failed to clear auth dir: ${(err as Error).message}`);
    }
}

// ── Queue worker ──────────────────────────────────────────────
// Single worker; processes one job at a time with conservative
// randomized inter-send delays. Started lazily by enqueue().
async function runQueueWorker(): Promise<void> {
    if (holder.workerRunning) return;
    holder.workerRunning = true;
    try {
        while (holder.queue.length > 0) {
            if (holder.paused) {
                const dropped = holder.queue.splice(0, holder.queue.length);
                waLog.warn(
                    `[whatsapp.queue] paused — dropping ${dropped.length} queued sends`,
                );
                for (const job of dropped) {
                    job.reject(
                        new Error(
                            `WhatsApp sending paused: ${holder.pauseReason ?? 'unknown reason'}`,
                        ),
                    );
                }
                break;
            }

            // Ensure connection. ensureWhatsAppStarted resolves when the
            // socket is created; wait briefly for state to leave
            // 'connecting'.
            await ensureWhatsAppStarted();
            const MAX_WAIT_MS = 15_000;
            let waited = 0;
            while (holder.state === 'connecting' && waited < MAX_WAIT_MS) {
                await new Promise((r) => setTimeout(r, 500));
                waited += 500;
            }
            if (holder.state !== 'connected' || !holder.sock) {
                // Reject only the head job; leave the rest queued so a
                // later reconnect can drain them. (Callers already treat
                // a rejection as "send failed".)
                const job = holder.queue.shift()!;
                job.reject(
                    new Error(`WhatsApp not connected (state=${holder.state})`),
                );
                continue;
            }

            const job = holder.queue.shift()!;

            // Inter-send delay: skip on the very first send (queue was
            // idle) so OTPs etc. don't pay an 8–15s tax when nothing
            // else is happening.
            const now = Date.now();
            if (holder.lastSendAt > 0) {
                const sinceLast = now - holder.lastSendAt;
                const baseDelay = randBetween(WA_MIN_DELAY_MS, WA_MAX_DELAY_MS);
                const remaining = Math.max(0, baseDelay - sinceLast);
                if (remaining > 0) {
                    waLog.info(
                        `[whatsapp.queue] sending after ${remaining}ms delay ` +
                            `kind=${job.kind} queueDepth=${holder.queue.length}`,
                    );
                    await new Promise((r) => setTimeout(r, remaining));
                }
            }
            // Extra pause before media — image sends are higher-risk.
            if (job.kind === 'image') {
                const extra = randBetween(
                    WA_MEDIA_EXTRA_MIN_MS,
                    WA_MEDIA_EXTRA_MAX_MS,
                );
                await new Promise((r) => setTimeout(r, extra));
            }

            // Re-check pause after the wait — a suspicious disconnect
            // may have fired during the delay.
            if (holder.paused) {
                job.reject(
                    new Error(
                        `WhatsApp sending paused: ${holder.pauseReason ?? 'unknown reason'}`,
                    ),
                );
                continue;
            }

            try {
                if (job.kind === 'image' && job.imagePath) {
                    await sendWhatsAppImageDirect(job.toPhone, job.imagePath, job.text);
                } else {
                    await sendWhatsAppTextDirect(job.toPhone, job.text);
                }
                holder.lastSendAt = Date.now();
                job.resolve();
            } catch (err) {
                holder.lastSendAt = Date.now();
                job.reject(err as Error);
            }
        }
    } finally {
        holder.workerRunning = false;
    }
}

function enqueueSend(job: Omit<QueueJob, 'resolve' | 'reject'>): Promise<void> {
    if (holder.paused) {
        return Promise.reject(
            new Error(
                `WhatsApp sending paused: ${holder.pauseReason ?? 'unknown reason'}`,
            ),
        );
    }
    return new Promise<void>((resolve, reject) => {
        holder.queue.push({ ...job, resolve, reject });
        waLog.info(
            `[whatsapp.queue] enqueued kind=${job.kind} to=${job.toPhone} ` +
                `queueDepth=${holder.queue.length}`,
        );
        runQueueWorker().catch((err) => {
            waLog.error('[whatsapp.queue] worker crashed', err);
        });
    });
}

/**
 * Public send: enqueues a text message on the global throttled queue.
 * Resolves when the worker actually transmits, rejects on failure.
 */
export async function sendWhatsAppText(toPhone: string, text: string): Promise<void> {
    return enqueueSend({ kind: 'text', toPhone, text });
}

/**
 * Low-level send (no queue). Dispatches arbitrary text to a phone via
 * WhatsApp. Used by the queue worker. Throws if the socket isn't
 * connected or the send fails.
 */
async function sendWhatsAppTextDirect(toPhone: string, text: string): Promise<void> {
    await ensureWhatsAppStarted();
    if (holder.state !== 'connected' || !holder.sock) {
        throw new Error(`WhatsApp not connected (state=${holder.state})`);
    }
    const jid = toPhone.replace(/^\+/, '') + '@s.whatsapp.net';
    // Confirm this number is actually registered on WhatsApp. Without
    // this check, sending to a non-WA number (or a wrong number) goes
    // out as a single-checkmark message that never gets delivered and
    // produces no error — which makes it impossible to debug.
    try {
        const [reg] = await holder.sock.onWhatsApp(jid);
        if (!reg?.exists) {
            throw new Error(
                `Number ${toPhone} is not registered on WhatsApp (jid=${jid}).`,
            );
        }
        // Baileys returns the canonical JID it knows for this number;
        // use that — for some users it'll differ from the raw phone
        // (LID-based accounts, ported numbers, etc.).
        if (reg.jid && reg.jid !== jid) {
            waLog.info(`[whatsapp] using canonical jid ${reg.jid} for ${toPhone}`);
        }
    } catch (err) {
        // Re-throw "not registered" errors as-is; for any other lookup
        // failure (network blip, etc.) log and proceed — the send
        // itself will surface a different error if it really can't
        // reach the recipient.
        if ((err as Error).message?.includes('not registered')) throw err;
        waLog.warn('[whatsapp] onWhatsApp lookup failed, proceeding with send', err);
    }
    const sent = await holder.sock.sendMessage(jid, { text });
    // Stash the plaintext so Baileys can answer any retry receipts the
    // recipient sends back. Keep the cache bounded — 500 entries is more
    // than enough for our send volume and avoids unbounded growth.
    if (sent?.key?.id) {
        // See getMessage above — key by id alone so retry receipts that
        // arrive with the recipient's LID jid still hit.
        const cacheKey = sent.key.id;
        holder.msgCache.set(cacheKey, { conversation: text });
        if (holder.msgCache.size > 500) {
            const firstKey = holder.msgCache.keys().next().value;
            if (firstKey !== undefined) holder.msgCache.delete(firstKey);
        }
        waLog.info(
            `[whatsapp] sent jid=${sent.key.remoteJid ?? jid} id=${sent.key.id} ` +
                `cacheSize=${holder.msgCache.size}`,
        );
    } else {
        waLog.warn(`[whatsapp] sendMessage returned no key for jid=${jid} — retries will fail`);
    }
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
        waLog.warn(
            `[whatsapp] OTP send failed (${(err as Error).message}); logging instead. ` +
                `to=${toPhone} code=${code}`,
        );
    }
}

/**
 * Public send: enqueues an image message on the global throttled queue.
 * Useful for maps, QR codes, or instructional graphics.
 */
export async function sendWhatsAppImage(toPhone: string, imagePath: string, caption?: string): Promise<void> {
    return enqueueSend({
        kind: 'image',
        toPhone,
        text: caption ?? '',
        imagePath,
    });
}

/**
 * Low-level image send (no queue). Used by the queue worker.
 */
async function sendWhatsAppImageDirect(toPhone: string, imagePath: string, caption?: string): Promise<void> {
    await ensureWhatsAppStarted();
    if (holder.state !== 'connected' || !holder.sock) {
        throw new Error(`WhatsApp not connected (state=${holder.state})`);
    }
    
    const jid = toPhone.replace(/^\+/, '') + '@s.whatsapp.net';
    
    try {
        const [reg] = await holder.sock.onWhatsApp(jid);
        if (!reg?.exists) {
            throw new Error(`Number ${toPhone} is not registered on WhatsApp.`);
        }
    } catch (err) {
        if ((err as Error).message?.includes('not registered')) throw err;
        waLog.warn('[whatsapp] onWhatsApp lookup failed, proceeding with send', err);
    }

    try {
        const sent = await holder.sock.sendMessage(jid, {
            image: { url: imagePath },
            caption: caption ?? '',
        });

        if (sent?.key?.id) {
            // Cache the *actual* message proto returned by Baileys — for
            // image sends this includes the `imageMessage` block with the
            // media key. If we cache a synthesized {conversation: caption}
            // here, retry receipts can't be answered (Baileys would try
            // to re-send a text message instead of the image) and the
            // recipient is stuck on "Waiting for this message" forever.
            const cached = (sent.message ?? { conversation: caption ?? '' }) as WAMessageContent;
            holder.msgCache.set(sent.key.id, cached);
            if (holder.msgCache.size > 500) {
                const firstKey = holder.msgCache.keys().next().value;
                if (firstKey !== undefined) holder.msgCache.delete(firstKey);
            }
            waLog.info(
                `[whatsapp] sent image jid=${sent.key.remoteJid ?? jid} id=${sent.key.id} ` +
                    `cacheSize=${holder.msgCache.size}`,
            );
        } else {
            waLog.warn(
                `[whatsapp] sendMessage(image) returned no key for jid=${jid} — retries will fail`,
            );
        }
    } catch (err) {
        waLog.error(`[whatsapp] Failed to send image to ${toPhone}`, err);
        throw err;
    }
}
