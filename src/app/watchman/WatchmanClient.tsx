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
import {
    SHIFT_SLOT_TIMES,
    allowedSlotsForWeekday,
} from '@/lib/watchman';
import type { ShiftSlot } from '@prisma/client';
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
    slot: ShiftSlot;
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

    // Group shifts by date key, then by slot
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of shifts) {
        const key = shiftDateKey(s.date);
        const list = shiftsByDay.get(key) ?? [];
        list.push(s);
        shiftsByDay.set(key, list);
    }

    function slotLabel(slot: ShiftSlot): string {
        const labels = t.watchman.slots;
        switch (slot) {
            case 'MORNING': return labels.morning;
            case 'AFTERNOON': return labels.afternoon;
            case 'EVENING': return labels.evening;
            case 'OVERNIGHT': return labels.overnight;
            default: return slot;
        }
    }

    function slotClass(slot: ShiftSlot): string {
        switch (slot) {
            case 'MORNING': return 'wm-shift-pill slot-morning';
            case 'AFTERNOON': return 'wm-shift-pill slot-afternoon';
            case 'EVENING': return 'wm-shift-pill slot-evening';
            case 'OVERNIGHT': return 'wm-shift-pill slot-overnight';
            default: return 'wm-shift-pill';
        }
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
        // Keep the day selected so admins can quickly add another person to the same shift.
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
    const selectedWeekday =
        selectedDay !== null
            ? new Date(Date.UTC(year, month, selectedDay)).getUTCDay()
            : -1;
    const selectedAllowedSlots =
        selectedWeekday >= 0 ? allowedSlotsForWeekday(selectedWeekday) : [];

    const MIN_PER_SHIFT = 2;

    function shiftsForSlot(slot: ShiftSlot): Shift[] {
        return selectedShifts.filter((s) => s.slot === slot);
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.watchman.title}</h1>
                <p>{t.watchman.subtitle}</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}



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
                                const weekday = new Date(
                                    Date.UTC(year, month, day)
                                ).getUTCDay();
                                const slotsForDay = allowedSlotsForWeekday(weekday);
                                const shiftsBySlot = new Map<ShiftSlot, Shift[]>();
                                for (const s of dayShifts) {
                                    const list = shiftsBySlot.get(s.slot) ?? [];
                                    list.push(s);
                                    shiftsBySlot.set(s.slot, list);
                                }
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
                                            {slotsForDay.map((slot) => {
                                                const slotShifts = shiftsBySlot.get(slot) ?? [];
                                                const count = slotShifts.length;
                                                const isUnderfilled = count < MIN_PER_SHIFT;
                                                const names = slotShifts
                                                    .map((s) => s.watchman.name)
                                                    .join(', ');
                                                return (
                                                    <span
                                                        key={slot}
                                                        className={`${slotClass(slot)}${count === 0 ? ' is-empty' : ''}${isUnderfilled && count > 0 ? ' is-underfilled' : ''}`}
                                                        title={`${slotLabel(slot)} — ${SHIFT_SLOT_TIMES[slot]}${count > 0 ? `: ${names}` : ''}`}
                                                    >
                                                        <span className="wm-pill-slot">
                                                            {slotLabel(slot)}
                                                            <span className="wm-pill-count">
                                                                {count}/{MIN_PER_SHIFT}
                                                            </span>
                                                        </span>
                                                        <span className="wm-pill-name">
                                                            {count > 0 ? names : '—'}
                                                        </span>
                                                    </span>
                                                );
                                            })}
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
                                {selectedAllowedSlots.map((slot) => {
                                    const slotShifts = shiftsForSlot(slot);
                                    const count = slotShifts.length;
                                    const isUnderfilled = count < MIN_PER_SHIFT;
                                    return (
                                        <li key={slot} className="wm-shift-group">
                                            <div className="wm-shift-group-header">
                                                <div>
                                                    <div
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.06em',
                                                            color: 'var(--text-tertiary)',
                                                        }}
                                                    >
                                                        {slotLabel(slot)} · {SHIFT_SLOT_TIMES[slot]}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: '0.8rem',
                                                            color: isUnderfilled
                                                                ? 'var(--warning)'
                                                                : 'var(--success)',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {count} / {MIN_PER_SHIFT}{' '}
                                                        {isUnderfilled
                                                            ? t.watchman.needMore
                                                            : t.watchman.staffed}
                                                    </div>
                                                </div>
                                            </div>

                                            {count === 0 ? (
                                                <div
                                                    style={{
                                                        color: 'var(--text-tertiary)',
                                                        fontSize: '0.9rem',
                                                        padding: '6px 0',
                                                    }}
                                                >
                                                    {t.watchman.unfilled}
                                                </div>
                                            ) : (
                                                <ul className="wm-person-list">
                                                    {slotShifts.map((s) => (
                                                        <li
                                                            key={s.id}
                                                            className="wm-person-row"
                                                        >
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
                                                                        handleDeleteShift(
                                                                            s.id
                                                                        )
                                                                    }
                                                                >
                                                                    {t.watchman.remove}
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {isAdmin && watchmen.length > 0 && (
                            <form action={handleAssign} key={selectedKey ?? ''}>
                                <input
                                    type="hidden"
                                    name="date"
                                    value={selectedKey ?? ''}
                                />
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="wm-shift-slot">
                                            {t.watchman.shift}
                                        </label>
                                        <select
                                            id="wm-shift-slot"
                                            name="slot"
                                            required
                                            defaultValue={selectedAllowedSlots[0]}
                                            onChange={(e) => {
                                                // Reset watchman selection when slot changes so the
                                                // filtered options are correct.
                                                const personSel = document.getElementById(
                                                    'wm-shift-person'
                                                ) as HTMLSelectElement | null;
                                                if (personSel) personSel.value = '';
                                                // Hide/show options based on slot.
                                                const slotVal = e.target.value as ShiftSlot;
                                                if (!personSel) return;
                                                const already = new Set(
                                                    shiftsForSlot(slotVal).map(
                                                        (s) => s.watchmanId
                                                    )
                                                );
                                                Array.from(personSel.options).forEach(
                                                    (opt) => {
                                                        if (!opt.value) return;
                                                        opt.hidden = already.has(opt.value);
                                                        opt.disabled = already.has(opt.value);
                                                    }
                                                );
                                            }}
                                        >
                                            {selectedAllowedSlots.map((slot) => (
                                                <option key={slot} value={slot}>
                                                    {slotLabel(slot)} ({SHIFT_SLOT_TIMES[slot]})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
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
                                            {watchmen.map((w) => {
                                                const firstSlot =
                                                    selectedAllowedSlots[0];
                                                const alreadyOnFirst = firstSlot
                                                    ? shiftsForSlot(firstSlot).some(
                                                          (s) => s.watchmanId === w.id
                                                      )
                                                    : false;
                                                return (
                                                    <option
                                                        key={w.id}
                                                        value={w.id}
                                                        hidden={alreadyOnFirst}
                                                        disabled={alreadyOnFirst}
                                                    >
                                                        {w.name}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
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
        </div>
    );
}
