'use client';

import { createVolunteer, deleteVolunteer, updateVolunteer } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';

type VolunteerWithAssignments = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string;
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

export default function VolunteersClient({
    volunteers,
    role,
}: {
    volunteers: VolunteerWithAssignments[];
    role: UserRole;
}) {
    const isAdmin = role === 'admin';
    const { t } = useTranslation();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState('');

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
        else setShowForm(false);
    }

    async function handleUpdate(formData: FormData) {
        setError('');
        const result = await updateVolunteer(formData);
        if (result?.error) setError(result.error);
        else setEditingId(null);
    }

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
                            <button type="submit" className="btn btn-primary">{t.volunteers.addVolunteerBtn}</button>
                        </form>
                    </div>
                )}

                {volunteers.length === 0 ? (
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
                                    <th>{t.volunteers.contactCol}</th>
                                    <th>{t.volunteers.currentAssignment}</th>
                                    {isAdmin && <th></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {volunteers.map((v) => {
                                    const currentAssignment = v.assignments[0];
                                    if (editingId === v.id) {
                                        return (
                                            <tr key={v.id}>
                                                <td colSpan={isAdmin ? 5 : 4}>
                                                    <form
                                                        action={handleUpdate}
                                                        style={{
                                                            display: 'grid',
                                                            gap: 8,
                                                            gridTemplateColumns:
                                                                '1fr 1fr 1fr 1fr auto auto',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <input type="hidden" name="id" value={v.id} />
                                                        <input
                                                            name="name"
                                                            defaultValue={v.name}
                                                            required
                                                            placeholder="Name"
                                                            className="form-input"
                                                        />
                                                        <select
                                                            name="type"
                                                            defaultValue={v.type}
                                                            className="form-input"
                                                        >
                                                            <option value="SINGLE_BROTHER">{t.types.singleBrother}</option>
                                                            <option value="SINGLE_SISTER">{t.types.singleSister}</option>
                                                            <option value="MARRIED_COUPLE">{t.types.marriedCouple}</option>
                                                        </select>
                                                        <input
                                                            name="phone"
                                                            defaultValue={v.phone ?? ''}
                                                            placeholder="+50588881111"
                                                            type="tel"
                                                            className="form-input"
                                                        />
                                                        <input
                                                            name="email"
                                                            defaultValue={v.email ?? ''}
                                                            placeholder="email@example.com"
                                                            type="email"
                                                            className="form-input"
                                                        />
                                                        <button type="submit" className="btn btn-primary btn-sm">
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm"
                                                            onClick={() => setEditingId(null)}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </form>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    return (
                                        <tr key={v.id}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v.name}</td>
                                            <td>
                                                <span className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</span>
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
                                                        className="btn btn-sm"
                                                        onClick={() => setEditingId(v.id)}
                                                    >
                                                        Edit
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
