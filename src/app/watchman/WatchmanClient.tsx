'use client';

import {
    createWatchman,
    createWatchmanShift,
    deleteWatchman,
    deleteWatchmanShift,
    getWatchmanShifts,
} from '@/actions/watchman';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useEffect, useState, useTransition } from 'react';

type Watchman = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
};

type Shift = {
    id: string;
    watchmanId: string;
    date: Date | string;
    notes: string | null;
    watchman: { id: string; name: string };
};

function getDaysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function firstWeekdayOfMonth(year: number, month: number): number {
    // 0 = Sunday .. 6 = Saturday
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

function toDateKey(year: number, month: number, day: number): string {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}

function shiftDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function WatchmanClient({
    watchmen,
    initialShifts,
    initialYear,
    initialMonth,
    role,
}: {
    watchmen: Watchman[];
    initialShifts: Shift[];
    initialYear: number;
    initialMonth: number;
    role: UserRole;
}) {
    const { locale, t } = useTranslation();
    const isAdmin = role === 'admin';

    const [year, setYear] = useState(initialYear);
    const [month, setMonth] = useState(initialMonth);
    const [shifts, setShifts] = useState<Shift[]>(initialShifts);
    const [showPersonForm, setShowPersonForm] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [, startTransition] = useTransition();

    // Refresh shifts when month changes
    useEffect(() => {
        let cancelled = false;
        startTransition(async () => {
            const fresh = await getWatchmanShifts(year, month);
            if (!cancelled) setShifts(fresh as Shift[]);
        });
        return () => {
            cancelled = true;
        };
    }, [year, month]);

    const daysInMonth = getDaysInMonth(year, month);
    const startWeekday = firstWeekdayOfMonth(year, month);
    const today = new Date();
    const isCurrentMonth =
        today.getUTCFullYear() === year && today.getUTCMonth() === month;
    const todayDay = isCurrentMonth ? today.getUTCDate() : -1;

    // Group shifts by date key
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of shifts) {
        const key = shiftDateKey(s.date);
        const list = shiftsByDay.get(key) ?? [];
        list.push(s);
        shiftsByDay.set(key, list);
    }

    function formatMonthYear() {
        return new Date(year, month, 1).toLocaleString(
            locale === 'es' ? 'es' : 'default',
            { month: 'long', year: 'numeric' }
        );
    }

    function prevMonth() {
        if (month === 0) {
            setMonth(11);
            setYear(year - 1);
        } else {
            setMonth(month - 1);
        }
        setSelectedDay(null);
    }

    function nextMonth() {
        if (month === 11) {
            setMonth(0);
            setYear(year + 1);
        } else {
            setMonth(month + 1);
        }
        setSelectedDay(null);
    }

    function goToToday() {
        setYear(today.getUTCFullYear());
        setMonth(today.getUTCMonth());
        setSelectedDay(null);
    }

    async function handleCreatePerson(formData: FormData) {
        setError('');
        const result = await createWatchman(formData);
        if (result?.error) setError(result.error);
        else setShowPersonForm(false);
    }

    async function handleAssign(formData: FormData) {
        setError('');
        const result = await createWatchmanShift(formData);
        if (result?.error) {
            setError(result.error);
            return;
        }
        const fresh = await getWatchmanShifts(year, month);
        setShifts(fresh as Shift[]);
        setSelectedDay(null);
    }

    async function handleDeleteShift(id: string) {
        const result = await deleteWatchmanShift(id);
        if (result?.error) {
            setError(result.error);
            return;
        }
        setShifts((prev) => prev.filter((s) => s.id !== id));
    }

    async function handleDeletePerson(id: string) {
        const result = await deleteWatchman(id);
        if (result?.error) {
            setError(result.error);
            return;
        }
        // Shifts will have been cascaded; refresh for this month
        const fresh = await getWatchmanShifts(year, month);
        setShifts(fresh as Shift[]);
    }

    const weekdayLabels =
        locale === 'es'
            ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
            : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const selectedKey =
        selectedDay !== null ? toDateKey(year, month, selectedDay) : null;
    const selectedShifts = selectedKey ? shiftsByDay.get(selectedKey) ?? [] : [];

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.watchman.title}</h1>
                <p>{t.watchman.subtitle}</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* ─── People Section ───────────────────────── */}
            <div className="section">
                <div className="section-header">
                    <h2>
                        {watchmen.length}{' '}
                        {watchmen.length !== 1
                            ? t.watchman.watchmanPlural
                            : t.watchman.watchman}
                    </h2>
                    {isAdmin && (
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowPersonForm(!showPersonForm)}
                        >
                            {showPersonForm
                                ? t.watchman.cancel
                                : t.watchman.addWatchman}
                        </button>
                    )}
                </div>

                {isAdmin && showPersonForm && (
                    <div className="glass-panel form-card">
                        <h3>{t.watchman.newWatchman}</h3>
                        <form action={handleCreatePerson}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="wm-name">
                                        {t.watchman.fullName}
                                    </label>
                                    <input
                                        id="wm-name"
                                        name="name"
                                        placeholder={
                                            t.watchman.fullNamePlaceholder
                                        }
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="wm-phone">
                                        {t.watchman.phoneOptional}
                                    </label>
                                    <input
                                        id="wm-phone"
                                        name="phone"
                                        type="tel"
                                        placeholder={
                                            t.watchman.phonePlaceholder
                                        }
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="wm-email">
                                        {t.watchman.emailOptional}
                                    </label>
                                    <input
                                        id="wm-email"
                                        name="email"
                                        type="email"
                                        placeholder={
                                            t.watchman.emailPlaceholder
                                        }
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary">
                                {t.watchman.addWatchmanBtn}
                            </button>
                        </form>
                    </div>
                )}

                {watchmen.length === 0 ? (
                    <div className="glass-panel empty-state">
                        <div className="empty-icon">🌙</div>
                        <h3>{t.watchman.noWatchmen}</h3>
                        <p>{t.watchman.noWatchmenDesc}</p>
                    </div>
                ) : (
                    <div className="glass-panel data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t.watchman.nameCol}</th>
                                    <th>{t.watchman.contactCol}</th>
                                    {isAdmin && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {watchmen.map((w) => (
                                    <tr key={w.id}>
                                        <td
                                            style={{
                                                color: 'var(--text-primary)',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {w.name}
                                        </td>
                                        <td>
                                            {w.email && <div>{w.email}</div>}
                                            {w.phone && <div>{w.phone}</div>}
                                            {!w.email && !w.phone && '—'}
                                        </td>
                                        {isAdmin && (
                                            <td>
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() =>
                                                        handleDeletePerson(w.id)
                                                    }
                                                >
                                                    {t.watchman.delete}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ─── Schedule Section ─────────────────────── */}
            <div className="section">
                <div className="section-header">
                    <h2>{t.watchman.schedule}</h2>
                </div>

                <div className="cal-controls">
                    <div className="cal-nav">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={prevMonth}
                        >
                            {t.calendar.prev}
                        </button>
                        <h2 className="cal-month-label">{formatMonthYear()}</h2>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={nextMonth}
                        >
                            {t.calendar.next}
                        </button>
                        <button
                            className="btn btn-sm"
                            onClick={goToToday}
                            style={{
                                color: 'var(--accent-secondary)',
                                border: '1px solid var(--border-color)',
                            }}
                        >
                            {t.calendar.today}
                        </button>
                    </div>
                </div>

                <div className="glass-panel wm-calendar">
                    <div className="wm-weekday-row">
                        {weekdayLabels.map((w) => (
                            <div key={w} className="wm-weekday">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="wm-day-grid">
                        {Array.from({ length: startWeekday }).map((_, i) => (
                            <div
                                key={`blank-${i}`}
                                className="wm-day wm-day-blank"
                            />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                            (day) => {
                                const key = toDateKey(year, month, day);
                                const dayShifts = shiftsByDay.get(key) ?? [];
                                const isToday = day === todayDay;
                                const isSelected = selectedDay === day;
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`wm-day ${
                                            isToday ? 'is-today' : ''
                                        } ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() =>
                                            setSelectedDay(
                                                isSelected ? null : day
                                            )
                                        }
                                    >
                                        <div className="wm-day-num">{day}</div>
                                        <div className="wm-day-shifts">
                                            {dayShifts.map((s) => (
                                                <span
                                                    key={s.id}
                                                    className="wm-shift-pill"
                                                    title={s.watchman.name}
                                                >
                                                    {s.watchman.name}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>

                {selectedDay !== null && (
                    <div className="glass-panel form-card" style={{ marginTop: '1rem' }}>
                        <h3>
                            {t.watchman.nightOf}{' '}
                            {new Date(
                                Date.UTC(year, month, selectedDay)
                            ).toLocaleDateString(
                                locale === 'es' ? 'es' : undefined,
                                {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                    timeZone: 'UTC',
                                }
                            )}
                        </h3>

                        {selectedShifts.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div
                                    style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-tertiary)',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                        marginBottom: '0.5rem',
                                    }}
                                >
                                    {t.watchman.scheduled}
                                </div>
                                <ul className="wm-shift-list">
                                    {selectedShifts.map((s) => (
                                        <li key={s.id} className="wm-shift-row">
                                            <div>
                                                <strong>
                                                    {s.watchman.name}
                                                </strong>
                                                {s.notes && (
                                                    <div
                                                        style={{
                                                            color:
                                                                'var(--text-tertiary)',
                                                            fontSize: '0.85rem',
                                                        }}
                                                    >
                                                        {s.notes}
                                                    </div>
                                                )}
                                            </div>
                                            {isAdmin && (
                                                <button
                                                    className="btn btn-danger btn-sm"
                                                    onClick={() =>
                                                        handleDeleteShift(s.id)
                                                    }
                                                >
                                                    {t.watchman.remove}
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {isAdmin && watchmen.length > 0 && (
                            <form action={handleAssign}>
                                <input
                                    type="hidden"
                                    name="date"
                                    value={selectedKey ?? ''}
                                />
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="wm-shift-person">
                                            {t.watchman.watchman}
                                        </label>
                                        <select
                                            id="wm-shift-person"
                                            name="watchmanId"
                                            required
                                        >
                                            <option value="">
                                                {t.watchman.selectWatchman}
                                            </option>
                                            {watchmen
                                                .filter(
                                                    (w) =>
                                                        !selectedShifts.some(
                                                            (s) =>
                                                                s.watchmanId ===
                                                                w.id
                                                        )
                                                )
                                                .map((w) => (
                                                    <option
                                                        key={w.id}
                                                        value={w.id}
                                                    >
                                                        {w.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="wm-shift-notes">
                                            {t.watchman.notesOptional}
                                        </label>
                                        <input
                                            id="wm-shift-notes"
                                            name="notes"
                                            placeholder={
                                                t.watchman.notesPlaceholder
                                            }
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    {t.watchman.assignForNight}
                                </button>
                            </form>
                        )}

                        {isAdmin && watchmen.length === 0 && (
                            <p style={{ color: 'var(--text-tertiary)' }}>
                                {t.watchman.addSomeoneFirst}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
