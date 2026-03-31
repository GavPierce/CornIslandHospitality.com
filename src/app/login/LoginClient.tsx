'use client';

import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import './login.css';

export default function LoginClient() {
    const { locale, setLocale, t } = useTranslation();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                body: JSON.stringify({ password: formData.get('password') }),
                headers: { 'Content-Type': 'application/json' },
            });

            if (res.ok) {
                window.location.href = '/';
            } else {
                setError(t.login.signIn === 'Iniciar Sesión' ? 'Contraseña incorrecta' : 'Invalid password');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            {/* Animated background */}
            <div className="login-bg">
                <div className="bg-gradient bg-gradient-1" />
                <div className="bg-gradient bg-gradient-2" />
                <div className="bg-gradient bg-gradient-3" />
                <div className="bg-grid" />
            </div>

            <div className="login-card animate-fade-in">
                {/* Brand */}
                <div className="login-brand">
                    <div className="brand-icon">
                        <span>🏠</span>
                    </div>
                    <h1>{t.login.title}</h1>
                    <p className="login-subtitle">{t.login.subtitle}</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-wrapper">
                        <label htmlFor="password">{t.login.passwordLabel}</label>
                        <div className="input-field">
                            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                placeholder={t.login.passwordPlaceholder}
                                required
                                autoFocus
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
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

                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading ? (
                            <span className="login-spinner" />
                        ) : (
                            <>
                                {t.login.signIn}
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Language toggle */}
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
