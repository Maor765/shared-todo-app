import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const { t } = useSettings();

  useEffect(() => {
    if (auth.user) navigate({ to: '/' });
  }, [auth.user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', height: 40, borderRadius: 10, background: 'var(--bg-card)', border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 15, marginBottom: 12, outline: 'none', color: 'var(--text)' } as const;

  return (
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{t('welcome_back')}</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32 }}>{t('sign_in_sub')}</p>

        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 280 }}>
          <input type="email" placeholder={t('email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder={t('password_ph')} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>{t('forgot_password')}?</Link>
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>

        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 20 }}>
          {t('no_account')}{' '}
          <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{t('create_one')}</Link>
        </p>
      </div>
    </div>
  );
}
