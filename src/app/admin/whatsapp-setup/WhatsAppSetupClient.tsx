'use client';

import { useCallback, useEffect, useState } from 'react';

type Status = {
    state: 'disconnected' | 'connecting' | 'qr' | 'connected';
    qrDataUrl: string | null;
    lastError: string | null;
    connectedAt: number | null;
};

type RunSummary = {
    sent: number;
    skipped: number;
    errors: number;
    disabled?: boolean;
};

export default function WhatsAppSetupClient({
    apiToken,
    canRunReminders,
}: {
    apiToken: string | null;
    canRunReminders: boolean;
}) {
    const [status, setStatus] = useState<Status | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [resetting, setResetting] = useState(false);
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState<
        | { ok: true; summary: RunSummary }
        | { ok: false; error: string }
        | null
    >(null);

    // ─── Reminders kill switch ──────────────────────────
    const [remindersEnabled, setRemindersEnabled] = useState<boolean | null>(null);
    const [togglingReminders, setTogglingReminders] = useState(false);

    // ─── Test message form ──────────────────────────────
    const [testPhone, setTestPhone] = useState('');
    const [testText, setTestText] = useState('Hello from Corn Island Hospitality 👋');
    const [testSending, setTestSending] = useState(false);
    const [testResult, setTestResult] = useState<
        | { ok: true; phone: string }
        | { ok: false; error: string }
        | null
    >(null);

    const tokenQs = apiToken ? `?token=${encodeURIComponent(apiToken)}` : '';

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/whatsapp-status${tokenQs}`, {
                cache: 'no-store',
            });
            if (!res.ok) {
                setFetchError(`Status check failed (${res.status})`);
                return;
            }
            setFetchError(null);
            setStatus(await res.json());
        } catch (err) {
            setFetchError((err as Error).message);
        }
    }, [tokenQs]);

    useEffect(() => {
        fetchStatus();
        const id = setInterval(fetchStatus, 2000);
        return () => clearInterval(id);
    }, [fetchStatus]);

    // Load the current reminders kill-switch state on mount, but only
    // for users with a real admin session (the bootstrap-token route
    // doesn't have admin privileges and the GET would 401).
    useEffect(() => {
        if (!canRunReminders) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/reminders-enabled', { cache: 'no-store' });
                if (!res.ok) return;
                const body = await res.json();
                if (!cancelled && typeof body.enabled === 'boolean') {
                    setRemindersEnabled(body.enabled);
                }
            } catch {
                /* leave as null — UI shows a dash */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [canRunReminders]);

    async function handleToggleReminders() {
        if (togglingReminders || remindersEnabled === null) return;
        const next = !remindersEnabled;
        setTogglingReminders(true);
        try {
            const res = await fetch('/api/admin/reminders-enabled', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ enabled: next }),
            });
            if (res.ok) {
                const body = await res.json();
                setRemindersEnabled(Boolean(body.enabled));
            }
        } finally {
            setTogglingReminders(false);
        }
    }

    async function handleSendTest(e: React.FormEvent) {
        e.preventDefault();
        if (testSending) return;
        setTestSending(true);
        setTestResult(null);
        try {
            const res = await fetch('/api/admin/send-test-message', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ phone: testPhone, text: testText }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setTestResult({ ok: false, error: body?.error ?? `HTTP ${res.status}` });
            } else {
                setTestResult({ ok: true, phone: body.phone });
            }
        } catch (err) {
            setTestResult({ ok: false, error: (err as Error).message });
        } finally {
            setTestSending(false);
        }
    }

    async function handleRunReminders() {
        if (running) return;
        setRunning(true);
        setRunResult(null);
        try {
            const res = await fetch('/api/admin/run-reminders', {
                method: 'POST',
                cache: 'no-store',
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                setRunResult({ ok: false, error: body?.error ?? `HTTP ${res.status}` });
            } else {
                setRunResult({ ok: true, summary: body.summary });
            }
        } catch (err) {
            setRunResult({ ok: false, error: (err as Error).message });
        } finally {
            setRunning(false);
        }
    }

    async function handleReset() {
        if (!confirm('Unlink the current WhatsApp session? You will need to scan a new QR code.')) return;
        setResetting(true);
        try {
            await fetch(`/api/admin/whatsapp-status${tokenQs ? `${tokenQs}&action=reset` : '?action=reset'}`, {
                method: 'POST',
            });
            await fetchStatus();
        } finally {
            setResetting(false);
        }
    }

    const state = status?.state ?? 'connecting';

    return (
        <div style={{ maxWidth: 540, margin: '40px auto', padding: '0 24px' }}>
            <div className="page-header" style={{ marginBottom: 18 }}>
                <h1>WhatsApp setup</h1>
                <p>Link this app to a WhatsApp account so it can send login codes.</p>
            </div>

            <div className="glass-panel" style={{ padding: 24, display: 'grid', gap: 20, placeItems: 'center', textAlign: 'center' }}>
                <StateBadge state={state} />

                {state === 'qr' && status?.qrDataUrl && (
                    <>
                        <img
                            src={status.qrDataUrl}
                            alt="WhatsApp pairing QR code"
                            width={320}
                            height={320}
                            style={{ background: '#fff', padding: 12, borderRadius: 12 }}
                        />
                        <ol style={{ textAlign: 'left', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.92rem', padding: 0, margin: 0, listStylePosition: 'inside' }}>
                            <li>Open WhatsApp on the phone you want to use.</li>
                            <li>Go to <strong>Settings → Linked Devices → Link a Device</strong>.</li>
                            <li>Scan the QR code above.</li>
                            <li>Wait a few seconds — this page updates automatically.</li>
                        </ol>
                    </>
                )}

                {state === 'connecting' && (
                    <p style={{ color: 'var(--text-tertiary)' }}>
                        Starting WhatsApp client…
                    </p>
                )}

                {state === 'disconnected' && (
                    <p style={{ color: 'var(--text-tertiary)' }}>
                        Not connected. {status?.lastError && <> Last error: <code>{status.lastError}</code></>}
                    </p>
                )}

                {state === 'connected' && (
                    <div style={{ display: 'grid', gap: 8 }}>
                        <p style={{ color: '#34d399', fontWeight: 600, fontSize: '1.05rem', margin: 0 }}>
                            ✓ WhatsApp is connected.
                        </p>
                        {status?.connectedAt && (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', margin: 0 }}>
                                Since {new Date(status.connectedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}

                {fetchError && (
                    <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{fetchError}</p>
                )}

                <button
                    type="button"
                    className="btn"
                    onClick={handleReset}
                    disabled={resetting}
                    style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                        padding: '8px 14px',
                        borderRadius: 8,
                        cursor: resetting ? 'not-allowed' : 'pointer',
                    }}
                >
                    {resetting ? 'Resetting…' : 'Unlink and re-pair'}
                </button>
            </div>

            {canRunReminders && state === 'connected' && (
                <div
                    className="glass-panel"
                    style={{ padding: 24, display: 'grid', gap: 20, marginTop: 18 }}
                >
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Admin tools</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                            For testing and ad-hoc messaging.
                        </p>
                    </div>

                    {/* ─── Reminders kill switch ─── */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '12px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255,255,255,0.02)',
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                                Daily reminders
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                When off, the 8 AM cron and “Run reminders now” button will skip sending.
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleToggleReminders}
                            disabled={togglingReminders || remindersEnabled === null}
                            aria-pressed={remindersEnabled === true}
                            style={{
                                minWidth: 80,
                                padding: '6px 12px',
                                borderRadius: 999,
                                border: '1px solid',
                                borderColor:
                                    remindersEnabled === null
                                        ? 'var(--border-color)'
                                        : remindersEnabled
                                          ? 'rgba(52, 211, 153, 0.4)'
                                          : 'rgba(156, 163, 175, 0.4)',
                                background:
                                    remindersEnabled === null
                                        ? 'rgba(255,255,255,0.04)'
                                        : remindersEnabled
                                          ? 'rgba(52, 211, 153, 0.12)'
                                          : 'rgba(156, 163, 175, 0.12)',
                                color:
                                    remindersEnabled === null
                                        ? 'var(--text-tertiary)'
                                        : remindersEnabled
                                          ? '#34d399'
                                          : '#9ca3af',
                                fontWeight: 600,
                                fontSize: '0.82rem',
                                cursor:
                                    togglingReminders || remindersEnabled === null
                                        ? 'not-allowed'
                                        : 'pointer',
                            }}
                        >
                            {remindersEnabled === null
                                ? '—'
                                : remindersEnabled
                                  ? 'On'
                                  : 'Off'}
                        </button>
                    </div>

                    {/* ─── Run reminders now ─── */}
                    <div style={{ display: 'grid', gap: 8 }}>
                        <button
                            type="button"
                            onClick={handleRunReminders}
                            disabled={running}
                            style={{
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                color: '#34d399',
                                padding: '8px 14px',
                                borderRadius: 8,
                                cursor: running ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            {running ? 'Running…' : 'Run reminders now'}
                        </button>
                        {runResult?.ok && runResult.summary.disabled && (
                            <p style={{ color: '#fbbf24', fontSize: '0.82rem', margin: 0 }}>
                                Skipped — reminders are turned off.
                            </p>
                        )}
                        {runResult?.ok && !runResult.summary.disabled && (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', margin: 0 }}>
                                Sent {runResult.summary.sent}, skipped {runResult.summary.skipped}, errors {runResult.summary.errors}.
                            </p>
                        )}
                        {runResult && !runResult.ok && (
                            <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>
                                {runResult.error}
                            </p>
                        )}
                    </div>

                    {/* ─── Send test message ─── */}
                    <form
                        onSubmit={handleSendTest}
                        style={{ display: 'grid', gap: 8 }}
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            Send a test message
                        </div>
                        <input
                            type="tel"
                            required
                            placeholder="Phone (e.g. +50588881111)"
                            value={testPhone}
                            onChange={(e) => setTestPhone(e.target.value)}
                            disabled={testSending}
                            style={inputStyle}
                        />
                        <textarea
                            required
                            rows={2}
                            placeholder="Message text"
                            value={testText}
                            onChange={(e) => setTestText(e.target.value)}
                            disabled={testSending}
                            style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <button
                            type="submit"
                            disabled={testSending}
                            style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                color: '#60a5fa',
                                padding: '8px 14px',
                                borderRadius: 8,
                                cursor: testSending ? 'not-allowed' : 'pointer',
                                fontWeight: 600,
                            }}
                        >
                            {testSending ? 'Sending…' : 'Send'}
                        </button>
                        {testResult?.ok && (
                            <p style={{ color: '#34d399', fontSize: '0.82rem', margin: 0 }}>
                                ✓ Sent to {testResult.phone}.
                            </p>
                        )}
                        {testResult && !testResult.ok && (
                            <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>
                                {testResult.error}
                            </p>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box',
};

function StateBadge({ state }: { state: Status['state'] }) {
    const config = {
        disconnected: { label: 'Disconnected', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.12)' },
        connecting: { label: 'Connecting…', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
        qr: { label: 'Waiting for scan', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)' },
        connected: { label: 'Connected', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
    }[state];

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: config.bg,
                color: config.color,
                fontSize: '0.85rem',
                fontWeight: 600,
            }}
        >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: config.color }} />
            {config.label}
        </span>
    );
}
