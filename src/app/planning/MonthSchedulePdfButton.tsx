'use client';

import { useState } from 'react';

type Assignment = {
    id: string;
    startDate: Date;
    endDate: Date;
    volunteer: { id: string; name: string; type: string };
    hospitalityMember?: { id: string; name: string; phone: string | null } | null;
};

type Room = {
    id: string;
    name: string;
    assignments: Assignment[];
};

type House = {
    id: string;
    name: string;
    address: string;
    rooms: Room[];
};

function typeLabel(type: string): string {
    switch (type) {
        case 'SINGLE_BROTHER': return 'Brother';
        case 'SINGLE_SISTER': return 'Sister';
        case 'MARRIED_COUPLE': return 'Couple';
        default: return type.replace(/_/g, ' ');
    }
}

function typeColor(type: string): string {
    switch (type) {
        case 'SINGLE_BROTHER': return '#3b82f6';
        case 'SINGLE_SISTER': return '#a855f7';
        case 'MARRIED_COUPLE': return '#22c55e';
        default: return '#6b7280';
    }
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthLabel(year: number, month: number, locale: string): string {
    return new Date(year, month, 1).toLocaleDateString(locale, {
        month: 'long', year: 'numeric',
    });
}

export default function MonthSchedulePdfButton({ houses }: { houses: House[] }) {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());

    function prevMonth() {
        if (month === 0) { setMonth(11); setYear((y) => y - 1); }
        else setMonth((m) => m - 1);
    }
    function nextMonth() {
        if (month === 11) { setMonth(0); setYear((y) => y + 1); }
        else setMonth((m) => m + 1);
    }

    function handlePrint() {
        const totalDays = daysInMonth(year, month);
        const firstDay = new Date(Date.UTC(year, month, 1));
        const lastDay = new Date(Date.UTC(year, month, totalDays, 23, 59, 59));
        const locale = 'en-US';
        const label = monthLabel(year, month, locale);
        const generatedAt = new Date().toLocaleDateString(locale, {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        // Collect all assignments that overlap with this month
        type Row = {
            volunteerName: string;
            volunteerType: string;
            houseName: string;
            roomName: string;
            startDate: Date;
            endDate: Date;
            hospitalityContact: string | null;
        };
        const rows: Row[] = [];
        for (const house of houses) {
            for (const room of house.rooms) {
                for (const a of room.assignments) {
                    const aStart = new Date(a.startDate);
                    const aEnd = new Date(a.endDate);
                    if (aEnd >= firstDay && aStart <= lastDay) {
                        rows.push({
                            volunteerName: a.volunteer.name,
                            volunteerType: a.volunteer.type,
                            houseName: house.name,
                            roomName: room.name,
                            startDate: aStart,
                            endDate: aEnd,
                            hospitalityContact: a.hospitalityMember ? a.hospitalityMember.name : null,
                        });
                    }
                }
            }
        }

        // Sort by house, then room, then start date
        rows.sort((a, b) => {
            const h = a.houseName.localeCompare(b.houseName);
            if (h !== 0) return h;
            const r = a.roomName.localeCompare(b.roomName);
            if (r !== 0) return r;
            const d = a.startDate.getTime() - b.startDate.getTime();
            return d !== 0 ? d : a.volunteerName.localeCompare(b.volunteerName);
        });

        // Build day-of-week header
        const dayHeaders = Array.from({ length: totalDays }, (_, i) => {
            const d = new Date(Date.UTC(year, month, i + 1));
            const wd = d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
            const sun = d.getUTCDay() === 0;
            const sat = d.getUTCDay() === 6;
            return `<th class="day-hdr${sun || sat ? ' weekend' : ''}">${i + 1}<br><span class="wd">${wd}</span></th>`;
        }).join('');

        // Build rows
        let tableRows = '';
        if (rows.length === 0) {
            tableRows = `<tr><td colspan="${totalDays + 3}" style="text-align:center;padding:20px;color:#9ca3af;font-style:italic;">No assignments this month</td></tr>`;
        }

        for (const row of rows) {
            const color = typeColor(row.volunteerType);
            const label2 = typeLabel(row.volunteerType);

            const dayCells = Array.from({ length: totalDays }, (_, i) => {
                const day = new Date(Date.UTC(year, month, i + 1));
                // Normalize start/end to UTC midnight for day comparison
                const start = new Date(Date.UTC(row.startDate.getFullYear(), row.startDate.getMonth(), row.startDate.getDate()));
                const end = new Date(Date.UTC(row.endDate.getFullYear(), row.endDate.getMonth(), row.endDate.getDate()));
                const isFirst = day.getTime() === start.getTime();
                const isLast = day.getTime() === end.getTime();
                const inRange = day >= start && day <= end;
                const sun = day.getUTCDay() === 0;
                const sat = day.getUTCDay() === 6;
                if (inRange) {
                    const radius = isFirst && isLast
                        ? '4px'
                        : isFirst ? '4px 0 0 4px'
                        : isLast ? '0 4px 4px 0'
                        : '0';
                    return `<td class="day-cell${sun || sat ? ' weekend' : ''}"><div class="bar" style="background:${color};border-radius:${radius};"></div></td>`;
                }
                return `<td class="day-cell${sun || sat ? ' weekend' : ''}"></td>`;
            }).join('');

            tableRows += `
                <tr>
                    <td class="name-cell">
                        <div style="margin-bottom:3px;"><span class="vol-name">${row.volunteerName}</span><span class="type-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">${label2}</span></div>
                        ${row.hospitalityContact ? `<div style="font-size:9px;color:#6b7280;font-weight:500;">🤝 ${row.hospitalityContact}</div>` : ''}
                    </td>
                    <td class="loc-cell">${row.houseName}<span class="room-name"> · ${row.roomName}</span></td>
                    ${dayCells}
                </tr>`;
        }

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Corn Island Hospitality — ${label} Schedule</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@page { size: landscape; margin: 15mm 12mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; background: #fff; font-size: 11px; }
.header { margin-bottom: 20px; border-bottom: 3px solid #3b82f6; padding-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
.header h1 { font-size: 18px; font-weight: 700; color: #1a1a2e; }
.header .sub { font-size: 11px; color: #6b7280; margin-top: 3px; }
.header .meta { font-size: 10px; color: #9ca3af; text-align: right; }
table { width: 100%; border-collapse: collapse; }
th { background: #f1f5f9; padding: 6px 4px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
th.name-hdr { text-align: left; min-width: 160px; padding-left: 8px; }
th.loc-hdr { text-align: left; min-width: 120px; padding-left: 6px; }
th.day-hdr { text-align: center; width: 22px; min-width: 18px; font-size: 9px; font-weight: 500; color: #94a3b8; line-height: 1.2; }
th.day-hdr.weekend { color: #cbd5e1; }
.wd { font-size: 8px; text-transform: uppercase; display: block; }
tr:nth-child(even) td { background: #fafafa; }
tr:hover td { background: #f0f9ff; }
.name-cell { padding: 5px 4px 5px 8px; white-space: nowrap; }
.vol-name { font-weight: 600; color: #1e293b; margin-right: 6px; }
.type-badge { font-size: 9px; padding: 1px 5px; border-radius: 999px; font-weight: 500; white-space: nowrap; }
.loc-cell { padding: 5px 6px; color: #374151; white-space: nowrap; font-size: 10px; }
.room-name { color: #9ca3af; }
.day-cell { padding: 3px 1px; width: 22px; }
.day-cell.weekend { background: #fafbff !important; }
.bar { height: 14px; width: 100%; }
.legend { margin-top: 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 10px; color: #6b7280; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; }
.footer { margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #9ca3af; text-align: center; }
.count { font-size: 11px; color: #64748b; margin-top: 2px; }
@media print { body { } .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="header">
    <div>
        <h1>📅 ${label} — Housing Schedule</h1>
        <div class="sub">Corn Island Construction Hospitality</div>
        <div class="count">${rows.length} assignment${rows.length !== 1 ? 's' : ''} this month</div>
    </div>
    <div class="meta">Generated: ${generatedAt}</div>
</div>
<table>
    <thead>
        <tr>
            <th class="name-hdr">Volunteer</th>
            <th class="loc-hdr">House · Room</th>
            ${dayHeaders}
        </tr>
    </thead>
    <tbody>
        ${tableRows}
    </tbody>
</table>
<div class="legend">
    <span style="font-size:10px;font-weight:600;color:#475569;">Key:</span>
    <div class="legend-item"><div class="legend-dot" style="background:#3b82f6;"></div> Single Brother</div>
    <div class="legend-item"><div class="legend-dot" style="background:#a855f7;"></div> Single Sister</div>
    <div class="legend-item"><div class="legend-dot" style="background:#22c55e;"></div> Married Couple</div>
    <div class="legend-item" style="color:#94a3b8;">Shaded columns = weekends</div>
</div>
<div class="footer">Corn Island Hospitality · ${label} · ${generatedAt}</div>
<script class="no-print">window.onload = function() { window.print(); };</script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) win.onafterprint = () => URL.revokeObjectURL(url);
    }

    const label = monthLabel(year, month, 'en-US');

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
                className="btn btn-secondary"
                style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', padding: '6px 8px', fontSize: '0.8rem' }}
                onClick={prevMonth}
                title="Previous month"
            >‹</button>
            <button
                className="btn btn-secondary"
                style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                onClick={handlePrint}
                title={`Print ${label} schedule`}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: 'middle' }}>
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                </svg>
                {label}
            </button>
            <button
                className="btn btn-secondary"
                style={{ borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', padding: '6px 8px', fontSize: '0.8rem' }}
                onClick={nextMonth}
                title="Next month"
            >›</button>
        </div>
    );
}
