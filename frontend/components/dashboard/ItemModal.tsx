'use client';
import React, { useState, useEffect } from 'react';
import { Globe, CreditCard, StickyNote, User, Plus, Edit2, X, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { generatePassword, passwordStrength } from '@/lib/crypto';

// Shared label helper
export function FieldLabel({ htmlFor, children }: Readonly<{ htmlFor: string; children: React.ReactNode }>) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8,
    }}>
      {children}
    </label>
  );
}

// Category pill selector
const CATEGORY_CONFIG = [
  { value: 'login', label: 'Login', icon: Globe },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'identity', label: 'Identity', icon: User },
] as const;

export function CategoryPicker({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {CATEGORY_CONFIG.map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20, border: '1px solid',
              borderColor: active ? 'var(--accent)' : 'var(--border)',
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontFamily: 'Outfit, sans-serif',
              cursor: 'pointer', transition: 'all 0.15s',
              minHeight: 36,
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Modal shell
export function Modal({ children, onClose, title, icon }: Readonly<{
  children: React.ReactNode; onClose: () => void; title: string; icon?: React.ReactNode;
}>) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.show();
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleBackdropClick = (e: MouseEvent) => { if (e.target === dialog) onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    dialog?.addEventListener('click', handleBackdropClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      dialog?.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      style={{
        position: 'fixed', inset: 0, margin: 0,
        width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100, padding: 0, border: 'none',
      }}
    >
      <style>{`
        @media (min-width: 600px) {
          .modal-sheet { border-radius: 20px !important; margin-bottom: 0 !important; }
          .modal-dialog { align-items: center !important; padding: 24px !important; }
        }
        @media (min-width: 600px) { .modal-handle { display: none !important; } }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .modal-sheet { animation: slideUp 0.28s cubic-bezier(0.32,0.72,0,1) forwards; }
      `}</style>

      <div
        className="modal-sheet"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '24px 24px 0 0',
          width: '100%', maxWidth: 520,
          maxHeight: '92dvh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div className="modal-handle" style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && (
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--accent-dim)', border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {icon}
              </div>
            )}
            <h3 className="font-display" style={{ fontSize: '1.4rem', color: 'var(--text-primary)', lineHeight: 1 }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text-secondary)',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0 0', flexShrink: 0 }} />

        <div style={{
          overflowY: 'auto', flex: 1,
          padding: '20px 24px',
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

function LoginFormFields({ form, setForm, genOptions }: Readonly<{ form: any; setForm: (f: any) => void; genOptions: any }>) {
  const [showPw, setShowPw] = useState(false);
  const s = form.password ? passwordStrength(form.password) : null;
  return (
    <>
      <div>
        <FieldLabel htmlFor="login-url">URL</FieldLabel>
        <input
          id="login-url" className="input-field" placeholder="https://github.com"
          value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }}
        />
      </div>
      <div>
        <FieldLabel htmlFor="login-username">Username / Email</FieldLabel>
        <input
          id="login-username" className="input-field" placeholder="you@example.com"
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }}
        />
      </div>
      <div>
        <FieldLabel htmlFor="login-password">Password</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              id="login-password" className="input-field"
              type={showPw ? 'text' : 'password'} placeholder="••••••••"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              style={{ paddingRight: 44, fontSize: 'max(16px, 0.9rem)' }}
            />
            <button
              type="button" onClick={() => setShowPw(!showPw)}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, width: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            type="button" className="btn-ghost"
            style={{ padding: '0 14px', flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setForm({ ...form, password: generatePassword(genOptions) })}
            title="Generate password"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        {s && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: i <= s.score ? s.color : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
            <span style={{ fontSize: '0.72rem', color: s.color }}>{s.label}</span>
          </div>
        )}
      </div>
    </>
  );
}

function CardFormFields({ form, setForm, prefix }: Readonly<{ form: any; setForm: (f: any) => void; prefix: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <FieldLabel htmlFor={`${prefix}-card-number`}>Card Number</FieldLabel>
        <input id={`${prefix}-card-number`} className="input-field" placeholder="4111 1111 1111 1111"
          value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)', fontFamily: 'DM Mono, monospace', letterSpacing: '0.05em' }} />
      </div>
      <div>
        <FieldLabel htmlFor={`${prefix}-card-holder`}>Cardholder Name</FieldLabel>
        <input id={`${prefix}-card-holder`} className="input-field" placeholder="Jane Smith"
          value={form.cardHolder} onChange={(e) => setForm({ ...form, cardHolder: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <FieldLabel htmlFor={`${prefix}-expiry`}>Expiry</FieldLabel>
          <input id={`${prefix}-expiry`} className="input-field" placeholder="MM/YY"
            value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })}
            style={{ fontSize: 'max(16px, 0.9rem)' }} />
        </div>
        <div>
          <FieldLabel htmlFor={`${prefix}-cvv`}>CVV</FieldLabel>
          <input id={`${prefix}-cvv`} className="input-field" placeholder="•••" type="password"
            value={form.cvv} onChange={(e) => setForm({ ...form, cvv: e.target.value })}
            style={{ fontSize: 'max(16px, 0.9rem)' }} />
        </div>
      </div>
    </div>
  );
}

