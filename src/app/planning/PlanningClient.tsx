'use client';

import { createAssignments, deleteAssignment, createHouse, createRoom, deleteHouse, deleteRoom, addHouseOwner, removeHouseOwner, updateAssignmentHospitality, reassignRoom, updateHouseAcceptedTypes, createHouseBlock, deleteHouseBlock, createIndividualAssignments, updateRoom } from '@/actions/housing';
import type { UserRole } from '@/lib/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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

type HouseBlock = {
    id: string;
    houseId: string;
    startDate: Date | string;
    endDate: Date | string;
    reason: string | null;
};

type HouseOwnerEntry = { volunteer: { id: string; name: string; phone: string | null } };

type House = {
    id: string;
    name: string;
    address: string;
    acceptedTypes: string[];
    owners: HouseOwnerEntry[];
    rooms: Room[];
    blocks: HouseBlock[];
};

type Volunteer = {
    id: string;
    name: string;
    type: string;
    isHospitality: boolean;
    isLocal: boolean;
    groupName: string | null;
    arrivalDate?: Date | string | null;
    departureDate?: Date | string | null;
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
    const [blockFormOpen, setBlockFormOpen] = useState<string | null>(null);
    const [assignIndividually, setAssignIndividually] = useState(false);
    const [bookingStartDate, setBookingStartDate] = useState('');
    const [bookingEndDate, setBookingEndDate] = useState('');
    const [editRoomId, setEditRoomId] = useState<string | null>(null);
    const [editRoomName, setEditRoomName] = useState('');
    const [editRoomCapacity, setEditRoomCapacity] = useState<number>(0);

    const searchParams = useSearchParams();
    const groupParam = searchParams.get('group');
    const initializedRef = useRef(false);

    useEffect(() => {
        if (groupParam && !initializedRef.current && volunteers.length > 0) {
            initializedRef.current = true;
            setSidebarGroupFilter(groupParam);
            const groupVols = volunteers.filter(v => v.groupName === groupParam && v.assignments.length === 0);
            if (groupVols.length > 0) {
                setSelectedVolunteerIds(new Set(groupVols.map(v => v.id)));
            }
        }
    }, [groupParam, volunteers]);

    useEffect(() => {
        if (selectedVolunteerIds.size === 1) {
            const firstId = Array.from(selectedVolunteerIds)[0];
            const vol = volunteers.find(v => v.id === firstId);
            if (vol) {
                if (vol.arrivalDate) {
                    const d = new Date(vol.arrivalDate);
                    const yr = d.getUTCFullYear();
                    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const da = String(d.getUTCDate()).padStart(2, '0');
                    setBookingStartDate(`${yr}-${mo}-${da}`);
                } else {
                    setBookingStartDate('');
                }
                if (vol.departureDate) {
                    const d = new Date(vol.departureDate);
                    const yr = d.getUTCFullYear();
                    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const da = String(d.getUTCDate()).padStart(2, '0');
                    setBookingEndDate(`${yr}-${mo}-${da}`);
                } else {
                    setBookingEndDate('');
                }
            }
        } else if (selectedVolunteerIds.size === 0) {
            setBookingStartDate('');
            setBookingEndDate('');
        }
    }, [selectedVolunteerIds, volunteers]);

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

    async function handleIndividualAssign(formData: FormData) {
        setError(''); setSuccess('');
        const result = await createIndividualAssignments(formData);
        if (result?.error) { setError(result.error); }
        else {
            setSuccess(t.planning.assignmentSuccess);
            const form = document.getElementById('assignment-form') as HTMLFormElement;
            if (form) form.reset();
            setVolunteerSearch(''); setSelectedVolunteerIds(new Set());
            setAssignIndividually(false);
        }
    }

    async function handleCreateHouse(formData: FormData) {
        setError('');
        const result = await createHouse(formData);
        if (result?.error) setError(result.error);
        else setShowHouseForm(false);
    }

    async function handleCreateBlock(formData: FormData) {
        setError(''); setSuccess('');
        const result = await createHouseBlock(formData);
        if (result?.error) { setError(result.error); }
        else {
            setBlockFormOpen(null);
            setSuccess('House blocked successfully!');
        }
    }

    async function handleDeleteBlock(id: string) {
        setError(''); setSuccess('');
        const result = await deleteHouseBlock(id);
        if (result?.error) { setError(result.error); }
        else {
            setSuccess('Block removed successfully!');
        }
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
                                <div className="plan-selected-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <span>{selectedVolunteerIds.size} selected</span>
                                        <button type="button" onClick={() => setSelectedVolunteerIds(new Set())}>Clear</button>
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'normal', color: 'var(--text-secondary)', marginTop: 4 }}>
                                        <input type="checkbox" checked={assignIndividually} onChange={(e) => setAssignIndividually(e.target.checked)} style={{ margin: 0 }} />
                                        <span>Assign different rooms</span>
                                    </label>
                                </div>
                                <form action={assignIndividually ? handleIndividualAssign : handleAssign} id="assignment-form">
                                    {Array.from(selectedVolunteerIds).map(id => (
                                        <input key={id} type="hidden" name="volunteerIds" value={id} />
                                    ))}
                                    {!assignIndividually ? (
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
                                    ) : (
                                        <div className="form-group">
                                            <label>Individual Room Assignment</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4, maxHeight: '200px', overflowY: 'auto', paddingRight: 4 }}>
                                                {Array.from(selectedVolunteerIds).map(id => {
                                                    const v = volunteers.find(vol => vol.id === id);
                                                    if (!v) return null;
                                                    return (
                                                        <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{v.name}</span>
                                                                <span className={typeBadgeClass(v.type)} style={{ fontSize: '0.65rem' }}>{typeLabel(v.type)}</span>
                                                            </div>
                                                            <select name={`roomId_${id}`} required style={{ padding: '4px 8px', fontSize: '0.78rem', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
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
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <div className="form-group" style={{ flex: '1 1 120px' }}>
                                            <label>{t.planning.startDate}</label>
                                            <input name="startDate" type="date" required value={bookingStartDate} onChange={(e) => setBookingStartDate(e.target.value)} style={{ padding: '8px 10px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                                        </div>
                                        <div className="form-group" style={{ flex: '1 1 120px' }}>
                                            <label>{t.planning.endDate}</label>
                                            <input name="endDate" type="date" required value={bookingEndDate} onChange={(e) => setBookingEndDate(e.target.value)} style={{ padding: '8px 10px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
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
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                                    <button className="plan-action-btn" onClick={() => { setEditTagsOpen(house.id); setEditTagsValue({ ...editTagsValue, [house.id]: house.acceptedTypes }); }}>✎ Edit types</button>
                                                    <button className="plan-action-btn" onClick={() => setBlockFormOpen(blockFormOpen === house.id ? null : house.id)}>📅 {t.planning.blockDates}</button>
                                                </div>
                                            )}

                                            {/* Block Dates Form */}
                                            {isAdmin && blockFormOpen === house.id && (
                                                <form action={handleCreateBlock} style={{ margin: '12px 0', padding: 14, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>📅 {t.planning.blockDates}</h4>
                                                    <input type="hidden" name="houseId" value={house.id} />
                                                    <div className="form-row" style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                                        <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                                                            <label style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t.planning.startDate}</label>
                                                            <input type="date" name="startDate" required style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                                                        </div>
                                                        <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                                                            <label style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t.planning.endDate}</label>
                                                            <input type="date" name="endDate" required style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                                                        </div>
                                                        <div className="form-group" style={{ flex: 2, minWidth: 180 }}>
                                                            <label style={{ fontSize: '0.75rem', marginBottom: 4, display: 'block' }}>{t.planning.blockReason}</label>
                                                            <input type="text" name="reason" placeholder="e.g. Maintenance, Paint job..." style={{ width: '100%', padding: '6px 10px', fontSize: '0.82rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <button type="submit" className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem', padding: '4px 12px' }}>{t.planning.addBlock}</button>
                                                        <button type="button" className="btn btn-sm" onClick={() => setBlockFormOpen(null)} style={{ fontSize: '0.78rem', padding: '4px 12px', border: '1px solid var(--border-color)' }}>{t.volunteers.cancel}</button>
                                                    </div>
                                                </form>
                                            )}

                                            {/* Date Blocks list */}
                                            {house.blocks && house.blocks.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0 12px 0', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                                    <strong style={{ fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        🛑 {t.planning.blockedDates}
                                                    </strong>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                                        {house.blocks.map(b => {
                                                            const start = new Date(b.startDate).toLocaleDateString(undefined, { timeZone: 'UTC' });
                                                            const end = new Date(b.endDate).toLocaleDateString(undefined, { timeZone: 'UTC' });
                                                            return (
                                                                <div key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 999, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                                    <span>
                                                                        <strong>{start} — {end}</strong>
                                                                        {b.reason && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>({b.reason})</span>}
                                                                    </span>
                                                                    {isAdmin && (
                                                                        <button type="button" onClick={() => handleDeleteBlock(b.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px', display: 'flex', alignItems: 'center' }} title={t.planning.deleteBlock}>
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
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
                                                            {isAdmin && editRoomId === room.id ? (
                                                                <div className="plan-room-header" style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 8px' }}>
                                                                    <input
                                                                        type="text"
                                                                        value={editRoomName}
                                                                        onChange={(e) => setEditRoomName(e.target.value)}
                                                                        style={{ padding: '3px 6px', fontSize: '0.8rem', flex: 2, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                                                                        placeholder="Room Name"
                                                                        required
                                                                    />
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                                                                        <input
                                                                            type="number"
                                                                            value={editRoomCapacity}
                                                                            onChange={(e) => setEditRoomCapacity(parseInt(e.target.value, 10) || 0)}
                                                                            style={{ padding: '3px 6px', fontSize: '0.8rem', width: '50px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                                                                            min={1}
                                                                            required
                                                                        />
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>beds</span>
                                                                    </div>
                                                                    <button className="btn btn-primary btn-sm" style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                                                        onClick={async () => {
                                                                            const res = await updateRoom(room.id, editRoomName, editRoomCapacity);
                                                                            if (res?.error) setError(res.error);
                                                                            else setEditRoomId(null);
                                                                        }}
                                                                    >Save</button>
                                                                    <button className="plan-action-btn" onClick={() => setEditRoomId(null)}>✕</button>
                                                                </div>
                                                            ) : (
                                                                <div className="plan-room-header">
                                                                    <span className="room-name">{room.name}</span>
                                                                    <span className="room-occupancy">{room.assignments.length}/{room.capacity}</span>
                                                                    <div className="occupancy-bar"><div className={`fill ${fillClass}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                                                                    {isAdmin && (
                                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                                            <button className="plan-action-btn" onClick={() => { setEditRoomId(room.id); setEditRoomName(room.name); setEditRoomCapacity(room.capacity); }} title="Edit room" style={{ cursor: 'pointer' }}>✎</button>
                                                                            <button className="plan-action-btn danger" onClick={() => deleteRoom(room.id)} title="Delete room">✕</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {room.assignments.length === 0 && <div className="plan-empty-room">No current assignments</div>}
                                                            {room.assignments.map((a) => (
                                                                <div key={a.id}>
                                                                    <div className="plan-assignment-row">
                                                                        <div className="plan-assignment-info">
                                                                            <span className="vol-name">{a.volunteer.name}</span>
                                                                            <span className={typeBadgeClass(a.volunteer.type)} style={{ fontSize: '0.68rem' }}>{typeLabel(a.volunteer.type)}</span>
                                                                            <span className="date-range">{new Date(a.startDate).toLocaleDateString(undefined, { timeZone: 'UTC' })} – {new Date(a.endDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>
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
