'use client';

import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';

type Assignment = {
    id: string;
    startDate: string;
    endDate: string;
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

function typeColor(type: string): string {
    switch (type) {
        case 'SINGLE_BROTHER': return 'var(--accent-primary)';
        case 'SINGLE_SISTER': return '#ec4899';
        case 'MARRIED_COUPLE': return 'var(--success)';
        default: return 'var(--text-tertiary)';
    }
}

function typeBgColor(type: string): string {
    switch (type) {
        case 'SINGLE_BROTHER': return 'rgba(59, 130, 246, 0.25)';
        case 'SINGLE_SISTER': return 'rgba(236, 72, 153, 0.25)';
        case 'MARRIED_COUPLE': return 'rgba(16, 185, 129, 0.25)';
        default: return 'rgba(255,255,255,0.1)';
    }
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

export default function CalendarClient({ houses }: { houses: House[] }) {
    const { locale, t } = useTranslation();
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [selectedHouseId, setSelectedHouseId] = useState<string>('all');

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth, daysInMonth, 23, 59, 59);

    // Format month/year using current locale
    function formatMonthYear(date: Date): string {
        return date.toLocaleString(locale === 'es' ? 'es' : 'default', { month: 'long', year: 'numeric' });
    }

    // Filter houses
    const filteredHouses = selectedHouseId === 'all'
        ? houses
        : houses.filter((h) => h.id === selectedHouseId);

    // Flatten rooms with house name
    const rooms = filteredHouses.flatMap((h) =>
        h.rooms.map((r) => ({
            ...r,
            houseName: h.name,
        }))
    );

    function prevMonth() {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    }

    function nextMonth() {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    }

    function goToToday() {
        setCurrentMonth(today.getMonth());
        setCurrentYear(today.getFullYear());
    }

    // Calculate left offset and width percentage for an assignment bar
    function getBarStyle(assignment: Assignment) {
        const start = new Date(assignment.startDate);
        const end = new Date(assignment.endDate);

        // Clamp to visible month
        const visStart = start < monthStart ? monthStart : start;
        const visEnd = end > monthEnd ? monthEnd : end;

        const startDay = visStart.getDate();
        const endDay = visEnd.getDate();

        const leftPct = ((startDay - 1) / daysInMonth) * 100;
        const widthPct = ((endDay - startDay + 1) / daysInMonth) * 100;

        return {
            left: `${leftPct}%`,
            width: `${Math.max(widthPct, (1 / daysInMonth) * 100)}%`,
        };
    }

    // Check if an assignment overlaps with the current month
    function overlapsMonth(assignment: Assignment) {
        const start = new Date(assignment.startDate);
        const end = new Date(assignment.endDate);
        return start <= monthEnd && end >= monthStart;
    }

    const todayDay = today.getMonth() === currentMonth && today.getFullYear() === currentYear
        ? today.getDate() : -1;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.calendar.title}</h1>
                <p>{t.calendar.subtitle}</p>
            </div>

            {/* Controls */}
            <div className="cal-controls">
                <div className="cal-nav">
                    <button className="btn btn-primary btn-sm" onClick={prevMonth}>
                        {t.calendar.prev}
                    </button>
                    <h2 className="cal-month-label">{formatMonthYear(new Date(currentYear, currentMonth))}</h2>
                    <button className="btn btn-primary btn-sm" onClick={nextMonth}>
                        {t.calendar.next}
                    </button>
                    <button className="btn btn-sm" onClick={goToToday} style={{ color: 'var(--accent-secondary)', border: '1px solid var(--border-color)' }}>
                        {t.calendar.today}
                    </button>
                </div>
                <div className="cal-filter">
                    <label htmlFor="house-filter" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t.calendar.house}
                    </label>
                    <select
                        id="house-filter"
                        value={selectedHouseId}
                        onChange={(e) => setSelectedHouseId(e.target.value)}
                        style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                        }}
                    >
                        <option value="all">{t.calendar.allHouses}</option>
                        {houses.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Legend */}
            <div className="cal-legend">
                <span className="cal-legend-item">
                    <span className="cal-legend-dot" style={{ background: 'var(--accent-primary)' }} />
                    {t.types.singleBrother}
                </span>
                <span className="cal-legend-item">
                    <span className="cal-legend-dot" style={{ background: '#ec4899' }} />
                    {t.types.singleSister}
                </span>
                <span className="cal-legend-item">
                    <span className="cal-legend-dot" style={{ background: 'var(--success)' }} />
                    {t.types.marriedCouple}
                </span>
            </div>

            {/* Timeline */}
            {rooms.length === 0 ? (
                <div className="glass-panel empty-state">
                    <div className="empty-icon">📅</div>
                    <h3>{t.calendar.noRooms}</h3>
                    <p>{t.calendar.noRoomsDesc}</p>
                </div>
            ) : (
                <div className="glass-panel cal-timeline-wrapper">
                    {/* Day Headers */}
                    <div className="cal-row cal-header-row">
                        <div className="cal-room-label cal-header-label">{t.calendar.roomCol}</div>
                        <div className="cal-days-track">
                            {days.map((d) => {
                                const date = new Date(currentYear, currentMonth, d);
                                const dayName = date.toLocaleString(locale === 'es' ? 'es' : 'default', { weekday: 'short' });
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                const isToday = d === todayDay;

                                return (
                                    <div
                                        key={d}
                                        className={`cal-day-header ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}
                                        style={{ width: `${100 / daysInMonth}%` }}
                                    >
                                        <span className="cal-day-name">{dayName}</span>
                                        <span className="cal-day-num">{d}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Room Rows */}
                    {rooms.map((room) => {
                        const visibleAssignments = room.assignments.filter(overlapsMonth);

                        return (
                            <div key={room.id} className="cal-row">
                                <div className="cal-room-label">
                                    <div className="cal-room-name">{room.name}</div>
                                    <div className="cal-house-name">{room.houseName}</div>
                                </div>
                                <div className="cal-days-track">
                                    {/* Grid lines */}
                                    {days.map((d) => {
                                        const date = new Date(currentYear, currentMonth, d);
                                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                                        const isToday = d === todayDay;

                                        return (
                                            <div
                                                key={d}
                                                className={`cal-day-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}`}
                                                style={{ width: `${100 / daysInMonth}%` }}
                                            />
                                        );
                                    })}

                                    {/* Assignment bars */}
                                    {visibleAssignments.map((a) => {
                                        const barStyle = getBarStyle(a);
                                        return (
                                            <div
                                                key={a.id}
                                                className="cal-assignment-bar"
                                                style={{
                                                    ...barStyle,
                                                    backgroundColor: typeBgColor(a.volunteer.type),
                                                    borderLeft: `3px solid ${typeColor(a.volunteer.type)}`,
                                                }}
                                                title={`${a.volunteer.name} (${new Date(a.startDate).toLocaleDateString(locale === 'es' ? 'es' : undefined)} – ${new Date(a.endDate).toLocaleDateString(locale === 'es' ? 'es' : undefined)})`}
                                            >
                                                <span className="cal-bar-label">{a.volunteer.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
