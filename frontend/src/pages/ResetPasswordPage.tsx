import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useSettings } from '../context/SettingsContext';
import client from '../api/client';

export default function ResetPasswordPage() {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  const inputStyle = {
    width: '100%', height: 40, borderRadius: 10, background: 'var(--bg-card)',
    border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 15,
    marginBottom: 12, outline: 'none', color: 'var(--text)',
  } as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError(t('passwords_no_match')); return; }
    if (password.length < 6) { setError(t('password_too_short')); return; }
    setLoading(true);
    try {
      await client.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate({ to: '/login' }), 2500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>{t('invalid_reset_link')}</p>
        <Link to="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>{t('request_new_link')}</Link>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: 48, marginBottom: 16 }}>{success ? '✅' : '🔒'}</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
          {success ? t('password_reset_success') : t('new_password')}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 28 }}>
          {success ? t('redirecting_login') : t('new_password_sub')}
        </p>

        {!success && (
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
            <input
              type="password" placeholder={t('new_password_ph')} value={password}
              onChange={(e) => setPassword(e.target.value)} required style={inputStyle}
            />
            <input
              type="password" placeholder={t('confirm_password_ph')} value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required style={{ ...inputStyle, marginBottom: 16 }}
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading || !password || !confirm}
              style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading || !password || !confirm ? 0.6 : 1 }}>
              {loading ? '...' : t('reset_password')}
            </button>
          </form>
        )}

        {!success && (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 24 }}>
            <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
              ← {t('back_to_login')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
