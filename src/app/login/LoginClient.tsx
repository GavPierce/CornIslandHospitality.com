'use client';

import { useTranslation } from '@/i18n/LanguageContext';
import { useState } from 'react';
import './login.css';

export default function LoginClient() {
    const { t } = useTranslation();
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        const formData = new FormData(e.currentTarget);

        const res = await fetch('/api/login', {
            method: 'POST',
            body: JSON.stringify({ password: formData.get('password') }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (res.ok) {
            window.location.href = '/';
        } else {
            setError('Invalid password');
        }
    }

    return (
        <div className="login-container">
            <div className="background-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
            </div>

            <div className="glass-panel login-card animate-fade-in">
                <div className="login-header">
                    <h1 className="glow-text">{t.login.title}</h1>
                    <p>{t.login.subtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <label htmlFor="password">{t.login.passwordLabel}</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            placeholder={t.login.passwordPlaceholder}
                            required
                        />
                    </div>
                    {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
                    <button type="submit" className="login-button">
                        {t.login.signIn}
                    </button>
                </form>
            </div>
        </div>
    );
}
