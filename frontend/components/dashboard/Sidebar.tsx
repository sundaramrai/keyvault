'use client';
import { useState } from 'react';
import { Key, Shield, Globe, CreditCard, StickyNote, User, Download, Lock, LogOut } from 'lucide-react';
import { VaultItem } from '@/lib/store';
import { Category } from './types';

interface DesktopSidebarProps {
  user: any;
  category: string;
  vaultItems: VaultItem[];
  setCategory: (c: Category) => void;
  handleExport: () => void;
  lockVault: () => void;
  handleLogout: () => Promise<void>;
}

export function DesktopSidebar({ user, category, vaultItems, setCategory, handleExport, lockVault, handleLogout }: Readonly<DesktopSidebarProps>) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignout = async () => {
    setSigningOut(true);
    try { await handleLogout(); } finally { setSigningOut(false); }
  };

  return (
    <aside className="desktop-sidebar" style={{
      width: 240, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '24px 16px', flexShrink: 0,
    }}>
      <div className="flex items-center gap-2 px-3 mb-8">
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Key size={16} color="#0a0908" strokeWidth={2.5} />
        </div>
        <span className="font-display text-xl" style={{ color: 'var(--text-primary)' }}>Cipheria</span>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { id: 'all', label: 'All Items', icon: Shield },
          { id: 'login', label: 'Logins', icon: Globe },
          { id: 'card', label: 'Cards', icon: CreditCard },
          { id: 'note', label: 'Notes', icon: StickyNote },
          { id: 'identity', label: 'Identities', icon: User },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setCategory(id as Category)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            background: category === id ? 'var(--accent-dim)' : 'transparent',
            color: category === id ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: '0.875rem', fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s',
          }}>
            <Icon size={16} />
            {label}
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }}>
              {id === 'all' ? vaultItems.length : vaultItems.filter((i: VaultItem) => i.category === id).length}
            </span>
          </button>
        ))}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button onClick={handleExport} className="btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: '0.8rem' }}>
          <Download size={14} /> Export Vault
        </button>
        <button onClick={lockVault} className="btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: '0.8rem' }}>
          <Lock size={14} /> Lock Vault
        </button>
        <button onClick={handleSignout} disabled={signingOut} className="btn-ghost" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: '0.8rem', color: 'var(--danger)', opacity: signingOut ? 0.5 : 1 }}>
          <LogOut size={14} /> {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'center', paddingTop: 8, opacity: 0.6 }}>
          {user?.email}
        </p>
      </div>
    </aside>
  );
}

interface MobileTopBarProps {
  mobilePanel: 'list' | 'detail';
  selectedItem: any;
  onBack: () => void;
  lockVault: () => void;
  handleLogout: () => Promise<void>;
}

export function MobileTopBar({ mobilePanel, selectedItem, onBack, lockVault, handleLogout }: Readonly<MobileTopBarProps>) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignout = async () => {
    setSigningOut(true);
    try { await handleLogout(); } finally { setSigningOut(false); }
  };

  return (
    <div style={{
      display: 'none',
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(10,9,8,0.95)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 16px',
      alignItems: 'center', justifyContent: 'space-between',
    }} className="mobile-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {mobilePanel === 'detail' && selectedItem ? (
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.875rem', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back
          </button>
        ) : (
          <>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={14} color="#0a0908" strokeWidth={2.5} />
            </div>
            <span className="font-display" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Cipheria</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={lockVault}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 6 }}
          title="Lock Vault"
        >
          <Lock size={18} />
        </button>
        <button
          onClick={handleSignout}
          disabled={signingOut}
          style={{ background: 'none', border: 'none', cursor: signingOut ? 'not-allowed' : 'pointer', color: 'var(--danger)', padding: 6, opacity: signingOut ? 0.5 : 1 }}
          title="Sign Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
