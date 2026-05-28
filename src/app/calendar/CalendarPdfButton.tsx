'use client';

import { useTranslation } from '@/i18n/LanguageContext';

type Assignment = {
    id: string;
    startDate: Date;
    endDate: Date;
    volunteer: { id: string; name: string; type: string };
};

type Room = {
    id: string;
    name: string;
    capacity: number;
    assignments: Assignment[];
};

type House = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    rooms: Room[];
};

interface CalendarPdfButtonProps {
    houses: House[];
    year: number;
    month: number;
}

export default function CalendarPdfButton({ houses, year, month }: CalendarPdfButtonProps) {
    const { locale, t } = useTranslation();

    function formatMonthYear(y: number, m: number): string {
        const date = new Date(y, m, 1);
        return date.toLocaleString(locale === 'es' ? 'es' : 'default', { month: 'long', year: 'numeric' });
    }

    function typeColor(type: string): string {
        switch (type) {
            case 'SINGLE_BROTHER': return '#3b82f6';
            case 'SINGLE_SISTER': return '#db2777';
            case 'MARRIED_COUPLE': return '#10b981';
            default: return '#64748b';
        }
    }

    function typeBgColor(type: string): string {
        switch (type) {
            case 'SINGLE_BROTHER': return 'rgba(59, 130, 246, 0.12)';
            case 'SINGLE_SISTER': return 'rgba(219, 39, 119, 0.12)';
            case 'MARRIED_COUPLE': return 'rgba(16, 185, 129, 0.12)';
            default: return 'rgba(100, 116, 139, 0.08)';
        }
    }

    function getDaysInMonth(y: number, m: number): number {
        return new Date(y, m + 1, 0).getDate();
    }

    function handlePrint() {
        const totalDays = getDaysInMonth(year, month);
        const days = Array.from({ length: totalDays }, (_, i) => i + 1);

        const monthStart = new Date(Date.UTC(year, month, 1));
        const monthEnd = new Date(Date.UTC(year, month, totalDays, 23, 59, 59));
        const monthLabelStr = formatMonthYear(year, month);
        
        const now = new Date().toLocaleDateString(locale === 'es' ? 'es' : 'en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        // Flatten rooms
        const rooms = houses.flatMap((h) =>
            h.rooms.map((r) => ({
                ...r,
                houseName: h.name,
            }))
        );

        // Build header grid HTML
        const dayHeadersHtml = days.map((d) => {
            const date = new Date(year, month, d);
            const dayName = date.toLocaleString(locale === 'es' ? 'es' : 'default', { weekday: 'narrow' });
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const leftPct = ((d - 1) / totalDays) * 100;
            const widthPct = (1 / totalDays) * 100;

            return `
                <div class="day-header-cell ${isWeekend ? 'weekend' : ''}" style="left: ${leftPct}%; width: ${widthPct}%;">
                    <div class="day-name">${dayName}</div>
                    <div class="day-num">${d}</div>
                </div>`;
        }).join('');

        let rowsHtml = '';
        rooms.forEach((room) => {
            // Filter assignments that overlap with the current month
            const overlapsMonth = (a: Assignment) => {
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);
                return start <= monthEnd && end >= monthStart;
            };

            const visibleAssignments = room.assignments.filter(overlapsMonth);

            // Compute tracks
            const assignmentsWithTrack = visibleAssignments.map((a) => {
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);
                const visStart = start < monthStart ? monthStart : start;
                const visEnd = end > monthEnd ? monthEnd : end;
                return {
                    ...a,
                    visStartDay: visStart.getUTCDate(),
                    visEndDay: visEnd.getUTCDate(),
                };
            });

            const sortedAssignments = [...assignmentsWithTrack].sort((a, b) => a.visStartDay - b.visStartDay);
            const assignmentsWithTracks: Array<typeof sortedAssignments[0] & { track: number }> = [];

            for (const a of sortedAssignments) {
                let trackIndex = 0;
                while (true) {
                    const hasOverlap = assignmentsWithTracks.some(existing =>
                        existing.track === trackIndex &&
                        a.visStartDay <= existing.visEndDay &&
                        a.visEndDay >= existing.visStartDay
                    );
                    if (!hasOverlap) break;
                    trackIndex++;
                }
                assignmentsWithTracks.push({ ...a, track: trackIndex });
            }

            const trackCount = assignmentsWithTracks.length > 0
                ? Math.max(...assignmentsWithTracks.map(a => a.track)) + 1
                : 1;

            const trackPitch = 24; // height + spacing
            const barHeight = 18;
            const topPad = 6;
            const trackHeight = trackCount * trackPitch + topPad * 2;

            // Render vertical grid lines for this room
            const gridLinesHtml = days.map((d) => {
                const date = new Date(year, month, d);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const leftPct = ((d - 1) / totalDays) * 100;
                const widthPct = (1 / totalDays) * 100;

                return `<div class="grid-line ${isWeekend ? 'weekend' : ''}" style="left: ${leftPct}%; width: ${widthPct}%;"></div>`;
            }).join('');

            // Render assignment bars
            const barsHtml = assignmentsWithTracks.map((a) => {
                const start = new Date(a.startDate);
                const end = new Date(a.endDate);

                const visStart = start < monthStart ? monthStart : start;
                const visEnd = end > monthEnd ? monthEnd : end;

                const startDay = visStart.getUTCDate();
                const endDay = visEnd.getUTCDate();

                const leftPct = ((startDay - 1) / totalDays) * 100;
                const widthPct = ((endDay - startDay + 1) / totalDays) * 100;

                const topOffset = topPad + a.track * trackPitch;
                const color = typeColor(a.volunteer.type);
                const bgColor = typeBgColor(a.volunteer.type);

                return `
                    <div class="assignment-bar" style="
                        left: ${leftPct}%;
                        width: ${Math.max(widthPct, (1 / totalDays) * 100)}%;
                        height: ${barHeight}px;
                        top: ${topOffset}px;
                        background: ${bgColor};
                        border-left: 3px solid ${color};
                        color: #0f172a;
                    ">
                        <span class="bar-label">${a.volunteer.name}</span>
                    </div>`;
            }).join('');

            rowsHtml += `
                <div class="timeline-row" style="height: ${Math.max(trackHeight, 44)}px;">
                    <div class="room-label-cell">
                        <div class="room-name">${room.name}</div>
                        <div class="house-name">${room.houseName}</div>
                    </div>
                    <div class="tracks-cell">
                        ${gridLinesHtml}
                        ${barsHtml}
                    </div>
                </div>`;
        });

        if (rooms.length === 0) {
            rowsHtml = `
                <div style="text-align: center; padding: 40px; color: #64748b; font-style: italic;">
                    ${t.calendar.noRoomsDesc}
                </div>`;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Corn Island Hospitality — Calendar Timeline</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @page { size: landscape; margin: 12mm 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; padding: 10px; background: #fff; font-size: 11px; }
        
        .header { margin-bottom: 16px; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
        .header .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
        .header .date { font-size: 10px; color: #94a3b8; text-align: right; }

        .legend { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; }
        .legend-title { font-weight: 600; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .legend-item { display: flex; align-items: center; gap: 5px; color: #475569; font-weight: 500; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }

        .timeline-container { border: 1px solid #cbd5e1; border-radius: 6px; display: block; overflow: visible; background: #fff; }
        
        /* Timeline Header Row */
        .timeline-header-row { display: flex; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; height: 38px; position: relative; }
        .room-header-cell { width: 140px; min-width: 140px; border-right: 1px solid #cbd5e1; display: flex; align-items: center; padding-left: 10px; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; }
        .days-header-track { flex: 1; position: relative; height: 100%; }
        
        .day-header-cell { position: absolute; top: 0; bottom: 0; text-align: center; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #e2e8f0; }
        .day-header-cell.weekend { background: #f8fafc; }
        .day-header-cell .day-name { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 500; }
        .day-header-cell .day-num { font-size: 11px; font-weight: 700; color: #334155; margin-top: 1px; }

        /* Timeline Data Row */
        .timeline-row { display: flex; border-bottom: 1px solid #cbd5e1; position: relative; break-inside: avoid; }
        .timeline-row:last-child { border-bottom: none; }
        .room-label-cell { width: 140px; min-width: 140px; border-right: 1px solid #cbd5e1; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; background: #fcfdfe; }
        .room-label-cell .room-name { font-weight: 600; color: #0f172a; font-size: 11px; }
        .room-label-cell .house-name { color: #64748b; font-size: 9px; margin-top: 1px; }
        
        .tracks-cell { flex: 1; position: relative; height: 100%; background: #fff; }
        
        .grid-line { position: absolute; top: 0; bottom: 0; border-right: 1px solid #f1f5f9; }
        .grid-line.weekend { background: rgba(248, 250, 252, 0.4); border-right-color: #e2e8f0; }
        
        .assignment-bar { position: absolute; border-radius: 4px; display: flex; align-items: center; padding: 0 6px; box-shadow: inset 0 -1px 0 rgba(0,0,0,0.05); }
        .bar-label { font-size: 9px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #0f172a; }

        .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; text-align: center; }

        @media print {
            body { padding: 0; }
            .no-print { display: none; }
            .timeline-container { page-break-after: avoid; }
        }
        
        /* Force color print */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>📅 ${t.calendar.title} — ${monthLabelStr} Timeline</h1>
            <div class="subtitle">${locale === 'es' ? 'Corn Island Construcción Hospitalidad' : 'Corn Island Construction Hospitality'}</div>
        </div>
        <div class="date">Generated: ${now}</div>
    </div>

    <div class="legend">
        <span class="legend-title">Key:</span>
        <div class="legend-item">
            <div class="legend-dot" style="background: #3b82f6;"></div>
            <span>${t.types.singleBrother}</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: #db2777;"></div>
            <span>${t.types.singleSister}</span>
        </div>
        <div class="legend-item">
            <div class="legend-dot" style="background: #10b981;"></div>
            <span>${t.types.marriedCouple}</span>
        </div>
        <div class="legend-item" style="color: #94a3b8; font-weight: normal; margin-left: auto; font-size: 9px;">
            Shaded columns = weekends
        </div>
    </div>

    <div class="timeline-container">
        <div class="timeline-header-row">
            <div class="room-header-cell">${t.calendar.roomCol}</div>
            <div class="days-header-track">
                ${dayHeadersHtml}
            </div>
        </div>
        ${rowsHtml}
    </div>

    <div class="footer">Corn Island Hospitality · ${monthLabelStr} · ${now}</div>
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
        <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', fontSize: '0.85rem' }}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t.dashboard.downloadPdf}
        </button>
    );
}
