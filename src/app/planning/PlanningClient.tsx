'use client';

import { createAssignments, deleteAssignment, createHouse, createRoom, deleteHouse, deleteRoom, addHouseOwner, removeHouseOwner, updateAssignmentHospitality, reassignRoom, updateHouseAcceptedTypes } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import HousesPdfButton from '../HousesPdfButton';
import MonthSchedulePdfButton from './MonthSchedulePdfButton';

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

type HouseOwnerEntry = { volunteer: { id: string; name: string; phone: string | null } };

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
    isLocal: boolean;
    groupName: string | null;
    assignments: { id: string; room: { name: string; house: { name: string } } }[];
};

function typeBadgeClass(type: string) {
    switch (type) {
        case 'SINGLE_BROTHER': return 'type-badge single-brother';
        case 'SINGLE_SISTER': return 'type-badge single-sister';
        case 'MARRIED_COUPLE': return 'type-badge married-couple';
        default: return 'type-badge';
    }
}

export default function PlanningClient({ houses, volunteers, role }: { houses: House[]; volunteers: Volunteer[]; role: UserRole }) {
    const isAdmin = role === 'admin' || role === 'hospitality';
    const { t } = useTranslation();
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showHouseForm, setShowHouseForm] = useState(false);
    const [collapsedHouses, setCollapsedHouses] = useState<Set<string>>(new Set());
    const [expandedAddRoom, setExpandedAddRoom] = useState<string | null>(null);
    const [addOwnerOpen, setAddOwnerOpen] = useState<string | null>(null);
    const [addOwnerValue, setAddOwnerValue] = useState<Record<string, string>>({});
    const [hospPickerOpen, setHospPickerOpen] = useState<string | null>(null);
    const [hospPickerValue, setHospPickerValue] = useState<Record<string, string>>({});
    const [movePickerOpen, setMovePickerOpen] = useState<string | null>(null);
    const [movePickerValue, setMovePickerValue] = useState<Record<string, string>>({});
    const [volunteerSearch, setVolunteerSearch] = useState('');
    const [selectedVolunteerIds, setSelectedVolunteerIds] = useState<Set<string>>(new Set());
    const [sidebarGroupFilter, setSidebarGroupFilter] = useState<string>('');
    const [editTagsOpen, setEditTagsOpen] = useState<string | null>(null);
    const [editTagsValue, setEditTagsValue] = useState<Record<string, string[]>>({});

    const hospitalityMembers = volunteers.filter((v) => v.isHospitality);
    const unassignedCount = volunteers.filter((v) => v.assignments.length === 0).length;
    const allRooms = houses.flatMap((h) => h.rooms.map((r) => ({ ...r, houseName: h.name, houseAcceptedTypes: h.acceptedTypes })));
    const sidebarGroupNames = Array.from(new Set(volunteers.map((v) => v.groupName).filter(Boolean) as string[])).sort();

    function typeLabel(type: string) {
        switch (type) {
            case 'SINGLE_BROTHER': return t.types.singleBrother;
            case 'SINGLE_SISTER': return t.types.singleSister;
            case 'MARRIED_COUPLE': return t.types.marriedCouple;
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
    }

    function toggleHouse(id: string) {
        setCollapsedHouses(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }

    function toggleVol(id: string) {
        setSelectedVolunteerIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    }

    async function handleAssign(formData: FormData) {
        setError(''); setSuccess('');
        const result = await createAssignments(formData);
        if (result?.error) { setError(result.error); }
        else {
            setSuccess(t.planning.assignmentSuccess);
            const form = document.getElementById('assignment-form') as HTMLFormElement;
            if (form) form.reset();
            setVolunteerSearch(''); setSelectedVolunteerIds(new Set());
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
        else setExpandedAddRoom(null);
    }

    async function handleUpdateTags(houseId: string) {
        const types = editTagsValue[houseId];
        if (!types || types.length === 0) { setError('Please select at least one type.'); return; }
        const result = await updateHouseAcceptedTypes(houseId, types as any);
        if (result?.error) setError(result.error);
        else setEditTagsOpen(null);
    }

    const filteredVolunteers = volunteers.filter((v) => {
        // Group filter
        if (sidebarGroupFilter && v.groupName !== sidebarGroupFilter) {
            if (!selectedVolunteerIds.has(v.id)) return false;
        }
        if (volunteerSearch.trim() === '') return true;
        if (selectedVolunteerIds.has(v.id)) return true;
        const q = volunteerSearch.toLowerCase();
        return v.name.toLowerCase().includes(q) || typeLabel(v.type).toLowerCase().includes(q);
    });

    return (
        <div className="animate-fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>{t.planning.title}</h1>
                    <p>{t.planning.subtitle}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <HousesPdfButton houses={houses} />
                    <MonthSchedulePdfButton houses={houses} />
                    {isAdmin && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowHouseForm(!showHouseForm)}>
                            {showHouseForm ? t.dashboard.cancel : t.dashboard.addHouse}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Add House Form */}
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
                                {['SINGLE_BROTHER', 'SINGLE_SISTER', 'MARRIED_COUPLE'].map(tp => (
                                    <label key={tp}><input type="checkbox" name="acceptedTypes" value={tp} /> {typeLabel(tp)}</label>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary">{t.dashboard.createHouse}</button>
                    </form>
                </div>
            )}

            {/* Two-Panel Layout */}
            <div className="plan-layout">
                {/* ── Sidebar ── */}
                {isAdmin && (
                <aside className="plan-sidebar">
                    <div className="glass-panel plan-sidebar-panel">
                        <h3>
                            {t.planning.unassignedVolunteers}
                            <span className="plan-count">{unassignedCount} unassigned / {volunteers.length} total</span>
                        </h3>
                        <input
                            type="text"
                            placeholder="Search volunteers..."
                            value={volunteerSearch}
                            onChange={(e) => setVolunteerSearch(e.target.value)}
                            style={{ padding: '8px 12px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%' }}
                        />
                        {sidebarGroupNames.length > 0 && (
                            <select
                                value={sidebarGroupFilter}
                                onChange={(e) => setSidebarGroupFilter(e.target.value)}
                                style={{ padding: '6px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', marginTop: 6 }}
                            >
                                <option value="">All Groups</option>
                                {sidebarGroupNames.map((g) => <option key={g} value={g}>{g}</option>)}
                            </select>
                        )}
                        {filteredVolunteers.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>
                                {volunteers.length === 0 ? t.planning.allVolunteersAssigned : 'No matches'}
                            </div>
                        ) : (
                            <div className="plan-vol-list">
                                {filteredVolunteers.map((v) => {
                                    const currentAssignment = v.assignments.length > 0 ? v.assignments[0] : null;
                                    return (
                                        <button key={v.id} type="button" className={`plan-vol-chip ${selectedVolunteerIds.has(v.id) ? 'selected' : ''}`} onClick={() => toggleVol(v.id)}>
                                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                                <span>
                                                    {v.name}
                                                    {v.isLocal && (
                                                        <span style={{ marginLeft: 6, padding: '1px 6px', fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 999, fontWeight: 500 }}>
                                                            🏠 Local
                                                        </span>
                                                    )}
                                                </span>
                                                {currentAssignment && (
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                                                        📍 {currentAssignment.room.house.name} — {currentAssignment.room.name}
                                                    </span>
                                                )}
                                                {v.groupName && (
                                                    <span style={{ fontSize: '0.65rem', color: '#a78bfa', fontWeight: 400 }}>
                                                        👥 {v.groupName}
                                                    </span>
                                                )}
                                            </span>
                                            <span className={typeBadgeClass(v.type)}>{typeLabel(v.type)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {selectedVolunteerIds.size > 0 && (
                            <>
                                <div className="plan-divider" />
                                <div className="plan-selected-bar">
                                    <span>{selectedVolunteerIds.size} selected</span>
                                    <button type="button" onClick={() => setSelectedVolunteerIds(new Set())}>Clear</button>
                                </div>
                                <form action={handleAssign} id="assignment-form">
                                    {Array.from(selectedVolunteerIds).map(id => (
                                        <input key={id} type="hidden" name="volunteerIds" value={id} />
                                    ))}
                                    <div className="form-group">
                                        <label>{t.planning.room}</label>
                                        <select name="roomId" required style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                                            <option value="">{t.planning.selectRoom}</option>
                                            {houses.map(h => (
                                                <optgroup key={h.id} label={h.name}>
                                                    {h.rooms.map(r => {
                                                        const allM = r.assignments.length > 0 && r.assignments.every(a => a.volunteer.type === 'MARRIED_COUPLE');
                                                        const cap = allM ? Math.max(r.capacity, 2) : r.capacity;
                                                        return <option key={r.id} value={r.id}>{r.name} ({r.assignments.length}/{cap})</option>;
                                                    })}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>{t.planning.startDate}</label>
                                            <input name="startDate" type="date" required style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label>{t.planning.endDate}</label>
                                            <input name="endDate" type="date" required style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
                                        </div>
                                    </div>
                                    {hospitalityMembers.length > 0 && (
                                        <div className="form-group">
                                            <label>🤝 Hospitality</label>
                                            <select name="hospitalityMemberId" style={{ padding: '8px 10px', fontSize: '0.82rem' }}>
                                                <option value="">None</option>
                                                {hospitalityMembers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{t.planning.assignVolunteer}</button>
                                </form>
                            </>
                        )}
                    </div>
                </aside>
                )}

                {/* ── Main Area ── */}
                <div className="plan-main">
                    {houses.length === 0 ? (
                        <div className="glass-panel empty-state">
                            <div className="empty-icon">🏡</div>
                            <h3>{t.dashboard.noHousesYet}</h3>
                            <p>{t.dashboard.noHousesDesc}</p>
                        </div>
                    ) : (
                        houses.map((house) => {
                            const totalCap = house.rooms.reduce((s, r) => s + r.capacity, 0);
                            const totalOcc = house.rooms.reduce((s, r) => s + r.assignments.length, 0);
                            const isOpen = !collapsedHouses.has(house.id);
                            const currentOwnerIds = new Set(house.owners.map(o => o.volunteer.id));
                            const availableOwners = volunteers.filter(v => !currentOwnerIds.has(v.id));

                            return (
                                <div key={house.id} className="plan-house-section">
                                    {/* House Header */}
                                    <div className="plan-house-header" onClick={() => toggleHouse(house.id)}>
                                        <div className="plan-house-title">
                                            <span className={`plan-house-chevron ${isOpen ? 'open' : ''}`}>▼</span>
                                            <div>
                                                <h3>{house.name}</h3>
                                                <span className="address">{house.address}</span>
                                            </div>
                                        </div>
                                        <div className="plan-house-stats">
                                            {house.acceptedTypes.map(tp => (
                                                <span key={tp} className={typeBadgeClass(tp)} style={{ fontSize: '0.65rem' }}>{typeLabel(tp)}</span>
                                            ))}
                                            <span className="plan-house-stat">{totalOcc}/{totalCap} {t.dashboard.bedsOccupied}</span>
                                            {isAdmin && (
                                                <button className="plan-action-btn danger" onClick={(e) => { e.stopPropagation(); deleteHouse(house.id); }} title={t.dashboard.delete}>🗑️</button>
                                            )}
                                        </div>
                                    </div>

                                    {/* House Body */}
                                    {isOpen && (
                                        <div className="plan-house-body">
                                            {/* Type Tags (editable) */}
                                            {isAdmin && editTagsOpen === house.id && (
                                                <div className="plan-tags-row">
                                                    {['SINGLE_BROTHER', 'SINGLE_SISTER', 'MARRIED_COUPLE'].map(tp => (
                                                        <label key={tp} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', fontWeight: 'normal' }}>
                                                            <input type="checkbox" checked={(editTagsValue[house.id] || house.acceptedTypes).includes(tp)}
                                                                onChange={(e) => {
                                                                    const cur = editTagsValue[house.id] || house.acceptedTypes;
                                                                    const next = e.target.checked ? [...cur, tp] : cur.filter(x => x !== tp);
                                                                    setEditTagsValue({ ...editTagsValue, [house.id]: next });
                                                                }} style={{ margin: 0 }}
                                                            />
                                                            {typeLabel(tp)}
                                                        </label>
                                                    ))}
                                                    <button className="btn btn-primary btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => handleUpdateTags(house.id)}>Save</button>
                                                    <button className="btn btn-sm" style={{ padding: '2px 8px', fontSize: '0.75rem', border: '1px solid var(--border-color)' }} onClick={() => setEditTagsOpen(null)}>Cancel</button>
                                                </div>
                                            )}
                                            {isAdmin && editTagsOpen !== house.id && (
                                                <div>
                                                    <button className="plan-action-btn" onClick={() => { setEditTagsOpen(house.id); setEditTagsValue({ ...editTagsValue, [house.id]: house.acceptedTypes }); }}>✎ Edit types</button>
                                                </div>
                                            )}

                                            {/* Owners */}
                                            <div className="plan-owners-row">
                                                <span className="plan-owners-label">🏠 Owners</span>
                                                {house.owners.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>None</span>}
                                                {house.owners.map(o => (
                                                    <span key={o.volunteer.id} className="plan-owner-chip">
                                                        {o.volunteer.name}
                                                        {o.volunteer.phone && <a href={`tel:${o.volunteer.phone}`} style={{ textDecoration: 'none', fontSize: '0.72rem' }}>📞</a>}
                                                        {isAdmin && <button onClick={() => removeHouseOwner(house.id, o.volunteer.id)}>✕</button>}
                                                    </span>
                                                ))}
                                                {isAdmin && addOwnerOpen === house.id ? (
                                                    <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                                        <select style={{ padding: '3px 6px', fontSize: '0.78rem' }} value={addOwnerValue[house.id] ?? ''} onChange={(e) => setAddOwnerValue(p => ({ ...p, [house.id]: e.target.value }))}>
                                                            <option value="">Select…</option>
                                                            {availableOwners.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                        </select>
                                                        <button className="btn btn-primary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }} disabled={!addOwnerValue[house.id]}
                                                            onClick={async () => { const vid = addOwnerValue[house.id]; if (!vid) return; await addHouseOwner(house.id, vid); setAddOwnerOpen(null); setAddOwnerValue(p => ({ ...p, [house.id]: '' })); }}>Add</button>
                                                        <button className="plan-action-btn" onClick={() => setAddOwnerOpen(null)}>✕</button>
                                                    </div>
                                                ) : (
                                                    isAdmin && availableOwners.length > 0 && <button className="plan-action-btn" onClick={() => setAddOwnerOpen(house.id)}>+ Add</button>
                                                )}
                                            </div>

                                            {/* Rooms */}
                                            {house.rooms.length === 0 ? (
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: '8px 0' }}>{t.planning.noRoomsYet}</div>
                                            ) : (
                                                house.rooms.map((room) => {
                                                    const pct = room.capacity > 0 ? (room.assignments.length / room.capacity) * 100 : 0;
                                                    const fillClass = pct >= 100 ? 'full' : pct >= 50 ? 'mid' : 'low';
                                                    return (
                                                        <div key={room.id} className="plan-room-block">
                                                            <div className="plan-room-header">
                                                                <span className="room-name">{room.name}</span>
                                                                <span className="room-occupancy">{room.assignments.length}/{room.capacity}</span>
                                                                <div className="occupancy-bar"><div className={`fill ${fillClass}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                                                                {isAdmin && <button className="plan-action-btn danger" onClick={() => deleteRoom(room.id)}>✕</button>}
                                                            </div>
                                                            {room.assignments.length === 0 && <div className="plan-empty-room">No current assignments</div>}
                                                            {room.assignments.map((a) => (
                                                                <div key={a.id}>
                                                                    <div className="plan-assignment-row">
                                                                        <div className="plan-assignment-info">
                                                                            <span className="vol-name">{a.volunteer.name}</span>
                                                                            <span className={typeBadgeClass(a.volunteer.type)} style={{ fontSize: '0.68rem' }}>{typeLabel(a.volunteer.type)}</span>
                                                                            <span className="date-range">{new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}</span>
                                                                            {a.hospitalityMember && (
                                                                                <span className="plan-hosp-chip">🤝 {a.hospitalityMember.name}</span>
                                                                            )}
                                                                        </div>
                                                                        {isAdmin && (
                                                                            <div className="plan-assignment-actions">
                                                                                <button className="plan-action-btn hosp" title="Hospitality" onClick={() => { setHospPickerOpen(hospPickerOpen === a.id ? null : a.id); setMovePickerOpen(null); }}>🤝</button>
                                                                                <button className="plan-action-btn move" title="Move" onClick={() => { setMovePickerOpen(movePickerOpen === a.id ? null : a.id); setHospPickerOpen(null); }}>🔄</button>
                                                                                <button className="plan-action-btn danger" title="Remove" onClick={() => deleteAssignment(a.id)}>✕</button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {hospPickerOpen === a.id && (
                                                                        <div className="plan-inline-picker">
                                                                            <select value={hospPickerValue[a.id] ?? a.hospitalityMember?.id ?? ''} onChange={(e) => setHospPickerValue(p => ({ ...p, [a.id]: e.target.value }))}>
                                                                                <option value="">No contact</option>
                                                                                {hospitalityMembers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                                                            </select>
                                                                            <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                                                                onClick={async () => { await updateAssignmentHospitality(a.id, hospPickerValue[a.id] || null); setHospPickerOpen(null); }}>Save</button>
                                                                            <button className="plan-action-btn" onClick={() => setHospPickerOpen(null)}>Cancel</button>
                                                                        </div>
                                                                    )}
                                                                    {movePickerOpen === a.id && (
                                                                        <div className="plan-inline-picker">
                                                                            <select value={movePickerValue[a.id] ?? ''} onChange={(e) => setMovePickerValue(p => ({ ...p, [a.id]: e.target.value }))}>
                                                                                <option value="">Select room…</option>
                                                                                {allRooms.filter(r => r.id !== room.id).map(r => {
                                                                                    const allM = r.assignments.length > 0 && r.assignments.every(x => x.volunteer.type === 'MARRIED_COUPLE');
                                                                                    const cap = allM ? Math.max(r.capacity, 2) : r.capacity;
                                                                                    return <option key={r.id} value={r.id}>{r.houseName} — {r.name} ({r.assignments.length}/{cap})</option>;
                                                                                })}
                                                                            </select>
                                                                            <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: '0.72rem' }} disabled={!movePickerValue[a.id]}
                                                                                onClick={async () => {
                                                                                    const rid = movePickerValue[a.id]; if (!rid) return;
                                                                                    const res = await reassignRoom(a.id, rid);
                                                                                    if (res?.error) setError(res.error); else setSuccess('Volunteer moved.');
                                                                                    setMovePickerOpen(null); setMovePickerValue(p => ({ ...p, [a.id]: '' }));
                                                                                }}>Move</button>
                                                                            <button className="plan-action-btn" onClick={() => setMovePickerOpen(null)}>Cancel</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })
                                            )}

                                            {/* Add Room */}
                                            {isAdmin && (
                                                expandedAddRoom === house.id ? (
                                                    <form action={handleCreateRoom} className="plan-add-room-form">
                                                        <input type="hidden" name="houseId" value={house.id} />
                                                        <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                                                            <label>{t.dashboard.roomName}</label>
                                                            <input name="name" placeholder={t.dashboard.roomNamePlaceholder} required style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
                                                        </div>
                                                        <div className="form-group" style={{ width: 80 }}>
                                                            <label>{t.dashboard.beds}</label>
                                                            <input name="capacity" type="number" min="1" defaultValue="1" required style={{ padding: '8px 10px', fontSize: '0.82rem' }} />
                                                        </div>
                                                        <button type="submit" className="btn btn-primary btn-sm">{t.dashboard.add}</button>
                                                        <button type="button" className="plan-action-btn danger" onClick={() => setExpandedAddRoom(null)}>✕</button>
                                                    </form>
                                                ) : (
                                                    <button className="plan-action-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setExpandedAddRoom(house.id)}>+ {t.dashboard.addRoom}</button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
