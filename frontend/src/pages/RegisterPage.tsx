import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { WorkspaceInvite } from '../types';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<WorkspaceInvite | null>(null);
  const [accepting, setAccepting] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const { t } = useSettings();

  useEffect(() => {
    if (auth.user && !pendingInvite) navigate({ to: '/' });
  }, [auth.user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const invite = await auth.register(name, email, password, '');
      if (invite) { setPendingInvite(invite); }
    } catch (err: any) {
      setError(err.response?.data?.error || t('reg_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!pendingInvite) return;
    setAccepting(true);
    try { await auth.acceptInvite(pendingInvite.id); navigate({ to: '/' }); }
    catch { navigate({ to: '/' }); }
  };

  const inputStyle = { width: '100%', height: 40, borderRadius: 10, background: 'var(--bg-card)', border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 14, marginBottom: 10, outline: 'none', color: 'var(--text)' } as const;

  return (
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{t('create_account')}</h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>{t('create_account_sub')}</p>

        <form onSubmit={handleRegister} style={{ width: '100%', maxWidth: 280 }}>
          <input type="text" placeholder={t('name_ph')} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <input type="email" placeholder={t('email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder={t('password_ph')} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? t('creating') : t('create_account')}
          </button>
        </form>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 20 }}>
          {t('have_account')}{' '}
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{t('sign_in')}</Link>
        </p>
      </div>

      {pendingInvite && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 32, zIndex: 10, padding: 28 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '32px 24px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>נ‰</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('youre_invited')}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 28 }}>
              {t('invite_message')}<br />
              <strong style={{ color: 'var(--text)', fontSize: 15 }}>{pendingInvite.workspace_name}</strong>
              {' '}{t('invite_as')} <strong style={{ color: 'var(--text)' }}>{pendingInvite.role}</strong>.
            </div>
            <button onClick={handleAccept} disabled={accepting}
              style={{ width: '100%', height: 42, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 10, opacity: accepting ? 0.6 : 1 }}>
              {accepting ? t('joining') : `${t('join_workspace')} ${pendingInvite.workspace_name}`}
            </button>
            <button onClick={() => { auth.finalizeSession(); navigate({ to: '/' }); }}
              style={{ width: '100%', height: 42, borderRadius: 10, background: 'var(--bg)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', fontSize: 14, cursor: 'pointer' }}>
              {t('skip_invite')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
