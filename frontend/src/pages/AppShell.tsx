import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import { NavBar } from '../components/ui/NavBar';
import Dashboard from '../components/Dashboard';
import Lists from '../components/Lists';
import ListDetail from '../components/ListDetail';
import Team from '../components/Team';
import SettingsPage from './SettingsPage';

export default function AppShell() {
  const auth = useAuth();
  const { t } = useSettings();
  const [tab, setTab] = useState('dash');
  const [detailListId, setDetailListId] = useState<string | null>(null);

  if (!auth.user || !auth.workspace) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: 'var(--text-muted)', fontSize: 14 }}>
        {t('loading')}
      </div>
    );
  }

  const handleSelectList = (listId: string) => {
    setDetailListId(listId);
    setTab('lists');
  };

  const renderScreen = () => {
    if (tab === 'lists' && detailListId) {
      return <ListDetail listId={detailListId} onBack={() => setDetailListId(null)} />;
    }
    switch (tab) {
      case 'dash':     return <Dashboard />;
      case 'lists':    return <Lists onSelectList={handleSelectList} />;
      case 'team':     return <Team />;
      case 'settings': return <SettingsPage />;
      default:         return null;
    }
  };

  return (
    <div
      style={{
        width: 390,
        minHeight: 780,
        background: 'var(--bg)',
        borderRadius: 32,
        border: '0.5px solid var(--border-light)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 8px 40px var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
          </svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M23 7l-7 5 7 5V7z M1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1z" />
          </svg>
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {renderScreen()}
      </div>

      <NavBar
        tab={detailListId ? 'lists' : tab}
        setTab={(t) => { setDetailListId(null); setTab(t); }}
      />
    </div>
  );
}
