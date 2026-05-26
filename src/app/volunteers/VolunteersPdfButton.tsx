'use client';

import { useTranslation } from '@/i18n/LanguageContext';

type VolunteerWithAssignments = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
    language: string | null;
    isHospitality: boolean;
    isWatchman: boolean;
    isLocal: boolean;
    arrivalDate: Date | string | null;
    departureDate: Date | string | null;
    groupName: string | null;
    arrivalTransport: string | null;
    assignments: {
        id: string;
        startDate: Date;
        endDate: Date;
        room: {
            name: string;
            house: { name: string };
        };
    }[];
};

type HousingFilter = 'needs_housing' | 'all' | 'local';

interface VolunteersPdfButtonProps {
    volunteers: VolunteerWithAssignments[];
    housingFilter: HousingFilter;
    groupFilter: string;
    searchQuery: string;
}

export default function VolunteersPdfButton({
    volunteers,
    housingFilter,
    groupFilter,
    searchQuery,
}: VolunteersPdfButtonProps) {
    const { t } = useTranslation();

    function typeLabel(type: string): string {
        switch (type) {
            case 'SINGLE_BROTHER': return t.types.singleBrother;
            case 'SINGLE_SISTER': return t.types.singleSister;
            case 'MARRIED_COUPLE': return t.types.marriedCouple;
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
    }

    function typeBadgeClass(type: string): string {
        switch (type) {
            case 'SINGLE_BROTHER': return 'single-brother';
            case 'SINGLE_SISTER': return 'single-sister';
            case 'MARRIED_COUPLE': return 'married-couple';
            default: return '';
        }
    }

    function fmtDate(d: Date | string | null | undefined): string {
        if (!d) return '';
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function handlePrint() {
        const now = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        // Group volunteers
        const groups: { [key: string]: VolunteerWithAssignments[] } = {};
        volunteers.forEach((v) => {
            const gName = v.groupName || 'No Group';
            if (!groups[gName]) {
                groups[gName] = [];
            }
            groups[gName].push(v);
        });

        // Sort group keys: named groups alphabetically, 'No Group' at the end
        const sortedGroupNames = Object.keys(groups).sort((a, b) => {
            if (a === 'No Group') return 1;
            if (b === 'No Group') return -1;
            return a.localeCompare(b);
        });

        let sectionsHtml = '';
        sortedGroupNames.forEach((groupName) => {
            const groupVols = groups[groupName];
            const displayGroupName = groupName === 'No Group' ? t.volunteers.noGroup : `${t.volunteers.group}: ${groupName}`;

            let tableRows = '';
            groupVols.forEach((v) => {
                const currentAssignment = v.assignments[0];
                const assignmentText = currentAssignment
                    ? `${currentAssignment.room.house.name} — ${currentAssignment.room.name}`
                    : `<span class="unassigned">${t.volunteers.unassigned}</span>`;

                const transportIcon = v.arrivalTransport === 'BOAT' ? '⛴️ ' : v.arrivalTransport === 'PLANE' ? '✈️ ' : '';
                const stayDatesText = v.isLocal
                    ? `<span class="na">N/A</span>`
                    : v.arrivalDate || v.departureDate
                        ? `${transportIcon}${fmtDate(v.arrivalDate)} – ${fmtDate(v.departureDate)}`
                        : `<span class="warning">Not set</span>`;

                const contactInfo = [v.email, v.phone].filter(Boolean).join('<br>') || '—';

                const badgesHtml = [
                    v.isLocal ? `<span class="role-badge local">🏠 ${t.volunteers.local}</span>` : '',
                    v.isWatchman ? `<span class="role-badge watchman">👁️ Watchman</span>` : '',
                    v.isHospitality ? `<span class="role-badge hospitality">🤝 Hospitality</span>` : '',
                ].filter(Boolean).join(' ');

                tableRows += `
                    <tr>
                        <td class="name-cell">
                            <strong>${v.name}</strong>
                            ${badgesHtml ? `<div class="badges-row">${badgesHtml}</div>` : ''}
                        </td>
                        <td>
                            <span class="type-badge ${typeBadgeClass(v.type)}">${typeLabel(v.type)}</span>
                        </td>
                        <td>${stayDatesText}</td>
                        <td>${contactInfo}</td>
                        <td>${assignmentText}</td>
                    </tr>`;
            });

            sectionsHtml += `
                <div class="group-section">
                    <div class="group-header">
                        <h2>${displayGroupName}</h2>
                        <span class="group-count">${groupVols.length} ${groupVols.length !== 1 ? t.volunteers.volunteerPlural : t.volunteers.volunteer}</span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 25%">Name</th>
                                <th style="width: 15%">Type</th>
                                <th style="width: 22%">Stay Dates</th>
                                <th style="width: 18%">Contact</th>
                                <th style="width: 20%">Assignment</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>`;
        });

        if (volunteers.length === 0) {
            sectionsHtml = `
                <div style="text-align:center; padding: 40px; color: #6b7280; font-style: italic;">
                    No volunteers matching the active filters.
                </div>`;
        }

        // Active filters description for the header
        const filterDetails: string[] = [];
        if (housingFilter === 'needs_housing') {
            filterDetails.push('Needs Housing');
        } else if (housingFilter === 'local') {
            filterDetails.push('Local Only');
        }
        if (groupFilter) {
            filterDetails.push(`Group: ${groupFilter}`);
        }
        if (searchQuery) {
            filterDetails.push(`Search: "${searchQuery}"`);
        }
        const filterSubtitle = filterDetails.length > 0 ? `Filters applied: ${filterDetails.join(', ')}` : 'All volunteers';

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Corn Island Hospitality — Volunteers Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; padding: 30px; background: #fff; line-height: 1.4; font-size: 12px; }
        .header { margin-bottom: 24px; border-bottom: 3px solid #3b82f6; padding-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .header h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .header .subtitle { font-size: 12px; color: #64748b; }
        .header .date { font-size: 11px; color: #94a3b8; text-align: right; }
        
        .summary-banner { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
        .summary-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; }
        .summary-card .val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }

        .group-section { margin-bottom: 24px; break-inside: avoid; }
        .group-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-bottom: none; border-radius: 6px 6px 0 0; }
        .group-header h2 { font-size: 13px; font-weight: 700; color: #334155; }
        .group-count { font-size: 11px; color: #64748b; font-weight: 500; }
        
        table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
        th { background: #fafcff; text-align: left; padding: 8px 12px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 2px solid #cbd5e1; }
        td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
        tr:nth-child(even) td { background: #f8fafc; }
        
        .name-cell strong { font-weight: 600; color: #0f172a; font-size: 12px; }
        .badges-row { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
        
        .type-badge { font-size: 9px; padding: 2px 6px; border-radius: 999px; font-weight: 500; display: inline-block; white-space: nowrap; }
        .type-badge.single-brother { background: rgba(59, 130, 246, 0.1); color: #2563eb; border: 1px solid rgba(59, 130, 246, 0.2); }
        .type-badge.single-sister { background: rgba(236, 72, 153, 0.1); color: #db2777; border: 1px solid rgba(236, 72, 153, 0.2); }
        .type-badge.married-couple { background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2); }

        .role-badge { font-size: 8px; padding: 1px 5px; border-radius: 999px; font-weight: 500; display: inline-block; white-space: nowrap; }
        .role-badge.local { background: rgba(245, 158, 11, 0.1); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.2); }
        .role-badge.watchman { background: rgba(59, 130, 246, 0.1); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.2); }
        .role-badge.hospitality { background: rgba(16, 185, 129, 0.1); color: #047857; border: 1px solid rgba(16, 185, 129, 0.2); }

        .unassigned { color: #d97706; font-weight: 500; font-style: italic; }
        .warning { color: #ef4444; font-weight: 500; }
        .na { color: #94a3b8; }
        
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }

        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
            tr { break-inside: avoid; }
        }
        
        /* Ensure background colors print correctly */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>👥 Corn Island Hospitality — Volunteers Report</h1>
            <div class="subtitle">${filterSubtitle}</div>
        </div>
        <div class="date">Generated: ${now}</div>
    </div>

    <div class="summary-banner">
        <div class="summary-card">
            <div class="label">Total Volunteers</div>
            <div class="val">${volunteers.length}</div>
        </div>
        <div class="summary-card">
            <div class="label">Needs Housing</div>
            <div class="val">${volunteers.filter(v => !v.isLocal && v.assignments.length === 0).length}</div>
        </div>
        <div class="summary-card">
            <div class="label">Housed</div>
            <div class="val">${volunteers.filter(v => !v.isLocal && v.assignments.length > 0).length}</div>
        </div>
        <div class="summary-card">
            <div class="label">Local (No Housing Needed)</div>
            <div class="val">${volunteers.filter(v => v.isLocal).length}</div>
        </div>
    </div>

    ${sectionsHtml}

    <div class="footer">Corn Island Hospitality · Generated on ${now}</div>
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
