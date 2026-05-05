'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAllTemplates, saveTemplate } from '@/actions/templates';

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

const TEMPLATE_CONFIGS = [
    { id: 'WATCHMAN_SHIFT', label: 'Watchman Shift', vars: '{name}, {date}, {slot}' },
    { id: 'VOLUNTEER_ARRIVAL', label: 'Volunteer Arrival', vars: '{name}, {houseName}, {houseAddress}, {roomName}, {endDate}' },
    { id: 'VOLUNTEER_DEPARTURE', label: 'Volunteer Departure', vars: '{name}, {houseName}, {roomName}' },
    { id: 'ASSIGNMENT_CONFIRMATION', label: 'Assignment Confirmation (Volunteer)', vars: '{volunteerName}, {houseName}, {houseAddress}, {roomName}, {startDate}, {endDate}' },
    { id: 'OWNER_NOTIFICATION', label: 'Owner Notification', vars: '{ownerName}, {volunteerName}, {houseName}, {roomName}, {startDate}, {endDate}' },
];

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

    // ─── Live transport logs ────────────────────────────
    type LogEntry = { ts: number; level: 'info' | 'warn' | 'error'; message: string };
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logsPaused, setLogsPaused] = useState(false);

    // ─── Test message form ──────────────────────────────
    const [testPhone, setTestPhone] = useState('');
    const [testText, setTestText] = useState('Hello from Corn Island Hospitality 👋');
    const [testSending, setTestSending] = useState(false);
    const [testResult, setTestResult] = useState<
        | { ok: true; phone: string }
        | { ok: false; error: string }
        | null
    >(null);

    // ─── Templates ──────────────────────────────────────
    const [templates, setTemplates] = useState<Record<string, string>>({});
    const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
    const [saveTemplateSuccess, setSaveTemplateSuccess] = useState<string | null>(null);

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

    // Poll the WhatsApp transport log buffer every 2s so admins can
    // diagnose delivery problems without tailing Docker logs in Coolify.
    // Only sends `?since=` after the first fetch so the initial pull
    // populates with the full buffer.
    useEffect(() => {
        if (!canRunReminders) return;
        if (logsPaused) return;
        let cancelled = false;
        let lastTs = 0;
        async function pull() {
            try {
                const url = lastTs
                    ? `/api/admin/whatsapp-logs?since=${lastTs}`
                    : '/api/admin/whatsapp-logs';
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) return;
                const body = (await res.json()) as { entries: LogEntry[] };
                if (cancelled || !body.entries?.length) return;
                lastTs = body.entries[body.entries.length - 1].ts;
                setLogs((prev) => {
                    const next = [...prev, ...body.entries];
                    // Cap client-side too so the panel can't OOM the tab.
                    return next.length > 500 ? next.slice(next.length - 500) : next;
                });
            } catch {
                /* transient network blip — try again next tick */
            }
        }
        pull();
        const id = setInterval(pull, 2000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [canRunReminders, logsPaused]);

    async function handleClearLogs() {
        try {
            await fetch('/api/admin/whatsapp-logs', { method: 'DELETE' });
        } finally {
            setLogs([]);
        }
    }

    // Load templates
    useEffect(() => {
        if (!canRunReminders) return;
        let cancelled = false;
        getAllTemplates().then((data) => {
            if (!cancelled) setTemplates(data);
        }).catch(console.error);
        return () => { cancelled = true; };
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

    async function handleSaveTemplate(key: string, value: string) {
        setSavingTemplate(key);
        try {
            const res = await saveTemplate(key, value);
            if (res.success) {
                setSaveTemplateSuccess(key);
                setTimeout(() => setSaveTemplateSuccess(null), 2000);
            } else {
                alert(`Failed to save: ${res.error}`);
            }
        } catch (err) {
            alert(`Failed to save: ${(err as Error).message}`);
        } finally {
            setSavingTemplate(null);
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

            {canRunReminders && state === 'connected' && (
                <div className="glass-panel" style={{ padding: 24, display: 'grid', gap: 24, marginTop: 18 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Message Templates</h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                            Customize the automated WhatsApp messages. Leave a box empty to use the default text.
                        </p>
                    </div>
                    
                    {TEMPLATE_CONFIGS.map((cfg) => (
                        <div key={cfg.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 20 }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600 }}>{cfg.label}</h3>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                Available variables: <code style={{ color: 'var(--accent-secondary)' }}>{cfg.vars}</code>
                            </p>
                            <div style={{ display: 'grid', gap: 16 }}>
                                {['EN', 'ES'].map((lang) => {
                                    const key = `template.${cfg.id}.${lang}`;
                                    const val = templates[key] ?? '';
                                    const isSaving = savingTemplate === key;
                                    const isSuccess = saveTemplateSuccess === key;
                                    return (
                                        <div key={key}>
                                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>
                                                {lang === 'EN' ? 'English' : 'Spanish'}
                                            </label>
                                            <textarea
                                                value={val}
                                                onChange={(e) => setTemplates({ ...templates, [key]: e.target.value })}
                                                placeholder={`Default ${lang} text will be used`}
                                                rows={4}
                                                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical', marginBottom: 8 }}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <button
                                                    onClick={() => handleSaveTemplate(key, val)}
                                                    disabled={isSaving}
                                                    className="btn btn-sm"
                                                    style={{ border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                                                >
                                                    {isSaving ? 'Saving...' : 'Save'}
                                                </button>
                                                {isSuccess && <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓ Saved</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {canRunReminders && (
                <div
                    className="glass-panel"
                    style={{ padding: 24, display: 'grid', gap: 12, marginTop: 18 }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Transport logs</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                Live tail of the WhatsApp socket. Useful for diagnosing &quot;Waiting for this message&quot; and other delivery issues.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => setLogsPaused((p) => !p)}
                                style={{
                                    background: logsPaused ? 'rgba(251, 191, 36, 0.12)' : 'rgba(255,255,255,0.04)',
                                    border: '1px solid var(--border-color)',
                                    color: logsPaused ? '#fbbf24' : 'var(--text-secondary)',
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                }}
                            >
                                {logsPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                                type="button"
                                onClick={handleClearLogs}
                                style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-secondary)',
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <div
                        ref={(el) => {
                            if (el && !logsPaused) el.scrollTop = el.scrollHeight;
                        }}
                        style={{
                            background: '#0b0f14',
                            border: '1px solid var(--border-color)',
                            borderRadius: 8,
                            padding: 12,
                            maxHeight: 360,
                            overflowY: 'auto',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: '0.78rem',
                            lineHeight: 1.5,
                        }}
                    >
                        {logs.length === 0 ? (
                            <div style={{ color: 'var(--text-tertiary)' }}>
                                No log entries yet. Send a test message to see activity.
                            </div>
                        ) : (
                            logs.map((entry, i) => {
                                const color =
                                    entry.level === 'error'
                                        ? '#f87171'
                                        : entry.level === 'warn'
                                          ? '#fbbf24'
                                          : '#9ca3af';
                                const time = new Date(entry.ts).toLocaleTimeString();
                                return (
                                    <div key={`${entry.ts}-${i}`} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        <span style={{ color: '#6b7280' }}>{time}</span>{' '}
                                        <span style={{ textTransform: 'uppercase', fontWeight: 600, marginRight: 6 }}>
                                            {entry.level}
                                        </span>
                                        <span style={{ color: 'var(--text-primary)' }}>{entry.message}</span>
                                    </div>
                                );
                            })
                        )}
                    </div>
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
