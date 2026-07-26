import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useSettings } from '../../context/SettingsContext';

export function OfflineBanner() {
  const { t } = useSettings();
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  if (isOnline) return null;

  return (
    <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-dim)', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: '6px 12px', flexShrink: 0 }}>
      {t('offline_banner')}
    </div>
  );
}