function IdentityFormFields({ form, setForm, prefix }: Readonly<{ form: any; setForm: (f: any) => void; prefix: string }>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <FieldLabel htmlFor={`${prefix}-first-name`}>First Name</FieldLabel>
          <input id={`${prefix}-first-name`} className="input-field" placeholder="Jane"
            value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            style={{ fontSize: 'max(16px, 0.9rem)' }} />
        </div>
        <div>
          <FieldLabel htmlFor={`${prefix}-last-name`}>Last Name</FieldLabel>
          <input id={`${prefix}-last-name`} className="input-field" placeholder="Smith"
            value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            style={{ fontSize: 'max(16px, 0.9rem)' }} />
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`${prefix}-phone`}>Phone</FieldLabel>
        <input id={`${prefix}-phone`} className="input-field" placeholder="+1 555 000 0000"
          value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }} />
      </div>
      <div>
        <FieldLabel htmlFor={`${prefix}-address`}>Address</FieldLabel>
        <input id={`${prefix}-address`} className="input-field" placeholder="123 Main St, City"
          value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }} />
      </div>
    </div>
  );
}

export function ItemFormBody({
  form, setForm, genOptions, submitLabel, submitting, onClose,
}: Readonly<{
  form: any; setForm: (f: any) => void; genOptions: any;
  submitLabel: string; submitting: boolean; onClose: () => void;
}>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <FieldLabel htmlFor="form-name">Name *</FieldLabel>
        <input
          id="form-name" className="input-field" required
          placeholder="e.g. GitHub, Netflix…"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ fontSize: 'max(16px, 0.9rem)' }}
        />
      </div>

      <div>
        <FieldLabel htmlFor="form-category">Category</FieldLabel>
        <CategoryPicker value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
      </div>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {form.category === 'login' && <LoginFormFields form={form} setForm={setForm} genOptions={genOptions} />}
      {form.category === 'card' && <CardFormFields form={form} setForm={setForm} prefix="form" />}
      {form.category === 'identity' && <IdentityFormFields form={form} setForm={setForm} prefix="form" />}

      <div>
        <FieldLabel htmlFor="form-notes">Notes</FieldLabel>
        <textarea
          id="form-notes" className="input-field" rows={3}
          placeholder="Any additional notes…"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={{ resize: 'vertical', fontSize: 'max(16px, 0.9rem)' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, minHeight: 46 }}>
          Cancel
        </button>
        <button
          type="submit" className="btn-primary"
          disabled={submitting}
          style={{ flex: 2, minHeight: 46, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function AddItemModal({ newItem, setNewItem, savingItem, genOptions, onSubmit, onClose }: Readonly<{
  newItem: any; setNewItem: (f: any) => void; savingItem: boolean; genOptions: any;
  onSubmit: (e: React.SyntheticEvent) => void; onClose: () => void;
}>) {
  return (
    <Modal onClose={onClose} title="Add Item" icon={<Plus size={16} color="var(--accent)" />}>
      <form onSubmit={onSubmit} autoComplete="off">
        <ItemFormBody
          form={newItem} setForm={setNewItem} genOptions={genOptions}
          submitLabel="Save to Vault" submitting={savingItem} onClose={onClose}
        />
      </form>
    </Modal>
  );
}

export function EditItemModal({ editForm, setEditForm, updatingItem, genOptions, onSubmit, onClose }: Readonly<{
  editForm: any; setEditForm: (f: any) => void; updatingItem: boolean; genOptions: any;
  onSubmit: (e: React.SyntheticEvent) => void; onClose: () => void;
}>) {
  return (
    <Modal onClose={onClose} title="Edit Item" icon={<Edit2 size={16} color="var(--accent)" />}>
      <form onSubmit={onSubmit} autoComplete="off">
        <ItemFormBody
          form={editForm} setForm={setEditForm} genOptions={genOptions}
          submitLabel="Save Changes" submitting={updatingItem} onClose={onClose}
        />
      </form>
    </Modal>
  );
}
