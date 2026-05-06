'use client';

import { createAssignment, deleteAssignment, createHouse, createRoom, deleteHouse, deleteRoom, addHouseOwner, removeHouseOwner, updateAssignmentHospitality } from '@/actions/housing';
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
        hospitalityMember: { id: string; name: string; phone: string | null } | null;
    }[];
};

type HouseOwnerEntry = {
    volunteer: { id: string; name: string; phone: string | null };
};

type House = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    owners: HouseOwnerEntry[];
    rooms: Room[];
};

type Volunteer = {
    id: string;
    name: string;
    type: string;
    isHospitality: boolean;
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
    const isAdmin = role === 'admin' || role === 'hospitality';
    const { t } = useTranslation();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showHouseForm, setShowHouseForm] = useState(false);
    const [expandedHouse, setExpandedHouse] = useState<string | null>(null);
    // Per-house add-owner picker: houseId → selected volunteerId in the dropdown
    const [addOwnerOpen, setAddOwnerOpen] = useState<string | null>(null);
    const [addOwnerValue, setAddOwnerValue] = useState<Record<string, string>>({});
    // Per-assignment hospitality picker: assignmentId → open state
    const [hospPickerOpen, setHospPickerOpen] = useState<string | null>(null);
    const [hospPickerValue, setHospPickerValue] = useState<Record<string, string>>({});

    const hospitalityMembers = volunteers.filter((v) => v.isHospitality);

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
                            {/* Multi-owner picker at creation time */}
                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label>Owners (optional — select one or more)</label>
                                <div className="checkbox-group" style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                                    {volunteers.length === 0 ? (
                                        <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>No volunteers yet</span>
                                    ) : (
                                        volunteers.map((v) => (
                                            <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input type="checkbox" name="ownerIds" value={v.id} style={{ width: 16, height: 16 }} />
                                                <span style={{ fontSize: '0.85rem' }}>{v.name}</span>
                                                <span className={typeBadgeClass(v.type)} style={{ fontSize: '0.72rem' }}>{typeLabel(v.type)}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
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

                            // Volunteers not already owning this house
                            const currentOwnerIds = new Set(house.owners.map((o) => o.volunteer.id));
                            const availableToAdd = volunteers.filter((v) => !currentOwnerIds.has(v.id));

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

                                    {/* ── Owners row ───────────────────── */}
                                    <div style={{
                                        padding: '8px 0',
                                        borderBottom: '1px solid var(--border-color)',
                                        marginBottom: 10,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: house.owners.length > 0 ? 6 : 0 }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600, minWidth: 44 }}>🏠 Owners:</span>
                                            {house.owners.length === 0 && (
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>None</span>
                                            )}
                                        </div>

                                        {/* Owner chips */}
                                        {house.owners.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                                                {house.owners.map((ownerRow) => (
                                                    <div
                                                        key={ownerRow.volunteer.id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            padding: '3px 8px',
                                                            background: 'rgba(var(--accent-rgb, 99,102,241), 0.1)',
                                                            border: '1px solid rgba(var(--accent-rgb, 99,102,241), 0.25)',
                                                            borderRadius: 999,
                                                            fontSize: '0.8rem',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        <span>{ownerRow.volunteer.name}</span>
                                                        {ownerRow.volunteer.phone && (
                                                            <a
                                                                href={`tel:${ownerRow.volunteer.phone}`}
                                                                style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textDecoration: 'none' }}
                                                            >
                                                                📞
                                                            </a>
                                                        )}
                                                        {isAdmin && (
                                                            <button
                                                                title={`Remove ${ownerRow.volunteer.name} as owner`}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    padding: '0 2px',
                                                                    lineHeight: 1,
                                                                    color: 'var(--text-tertiary)',
                                                                    fontSize: '0.75rem',
                                                                }}
                                                                onClick={() => removeHouseOwner(house.id, ownerRow.volunteer.id)}
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add owner picker */}
                                        {isAdmin && (
                                            addOwnerOpen === house.id ? (
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                                                    <select
                                                        style={{ flex: 1, minWidth: 0, padding: '5px 8px', fontSize: '0.82rem' }}
                                                        value={addOwnerValue[house.id] ?? ''}
                                                        onChange={(e) => setAddOwnerValue((prev) => ({ ...prev, [house.id]: e.target.value }))}
                                                    >
                                                        <option value="">— select volunteer —</option>
                                                        {availableToAdd.map((v) => (
                                                            <option key={v.id} value={v.id}>{v.name}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        disabled={!addOwnerValue[house.id]}
                                                        onClick={async () => {
                                                            const vid = addOwnerValue[house.id];
                                                            if (!vid) return;
                                                            await addHouseOwner(house.id, vid);
                                                            setAddOwnerOpen(null);
                                                            setAddOwnerValue((prev) => ({ ...prev, [house.id]: '' }));
                                                        }}
                                                    >
                                                        Add
                                                    </button>
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ border: '1px solid var(--border-color)' }}
                                                        onClick={() => setAddOwnerOpen(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                availableToAdd.length > 0 && (
                                                    <button
                                                        className="btn btn-sm"
                                                        style={{ fontSize: '0.78rem', border: '1px solid var(--border-color)', color: 'var(--accent-secondary)' }}
                                                        onClick={() => setAddOwnerOpen(house.id)}
                                                    >
                                                        + Add Owner
                                                    </button>
                                                )
                                            )
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
                                {allRooms.map((r) => {
                                    const allMarried =
                                        r.assignments.length > 0 &&
                                        r.assignments.every((a) => a.volunteer.type === 'MARRIED_COUPLE');
                                    const effectiveCap = allMarried ? Math.max(r.capacity, 2) : r.capacity;
                                    return (
                                        <option key={r.id} value={r.id}>
                                            {r.houseName} — {r.name} ({r.assignments.length}/{effectiveCap})
                                        </option>
                                    );
                                })}
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
                    {hospitalityMembers.length > 0 && (
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label htmlFor="assign-hospitality">🤝 Hospitality contact (optional)</label>
                            <select id="assign-hospitality" name="hospitalityMemberId">
                                <option value="">No hospitality contact</option>
                                {hospitalityMembers.map((v) => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
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
                                                            {/* Hospitality contact chip */}
                                                            {a.hospitalityMember && (
                                                                <span style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                                                    marginLeft: 8, padding: '2px 7px',
                                                                    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                                                                    borderRadius: 999, fontSize: '0.73rem', fontWeight: 500, color: '#34d399',
                                                                }}>
                                                                    🤝 {a.hospitalityMember.name}
                                                                    {a.hospitalityMember.phone && <span style={{ color: 'var(--text-tertiary)' }}>· {a.hospitalityMember.phone}</span>}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {isAdmin && (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                                                                        {new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}
                                                                    </span>
                                                                    <button
                                                                        className="btn btn-sm"
                                                                        style={{ fontSize: '0.72rem', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}
                                                                        onClick={() => setHospPickerOpen(hospPickerOpen === a.id ? null : a.id)}
                                                                    >
                                                                        🤝 {a.hospitalityMember ? 'Change' : 'Assign'}
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-danger btn-sm"
                                                                        onClick={() => deleteAssignment(a.id)}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                                {hospPickerOpen === a.id && (
                                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                                                                        <select
                                                                            style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: 140 }}
                                                                            value={hospPickerValue[a.id] ?? a.hospitalityMember?.id ?? ''}
                                                                            onChange={(e) => setHospPickerValue((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                                                        >
                                                                            <option value="">No contact</option>
                                                                            {hospitalityMembers.map((v) => (
                                                                                <option key={v.id} value={v.id}>{v.name}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button
                                                                            className="btn btn-primary btn-sm"
                                                                            onClick={async () => {
                                                                                const newId = hospPickerValue[a.id] ?? '';
                                                                                await updateAssignmentHospitality(a.id, newId || null);
                                                                                setHospPickerOpen(null);
                                                                            }}
                                                                        >Save</button>
                                                                        <button className="btn btn-sm" style={{ border: '1px solid var(--border-color)' }} onClick={() => setHospPickerOpen(null)}>Cancel</button>
                                                                    </div>
                                                                )}
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
