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
        width: '100%',
        maxWidth: 480,
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
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
