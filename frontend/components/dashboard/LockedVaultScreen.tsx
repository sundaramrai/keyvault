'use client';
import { Lock } from 'lucide-react';

interface Props {
    user: any;
    masterPassword: string;
    setMasterPassword: (v: string) => void;
    unlocking: boolean;
    signout: boolean;
    setSignout: (v: boolean) => void;
    unlockVault: (e: React.SyntheticEvent) => void;
    handleLogout: () => Promise<void>;
}

export function LockedVaultScreen({ user, masterPassword, setMasterPassword, unlocking, signout, setSignout, unlockVault, handleLogout }: Readonly<Props>) {
    const handleSignout = async () => {
        setSignout(true);
        try {
            await handleLogout();
        } finally {
            setSignout(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg)',
                padding: 'clamp(16px, 5vw, 24px)',
                overflowY: 'auto',
            }}
        >
            <div style={{
                position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
                width: 'min(500px, 100vw)', height: 'min(500px, 100vw)', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />
            <div
                className="glass animate-fade-up"
                style={{
                    borderRadius: 24,
                    padding: 'clamp(24px, 6vw, 48px)',
                    width: '100%',
                    maxWidth: 420,
                    position: 'relative',
                    zIndex: 1,
                    margin: '0 auto',
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: 'clamp(24px, 6vw, 36px)' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: 18,
                        background: 'var(--accent-dim)', border: '1px solid rgba(245,158,11,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                    }}>
                        <Lock size={32} color="var(--accent)" />
                    </div>
                    <h2 className="font-display" style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', color: 'var(--text-primary)', marginBottom: 8 }}>
                        Vault Locked
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Enter your master password to unlock
                    </p>
                    {user?.master_hint && (
                        <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'rgba(245,158,11,0.7)', fontStyle: 'italic' }}>
                            Hint: {user.master_hint}
                        </p>
                    )}
                </div>
                <form onSubmit={unlockVault} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <input
                        className="input-field"
                        type="password"
                        placeholder="Master password"
                        required
                        autoFocus
                        value={masterPassword}
                        onChange={(e) => setMasterPassword(e.target.value)}
                        style={{ fontSize: 'max(16px, 0.9rem)' }}
                    />
                    <button
                        className="btn-primary"
                        type="submit"
                        disabled={unlocking}
                        style={{ opacity: unlocking ? 0.7 : 1, minHeight: 48 }}
                    >
                        {unlocking ? 'Unlocking...' : 'Unlock Vault'}
                    </button>
                </form>
                <button
                    onClick={handleSignout}
                    className="btn-ghost"
                    disabled={signout}
                    style={{ width: '100%', marginTop: 12, minHeight: 44, opacity: signout ? 0.7 : 1, color: 'var(--danger)' }}
                >
                    {signout ? 'Signing out...' : 'Sign out'}
                </button>
            </div>
        </div>
    );
}
