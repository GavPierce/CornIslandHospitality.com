'use client';

import { createAssignment, deleteAssignment } from '@/actions/housing';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';

type Room = {
    id: string;
    name: string;
    capacity: number;
    assignments: {
        id: string;
        startDate: string;
        endDate: string;
        volunteer: { id: string; name: string; type: string };
    }[];
};

type House = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    rooms: Room[];
};

type Volunteer = {
    id: string;
    name: string;
    type: string;
    assignments: {
        id: string;
        room: { name: string; house: { name: string } };
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

export default function PlanningClient({
    houses,
    volunteers,
}: {
    houses: House[];
    volunteers: Volunteer[];
}) {
    const { t } = useTranslation();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const unassignedVolunteers = volunteers.filter((v) => v.assignments.length === 0);

    // Build flat list of all rooms with house info
    const allRooms = houses.flatMap((h) =>
        h.rooms.map((r) => ({
            ...r,
            houseName: h.name,
            houseAcceptedTypes: h.acceptedTypes,
        }))
    );

    function typeLabel(type: string) {
        switch (type) {
            case 'SINGLE_BROTHER': return t.types.singleBrother;
            case 'SINGLE_SISTER': return t.types.singleSister;
            case 'MARRIED_COUPLE': return t.types.marriedCouple;
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
    }

    async function handleAssign(formData: FormData) {
        setError('');
        setSuccess('');
        const result = await createAssignment(formData);
        if (result?.error) setError(result.error);
        else setSuccess(t.planning.assignmentSuccess);
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.planning.title}</h1>
                <p>{t.planning.subtitle}</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Assignment Form */}
            <div className="glass-panel form-card">
                <h3>{t.planning.newAssignment}</h3>
                <form action={handleAssign}>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="assign-volunteer">{t.planning.volunteer}</label>
                            <select id="assign-volunteer" name="volunteerId" required>
                                <option value="">{t.planning.selectVolunteer}</option>
                                {unassignedVolunteers.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.name} ({typeLabel(v.type)})
                                    </option>
                                ))}
                                {unassignedVolunteers.length === 0 && (
                                    <option disabled>{t.planning.allVolunteersAssigned}</option>
                                )}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="assign-room">{t.planning.room}</label>
                            <select id="assign-room" name="roomId" required>
                                <option value="">{t.planning.selectRoom}</option>
                                {allRooms.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.houseName} — {r.name} ({r.assignments.length}/{r.capacity})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="assign-start">{t.planning.startDate}</label>
                            <input id="assign-start" name="startDate" type="date" required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="assign-end">{t.planning.endDate}</label>
                            <input id="assign-end" name="endDate" type="date" required />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary">{t.planning.assignVolunteer}</button>
                </form>
            </div>

            {/* Current Assignments by House */}
            <div className="section">
                <h2 style={{ marginBottom: 16 }}>{t.planning.currentAssignments}</h2>
                {houses.length === 0 ? (
                    <div className="glass-panel empty-state">
                        <div className="empty-icon">📋</div>
                        <h3>{t.planning.noHouses}</h3>
                        <p>{t.planning.noHousesDesc}</p>
                    </div>
                ) : (
                    <div className="houses-grid">
                        {houses.map((house) => (
                            <div key={house.id} className="glass-panel house-card">
                                <div className="house-card-header">
                                    <div>
                                        <h3>{house.name}</h3>
                                        <div className="address">{house.address}</div>
                                    </div>
                                    <div className="accepted-types">
                                        {house.acceptedTypes.map((tp) => (
                                            <span key={tp} className={typeBadgeClass(tp)}>
                                                {typeLabel(tp)}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {house.rooms.length === 0 ? (
                                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', padding: '12px 0' }}>
                                        {t.planning.noRoomsYet}
                                    </div>
                                ) : (
                                    <div className="room-list">
                                        {house.rooms.map((room) => (
                                            <div key={room.id} className="room-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: room.assignments.length > 0 ? 8 : 0 }}>
                                                    <span className="room-name">{room.name}</span>
                                                    <span className="room-occupancy">{room.assignments.length}/{room.capacity} {t.planning.beds}</span>
                                                </div>
                                                {room.assignments.map((a) => (
                                                    <div
                                                        key={a.id}
                                                        style={{
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            padding: '6px 12px',
                                                            background: 'var(--bg-primary)',
                                                            borderRadius: 'var(--radius-sm)',
                                                            marginBottom: 4,
                                                            fontSize: '0.825rem',
                                                        }}
                                                    >
                                                        <div>
                                                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                {a.volunteer.name}
                                                            </span>
                                                            <span className={typeBadgeClass(a.volunteer.type)} style={{ marginLeft: 8 }}>
                                                                {typeLabel(a.volunteer.type)}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                                                {new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}
                                                            </span>
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => deleteAssignment(a.id)}
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Unassigned Volunteers */}
            {unassignedVolunteers.length > 0 && (
                <div className="section">
                    <h2 style={{ marginBottom: 16 }}>{t.planning.unassignedVolunteers} ({unassignedVolunteers.length})</h2>
                    <div className="glass-panel data-table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t.planning.nameCol}</th>
                                    <th>{t.planning.typeCol}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unassignedVolunteers.map((v) => (
                                    <tr key={v.id}>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v.name}</td>
                                        <td>
                                            <span className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
