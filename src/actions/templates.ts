'use server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getTemplate(key: string): Promise<string | null> {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
}

export async function getAllTemplates(): Promise<Record<string, string>> {
    await requireAdmin();
    const rows = await prisma.appSetting.findMany({
        where: { key: { startsWith: 'template.' } }
    });
    const map: Record<string, string> = {};
    for (const r of rows) {
        map[r.key] = r.value;
    }
    return map;
}

export async function saveTemplate(key: string, value: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireAdmin();
        if (!key.startsWith('template.')) {
            return { success: false, error: 'Invalid template key' };
        }
        await prisma.appSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: (err as Error).message };
    }
}
