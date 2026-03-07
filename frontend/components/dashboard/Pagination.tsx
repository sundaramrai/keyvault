'use client';
import { CSSProperties } from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: Readonly<PaginationProps>) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visible = pages.filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  const withEllipsis: (number | '...')[] = [];
  for (let i = 0; i < visible.length; i++) {
    if (i > 0 && visible[i] - visible[i - 1] > 1) withEllipsis.push('...');
    withEllipsis.push(visible[i]);
  }

  const btnBase: CSSProperties = {
    minWidth: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', fontSize: '0.78rem',
    fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      padding: '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0,
    }}>
      <button
        style={{ ...btnBase, color: page === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: page === 1 ? 0.35 : 1 }}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {withEllipsis.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-before-${visible[i]}`} style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0 2px' }}>…</span>
        ) : (
          <button
            key={p}
            style={{
              ...btnBase,
              background: p === page ? 'var(--accent-dim)' : 'transparent',
              borderColor: p === page ? 'var(--accent)' : 'var(--border)',
              color: p === page ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: p === page ? 600 : 400,
            }}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}
      <button
        style={{ ...btnBase, color: page === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', opacity: page === totalPages ? 0.35 : 1 }}
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
}
