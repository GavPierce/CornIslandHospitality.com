'use client';

import { createAssignment, deleteAssignment, createHouse, createRoom, deleteHouse, deleteRoom, updateHouseOwner } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import HousesPdfButton from '../HousesPdfButton';

type Room = {
    id: string;
    name: string;
    capacity: number;
    assignments: {
        id: string;
        startDate: Date;
        endDate: Date;
        volunteer: { id: string; name: string; type: string };
    }[];
};

type House = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    owner: { id: string; name: string; phone: string | null } | null;
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
    role,
}: {
    houses: House[];
    volunteers: Volunteer[];
    role: UserRole;
}) {
    const isAdmin = role === 'admin';
    const { t } = useTranslation();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showHouseForm, setShowHouseForm] = useState(false);
    const [expandedHouse, setExpandedHouse] = useState<string | null>(null);
    // Per-house owner-picker state: houseId → 'idle' | 'picking'
    const [ownerPickerOpen, setOwnerPickerOpen] = useState<string | null>(null);
    const [ownerPickerValue, setOwnerPickerValue] = useState<Record<string, string>>({});

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

    async function handleCreateHouse(formData: FormData) {
        setError('');
        const result = await createHouse(formData);
        if (result?.error) setError(result.error);
        else setShowHouseForm(false);
    }

    async function handleCreateRoom(formData: FormData) {
        setError('');
        const result = await createRoom(formData);
        if (result?.error) setError(result.error);
    }

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <h1>{t.planning.title}</h1>
                <p>{t.planning.subtitle}</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* ── Houses Section ─────────────────────────────────────── */}
            <div className="section">
                <div className="section-header">
                    <h2>{t.dashboard.houses}</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <HousesPdfButton houses={houses} />
                        {isAdmin && (
                            <button className="btn btn-primary" onClick={() => setShowHouseForm(!showHouseForm)}>
                                {showHouseForm ? t.dashboard.cancel : t.dashboard.addHouse}
                            </button>
                        )}
                    </div>
                </div>

                {isAdmin && showHouseForm && (
                    <div className="glass-panel form-card">
                        <h3>{t.dashboard.newHouse}</h3>
                        <form action={handleCreateHouse}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="house-name">{t.dashboard.name}</label>
                                    <input id="house-name" name="name" placeholder={t.dashboard.namePlaceholder} required />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="house-address">{t.dashboard.address}</label>
                                    <input id="house-address" name="address" placeholder={t.dashboard.addressPlaceholder} required />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>{t.dashboard.acceptedVolunteerTypes}</label>
                                <div className="checkbox-group">
                                    <label>
                                        <input type="checkbox" name="acceptedTypes" value="SINGLE_BROTHER" />
                                        {t.types.singleBrother}
                                    </label>
                                    <label>
                                        <input type="checkbox" name="acceptedTypes" value="SINGLE_SISTER" />
                                        {t.types.singleSister}
                                    </label>
                                    <label>
                                        <input type="checkbox" name="acceptedTypes" value="MARRIED_COUPLE" />
                                        {t.types.marriedCouple}
                                    </label>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label htmlFor="house-owner">Owner (optional)</label>
                                <select id="house-owner" name="ownerId">
                                    <option value="">No owner assigned</option>
                                    {volunteers.map((v) => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary">{t.dashboard.createHouse}</button>
                        </form>
                    </div>
                )}

                {houses.length === 0 ? (
                    <div className="glass-panel empty-state">
                        <div className="empty-icon">🏡</div>
                        <h3>{t.dashboard.noHousesYet}</h3>
                        <p>{t.dashboard.noHousesDesc}</p>
                    </div>
                ) : (
                    <div className="houses-grid">
                        {houses.map((house) => {
                            const totalRoomCap = house.rooms.reduce((s, r) => s + r.capacity, 0);
                            const totalAssigned = house.rooms.reduce((s, r) => s + r.assignments.length, 0);
                            const isExpanded = expandedHouse === house.id;

                            return (
                                <div key={house.id} className="glass-panel house-card">
                                    <div className="house-card-header">
                                        <div>
                                            <h3>{house.name}</h3>
                                            <div className="address">{house.address}</div>
                                        </div>
                                        {isAdmin && (
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => deleteHouse(house.id)}
                                            >
                                                {t.dashboard.delete}
                                            </button>
                                        )}
                                    </div>

                                    <div className="accepted-types">
                                        {house.acceptedTypes.map((tp) => (
                                            <span key={tp} className={typeBadgeClass(tp)}>
                                                {typeLabel(tp)}
                                            </span>
                                        ))}
                                    </div>

                                    {/* ── Owner row ───────────────────── */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 0',
                                        borderBottom: '1px solid var(--border-color)',
                                        marginBottom: 10,
                                        flexWrap: 'wrap',
                                    }}>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 44 }}>🏠 Owner:</span>
                                        {house.owner ? (
                                            <>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{house.owner.name}</span>
                                                {house.owner.phone && (
                                                    <a href={`tel:${house.owner.phone}`} style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}>
                                                        📞 {house.owner.phone}
                                                    </a>
                                                )}
                                                {isAdmin && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ marginLeft: 'auto', fontSize: '0.72rem', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}
                                                        onClick={() => { setOwnerPickerOpen(ownerPickerOpen === house.id ? null : house.id); }}
                                                    >
                                                        Change
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            isAdmin ? (
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ fontSize: '0.78rem', border: '1px solid var(--border-color)', color: 'var(--accent-secondary)' }}
                                                    onClick={() => setOwnerPickerOpen(ownerPickerOpen === house.id ? null : house.id)}
                                                >
                                                    + Assign Owner
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>None</span>
                                            )
                                        )}
                                        {/* Inline picker */}
                                        {isAdmin && ownerPickerOpen === house.id && (
                                            <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4, flexWrap: 'wrap' }}>
                                                <select
                                                    style={{ flex: 1, minWidth: 0, padding: '6px 8px', fontSize: '0.82rem' }}
                                                    value={ownerPickerValue[house.id] ?? house.owner?.id ?? ''}
                                                    onChange={(e) => setOwnerPickerValue((prev) => ({ ...prev, [house.id]: e.target.value }))}
                                                >
                                                    <option value="">No owner</option>
                                                    {volunteers.map((v) => (
                                                        <option key={v.id} value={v.id}>{v.name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={async () => {
                                                        const newId = ownerPickerValue[house.id] ?? null;
                                                        await updateHouseOwner(house.id, newId || null);
                                                        setOwnerPickerOpen(null);
                                                    }}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="btn btn-sm"
                                                    style={{ border: '1px solid var(--border-color)' }}
                                                    onClick={() => setOwnerPickerOpen(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ fontSize: '0.825rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                                        {totalAssigned} / {totalRoomCap} {t.dashboard.bedsOccupied} · {house.rooms.length} {house.rooms.length !== 1 ? t.dashboard.rooms : t.dashboard.room}
                                    </div>

                                    <div className="room-list">
                                        {house.rooms.map((room) => {
                                            const pct = room.capacity > 0 ? (room.assignments.length / room.capacity) * 100 : 0;
                                            const fillClass = pct >= 100 ? 'full' : pct >= 50 ? 'mid' : 'low';

                                            return (
                                                <div key={room.id} className="room-item">
                                                    <div>
                                                        <span className="room-name">{room.name}</span>
                                                        {room.assignments.length > 0 && (
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                                {room.assignments.map((a) => a.volunteer.name).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <span className="room-occupancy">
                                                            {room.assignments.length}/{room.capacity}
                                                        </span>
                                                        <div className="occupancy-bar">
                                                            <div className={`fill ${fillClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                        </div>
                                                        {isAdmin && (
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                style={{ marginLeft: 8 }}
                                                                onClick={() => deleteRoom(room.id)}
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Add Room form */}
                                    {isAdmin && (
                                        <div style={{ marginTop: 12 }}>
                                            {isExpanded ? (
                                                <form action={handleCreateRoom} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                    <input type="hidden" name="houseId" value={house.id} />
                                                    <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                                                        <label>{t.dashboard.roomName}</label>
                                                        <input name="name" placeholder={t.dashboard.roomNamePlaceholder} required style={{ padding: '8px 10px', fontSize: '0.825rem' }} />
                                                    </div>
                                                    <div className="form-group" style={{ width: 80 }}>
                                                        <label>{t.dashboard.beds}</label>
                                                        <input name="capacity" type="number" min="1" defaultValue="1" required style={{ padding: '8px 10px', fontSize: '0.825rem' }} />
                                                    </div>
                                                    <button type="submit" className="btn btn-primary btn-sm">{t.dashboard.add}</button>
                                                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setExpandedHouse(null)}>✕</button>
                                                </form>
                                            ) : (
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    style={{ width: '100%' }}
                                                    onClick={() => setExpandedHouse(house.id)}
                                                >
                                                    {t.dashboard.addRoom}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── New Assignment Form ─────────────────────────────────── */}
            {isAdmin && (
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
            )}

            {/* ── Current Assignments by House ───────────────────────── */}
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
                                                            gap: 8,
                                                            flexWrap: 'wrap',
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
                                                        {isAdmin && (
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
                                                        )}
                                                        {!isAdmin && (
                                                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                                                {new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}
                                                            </span>
                                                        )}
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

            {/* ── Unassigned Volunteers ──────────────────────────────── */}
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
