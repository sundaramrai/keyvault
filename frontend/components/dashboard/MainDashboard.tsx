'use client';
import React, { useState } from 'react';
import { Search, Plus, Shield, Globe, CreditCard, StickyNote, User, Trash2, Download, Star, Edit2, ChevronRight } from 'lucide-react';
import { checkHIBP } from '@/lib/crypto';
import { Category, CATEGORY_ICONS } from './types';
import { DesktopSidebar, MobileTopBar } from './Sidebar';
import { Pagination } from './Pagination';
import { Field, HibpCheck } from './Field';
import { AddItemModal, EditItemModal } from './ItemModal';

// Internal: renders the decrypted fields for a selected item (shared by mobile + desktop panels)
function ItemDetailFields({ selectedItem, copyToClipboard, hibp, setHibp }: Readonly<{
    selectedItem: any;
    copyToClipboard: (text: string, label: string) => void;
    hibp: { checking: boolean; count: number | null };
    setHibp: (v: { checking: boolean; count: number | null }) => void;
}>) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedItem.decrypted?.url && <Field label="URL" value={selectedItem.decrypted.url} onCopy={() => copyToClipboard(selectedItem.decrypted.url, 'URL')} />}
            {selectedItem.decrypted?.username && <Field label="Username / Email" value={selectedItem.decrypted.username} onCopy={() => copyToClipboard(selectedItem.decrypted.username, 'Username')} />}
            {selectedItem.decrypted?.password && (
                <>
                    <Field label="Password" value={selectedItem.decrypted.password} secret onCopy={() => copyToClipboard(selectedItem.decrypted.password, 'Password')} />
                    <HibpCheck
                        hibp={hibp}
                        onCheck={async () => {
                            setHibp({ checking: true, count: null });
                            try { const c = await checkHIBP(selectedItem.decrypted.password); setHibp({ checking: false, count: c }); }
                            catch { setHibp({ checking: false, count: -1 }); }
                        }}
                    />
                </>
            )}
            {selectedItem.decrypted?.cardNumber && <Field label="Card Number" value={selectedItem.decrypted.cardNumber} secret onCopy={() => copyToClipboard(selectedItem.decrypted.cardNumber, 'Card number')} />}
            {selectedItem.decrypted?.cardHolder && <Field label="Cardholder Name" value={selectedItem.decrypted.cardHolder} onCopy={() => copyToClipboard(selectedItem.decrypted.cardHolder, 'Cardholder')} />}
            {selectedItem.decrypted?.expiry && <Field label="Expiry" value={selectedItem.decrypted.expiry} onCopy={() => copyToClipboard(selectedItem.decrypted.expiry, 'Expiry')} />}
            {selectedItem.decrypted?.cvv && <Field label="CVV" value={selectedItem.decrypted.cvv} secret onCopy={() => copyToClipboard(selectedItem.decrypted.cvv, 'CVV')} />}
            {selectedItem.decrypted?.firstName && <Field label="First Name" value={selectedItem.decrypted.firstName} onCopy={() => copyToClipboard(selectedItem.decrypted.firstName, 'First name')} />}
            {selectedItem.decrypted?.lastName && <Field label="Last Name" value={selectedItem.decrypted.lastName} onCopy={() => copyToClipboard(selectedItem.decrypted.lastName, 'Last name')} />}
            {selectedItem.decrypted?.phone && <Field label="Phone" value={selectedItem.decrypted.phone} onCopy={() => copyToClipboard(selectedItem.decrypted.phone, 'Phone')} />}
            {selectedItem.decrypted?.address && <Field label="Address" value={selectedItem.decrypted.address} multiline />}
            {selectedItem.decrypted?.notes && <Field label="Notes" value={selectedItem.decrypted.notes} multiline />}
        </div>
    );
}

