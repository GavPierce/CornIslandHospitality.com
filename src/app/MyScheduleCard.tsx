'use client';

import { useTranslation } from '@/i18n/LanguageContext';
import { SHIFT_SLOT_TIMES } from '@/lib/watchman';
import type { ShiftSlot } from '@prisma/client';
import Link from 'next/link';

export type MyShift = {
    id: string;
    date: string; // ISO (serialised before being passed from server)
    slot: ShiftSlot;
    notes: string | null;
};

export type MyAssignment = {
    id: string;
    startDate: string;
    endDate: string;
    roomName: string;
    houseName: string;
    houseAddress: string;
    hospitalityContact: { name: string; phone: string | null } | null;
};

export default function MyScheduleCard({
    userName,
    identityType,
    shifts,
    assignments,
}: {
    userName: string;
    identityType: 'WATCHMAN' | 'VOLUNTEER' | null;
    shifts: MyShift[];
    assignments: MyAssignment[];
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

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleDateString(dateLocale, {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
        });
    }

    const isWatchman = identityType === 'WATCHMAN';
    const isVolunteer = identityType === 'VOLUNTEER';

    return (
        <div className="glass-panel" style={{ padding: '20px 22px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        {t.myDashboard.welcomeLabel}
                    </div>
                    <h2 style={{ margin: '4px 0 0', fontSize: '1.3rem' }}>{userName}</h2>
                </div>
                {isWatchman && (
                    <Link href="/watchman" className="btn btn-sm" style={{ border: '1px solid var(--border-color)', color: 'var(--accent-secondary)' }}>
                        {t.myDashboard.viewFullSchedule}
                    </Link>
                )}
            </div>

            {isWatchman && (
                <div>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: 'var(--text-secondary)' }}>
                        {t.myDashboard.upcomingShifts}
                    </h3>
                    {shifts.length === 0 ? (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            {t.myDashboard.noUpcomingShifts}
                        </p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                            {shifts.slice(0, 6).map((s) => (
                                <li
                                    key={s.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        gap: 12,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{formatDate(s.date)}</div>
                                        {s.notes && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                {s.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', fontWeight: 500 }}>
                                        {slotLabel(s.slot)} · {SHIFT_SLOT_TIMES[s.slot]}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {isVolunteer && (
                <div>
                    <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: 'var(--text-secondary)' }}>
                        {t.myDashboard.myAssignments}
                    </h3>
                    {assignments.length === 0 ? (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                            {t.myDashboard.noAssignments}
                        </p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                            {assignments.map((a) => (
                                <li
                                    key={a.id}
                                    style={{
                                        padding: '10px 12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                    }}
                                >
                                    <div style={{ fontWeight: 600 }}>
                                        {a.houseName} · {a.roomName}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        {a.houseAddress}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)', marginTop: 4 }}>
                                        {formatDate(a.startDate)} — {formatDate(a.endDate)}
                                    </div>
                                    {a.hospitalityContact && (
                                        <div style={{
                                            marginTop: 8,
                                            padding: '6px 10px',
                                            background: 'rgba(16,185,129,0.08)',
                                            border: '1px solid rgba(16,185,129,0.2)',
                                            borderRadius: 6,
                                            fontSize: '0.8rem',
                                            color: '#34d399',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap',
                                        }}>
                                            <span>🤝 <strong>Your hospitality contact:</strong> {a.hospitalityContact.name}</span>
                                            {a.hospitalityContact.phone && (
                                                <a
                                                    href={`tel:${a.hospitalityContact.phone}`}
                                                    style={{ color: '#34d399', fontWeight: 600, textDecoration: 'none' }}
                                                >
                                                    📞 {a.hospitalityContact.phone}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
