'use client';
import { useState } from 'react';
import { Eye, EyeOff, Copy } from 'lucide-react';

export function Field({ label, value, secret, onCopy }: Readonly<{
  label: string; value: string; secret?: boolean; multiline?: boolean; onCopy?: () => void;
}>) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="glass" style={{ borderRadius: 12, padding: '16px 18px' }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={{
          flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: secret ? 'DM Mono, monospace' : 'inherit',
          wordBreak: 'break-all', lineHeight: 1.6,
        }}>
          {secret && !show ? '••••••••••••••••' : value}
        </p>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {secret && (
            <button onClick={() => setShow(!show)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          {onCopy && (
            <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
              <Copy size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function HibpCheck({ hibp, onCheck }: Readonly<{
  hibp: { checking: boolean; count: number | null };
  onCheck: () => void;
}>) {
  const { checking, count } = hibp;
  let statusColor = 'var(--text-secondary)';
  if (count === 0) statusColor = '#22c55e';
  else if (count !== null && count > 0) statusColor = '#ef4444';
  let statusText = '';
  if (count === -1) statusText = 'Check failed';
  else if (count === 0) statusText = '✓ Not found in known breaches';
  else if (count !== null) statusText = `⚠ Found in ${count.toLocaleString()} breaches`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -8 }}>
      <button
        type="button"
        onClick={onCheck}
        disabled={checking}
        style={{
          fontSize: '0.72rem', padding: '4px 10px', borderRadius: 6,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-secondary)', cursor: checking ? 'default' : 'pointer',
          opacity: checking ? 0.6 : 1,
        }}
      >
        {checking ? 'Checking…' : 'Check breaches (HIBP)'}
      </button>
      {count !== null && (
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColor }}>
          {statusText}
        </span>
      )}
    </div>
  );
}
