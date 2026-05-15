import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { TopBar } from './ui/TopBar';
import { IconBtn } from './ui/IconBtn';
import { Badge } from './ui/Badge';
import { Avatar } from './ui/Avatar';
import { Sheet } from './ui/Sheet';
import { workspaceAPI } from '../api/workspace.api';
import { membersAPI } from '../api/members.api';
import { PublicUser } from '../types';

interface PendingInvite { id: string; email: string; role: 'admin' | 'member'; created_at: string; }

export default function Team() {
  const auth = useAuth();
  const { lists } = useLists();
  const { t } = useSettings();
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [invited, setInvited] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    try { const r = await workspaceAPI.getMembers(); setMembers(r.data); } catch {}
  };
  const fetchInvites = async () => {
    try { const r = await membersAPI.getInvites(); setInvites(r.data); } catch {}
  };

  useEffect(() => { fetchMembers(); fetchInvites(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    try {
      await workspaceAPI.inviteMember(inviteEmail, inviteRole);
      setInvited(true); setInviteEmail('');
      await Promise.all([fetchMembers(), fetchInvites()]);
      setTimeout(() => { setShowInvite(false); setInvited(false); }, 1500);
    } catch {} finally { setLoading(false); }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await membersAPI.deleteInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {}
  };

  const current = members.find((m) => m.id === auth.user?.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TopBar
        title={t('team')}
        sub={t('workspace_members')}
        right={
          <IconBtn
            icon="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
            onClick={() => setShowInvite(true)}
          />
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        {current && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '20px 16px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ margin: '0 auto 10px', width: 64, height: 64, borderRadius: '50%', background: current.color, color: current.text_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>
              {current.initials}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{current.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{current.email}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <Badge variant="info">{current.role === 'admin' ? t('admin_role') : t('member_role')}</Badge>
              <Badge variant="success">{lists.filter((l) => l.members?.some((m) => m.id === current.id)).length} {t('active_lists')}</Badge>
            </div>
            <button onClick={auth.logout}
              style={{ marginTop: 14, padding: '8px 20px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {t('log_out')}
            </button>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          {t('all_members')} ({members.length})
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '0 14px' }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < members.length - 1 ? '0.5px solid var(--border-subtle)' : 'none' }}>
              <Avatar member={m} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, textTransform: 'capitalize' }}>
                  {m.role === 'admin' ? t('admin_role') : t('member_role')} · {lists.filter((l) => l.members?.some((ml) => ml.id === m.id)).length} {t('nav_lists').toLowerCase()}
                </div>
              </div>
              <Badge variant={m.status === 'active' ? 'info' : 'neutral'}>{m.status === 'active' ? t('active') : t('away')}</Badge>
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '18px 0 8px' }}>
              {t('pending_invites')} ({invites.length})
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '0 14px' }}>
              {invites.map((invite, i) => (
                <div key={invite.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: i < invites.length - 1 ? '0.5px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'var(--bg)', border: '1.5px dashed var(--border-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <Badge variant="warn">{t('pending_badge')}</Badge>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'capitalize' }}>{invite.role === 'admin' ? t('admin_role') : t('member_role')}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteInvite(invite.id)} title={t('cancel_invite')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--text-faint)', display: 'flex', alignItems: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {invited && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 10, fontSize: 13, color: 'var(--success-dim)', fontWeight: 500 }}>
            {t('invite_sent')}
          </div>
        )}
      </div>

      <Sheet open={showInvite} onClose={() => { setShowInvite(false); setInvited(false); }} title={t('invite_to_ws')}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('email_address')}</div>
          <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
            style={{ width: '100%', height: 38, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--primary)', padding: '0 12px', fontSize: 14, outline: 'none', color: 'var(--text)' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>{t('role_label')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(['member', 'admin'] as const).map((r) => (
              <button key={r} onClick={() => setInviteRole(r)}
                style={{ padding: 12, borderRadius: 12, border: inviteRole === r ? '2px solid var(--primary)' : '0.5px solid var(--border)', background: inviteRole === r ? 'var(--primary-bg)' : 'var(--bg-input)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: inviteRole === r ? 'var(--primary)' : 'var(--text)', textTransform: 'capitalize' }}>
                  {r === 'member' ? t('member_role') : t('admin_role')}
                </div>
                <div style={{ fontSize: 11, color: inviteRole === r ? 'var(--primary-dim)' : 'var(--text-muted)', marginTop: 2 }}>
                  {r === 'member' ? t('member_desc') : t('admin_desc')}
                </div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleInvite} disabled={loading || !inviteEmail}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading || !inviteEmail ? 0.6 : 1 }}>
          {loading ? t('sending') : t('send_invite')}
        </button>
      </Sheet>
    </div>
  );
}
