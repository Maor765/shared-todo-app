import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask, ListWithMembers } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { IconBtn } from './ui/IconBtn';
import { tasksAPI } from '../api/tasks.api';
import TaskDetailSheet from './TaskDetailSheet';

export default function Dashboard() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { lists, isLoading } = useLists();
  const { t } = useSettings();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);

  const allTasks = lists.flatMap((l) => l.tasks?.map((task) => ({ ...task, list: l })) || []);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = allTasks.filter((task) => {
    if (search) return task.text.toLowerCase().includes(search.toLowerCase());
    if (task.done) return false;
    if (filter === 'Mine') return task.assignee_id === auth.user?.id;
    if (filter === 'Due today') return task.due === today;
    if (filter === 'Overdue') return task.due && task.due < today;
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
    const newDone = !task.done;
    const patch = (done: boolean) =>
      queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
        (prev ?? []).map((l) =>
          l.id === listId
            ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === taskId ? { ...t, done } : t)) }
            : l,
        ),
      );
    patch(newDone);
    try { await tasksAPI.updateTask(listId, taskId, { done: newDone }); }
    catch { patch(task.done); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <TopBar
        title={t('nav_dash')}
        sub={`${greeting}, ${auth.user?.name.split(' ')[0]} 👋`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconBtn icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" onClick={() => { setShowSearch((s) => !s); setSearch(''); }} />
            {auth.user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', borderRadius: 999, padding: '4px 10px 4px 4px', border: '0.5px solid var(--border)' }}>
                <Avatar member={auth.user} size={24} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{auth.user.name.split(' ')[0]}</span>
              </div>
            )}
          </div>
        }
      />

      {showSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '0 12px', height: 38, margin: '0 16px 8px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_ph')}
            style={{ border: 'none', background: 'none', fontSize: 15, color: 'var(--text)', outline: 'none', flex: 1 }} />
        </div>
      )}
      <FilterChips
        options={['All', 'Mine', 'Due today', 'Overdue']}
        labels={[t('filter_all'), t('filter_mine'), t('filter_due_today'), t('filter_overdue')]}
        value={filter}
        onChange={setFilter}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        {!search && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              { num: total, lbl: t('total_tasks'),  color: 'var(--text)' },
              { num: done,  lbl: t('completed'),    color: 'var(--success)' },
              { num: inProg,lbl: t('open'),         color: 'var(--warning)' },
              { num: lists.length, lbl: t('nav_lists'), color: 'var(--text)' },
            ].map((s) => (
              <div key={s.lbl} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '10px 12px', border: '0.5px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
                {isLoading ? (
                  <>
                    <div style={{ width: 40, height: 28, borderRadius: 6, background: 'var(--border)', marginBottom: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ width: 70, height: 13, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.num}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>{s.lbl}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            {search ? `${filtered.length} ${t('results')}` : filter === 'All' ? `${t('filter_all')} (${filtered.length})` : `${filtered.length}`}
          </div>
        )}

        {isLoading ? (
          [1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--border)', flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: `${60 + i * 8}%`, height: 14, borderRadius: 4, background: 'var(--border)', marginBottom: 6, animation: 'pulse 1.4s ease-in-out infinite' }} />
                <div style={{ width: 80, height: 11, borderRadius: 4, background: 'var(--border)', animation: 'pulse 1.4s ease-in-out infinite' }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dim)' }}>{t('nothing_here')}</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{t('no_tasks_filter')}</div>
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
                  <div style={{ fontSize: 15, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.text}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 2 }}>{breadcrumb}</div>
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
