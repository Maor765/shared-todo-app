import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useLists } from '../hooks/useLists';
import { TopBar } from '../components/ui/TopBar';

function ToggleRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: value ? 'var(--primary)' : 'var(--border)',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background .2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            top: 3,
            left: value ? 21 : 3,
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, lang, setTheme, setLang, t } = useSettings();
  const { lists } = useLists();
  const [exporting, setExporting] = useState(false);

  const exportCSV = () => {
    setExporting(true);
    try {
      const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
      const rows: string[] = [
        ['List', 'Task', 'Done', 'Assignee', 'Due', 'Notes', 'Created'].join(','),
      ];
      for (const list of lists) {
        for (const task of list.tasks || []) {
          rows.push([
            escape(`${list.emoji} ${list.name}`),
            escape(task.text),
            task.done ? 'Yes' : 'No',
            escape(task.assignee_id || ''),
            task.due ? task.due.slice(0, 10) : '',
            escape(task.notes || ''),
            task.created_at ? task.created_at.slice(0, 10) : '',
          ].join(','));
        }
      }
      const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TopBar title={t('settings')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '12px 0 8px' }}>
          {t('appearance')}
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <ToggleRow
            label={t('dark_mode')}
            value={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '20px 0 8px' }}>
          {t('language')}
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <ToggleRow
            label={t('hebrew')}
            value={lang === 'he'}
            onChange={(v) => setLang(v ? 'he' : 'en')}
          />
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, margin: '20px 0 8px' }}>
          {t('export_section')}
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{t('export_csv')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{t('export_csv_sub')}</div>
            </div>
            <button onClick={exportCSV} disabled={exporting}
              style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: exporting ? 0.6 : 1, flexShrink: 0 }}>
              {exporting ? '...' : t('export_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
