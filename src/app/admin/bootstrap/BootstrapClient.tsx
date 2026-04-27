'use client';

import { useState } from 'react';
import { bootstrapFirstAdmin } from '@/actions/bootstrap';

export default function BootstrapClient({
    token,
    alreadyInitialized,
}: {
    token: string | null;
    alreadyInitialized: boolean;
}) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<
        | { ok: true; phoneE164: string; isAdmin: boolean }
        | { error: string }
        | null
    >(null);

    if (alreadyInitialized) {
        return (
            <div style={{ maxWidth: 540, margin: '60px auto', padding: 24 }}>
                <h1 style={{ marginBottom: 8 }}>Admin bootstrap</h1>
                <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                    The system already has users. This page is locked.
                    Sign in at <a href="/login">/login</a> and use the normal
                    admin UI to add more.
                </p>
            </div>
        );
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setResult(null);
        const res = await bootstrapFirstAdmin({
            name,
            phone,
            token: token ?? '',
        });
        setBusy(false);
        setResult(res);
    }

    return (
        <div style={{ maxWidth: 540, margin: '40px auto', padding: '0 24px' }}>
            <div className="page-header" style={{ marginBottom: 18 }}>
                <h1>Admin bootstrap</h1>
                <p>
                    Create the first user so you can log in. This page only
                    works once — it locks itself as soon as any user exists.
                </p>
            </div>

            {result && 'ok' in result ? (
                <div className="glass-panel" style={{ padding: 24, display: 'grid', gap: 12 }}>
                    <p style={{ color: '#34d399', fontWeight: 600, margin: 0 }}>
                        ✓ Created.
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        Phone stored as <code>{result.phoneE164}</code>.
                    </p>
                    {result.isAdmin ? (
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                            That phone is in <code>ADMIN_PHONES</code>, so you
                            will have admin privileges after login.
                        </p>
                    ) : (
                        <p style={{ margin: 0, color: '#fbbf24' }}>
                            ⚠ That phone is <strong>not</strong> in{' '}
                            <code>ADMIN_PHONES</code>. You will be a regular
                            watchman after login. Add it to the env var and
                            restart if you want admin rights.
                        </p>
                    )}
                    <a
                        href="/login"
                        className="btn"
                        style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            color: '#34d399',
                            padding: '10px 14px',
                            borderRadius: 8,
                            textAlign: 'center',
                            textDecoration: 'none',
                            fontWeight: 600,
                        }}
                    >
                        Go to login →
                    </a>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className="glass-panel"
                    style={{ padding: 24, display: 'grid', gap: 14 }}
                >
                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Full name
                        </span>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Gavin Pierce"
                            style={inputStyle}
                            disabled={busy}
                        />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Phone number (E.164)
                        </span>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+50588881111"
                            style={inputStyle}
                            disabled={busy}
                        />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            Must match an entry in <code>ADMIN_PHONES</code>{' '}
                            for admin rights.
                        </span>
                    </label>

                    {result && 'error' in result && (
                        <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>
                            {result.error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={busy}
                        className="btn"
                        style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            padding: '10px 14px',
                            borderRadius: 8,
                            cursor: busy ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                        }}
                    >
                        {busy ? 'Creating…' : 'Create first admin'}
                    </button>
                </form>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    width: '100%',
    boxSizing: 'border-box',
};
