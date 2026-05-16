'use client';

import type { UserRole } from '@/lib/auth';
import { useState, useMemo } from 'react';

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
    assignments: {
        id: string;
        startDate: Date | string;
        endDate: Date | string;
        room: {
            name: string;
            house: { name: string };
        };
    }[];
};

function toDateKey(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
}

function fmtDateLong(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString();
}

function typeBadgeClass(type: string) {
    switch (type) {
        case 'SINGLE_BROTHER': return 'type-badge single-brother';
        case 'SINGLE_SISTER': return 'type-badge single-sister';
        case 'MARRIED_COUPLE': return 'type-badge married-couple';
        default: return 'type-badge';
    }
}

function typeLabel(type: string) {
    switch (type) {
        case 'SINGLE_BROTHER': return 'Single Brother';
        case 'SINGLE_SISTER': return 'Single Sister';
        case 'MARRIED_COUPLE': return 'Married Couple';
        default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
}

export default function ArrivalsClient({
    volunteers,
}: {
    volunteers: VolunteerWithAssignments[];
    role: UserRole;
}) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [selectedDate, setSelectedDate] = useState(todayStr);

    // Find all volunteers arriving on the selected date
    const arriving = useMemo(() => {
        return volunteers.filter((v) => {
            if (v.isLocal) return false; // locals don't "arrive"
            return toDateKey(v.arrivalDate) === selectedDate;
        });
    }, [volunteers, selectedDate]);

    // Group by groupName (ungrouped last)
    const grouped = useMemo(() => {
        const groups: Record<string, VolunteerWithAssignments[]> = {};
        const ungrouped: VolunteerWithAssignments[] = [];
        for (const v of arriving) {
            if (v.groupName) {
                if (!groups[v.groupName]) groups[v.groupName] = [];
                groups[v.groupName].push(v);
            } else {
                ungrouped.push(v);
            }
        }
        // Sort group names alphabetically
        const sortedGroupNames = Object.keys(groups).sort();
        const result: { groupName: string | null; volunteers: VolunteerWithAssignments[] }[] = [];
        for (const name of sortedGroupNames) {
            result.push({ groupName: name, volunteers: groups[name] });
        }
        if (ungrouped.length > 0) {
            result.push({ groupName: null, volunteers: ungrouped });
        }
        return result;
    }, [arriving]);

    const isToday = selectedDate === todayStr;

    return (
        <div className="animate-fade-in arrivals-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>🚢 Arrivals</h1>
                    <p>Volunteers arriving {isToday ? 'today' : `on ${fmtDateLong(selectedDate)}`}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            fontSize: '0.9rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                        }}
                    />
                    {!isToday && (
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedDate(todayStr)}
                        >
                            Today
                        </button>
                    )}
                    <button
                        className="btn btn-primary btn-sm no-print"
                        onClick={() => window.print()}
                    >
                        🖨️ Print
                    </button>
                </div>
            </div>

            {arriving.length === 0 ? (
                <div className="glass-panel empty-state">
                    <div className="empty-icon">🚢</div>
                    <h3>No arrivals {isToday ? 'today' : 'on this date'}</h3>
                    <p>No volunteers have their arrival date set to {isToday ? 'today' : fmtDateLong(selectedDate)}.</p>
                </div>
            ) : (
                <>
                    {/* Summary bar */}
                    <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                            {arriving.length} volunteer{arriving.length !== 1 ? 's' : ''} arriving
                        </span>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            {grouped.filter(g => g.groupName).length} group{grouped.filter(g => g.groupName).length !== 1 ? 's' : ''}
                            {grouped.some(g => !g.groupName) ? ` + ${grouped.find(g => !g.groupName)!.volunteers.length} individual${grouped.find(g => !g.groupName)!.volunteers.length !== 1 ? 's' : ''}` : ''}
                        </span>
                    </div>

                    {/* Grouped list */}
                    {grouped.map((group, gi) => (
                        <div key={group.groupName ?? '__ungrouped'} className="arrivals-group" style={{ marginBottom: 24 }}>
                            <div className="arrivals-group-header" style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 12,
                                paddingBottom: 8,
                                borderBottom: '1px solid var(--border-color)',
                            }}>
                                {group.groupName ? (
                                    <>
                                        <span style={{
                                            padding: '4px 12px',
                                            fontSize: '0.85rem',
                                            background: 'rgba(139,92,246,0.15)',
                                            color: '#a78bfa',
                                            borderRadius: 999,
                                            fontWeight: 600,
                                        }}>
                                            👥 {group.groupName}
                                        </span>
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                                            {group.volunteers.length} volunteer{group.volunteers.length !== 1 ? 's' : ''}
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
                                        Individuals (no group)
                                    </span>
                                )}
                            </div>

                            <div className="glass-panel data-table-wrapper">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Contact</th>
                                            <th>Housing Assignment</th>
                                            <th>Departure</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.volunteers.map((v) => {
                                            // Find the best matching assignment (the one overlapping the arrival date)
                                            const assignment = v.assignments.find((a) => {
                                                const start = toDateKey(a.startDate);
                                                const end = toDateKey(a.endDate);
                                                return start <= selectedDate && end >= selectedDate;
                                            }) || v.assignments[0] || null;

                                            return (
                                                <tr key={v.id}>
                                                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                        {v.name}
                                                    </td>
                                                    <td>
                                                        <span className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</span>
                                                    </td>
                                                    <td>
                                                        {v.phone && <div>{v.phone}</div>}
                                                        {v.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{v.email}</div>}
                                                        {!v.phone && !v.email && '—'}
                                                    </td>
                                                    <td>
                                                        {assignment ? (
                                                            <div>
                                                                <div style={{ fontWeight: 500 }}>{assignment.room.house.name}</div>
                                                                <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                                                                    {assignment.room.name} · {fmtDate(assignment.startDate)} – {fmtDate(assignment.endDate)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--warning)', fontWeight: 500 }}>⚠️ Not assigned yet</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {v.departureDate ? fmtDate(v.departureDate) : '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}
