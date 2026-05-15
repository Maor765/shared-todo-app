import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { tasksAPI } from '../api/tasks.api';
import TaskDetailSheet from './TaskDetailSheet';

export default function Dashboard() {
  const auth = useAuth();
  const { lists } = useLists();
  const { t } = useSettings();
  const [filter, setFilter] = useState('All');
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);

  const allTasks = lists.flatMap((l) => l.tasks?.map((task) => ({ ...task, list: l })) || []);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = allTasks.filter((task) => {
    if (filter === 'Mine') return task.assignee_id === auth.user?.id;
    if (filter === 'Due today') return task.due === today;
    if (filter === 'Overdue') return task.due && task.due < today && !task.done;
    return true;
  });

  const total = allTasks.length;
  const done = allTasks.filter((task) => task.done).length;
  const inProg = allTasks.filter((task) => !task.done).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('good_morning') : hour < 18 ? t('good_afternoon') : t('good_evening');

  const toggleTask = async (taskId: string, listId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    try { await tasksAPI.updateTask(listId, taskId, { done: !task.done }); } catch {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TopBar
        title={t('nav_dash')}
        sub={`${greeting}, ${auth.user?.name.split(' ')[0]} 👋`}
        right={
          auth.user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', borderRadius: 999, padding: '4px 10px 4px 4px', border: '0.5px solid var(--border)' }}>
              <Avatar member={auth.user} size={24} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{auth.user.name.split(' ')[0]}</span>
            </div>
          ) : null
        }
      />

      <FilterChips
        options={['All', 'Mine', 'Due today', 'Overdue']}
        labels={[t('filter_all'), t('filter_mine'), t('filter_due_today'), t('filter_overdue')]}
        value={filter}
        onChange={setFilter}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { num: total, lbl: t('total_tasks'),  color: 'var(--text)' },
            { num: done,  lbl: t('completed'),    color: 'var(--success)' },
            { num: inProg,lbl: t('open'),         color: 'var(--warning)' },
            { num: lists.length, lbl: t('nav_lists'), color: 'var(--text)' },
          ].map((s) => (
            <div key={s.lbl} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
          {filter === 'All' ? `${t('filter_all')} (${filtered.length})` : `${filtered.length}`}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }}>{t('nothing_here')}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{t('no_tasks_filter')}</div>
          </div>
        ) : (
          filtered.map((task) => {
            const isOverdue = task.due && task.due < today && !task.done;
            const isDueSoon = task.due && task.due >= today && !task.done;
            const breadcrumb = `${task.list.emoji} ${task.list.name}`;
            const assignee = auth.user?.id === task.assignee_id ? auth.user : null;
            return (
              <div
                key={task.id}
                onClick={() => setTaskSheet(task)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 8, cursor: 'pointer' }}
              >
                <div onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.list_id); }}>
                  <CheckCircle done={task.done} onToggle={() => toggleTask(task.id, task.list_id)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: task.done ? 'var(--text-disabled)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{breadcrumb}</div>
                </div>
                {isOverdue && <Badge variant="danger">{t('overdue_badge')}</Badge>}
                {isDueSoon && <Badge variant="warn">{t('due_soon_badge')}</Badge>}
                {assignee && <Avatar member={assignee} size={22} />}
              </div>
            );
          })
        )}
      </div>

      {taskSheet && (
        <TaskDetailSheet
          task={taskSheet} listId={taskSheet.list_id}
          onClose={() => setTaskSheet(null)}
          onSave={() => setTaskSheet(null)}
          onDelete={() => setTaskSheet(null)}
        />
      )}
    </div>
  );
}
