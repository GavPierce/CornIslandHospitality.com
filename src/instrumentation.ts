/**
 * Next.js boot hook. Runs once per server start (both `next dev` and
 * `next start`). Used here to:
 *   - warm up the WhatsApp (Baileys) socket so that pairing / reconnects
 *     happen in the background, without waiting for the first user
 *     request;
 *   - schedule the daily reminder cron job.
 *
 * Guarded to the Node runtime so it doesn't attempt to run in the Edge
 * middleware bundle.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    // Start WhatsApp socket in the background. If pairing is needed the
    // admin page will show a QR; otherwise it just reconnects using the
    // persisted session in `WA_AUTH_DIR`.
    try {
        const { ensureWhatsAppStarted } = await import('./lib/whatsapp');
        ensureWhatsAppStarted().catch((err) => {
            console.error('[instrumentation] WhatsApp start failed', err);
        });
    } catch (err) {
        console.error('[instrumentation] Failed to load whatsapp module', err);
    }

    // Start the reminder scheduler.
    try {
        const { startReminderScheduler } = await import('./lib/reminders');
        await startReminderScheduler();
    } catch (err) {
        console.error('[instrumentation] Reminder scheduler failed to start', err);
    }
}
