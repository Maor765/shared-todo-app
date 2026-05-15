import { useState } from 'react';
import { DBTask } from '../types';
import { Sheet } from './ui/Sheet';
import { CheckCircle } from './ui/CheckCircle';
import { useSettings } from '../context/SettingsContext';
import { tasksAPI } from '../api/tasks.api';
import { useListDetail } from '../hooks/useLists';

interface TaskDetailSheetProps {
  task: DBTask; listId: string;
  onClose: () => void; onSave: () => void; onDelete: () => void;
}

export default function TaskDetailSheet({ task, listId, onClose, onSave, onDelete }: TaskDetailSheetProps) {
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const [text, setText] = useState(task.text);
  const [notes, setNotes] = useState(task.notes || '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [due, setDue] = useState(task.due || '');
  const [sublistId, setSublistId] = useState(task.sublist_id);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await tasksAPI.updateTask(listId, task.id, { text, notes, assignee_id: assigneeId, due: due || null, sublist_id: sublistId }); onSave(); }
    catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (confirm(t('delete_confirm'))) {
      try { await tasksAPI.deleteTask(listId, task.id); onDelete(); } catch {}
    }
  };

  const handleToggleDone = async () => {
    setSaving(true);
    try { await tasksAPI.updateTask(listId, task.id, { done: !task.done }); onSave(); }
    catch {} finally { setSaving(false); }
  };

  if (!list) return null;

  const inputStyle = { width: '100%', height: 36, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--border)', padding: '0 8px', fontSize: 13, outline: 'none', color: 'var(--text)' } as const;

  return (
    <Sheet open={true} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <CheckCircle done={task.done} onToggle={handleToggleDone} />
        <input value={text} onChange={(e) => setText(e.target.value)}
          style={{ flex: 1, fontSize: 16, fontWeight: 600, color: 'var(--text)', border: 'none', outline: 'none', background: 'none' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('notes_label')}</div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notes_ph')} rows={3}
          style={{ width: '100%', borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--border)', padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'none', color: 'var(--text)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('assignee_label')}</div>
          <select value={assigneeId || ''} onChange={(e) => setAssigneeId(e.target.value || null)} style={inputStyle}>
            <option value="">{t('unassigned')}</option>
            {(list.members || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('due_date')}</div>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {(list.sublists || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('sublist_label')}</div>
          <select value={sublistId || ''} onChange={(e) => setSublistId(e.target.value || null)} style={inputStyle}>
            <option value="">{t('no_sublist')}</option>
            {(list.sublists || []).map((sl) => <option key={sl.id} value={sl.id}>{sl.name}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('saving') : t('save')}
        </button>
        <button onClick={handleDelete}
          style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--danger-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </Sheet>
  );
}
