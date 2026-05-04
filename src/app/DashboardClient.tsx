'use client';

import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import MyScheduleCard, { type MyAssignment, type MyShift } from './MyScheduleCard';
import { SHIFT_SLOT_TIMES } from '@/lib/watchman';
import type { ShiftSlot } from '@prisma/client';
import Link from 'next/link';

export type WatchShift = {
    id: string;
    date: string; // ISO
    slot: ShiftSlot;
    notes: string | null;
    watchmanName: string;
    watchmanPhone: string | null;
    partners: { name: string; phone: string | null }[];
};

// Group shifts by date for the calendar-style display
function groupByDate(shifts: WatchShift[]): Map<string, WatchShift[]> {
    const map = new Map<string, WatchShift[]>();
    for (const s of shifts) {
        const day = s.date.slice(0, 10); // YYYY-MM-DD
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(s);
    }
    return map;
}

const SLOT_ICONS: Record<string, string> = {
    MORNING: '🌅',
    LUNCH: '☀️',
    AFTERNOON: '🌤️',
    EVENING: '🌆',
    OVERNIGHT: '🌙',
};

export default function DashboardClient({
    houseCount,
    volunteerCount,
    activeAssignments,
    role,
    userName,
    identityType,
    myShifts,
    myAssignments,
    watchShifts,
}: {
    houseCount: number;
    volunteerCount: number;
    activeAssignments: number;
    role: UserRole;
    userName: string | null;
    identityType: 'WATCHMAN' | 'VOLUNTEER' | null;
    myShifts: MyShift[];
    myAssignments: MyAssignment[];
    watchShifts: WatchShift[];
}) {
    const { locale, t } = useTranslation();
    const dateLocale = locale === 'es' ? 'es' : 'en-US';

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

    function formatDay(iso: string): string {
        return new Date(iso).toLocaleDateString(dateLocale, {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
        });
    }

    function isToday(iso: string): boolean {
        const today = new Date();
        const d = new Date(iso + 'T00:00:00Z');
        return (
            d.getUTCFullYear() === today.getUTCFullYear() &&
            d.getUTCMonth() === today.getUTCMonth() &&
            d.getUTCDate() === today.getUTCDate()
        );
    }

    const grouped = groupByDate(watchShifts);
    const days = Array.from(grouped.keys()).sort();

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.dashboard.title}</h1>
                <p>{t.dashboard.subtitle}</p>
            </div>

            {/* Personalized schedule card */}
            {userName && identityType && (
                <MyScheduleCard
                    userName={userName}
                    identityType={identityType}
                    shifts={myShifts}
                    assignments={myAssignments}
                />
            )}

            {/* Stats */}
            <div className="stats-grid">
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.totalHouses}</span>
                    <span className="stat-value accent">{houseCount}</span>
                </div>
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.activeAssignments}</span>
                    <span className="stat-value">{activeAssignments}</span>
                </div>
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.registeredVolunteers}</span>
                    <span className="stat-value">{volunteerCount}</span>
                </div>
            </div>

            {/* ── Night Watchman Schedule at a Glance ─────────────── */}
            <div className="section">
                <div className="section-header" style={{ marginBottom: 16 }}>
                    <div>
                        <h2 style={{ margin: 0 }}>{t.dashboard.watchScheduleTitle}</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                            {t.dashboard.watchScheduleSubtitle}
                        </p>
                    </div>
                    <Link
                        href="/watchman"
                        className="btn btn-sm"
                        style={{ border: '1px solid var(--border-color)', color: 'var(--accent-secondary)', whiteSpace: 'nowrap' }}
                    >
                        {t.dashboard.viewFullSchedule}
                    </Link>
                </div>

                {days.length === 0 ? (
                    <div className="glass-panel empty-state">
                        <div className="empty-icon">🌙</div>
                        <h3>{t.dashboard.noShiftsTonight}</h3>
                        <p>{t.dashboard.noShiftsTonightDesc}</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {days.map((day) => {
                            const shifts = grouped.get(day)!;
                            const today = isToday(day);
                            return (
                                <div
                                    key={day}
                                    className="glass-panel"
                                    style={{
                                        padding: '16px 20px',
                                        borderLeft: today ? '3px solid var(--accent-primary)' : '3px solid transparent',
                                    }}
                                >
                                    {/* Day Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: '0.95rem',
                                            color: today ? 'var(--accent-primary)' : 'var(--text-primary)',
                                        }}>
                                            {formatDay(day)}
                                        </span>
                                        {today && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                padding: '2px 8px',
                                                borderRadius: 99,
                                                background: 'var(--accent-primary)',
                                                color: '#fff',
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                            }}>
                                                {t.dashboard.tonightsWatch}
                                            </span>
                                        )}
                                    </div>

                                    {/* Shifts for this day */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {shifts.map((shift) => (
                                            <div
                                                key={shift.id}
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'auto 1fr auto',
                                                    alignItems: 'center',
                                                    gap: '0 16px',
                                                    padding: '10px 14px',
                                                    background: 'rgba(255,255,255,0.04)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: 10,
                                                }}
                                            >
                                                {/* Slot label */}
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 120 }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                                                        {SLOT_ICONS[shift.slot]} {slotLabel(shift.slot)}
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                        {SHIFT_SLOT_TIMES[shift.slot]}
                                                    </span>
                                                </div>

                                                {/* Watchman + partner */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {/* Primary watchman */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                            {shift.watchmanName}
                                                        </span>
                                                        {shift.watchmanPhone && (
                                                            <a
                                                                href={`tel:${shift.watchmanPhone}`}
                                                                style={{
                                                                    fontSize: '0.78rem',
                                                                    color: 'var(--text-tertiary)',
                                                                    textDecoration: 'none',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 3,
                                                                }}
                                                            >
                                                                📞 {shift.watchmanPhone}
                                                            </a>
                                                        )}
                                                    </div>
                                                    {/* Partner(s) */}
                                                    {shift.partners.length > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                                                                {t.dashboard.partner}:
                                                            </span>
                                                            {shift.partners.map((p, i) => (
                                                                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                                        {p.name}
                                                                    </span>
                                                                    {p.phone && (
                                                                        <a
                                                                            href={`tel:${p.phone}`}
                                                                            style={{
                                                                                fontSize: '0.75rem',
                                                                                color: 'var(--text-tertiary)',
                                                                                textDecoration: 'none',
                                                                            }}
                                                                        >
                                                                            📞 {p.phone}
                                                                        </a>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Notes */}
                                                {shift.notes && (
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-tertiary)',
                                                        fontStyle: 'italic',
                                                        textAlign: 'right',
                                                        maxWidth: 160,
                                                    }}>
                                                        {shift.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
