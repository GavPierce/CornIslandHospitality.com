'use client';

import { requestOtp, verifyOtp } from '@/actions/auth';
import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import './login.css';

type Step = 'phone' | 'code';

export default function LoginClient() {
    const { locale, setLocale, t } = useTranslation();
    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handlePhoneSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await requestOtp(phone);
            if (res.error) {
                setError(res.error);
                return;
            }
            if (res.phone) setPhone(res.phone);
            setStep('code');
            setCode('');
        } finally {
            setLoading(false);
        }
    }

    async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await verifyOtp(phone, code);
            if (res.error) {
                setError(res.error);
                return;
            }
            window.location.href = '/';
        } finally {
            setLoading(false);
        }
    }

    async function handleResend() {
        setError('');
        setLoading(true);
        try {
            const res = await requestOtp(phone);
            if (res.error) setError(res.error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-bg">
                <div className="bg-gradient bg-gradient-1" />
                <div className="bg-gradient bg-gradient-2" />
                <div className="bg-gradient bg-gradient-3" />
                <div className="bg-grid" />
            </div>

            <div className="login-card animate-fade-in">
                <div className="login-brand">
                    <div className="brand-icon">
                        <span>🏠</span>
                    </div>
                    <h1>{t.login.title}</h1>
                    <p className="login-subtitle">{t.login.subtitle}</p>
                </div>

                {step === 'phone' ? (
                    <form onSubmit={handlePhoneSubmit} className="login-form">
                        <div className="input-wrapper">
                            <label htmlFor="phone">{t.login.phoneLabel}</label>
                            <div className="input-field">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72a2 2 0 0 1 1.72 2z" />
                                </svg>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder={t.login.phonePlaceholder}
                                    required
                                    autoFocus
                                    autoComplete="tel"
                                    inputMode="tel"
                                />
                            </div>
                            <p className="login-hint">{t.login.phoneHelp}</p>
                        </div>

                        {error && (
                            <div className="login-error animate-fade-in">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="login-submit" disabled={loading || !phone.trim()}>
                            {loading ? (
                                <span className="login-spinner" />
                            ) : (
                                <>
                                    {t.login.sendCode}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleCodeSubmit} className="login-form">
                        <div className="input-wrapper">
                            <label htmlFor="code">{t.login.codeLabel}</label>
                            <div className="input-field">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    type="text"
                                    id="code"
                                    name="code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder={t.login.codePlaceholder}
                                    required
                                    autoFocus
                                    autoComplete="one-time-code"
                                    inputMode="numeric"
                                    maxLength={6}
                                    style={{ letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }}
                                />
                            </div>
                            <p className="login-hint">
                                {t.login.codeHelp}
                                {phone && <> <strong>{phone}</strong></>}
                            </p>
                        </div>

                        {error && (
                            <div className="login-error animate-fade-in">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="login-submit" disabled={loading || code.length !== 6}>
                            {loading ? (
                                <span className="login-spinner" />
                            ) : (
                                <>
                                    {t.login.verify}
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </>
                            )}
                        </button>

                        <div className="login-secondary-actions">
                            <button
                                type="button"
                                className="login-link"
                                onClick={() => { setStep('phone'); setError(''); setCode(''); }}
                                disabled={loading}
                            >
                                {t.login.changePhone}
                            </button>
                            <button
                                type="button"
                                className="login-link"
                                onClick={handleResend}
                                disabled={loading}
                            >
                                {t.login.resend}
                            </button>
                        </div>
                    </form>
                )}

                <div className="login-lang">
                    <button
                        className={`login-lang-btn ${locale === 'en' ? 'active' : ''}`}
                        onClick={() => setLocale('en')}
                    >
                        🇺🇸 EN
                    </button>
                    <button
                        className={`login-lang-btn ${locale === 'es' ? 'active' : ''}`}
                        onClick={() => setLocale('es')}
                    >
                        🇳🇮 ES
                    </button>
                </div>
            </div>
        </div>
    );
}
