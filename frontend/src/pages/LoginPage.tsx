import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: '100%', height: 40, borderRadius: 10, background: 'var(--bg-card)', border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 13, marginBottom: 12, outline: 'none', color: 'var(--text)' } as const;

  return (
    <div style={{ width: 390, minHeight: 780, background: 'var(--bg)', borderRadius: 32, border: '0.5px solid var(--border-light)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 8px 40px var(--shadow)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{t('welcome_back')}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>{t('sign_in_sub')}</p>

        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 280 }}>
          <input type="email" placeholder={t('email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder={t('password_ph')} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
          {t('no_account')}{' '}
          <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{t('create_one')}</Link>
        </p>
      </div>
    </div>
  );
}
