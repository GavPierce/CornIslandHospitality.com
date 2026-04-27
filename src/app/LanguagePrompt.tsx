'use client';

import { useState, useTransition } from 'react';
import { setMyLanguage } from '@/actions/preferences';

/**
 * One-time modal shown after first login when the user has no saved
 * language preference. The choice is persisted on the user's Watchman
 * or Volunteer record and drives the language of WhatsApp reminders.
 */
export default function LanguagePrompt() {
    const [visible, setVisible] = useState(true);
    const [busy, setBusy] = useState(false);
    const [, startTransition] = useTransition();

    if (!visible) return null;

    async function choose(lang: 'EN' | 'ES') {
        if (busy) return;
        setBusy(true);
        const res = await setMyLanguage(lang);
        if (res?.error) {
            setBusy(false);
            alert(res.error);
            return;
        }
        setVisible(false);
        // Make sure any server components re-fetch the updated preference.
        startTransition(() => {
            // no-op transition; revalidatePath in the server action handles it
        });
    }

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.72)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: 20,
            }}
        >
            <div
                className="glass-panel"
                style={{
                    padding: '28px 28px 24px',
                    maxWidth: 420,
                    width: '100%',
                    textAlign: 'center',
                    display: 'grid',
                    gap: 18,
                }}
            >
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                        🌍 Choose your language
                    </h2>
                    <p style={{ margin: '8px 0 0', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        Escoge tu idioma para recordatorios de WhatsApp.<br />
                        We&apos;ll use this for WhatsApp reminders.
                    </p>
                </div>

                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                    <button
                        type="button"
                        onClick={() => choose('ES')}
                        disabled={busy}
                        style={btnStyle}
                    >
                        <span style={{ fontSize: '1.4rem' }}>🇳🇮</span>
                        <span>Español</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => choose('EN')}
                        disabled={busy}
                        style={btnStyle}
                    >
                        <span style={{ fontSize: '1.4rem' }}>🇺🇸</span>
                        <span>English</span>
                    </button>
                </div>

                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>
                    You can change this later.
                </p>
            </div>
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '16px 12px',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease, border-color 0.15s ease',
};
