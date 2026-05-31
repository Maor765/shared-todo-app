import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
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
  const navigate = useNavigate();
  const [tab, setTab] = useState('dash');
  const [detailListId, setDetailListId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      navigate({ to: '/login' });
    }
  }, [auth.isLoading, auth.user, navigate]);

  if (auth.isLoading || !auth.user || !auth.workspace) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: 'var(--text-muted)', fontSize: 16 }}>
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
        width: '100%',
        maxWidth: 480,
        height: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
