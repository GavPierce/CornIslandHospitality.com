'use client';

import { useTranslation } from '@/i18n/LanguageContext';

type HouseWithRooms = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    rooms: {
        id: string;
        name: string;
        capacity: number;
        assignments: {
            id: string;
            volunteer: { id: string; name: string; type: string };
        }[];
    }[];
};

function typeLabel(type: string): string {
    switch (type) {
        case 'SINGLE_BROTHER': return 'Single Brother';
        case 'SINGLE_SISTER': return 'Single Sister';
        case 'MARRIED_COUPLE': return 'Married Couple';
        default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
}

export default function HousesPdfButton({ houses }: { houses: HouseWithRooms[] }) {
    const { t } = useTranslation();

    function handleDownload() {
        const now = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        let tableRows = '';
        houses.forEach((house) => {
            const totalBeds = house.rooms.reduce((s, r) => s + r.capacity, 0);
            const totalOccupied = house.rooms.reduce((s, r) => s + r.assignments.length, 0);
            const acceptedLabel = house.acceptedTypes.map(typeLabel).join(', ');

            // House header row
            tableRows += `
                <tr class="house-row">
                    <td colspan="4">
                        <strong>${house.name}</strong>
                        <span class="address">${house.address}</span>
                        <span class="meta">${acceptedLabel} · ${totalOccupied}/${totalBeds} beds occupied · ${house.rooms.length} room${house.rooms.length !== 1 ? 's' : ''}</span>
                    </td>
                </tr>`;

            // Room rows
            house.rooms.forEach((room) => {
                const occupants = room.assignments.length > 0
                    ? room.assignments.map(a => `${a.volunteer.name} (${typeLabel(a.volunteer.type)})`).join(', ')
                    : '—';
                tableRows += `
                    <tr class="room-row">
                        <td class="indent">${room.name}</td>
                        <td class="center">${room.capacity}</td>
                        <td class="center">${room.assignments.length}</td>
                        <td>${occupants}</td>
                    </tr>`;
            });

            if (house.rooms.length === 0) {
                tableRows += `
                    <tr class="room-row">
                        <td class="indent" colspan="4" style="color:#999;font-style:italic;">No rooms added</td>
                    </tr>`;
            }
        });

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Corn Island Hospitality — Houses Report</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; padding: 40px; background: #fff; }
        .header { margin-bottom: 32px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; }
        .header h1 { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
        .header .subtitle { font-size: 13px; color: #6b7280; }
        .header .date { font-size: 12px; color: #9ca3af; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; text-align: left; padding: 10px 14px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 2px solid #e2e8f0; }
        th.center { text-align: center; }
        .house-row td { background: #f8fafc; padding: 14px; border-top: 2px solid #e2e8f0; }
        .house-row strong { font-size: 15px; display: block; color: #1e293b; }
        .house-row .address { font-size: 12px; color: #6b7280; display: block; margin-top: 2px; }
        .house-row .meta { font-size: 11px; color: #94a3b8; display: block; margin-top: 4px; }
        .room-row td { padding: 8px 14px; border-bottom: 1px solid #f1f5f9; }
        .room-row .indent { padding-left: 28px; }
        .center { text-align: center; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #9ca3af; text-align: center; }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏠 Corn Island Hospitality — Houses Report</h1>
        <div class="subtitle">Complete listing of all houses, rooms, and current assignments</div>
        <div class="date">Generated: ${now}</div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Room</th>
                <th class="center">Beds</th>
                <th class="center">Occupied</th>
                <th>Current Occupants</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    <div class="footer">Corn Island Hospitality · ${now}</div>
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
        <button className="btn btn-secondary" onClick={handleDownload} id="download-pdf-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t.dashboard.downloadPdf}
        </button>
    );
}
