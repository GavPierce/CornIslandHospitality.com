'use client';

import { useTranslation } from '@/i18n/LanguageContext';
import {
    SHIFT_SLOT_ORDER,
    SHIFT_SLOT_TIMES,
    allowedSlotsForWeekday,
} from '@/lib/watchman';
import type { ShiftSlot } from '@prisma/client';

type Shift = {
    id: string;
    watchmanId: string;
    date: Date | string;
    slot: ShiftSlot;
    notes: string | null;
    watchman: { id: string; name: string };
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shiftDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function toDateKey(year: number, month: number, day: number): string {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export default function WatchmanPdfButton({
    year,
    month,
    shifts,
}: {
    year: number;
    month: number;
    shifts: Shift[];
}) {
    const { locale, t } = useTranslation();

    function slotLabel(slot: ShiftSlot): string {
        const labels = t.watchman.slots;
        switch (slot) {
            case 'MORNING': return labels.morning;
            case 'LUNCH': return labels.lunch;
            case 'AFTERNOON': return labels.afternoon;
            case 'EVENING': return labels.evening;
            case 'OVERNIGHT': return labels.overnight;
            default: return slot;
        }
    }

    function handleDownload() {
        const dateLocale = locale === 'es' ? 'es' : 'en-US';

        const monthLabel = new Date(year, month, 1).toLocaleDateString(
            dateLocale,
            { month: 'long', year: 'numeric' },
        );
        const generatedAt = new Date().toLocaleDateString(dateLocale, {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        // Group shifts by day key
        const shiftsByDay = new Map<string, Shift[]>();
        for (const s of shifts) {
            const key = shiftDateKey(s.date);
            const list = shiftsByDay.get(key) ?? [];
            list.push(s);
            shiftsByDay.set(key, list);
        }

        const totalDays = daysInMonth(year, month);

        let rows = '';
        for (let day = 1; day <= totalDays; day++) {
            const key = toDateKey(year, month, day);
            const dayDate = new Date(Date.UTC(year, month, day));
            const weekday = dayDate.getUTCDay();
            const defaultSlots = new Set<ShiftSlot>(
                allowedSlotsForWeekday(weekday),
            );
            const dayShifts = shiftsByDay.get(key) ?? [];
            const byslot = new Map<ShiftSlot, Shift[]>();
            for (const s of dayShifts) {
                const list = byslot.get(s.slot) ?? [];
                list.push(s);
                byslot.set(s.slot, list);
            }

            const weekdayLabel = dayDate.toLocaleDateString(dateLocale, {
                weekday: 'short', timeZone: 'UTC',
            });
            const dayNumLabel = dayDate.toLocaleDateString(dateLocale, {
                month: 'short', day: 'numeric', timeZone: 'UTC',
            });
            const isWeekendHighlight = weekday === 0 || weekday === 1;

            const slotCells = SHIFT_SLOT_ORDER.map((slot) => {
                const slotShifts = byslot.get(slot) ?? [];
                const isDefault = defaultSlots.has(slot);
                if (slotShifts.length === 0) {
                    // Not scheduled. Dim the cell if the slot isn't a default
                    // for this weekday (e.g. a weekday morning nobody added).
                    const cls = isDefault ? 'slot-empty' : 'slot-na';
                    const content = isDefault ? '—' : '';
                    return `<td class="slot ${cls}">${content}</td>`;
                }
                const names = slotShifts
                    .map((s) => escapeHtml(s.watchman.name))
                    .join('<br>');
                return `<td class="slot slot-filled">${names}</td>`;
            }).join('');

            rows += `
                <tr class="${isWeekendHighlight ? 'row-weekend' : ''}">
                    <td class="date-cell">
                        <div class="weekday">${escapeHtml(weekdayLabel)}</div>
                        <div class="daynum">${escapeHtml(dayNumLabel)}</div>
                    </td>
                    ${slotCells}
                </tr>`;
        }

        const slotHeaders = SHIFT_SLOT_ORDER.map((slot) => {
            return `<th class="slot-head">
                <div class="slot-head-name">${escapeHtml(slotLabel(slot))}</div>
                <div class="slot-head-time">${escapeHtml(SHIFT_SLOT_TIMES[slot])}</div>
            </th>`;
        }).join('');

        const title = `${t.watchman.title} — ${monthLabel}`;

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; padding: 32px; background: #fff; }
        .header { margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 16px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
        .header .subtitle { font-size: 13px; color: #6b7280; }
        .header .date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
        th { background: #f1f5f9; text-align: center; padding: 10px 8px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; border: 1px solid #e2e8f0; }
        th.date-head { width: 14%; text-align: left; padding-left: 12px; }
        th.slot-head .slot-head-name { font-size: 11px; }
        th.slot-head .slot-head-time { font-size: 9px; font-weight: 400; color: #94a3b8; margin-top: 2px; text-transform: none; letter-spacing: 0; }
        td { border: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
        td.date-cell { padding: 8px 10px; background: #fafbfc; }
        td.date-cell .weekday { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; font-weight: 600; }
        td.date-cell .daynum { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 2px; }
        td.slot { text-align: center; font-size: 11px; line-height: 1.4; min-height: 32px; }
        td.slot-filled { color: #0f172a; font-weight: 500; }
        td.slot-empty { color: #cbd5e1; }
        td.slot-na { background: #f8fafc; }
        tr.row-weekend td.date-cell { background: #eff6ff; }
        tr.row-weekend td.date-cell .weekday { color: #1d4ed8; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #9ca3af; text-align: center; }
        @media print {
            body { padding: 16px; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            .no-print { display: none; }
        }
        @page { size: letter portrait; margin: 0.5in; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌙 ${escapeHtml(t.watchman.title)} — ${escapeHtml(monthLabel)}</h1>
        <div class="subtitle">${escapeHtml(t.watchman.subtitle)}</div>
        <div class="date">${escapeHtml(generatedAt)}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th class="date-head">${escapeHtml(t.watchman.nightOf)}</th>
                ${slotHeaders}
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>
    <div class="footer">Corn Island Hospitality · ${escapeHtml(generatedAt)}</div>
    <script class="no-print">
        window.onload = function() { window.print(); };
    </script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) {
            win.onafterprint = () => {
                URL.revokeObjectURL(url);
            };
        }
    }

    return (
        <button className="btn btn-secondary" onClick={handleDownload}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t.dashboard.downloadPdf}
        </button>
    );
}
