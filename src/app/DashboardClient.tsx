'use client';

import { createHouse, createRoom, deleteHouse, deleteRoom } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import HousesPdfButton from './HousesPdfButton';

type HouseWithRooms = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    rooms: {
        id: string;
        name: string;
        capacity: number;
        assignments: {
            id: string;
            volunteer: { id: string; name: string; type: string };
        }[];
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

export default function DashboardClient({
    houses,
    volunteerCount,
    activeAssignments,
    totalBeds,
    maxCapacity,
    role,
}: {
    houses: HouseWithRooms[];
    volunteerCount: number;
    activeAssignments: number;
    totalBeds: number;
    maxCapacity: number;
    role: UserRole;
}) {
    const isAdmin = role === 'admin';
    const { t } = useTranslation();
    const [showHouseForm, setShowHouseForm] = useState(false);
    const [expandedHouse, setExpandedHouse] = useState<string | null>(null);
    const [error, setError] = useState('');

    function typeLabel(type: string) {
        switch (type) {
            case 'SINGLE_BROTHER': return t.types.singleBrother;
            case 'SINGLE_SISTER': return t.types.singleSister;
            case 'MARRIED_COUPLE': return t.types.marriedCouple;
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
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
                <h1>{t.dashboard.title}</h1>
                <p>{t.dashboard.subtitle}</p>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.totalHouses}</span>
                    <span className="stat-value accent">{houses.length}</span>
                </div>
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.totalBeds}</span>
                    <span className="stat-value">{totalBeds}</span>
                </div>
                <div className="glass-panel stat-card">
                    <span className="stat-label">{t.dashboard.maxCapacity}</span>
                    <span className="stat-value accent">{maxCapacity}</span>
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

            {error && <div className="alert alert-error">{error}</div>}

            {/* Add House */}
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
                            <button type="submit" className="btn btn-primary">{t.dashboard.createHouse}</button>
                        </form>
                    </div>
                )}

                {/* House Cards */}
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
        </div>
    );
}
