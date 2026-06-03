import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSettings } from '../context/SettingsContext';
import client from '../api/client';

export default function ForgotPasswordPage() {
  const { t } = useSettings();
  const [email, setEmail] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const inputStyle = {
    width: '100%', height: 40, borderRadius: 10, background: 'var(--bg-card)',
    border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 15,
    marginBottom: 12, outline: 'none', color: 'var(--text)',
  } as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await client.post('/api/auth/forgot-password', { email });
      setResetLink(res.data.resetLink || '');
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
          {t('forgot_password')}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.5 }}>
          {t('forgot_password_sub')}
        </p>

        {!done ? (
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 300 }}>
            <input
              type="email" placeholder={t('email_ph')} value={email}
              onChange={(e) => setEmail(e.target.value)} required style={inputStyle}
            />
            {error && <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading || !email}
              style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading || !email ? 0.6 : 1 }}>
              {loading ? '...' : t('send_reset_link')}
            </button>
          </form>
        ) : (
          <div style={{ width: '100%', maxWidth: 300 }}>
            {resetLink ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  {t('reset_link_ready')}
                </div>
                <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, wordBreak: 'break-all', fontSize: 12, color: 'var(--primary)', textAlign: 'left' }}>
                  {resetLink}
                </div>
                <a href={resetLink}
                  style={{ display: 'block', width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', lineHeight: '40px', textAlign: 'center' }}>
                  {t('go_to_reset')}
                </a>
              </>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {t('email_not_found')}
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 24 }}>
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            ← {t('back_to_login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