export function MainDashboard(props: Readonly<any>) {
    const {
        user, category, searchValue, onSearchChange, handleExport, lockVault, handleLogout,
        vaultItems, setShowAddModal, selectedItem, handleSelectItem, selectedItemLoading,
        handleToggleFav, handleOpenEdit, handleDelete, deletingId, copyToClipboard,
        hibp, setHibp, showAddModal, newItem, setNewItem, savingItem, genOptions, handleAddItem,
        showEditModal, setShowEditModal, editForm, setEditForm, updatingItem, handleEditItem,
        filteredItems, page, totalPages, onPageChange, isSearchActive,
    } = props;

    const [mobilePanel, setMobilePanel] = useState<'list' | 'detail'>('list');

    const handleSelectItemMobile = (item: any) => {
        handleSelectItem(item);
        setMobilePanel('detail');
    };

    return (
        <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>
            <MobileTopBar
                mobilePanel={mobilePanel}
                selectedItem={selectedItem}
                onBack={() => setMobilePanel('list')}
                lockVault={lockVault}
                handleLogout={handleLogout}
            />

            <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar, .desktop-list-col, .desktop-detail-col { display: none !important; }
          .mobile-topbar { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-topbar, .mobile-list-panel, .mobile-detail-panel { display: none !important; }
          .desktop-sidebar { display: flex !important; }
          .desktop-list-col { display: flex !important; }
          .desktop-detail-col { display: block !important; }
        }
      `}</style>

            {/* Mobile: List panel */}
            <div
                className="mobile-list-panel"
                style={{
                    display: mobilePanel === 'list' ? 'flex' : 'none',
                    position: 'fixed', inset: 0, zIndex: 10,
                    flexDirection: 'column',
                    background: 'var(--bg)',
                    paddingTop: 57,
                }}
            >
                {/* Category scroll */}
                <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    {[
                        { id: 'all', label: 'All', icon: Shield },
                        { id: 'login', label: 'Logins', icon: Globe },
                        { id: 'card', label: 'Cards', icon: CreditCard },
                        { id: 'note', label: 'Notes', icon: StickyNote },
                        { id: 'identity', label: 'Identities', icon: User },
                    ].map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => props.setCategory(id as Category)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 20, border: '1px solid',
                            borderColor: category === id ? 'var(--accent)' : 'var(--border)',
                            background: category === id ? 'var(--accent-dim)' : 'transparent',
                            color: category === id ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: '0.8rem', fontFamily: 'Outfit, sans-serif',
                            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                            <Icon size={13} /> {label}
                        </button>
                    ))}
                </div>

                {/* Search + Add */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input className="input-field" placeholder="Search vault..." value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)} style={{ paddingLeft: 36, fontSize: 'max(16px, 0.9rem)' }} />
                    </div>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', flexShrink: 0 }}>
                        <Plus size={16} />
                    </button>
                </div>

                {/* Items list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                            <Shield size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                            <p style={{ fontSize: '0.875rem' }}>No items found</p>
                        </div>
                    ) : filteredItems.map((item: any) => {
                        const Icon = CATEGORY_ICONS[item.category] || Globe;
                        return (
                            <button key={item.id} onClick={() => handleSelectItemMobile(item)} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '14px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: 'transparent', borderLeft: '2px solid transparent',
                                transition: 'all 0.15s', marginBottom: 2,
                            }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {item.favicon_url
                                        ? <img src={item.favicon_url} alt="" width={22} height={22} onError={(e: any) => e.target.style.display = 'none'} />
                                        : <Icon size={18} color="var(--text-secondary)" />}
                                </div>
                                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.decrypted?.username || item.decrypted?.url || item.category}
                                    </p>
                                </div>
                                {item.is_favourite && <Star size={14} color="var(--accent)" fill="var(--accent)" />}
                                <ChevronRight size={16} color="var(--text-secondary)" style={{ opacity: 0.4 }} />
                            </button>
                        );
                    })}
                </div>

                {!isSearchActive && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}

                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 8, paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
                    <button onClick={handleExport} className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', fontSize: '0.8rem' }}>
                        <Download size={14} /> Export
                    </button>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '0 8px', opacity: 0.6, flex: 1, justifyContent: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.email}
                    </p>
                </div>
            </div>

            {/* Mobile: Detail panel */}
            <div
                className="mobile-detail-panel"
                style={{
                    display: mobilePanel === 'detail' ? 'flex' : 'none',
                    position: 'fixed', inset: 0, zIndex: 10,
                    flexDirection: 'column',
                    background: 'var(--bg)',
                    paddingTop: 57,
                    overflowY: 'auto',
                }}
            >
                <div style={{ padding: '24px 16px', flex: 1 }}>
                    {selectedItem == null && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, opacity: 0.4 }}>
                            <Shield size={48} color="var(--text-secondary)" />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select an item to view details</p>
                        </div>
                    )}
                    {selectedItem != null && selectedItemLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, flexDirection: 'column', gap: 12, opacity: 0.5 }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Decrypting…</p>
                        </div>
                    )}
                    {selectedItem != null && !selectedItemLoading && (
                        <div className="animate-fade-up">
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {selectedItem.favicon_url
                                            ? <img src={selectedItem.favicon_url} alt="" width={26} height={26} />
                                            : React.createElement(CATEGORY_ICONS[selectedItem.category] || Globe, { size: 22, color: 'var(--accent)' })}
                                    </div>
                                    <div>
                                        <h2 className="font-display" style={{ fontSize: 'clamp(1.25rem, 5vw, 1.75rem)', color: 'var(--text-primary)' }}>{selectedItem.name}</h2>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{selectedItem.category}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => handleToggleFav(selectedItem)} className="btn-ghost" style={{ padding: '8px 10px' }}>
                                        <Star size={15} color={selectedItem.is_favourite ? 'var(--accent)' : 'var(--text-secondary)'} fill={selectedItem.is_favourite ? 'var(--accent)' : 'none'} />
                                    </button>
                                    <button onClick={() => handleOpenEdit(selectedItem)} className="btn-ghost" style={{ padding: '8px 10px' }}>
                                        <Edit2 size={15} />
                                    </button>
                                    <button onClick={() => handleDelete(selectedItem.id, () => setMobilePanel('list'))} className="btn-ghost"
                                        disabled={deletingId === selectedItem.id}
                                        style={{ padding: '8px 10px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)', opacity: deletingId === selectedItem.id ? 0.5 : 1 }}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                            <ItemDetailFields selectedItem={selectedItem} copyToClipboard={copyToClipboard} hibp={hibp} setHibp={setHibp} />
                            <p style={{ marginTop: 20, fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                Last updated {new Date(selectedItem.updated_at).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop layout */}
            <DesktopSidebar
                user={user}
                category={category}
                vaultItems={vaultItems}
                setCategory={props.setCategory}
                handleExport={handleExport}
                lockVault={lockVault}
                handleLogout={handleLogout}
            />

            <div className="desktop-list-col" style={{ width: 320, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                            className="input-field"
                            placeholder="Search vault..."
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            style={{ paddingLeft: 36 }}
                        />
                    </div>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                            <Shield size={32} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                            <p style={{ fontSize: '0.875rem' }}>No items found</p>
                        </div>
                    ) : filteredItems.map((item: any) => {
                        const Icon = CATEGORY_ICONS[item.category] || Globe;
                        return (
                            <button key={item.id} onClick={() => handleSelectItem(item)} style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: selectedItem?.id === item.id ? 'var(--accent-dim)' : 'transparent',
                                borderLeft: selectedItem?.id === item.id ? '2px solid var(--accent)' : '2px solid transparent',
                                transition: 'all 0.15s', marginBottom: 2,
                            }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                                    background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    {item.favicon_url ? (
                                        <img src={item.favicon_url} alt="" width={20} height={20} onError={(e: any) => e.target.style.display = 'none'} />
                                    ) : <Icon size={16} color="var(--text-secondary)" />}
                                </div>
                                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.decrypted?.username || item.decrypted?.url || item.category}
                                    </p>
                                </div>
                                {item.is_favourite && <Star size={12} color="var(--accent)" fill="var(--accent)" />}
                            </button>
                        );
                    })}
                </div>

                {!isSearchActive && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
            </div>

            <div className="desktop-detail-col" style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
                {selectedItem == null && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, opacity: 0.4 }}>
                        <Shield size={48} color="var(--text-secondary)" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select an item to view details</p>
                    </div>
                )}
                {selectedItem != null && selectedItemLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12, opacity: 0.5 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Decrypting…</p>
                    </div>
                )}
                {selectedItem != null && !selectedItemLoading && (
                    <div className="animate-fade-up" style={{ maxWidth: 560 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: 12, background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {selectedItem.favicon_url
                                        ? <img src={selectedItem.favicon_url} alt="" width={28} height={28} />
                                        : React.createElement(CATEGORY_ICONS[selectedItem.category] || Globe, { size: 24, color: 'var(--accent)' })}
                                </div>
                                <div>
                                    <h2 className="font-display" style={{ fontSize: '1.75rem', color: 'var(--text-primary)' }}>{selectedItem.name}</h2>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{selectedItem.category}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleToggleFav(selectedItem)} className="btn-ghost" style={{ padding: '8px 12px' }}>
                                    <Star size={16} color={selectedItem.is_favourite ? 'var(--accent)' : 'var(--text-secondary)'} fill={selectedItem.is_favourite ? 'var(--accent)' : 'none'} />
                                </button>
                                <button onClick={() => handleOpenEdit(selectedItem)} className="btn-ghost" style={{ padding: '8px 12px' }} title="Edit item">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(selectedItem.id)} className="btn-ghost"
                                    disabled={deletingId === selectedItem.id}
                                    style={{ padding: '8px 12px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)', opacity: deletingId === selectedItem.id ? 0.5 : 1 }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <ItemDetailFields selectedItem={selectedItem} copyToClipboard={copyToClipboard} hibp={hibp} setHibp={setHibp} />
                        <p style={{ marginTop: 24, fontSize: '0.72rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                            Last updated {new Date(selectedItem.updated_at).toLocaleDateString()}
                        </p>
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddItemModal newItem={newItem} setNewItem={setNewItem} savingItem={savingItem} genOptions={genOptions} onSubmit={handleAddItem} onClose={() => setShowAddModal(false)} />
            )}
            {showEditModal && editForm && (
                <EditItemModal editForm={editForm} setEditForm={setEditForm} updatingItem={updatingItem} genOptions={genOptions} onSubmit={handleEditItem} onClose={() => { setShowEditModal(false); setEditForm(null); }} />
            )}
        </div>
    );
}
