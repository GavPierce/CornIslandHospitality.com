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
    arrivalTransport: string | null;
    assignments: {
        id: string;
        startDate: Date | string;
        endDate: Date | string;
        room: {
            name: string;
            house: { name: string };
        };
        hospitalityMember: { name: string; phone: string | null } | null;
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
    return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
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
    const [calYear, setCalYear] = useState(() => new Date().getUTCFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getUTCMonth());

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

    const arrivalsByDate = useMemo(() => {
        const map: Record<string, number> = {};
        for (const v of volunteers) {
            if (v.isLocal) continue;
            const key = toDateKey(v.arrivalDate);
            if (key) map[key] = (map[key] || 0) + 1;
        }
        return map;
    }, [volunteers]);

    const daysInMonth = new Date(Date.UTC(calYear, calMonth + 1, 0)).getUTCDate();
    const firstDayOfWeek = new Date(Date.UTC(calYear, calMonth, 1)).getUTCDay();

    function prevMonth() {
        if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
        else setCalMonth((m) => m - 1);
    }
    function nextMonth() {
        if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
        else setCalMonth((m) => m + 1);
    }
    function selectDate(dateStr: string) {
        setSelectedDate(dateStr);
        const d = new Date(dateStr + 'T00:00:00Z');
        setCalYear(d.getUTCFullYear());
        setCalMonth(d.getUTCMonth());
    }

    const isToday = selectedDate === todayStr;

    return (
        <div className="animate-fade-in arrivals-page">
            <div className="page-header">
                <div>
                    <h1>🚢 Arrivals</h1>
                    <p>Click any day to view arrivals and print the daily list.</p>
                </div>
            </div>

            {/* ─── Calendar Overview (hidden when printing) ─── */}
            <div className="glass-panel no-print" style={{ padding: '20px', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1 }}>←</button>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {new Date(Date.UTC(calYear, calMonth, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                    <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1 }}>→</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', padding: '4px 0', letterSpacing: '0.03em' }}>{d}</div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const count = arrivalsByDate[dateKey] || 0;
                        const isSel = dateKey === selectedDate;
                        const isTodayCal = dateKey === todayStr;
                        return (
                            <button
                                key={day}
                                onClick={() => selectDate(dateKey)}
                                style={{
                                    position: 'relative',
                                    padding: '8px 4px 6px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: isSel
                                        ? '2px solid var(--accent)'
                                        : isTodayCal
                                        ? '1px solid rgba(99,102,241,0.45)'
                                        : count > 0
                                        ? '1px solid rgba(245,158,11,0.35)'
                                        : '1px solid transparent',
                                    background: isSel
                                        ? 'rgba(99,102,241,0.15)'
                                        : count > 0
                                        ? 'rgba(245,158,11,0.08)'
                                        : 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    fontSize: '0.88rem',
                                    fontWeight: isSel || isTodayCal ? 700 : 400,
                                    color: isSel || isTodayCal ? 'var(--accent)' : 'var(--text-primary)',
                                    minHeight: 44,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    gap: 3,
                                }}
                            >
                                {day}
                                {count > 0 && (
                                    <span style={{
                                        background: isSel ? 'var(--accent)' : '#f59e0b',
                                        color: '#fff',
                                        borderRadius: 999,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        padding: '1px 5px',
                                        lineHeight: 1.5,
                                        minWidth: 18,
                                        textAlign: 'center',
                                    }}>{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Day Detail Header ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {isToday ? 'Today — ' : ''}{fmtDateLong(selectedDate)}
                    </span>
                    {arriving.length > 0 && (
                        <span style={{ padding: '2px 10px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600 }}>
                            {arriving.length} arriving
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="no-print">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => selectDate(e.target.value)}
                        style={{ padding: '6px 10px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                    {!isToday && (
                        <button className="btn btn-secondary btn-sm" onClick={() => selectDate(todayStr)}>Today</button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨️ Print day</button>
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
                            {(() => {
                                // Collect unique hospitality contacts for this group
                                const contactMap = new Map<string, { name: string; phone: string | null }>();
                                for (const v of group.volunteers) {
                                    for (const a of v.assignments) {
                                        if (a.hospitalityMember) contactMap.set(a.hospitalityMember.name, a.hospitalityMember);
                                    }
                                }
                                const contacts = Array.from(contactMap.values());
                                return (
                                    <div className="arrivals-group-header" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        marginBottom: 12,
                                        paddingBottom: 8,
                                        borderBottom: '1px solid var(--border-color)',
                                        flexWrap: 'wrap',
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
                                        {contacts.length > 0 && (
                                            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {contacts.map((c) => (
                                                    <span key={c.name} style={{
                                                        padding: '4px 12px',
                                                        fontSize: '0.82rem',
                                                        background: 'rgba(16,185,129,0.12)',
                                                        color: '#34d399',
                                                        borderRadius: 999,
                                                        fontWeight: 500,
                                                        border: '1px solid rgba(16,185,129,0.25)',
                                                    }}>
                                                        🤝 {c.name}{c.phone ? ` · ${c.phone}` : ''}
                                                    </span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}

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
                                                        {v.arrivalTransport === 'BOAT' && (
                                                            <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', borderRadius: 999, border: '1px solid rgba(59,130,246,0.25)' }}>⛴️ Boat</span>
                                                        )}
                                                        {v.arrivalTransport === 'PLANE' && (
                                                            <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(139,92,246,0.12)', color: '#a78bfa', borderRadius: 999, border: '1px solid rgba(139,92,246,0.25)' }}>✈️ Plane</span>
                                                        )}
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
