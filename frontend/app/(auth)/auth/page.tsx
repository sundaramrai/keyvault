'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useAuthForm } from '@/components/dashboard/hooks/useAuthForm';

const GLOW_STYLE = {
  position: 'fixed' as const,
  top: '30%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(600px, 100vw)',
  height: 'min(600px, 100vw)',
  borderRadius: '50%',
  background: 'radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)',
  pointerEvents: 'none' as const,
};

const LOGO_WRAP_STYLE = {
  width: 44,
  height: 44,
  borderRadius: 10,
  flexShrink: 0,
  background: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const CARD_STYLE = {
  borderRadius: 20,
  padding: 'clamp(24px, 6vw, 40px)',
} as const;

const WARNING_BOX_STYLE = {
  display: 'flex',
  gap: 8,
  marginTop: 10,
  padding: 'clamp(8px, 2vw, 10px) 12px',
  borderRadius: 8,
  background: 'rgba(245,158,11,0.06)',
  border: '1px solid rgba(245,158,11,0.15)',
} as const;

function AuthPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, restoreSession } = useAuthStore();
  const initialTab = params.get('tab') === 'register' ? 'register' : 'login';
  const {
    tab, setTab, toggleTab,
    showPassword, togglePassword,
    loading, form, handleChange,
    handleSubmit, strength, submitLabel,
  } = useAuthForm(initialTab);

  useEffect(() => {
    if (isAuthenticated) { router.push('/dashboard'); return; }
    restoreSession().then((ok) => { if (ok) router.push('/dashboard'); });
  }, []);

  return (
    <main
      style={{
        background: 'var(--bg)',
        padding: 'clamp(16px, 5vw, 24px)',
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <style>{`@media (min-height: 640px) { main { align-items: center !important; } }`}</style>

      <div style={GLOW_STYLE} />

      <div
        className="animate-fade-up"
        style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1, margin: '0 auto' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center" style={{ marginBottom: 'clamp(24px, 6vw, 40px)' }}>
          <div style={LOGO_WRAP_STYLE}>
            <Key size={22} color="#0a0908" strokeWidth={2.5} />
          </div>
          <span className="font-display text-3xl" style={{ color: 'var(--text-primary)' }}>Cipheria</span>
        </div>

        {/* Card */}
        <div className="glass" style={CARD_STYLE}>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, marginBottom: 'clamp(20px, 5vw, 32px)',
            background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4,
          }}>
            {(['login', 'register'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: 'clamp(8px, 2vw, 10px)', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#0a0908' : 'var(--text-secondary)',
                fontFamily: 'Outfit, sans-serif', fontWeight: 600,
                fontSize: 'clamp(0.78rem, 2.5vw, 0.875rem)', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
              }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(14px, 3vw, 18px)' }}>
            {tab === 'register' && (
              <div>
                <label htmlFor="fullName" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                  FULL NAME
                </label>
                <input
                  id="fullName"
                  className="input-field"
                  type="text"
                  placeholder="Ada Lovelace"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                EMAIL
              </label>
              <input
                id="email"
                className="input-field"
                type="email"
                placeholder="you@example.com"
                required
                value={form.email}
                onChange={handleChange('email')}
                style={{ fontSize: 'max(16px, 0.9rem)' }}
              />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  required
                  value={form.password}
                  onChange={handleChange('password')}
                  style={{ paddingRight: 44, fontSize: 'max(16px, 0.9rem)' }}
                />
                <button
                  type="button"
                  onClick={togglePassword}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0,
                    width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength bar */}
              {strength && form.password && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} style={{
                        height: 3, flex: 1, borderRadius: 2,
                        background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.3s',
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            {tab === 'register' && (
              <div>
                <label htmlFor="masterHint" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, letterSpacing: '0.04em' }}>
                  MASTER PASSWORD HINT <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <input
                  id="masterHint"
                  className="input-field"
                  type="text"
                  placeholder="A hint to remember your master password"
                  value={form.masterHint}
                  onChange={handleChange('masterHint')}
                  style={{ fontSize: 'max(16px, 0.9rem)' }}
                />
                <div style={WARNING_BOX_STYLE}>
                  <AlertCircle size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Your master password derives the encryption key. If you forget it, <strong style={{ color: 'var(--text-primary)' }}>your vault cannot be recovered</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                marginTop: 8, opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                minHeight: 48,
              }}
            >
              {submitLabel}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={toggleTab}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', padding: '4px 2px' }}
          >
            {tab === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AuthPageContent />
    </Suspense>
  );
}
