import 'server-only';

import { prisma } from './prisma';

/**
 * Tiny key/value store backed by the `AppSetting` table. Used for
 * runtime flags an admin can flip without redeploying — currently just
 * the reminders kill switch.
 */

const KEY_REMINDERS_ENABLED = 'reminders.enabled';

async function readSetting(key: string): Promise<string | null> {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
    await prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
    });
}

/**
 * Whether the daily reminder cron + manual run-reminders endpoint are
 * allowed to send messages. Defaults to `true` (enabled) when no value
 * has ever been written, which is what we want on a fresh install.
 */
export async function getRemindersEnabled(): Promise<boolean> {
    const v = await readSetting(KEY_REMINDERS_ENABLED);
    if (v === null) return true;
    return v === 'true';
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
    await writeSetting(KEY_REMINDERS_ENABLED, enabled ? 'true' : 'false');
}
