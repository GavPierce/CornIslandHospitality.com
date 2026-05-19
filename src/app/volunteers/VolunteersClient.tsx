'use client';

import { createVolunteer, deleteVolunteer, updateVolunteer } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
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
        startDate: Date;
        endDate: Date;
        room: {
            name: string;
            house: { name: string };
        };
    }[];
};

function typeBadgeClass(type: string) {
    switch (type) {
        case 'SINGLE_BROTHER': return 'type-badge single-brother';
        case 'SINGLE_SISTER': return 'type-badge single-sister';
        case 'MARRIED_COUPLE': return 'type-badge married-couple';
        default: return 'type-badge';
    }
}

function fmtDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
}

function toInputDate(d: Date | string | null | undefined): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
}

type HousingFilter = 'all' | 'needs_rooming' | 'local';

export default function VolunteersClient({
    volunteers,
    role,
}: {
    volunteers: VolunteerWithAssignments[];
    role: UserRole;
}) {
    const isAdmin = role === 'admin' || role === 'hospitality';
    const { t } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [housingFilter, setHousingFilter] = useState<HousingFilter>('all');
    const [groupFilter, setGroupFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLocalChecked, setIsLocalChecked] = useState(false);

    // Collect distinct group names for the filter dropdown and autocomplete datalist
    const groupNames = useMemo(() => {
        const names = new Set<string>();
        volunteers.forEach((v) => { if (v.groupName) names.add(v.groupName); });
        return Array.from(names).sort();
    }, [volunteers]);

    function typeLabel(type: string) {
        switch (type) {
            case 'SINGLE_BROTHER': return t.types.singleBrother;
            case 'SINGLE_SISTER': return t.types.singleSister;
            case 'MARRIED_COUPLE': return t.types.marriedCouple;
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
    }

    async function handleCreate(formData: FormData) {
        setError('');
        const result = await createVolunteer(formData);
        if (result?.error) setError(result.error);
        else { setShowForm(false); setIsLocalChecked(false); }
    }

    async function handleUpdate(formData: FormData) {
        setError('');
        const result = await updateVolunteer(formData);
        if (result?.error) setError(result.error);
        else setEditingId(null);
    }

    // Apply filters
    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return volunteers.filter((v) => {
            if (housingFilter === 'local' && !v.isLocal) return false;
            if (housingFilter === 'needs_rooming' && v.isLocal) return false;
            if (groupFilter && v.groupName !== groupFilter) return false;
            if (q && !v.name.toLowerCase().includes(q) && !(v.email?.toLowerCase().includes(q)) && !(v.phone?.toLowerCase().includes(q)) && !(v.groupName?.toLowerCase().includes(q))) return false;
            return true;
        });
    }, [volunteers, housingFilter, groupFilter, searchQuery]);

    const localCount = volunteers.filter((v) => v.isLocal).length;
    const needsRoomingCount = volunteers.length - localCount;

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.volunteers.title}</h1>
                <p>{t.volunteers.subtitle}</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="section">
                <div className="section-header">
                    <h2>{volunteers.length} {volunteers.length !== 1 ? t.volunteers.volunteerPlural : t.volunteers.volunteer}</h2>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                            {showForm ? t.volunteers.cancel : t.volunteers.addVolunteer}
                        </button>
                    )}
                </div>

                {isAdmin && showForm && (
                    <div className="glass-panel form-card">
                        <h3>{t.volunteers.newVolunteer}</h3>
                        <form action={handleCreate}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="vol-name">{t.volunteers.fullName}</label>
                                    <input id="vol-name" name="name" placeholder={t.volunteers.fullNamePlaceholder} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vol-type">{t.volunteers.type}</label>
                                    <select id="vol-type" name="type" required>
                                        <option value="">{t.volunteers.selectType}</option>
                                        <option value="SINGLE_BROTHER">{t.types.singleBrother}</option>
                                        <option value="SINGLE_SISTER">{t.types.singleSister}</option>
                                        <option value="MARRIED_COUPLE">{t.types.marriedCouple}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="vol-email">{t.volunteers.emailOptional}</label>
                                    <input id="vol-email" name="email" type="email" placeholder={t.volunteers.emailPlaceholder} />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vol-phone">{t.volunteers.phoneOptional}</label>
                                    <input id="vol-phone" name="phone" type="tel" placeholder={t.volunteers.phonePlaceholder} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="vol-group">{t.volunteers.group}</label>
                                    <input id="vol-group" name="groupName" placeholder={t.volunteers.groupPlaceholder} list="group-names-list" />
                                    <datalist id="group-names-list">
                                        {groupNames.map((g) => <option key={g} value={g} />)}
                                    </datalist>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vol-local" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input id="vol-local" name="isLocal" type="checkbox" checked={isLocalChecked} onChange={(e) => setIsLocalChecked(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                        <span>🏠 {t.volunteers.isLocal}</span>
                                    </label>
                                </div>
                            </div>
                            {!isLocalChecked && (
                                <div className="form-row">
                                    <div className="form-group">
                                        <label htmlFor="vol-arrival">{t.volunteers.arrivalDate}</label>
                                        <input id="vol-arrival" name="arrivalDate" type="date" />
                                    </div>
                                    <div className="form-group">
                                        <label htmlFor="vol-departure">{t.volunteers.departureDate}</label>
                                        <input id="vol-departure" name="departureDate" type="date" />
                                    </div>
                                </div>
                            )}
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="vol-watchman" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input id="vol-watchman" name="isWatchman" type="checkbox" style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                        <span>Is watchman</span>
                                    </label>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="vol-hospitality" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input id="vol-hospitality" name="isHospitality" type="checkbox" style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                        <span>🤝 Is hospitality team</span>
                                    </label>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary">{t.volunteers.addVolunteerBtn}</button>
                        </form>
                    </div>
                )}

                {/* Filter Bar */}
                <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', padding: '12px 16px', marginBottom: 0 }}>
                    {/* Housing filter pills */}
                    <div style={{ display: 'flex', gap: 4 }}>
                        {([
                            { key: 'all' as HousingFilter, label: `${t.volunteers.filterAll} (${volunteers.length})` },
                            { key: 'needs_rooming' as HousingFilter, label: `${t.volunteers.filterNeedsRooming} (${needsRoomingCount})` },
                            { key: 'local' as HousingFilter, label: `🏠 ${t.volunteers.filterLocal} (${localCount})` },
                        ]).map(({ key, label }) => (
                            <button
                                key={key}
                                className={`btn btn-sm ${housingFilter === key ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setHousingFilter(key)}
                                style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: 999 }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Search */}
                    <input
                        type="search"
                        placeholder="Search by name, email, phone, group…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '5px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 220 }}
                    />
                    {/* Group filter dropdown */}
                    {groupNames.length > 0 && (
                        <select
                            value={groupFilter}
                            onChange={(e) => setGroupFilter(e.target.value)}
                            style={{ padding: '5px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        >
                            <option value="">{t.volunteers.allGroups}</option>
                            {groupNames.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    )}
                </div>

                {filtered.length === 0 ? (
                    <div className="glass-panel empty-state">
                        <div className="empty-icon">👥</div>
                        <h3>{t.volunteers.noVolunteers}</h3>
                        <p>{t.volunteers.noVolunteersDesc}</p>
                    </div>
                ) : (
                    <div className="glass-panel data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t.volunteers.nameCol}</th>
                                    <th>{t.volunteers.typeCol}</th>
                                    <th>{t.volunteers.group}</th>
                                    <th>{t.volunteers.stayDates}</th>
                                    <th>{t.volunteers.contactCol}</th>
                                    <th>{t.volunteers.currentAssignment}</th>
                                    {isAdmin && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((v) => {
                                    const currentAssignment = v.assignments[0];
                                    if (editingId === v.id) {
                                        return (
                                            <EditRow
                                                key={v.id}
                                                v={v}
                                                isAdmin={isAdmin}
                                                groupNames={groupNames}
                                                handleUpdate={handleUpdate}
                                                onCancel={() => setEditingId(null)}
                                                t={t}
                                            />
                                        );
                                    }
                                    return (
                                        <tr key={v.id}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {v.name}
                                                {v.isLocal && (
                                                    <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 999, fontWeight: 500 }}>
                                                        🏠 {t.volunteers.local}
                                                    </span>
                                                )}
                                                {v.isWatchman && (
                                                    <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: 999, fontWeight: 500 }}>
                                                        Watchman
                                                    </span>
                                                )}
                                                {v.isHospitality && (
                                                    <span style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', borderRadius: 999, fontWeight: 500 }}>
                                                        🤝 Hospitality
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</span>
                                            </td>
                                            <td>
                                                {v.groupName ? (
                                                    <span style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderRadius: 999, fontWeight: 500 }}>
                                                        {v.groupName}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td>
                                                {v.isLocal ? (
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>N/A</span>
                                                ) : v.arrivalDate || v.departureDate ? (
                                                    <span style={{ fontSize: '0.82rem' }}>
                                                        {fmtDate(v.arrivalDate)} – {fmtDate(v.departureDate)}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--warning)', fontSize: '0.82rem' }}>Not set</span>
                                                )}
                                            </td>
                                            <td>
                                                {v.email && <div>{v.email}</div>}
                                                {v.phone && <div>{v.phone}</div>}
                                                {!v.email && !v.phone && '—'}
                                            </td>
                                            <td>
                                                {currentAssignment ? (
                                                    <span>
                                                        {currentAssignment.room.house.name} — {currentAssignment.room.name}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--warning)' }}>{t.volunteers.unassigned}</span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => setEditingId(v.id)}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    <button
                                                        className="btn btn-danger btn-sm"
                                                        onClick={() => deleteVolunteer(v.id)}
                                                    >
                                                        {t.volunteers.delete}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Inline Edit Row (extracted for clarity) ─── */
function EditRow({
    v,
    isAdmin,
    groupNames,
    handleUpdate,
    onCancel,
    t,
}: {
    v: VolunteerWithAssignments;
    isAdmin: boolean;
    groupNames: string[];
    handleUpdate: (fd: FormData) => Promise<void>;
    onCancel: () => void;
    t: ReturnType<typeof import('@/i18n/LanguageContext').useTranslation>['t'];
}) {
    const [editLocal, setEditLocal] = useState(v.isLocal);
    const fieldStyle: React.CSSProperties = {
        width: '100%',
        padding: '7px 10px',
        fontSize: '0.85rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
    };
    const labelStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--text-tertiary)',
    };
    return (
        <tr>
            <td colSpan={isAdmin ? 7 : 6} style={{ padding: '12px 8px' }}>
                <form action={handleUpdate}>
                    <input type="hidden" name="id" value={v.id} />
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Editing: {v.name}</span>
                            <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-tertiary)' }}>✕</button>
                        </div>

                        {/* Row 1: Name + Type */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                {t.volunteers.fullName}
                                <input name="name" defaultValue={v.name} required style={fieldStyle} />
                            </label>
                            <label style={labelStyle}>
                                {t.volunteers.type}
                                <select name="type" defaultValue={v.type} style={fieldStyle}>
                                    <option value="SINGLE_BROTHER">{t.types.singleBrother}</option>
                                    <option value="SINGLE_SISTER">{t.types.singleSister}</option>
                                    <option value="MARRIED_COUPLE">{t.types.marriedCouple}</option>
                                </select>
                            </label>
                        </div>

                        {/* Row 2: Phone + Email + Group + Language */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                            <label style={labelStyle}>
                                {t.volunteers.phoneOptional}
                                <input name="phone" defaultValue={v.phone ?? ''} placeholder="+50588881111" type="tel" style={fieldStyle} />
                            </label>
                            <label style={labelStyle}>
                                {t.volunteers.emailOptional}
                                <input name="email" defaultValue={v.email ?? ''} placeholder="email@example.com" type="email" style={fieldStyle} />
                            </label>
                            <label style={labelStyle}>
                                {t.volunteers.group}
                                <input type="hidden" name="groupNamePresent" value="1" />
                                <input name="groupName" defaultValue={v.groupName ?? ''} placeholder={t.volunteers.groupPlaceholder} style={fieldStyle} list="edit-group-names-list" />
                                <datalist id="edit-group-names-list">{groupNames.map((g) => <option key={g} value={g} />)}</datalist>
                            </label>
                            <label style={labelStyle}>
                                Language
                                <input type="hidden" name="languagePresent" value="1" />
                                <select name="language" defaultValue={v.language ?? ''} style={fieldStyle}>
                                    <option value="">🌐 Not set</option>
                                    <option value="EN">🇺🇸 English</option>
                                    <option value="ES">🇳🇮 Español</option>
                                </select>
                            </label>
                        </div>

                        {/* Row 3: Dates + Checkboxes */}
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <input type="hidden" name="isLocalPresent" value="1" />
                            <input type="hidden" name="arrivalDatePresent" value="1" />
                            <input type="hidden" name="departureDatePresent" value="1" />
                            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" name="isLocal" checked={editLocal} onChange={(e) => setEditLocal(e.target.checked)} style={{ width: 16, height: 16 }} />
                                🏠 {t.volunteers.local}
                            </label>
                            {!editLocal && (
                                <>
                                    <label style={labelStyle}>
                                        {t.volunteers.arrivalDate}
                                        <input name="arrivalDate" type="date" defaultValue={toInputDate(v.arrivalDate)} style={fieldStyle} />
                                    </label>
                                    <label style={labelStyle}>
                                        {t.volunteers.departureDate}
                                        <input name="departureDate" type="date" defaultValue={toInputDate(v.departureDate)} style={fieldStyle} />
                                    </label>
                                </>
                            )}
                            <input type="hidden" name="isWatchmanPresent" value="1" />
                            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" name="isWatchman" defaultChecked={v.isWatchman} style={{ width: 16, height: 16 }} />
                                👁 Watchman
                            </label>
                            <input type="hidden" name="isHospitalityPresent" value="1" />
                            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                                <input type="checkbox" name="isHospitality" defaultChecked={v.isHospitality} style={{ width: 16, height: 16 }} />
                                🤝 Hospitality
                            </label>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border-color)' }}>
                            <button type="submit" className="btn btn-primary btn-sm">Save changes</button>
                            <button type="button" className="btn btn-sm" onClick={onCancel} style={{ border: '1px solid var(--border-color)' }}>Cancel</button>
                        </div>
                    </div>
                </form>
            </td>
        </tr>
    );
}
