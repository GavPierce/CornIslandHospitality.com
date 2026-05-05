import 'server-only';

/**
 * Ring buffer of recent WhatsApp transport log lines.
 *
 * The admin /admin/whatsapp-setup page polls these via an API route so
 * you can debug delivery issues without SSH-ing into the prod container
 * to tail Docker logs. The buffer lives on `globalThis` so it survives
 * Next.js dev HMR and Next.js's per-request module caching.
 *
 * Memory footprint is bounded at MAX_ENTRIES (default 300) — enough to
 * cover several minutes of real activity.
 */

const MAX_ENTRIES = 300;

export type WaLogLevel = 'info' | 'warn' | 'error';

export type WaLogEntry = {
    ts: number; // epoch ms
    level: WaLogLevel;
    message: string;
};

type Holder = { entries: WaLogEntry[] };

const g = globalThis as unknown as { __cihWaLogs?: Holder };
if (!g.__cihWaLogs) g.__cihWaLogs = { entries: [] };
const holder = g.__cihWaLogs;

function push(level: WaLogLevel, message: string): void {
    holder.entries.push({ ts: Date.now(), level, message });
    if (holder.entries.length > MAX_ENTRIES) {
        holder.entries.splice(0, holder.entries.length - MAX_ENTRIES);
    }
}

/**
 * Log + record. Use these instead of `console.*` in the WhatsApp
 * transport so the messages also show up in the admin logs panel.
 */
export const waLog = {
    info(message: string): void {
        push('info', message);
        console.log(message);
    },
    warn(message: string, err?: unknown): void {
        const full = err ? `${message} ${formatErr(err)}` : message;
        push('warn', full);
        console.warn(message, ...(err ? [err] : []));
    },
    error(message: string, err?: unknown): void {
        const full = err ? `${message} ${formatErr(err)}` : message;
        push('error', full);
        console.error(message, ...(err ? [err] : []));
    },
};

function formatErr(err: unknown): string {
    if (err instanceof Error) return `${err.name}: ${err.message}`;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

/**
 * Return all buffered log entries, oldest first. Optionally filter to
 * entries newer than `sinceTs` so the client can incrementally fetch
 * just what it doesn't already have.
 */
export function getWaLogs(sinceTs?: number): WaLogEntry[] {
    if (sinceTs === undefined) return [...holder.entries];
    return holder.entries.filter((e) => e.ts > sinceTs);
}

/** Clear the buffer. Used by the admin "clear logs" button. */
export function clearWaLogs(): void {
    holder.entries.length = 0;
}
