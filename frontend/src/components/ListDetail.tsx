import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { Sheet } from './ui/Sheet';
import { tasksAPI } from '../api/tasks.api';
import { sublistsAPI } from '../api/sublists.api';
import TaskDetailSheet from './TaskDetailSheet';

interface ListDetailProps { listId: string; onBack: () => void; }

export default function ListDetail({ listId, onBack }: ListDetailProps) {
  const auth = useAuth();
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const [filter, setFilter] = useState('All');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addSheet, setAddSheet] = useState(false);
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);
  const [addType, setAddType] = useState('task');
  const [addName, setAddName] = useState('');
  const [addSublist, setAddSublist] = useState<string | null>(null);
  const [addAssignee, setAddAssignee] = useState<string | null>(null);
  const [addDue, setAddDue] = useState('');

  if (!list) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>{t('loading')}</div>;

  const today = new Date().toISOString().slice(0, 10);

  const filterTask = (task: DBTask) => {
    if (filter === 'Open') return !task.done;
    if (filter === 'Done') return task.done;
    if (filter === 'Mine') return task.assignee_id === auth.user?.id;
    return true;
  };

  const toggleTask = async (taskId: string) => {
    const task = list.tasks.find((task) => task.id === taskId);
    if (!task) return;
    try { await tasksAPI.updateTask(listId, taskId, { done: !task.done }); } catch {}
  };

  const doAdd = async () => {
    if (!addName.trim()) return;
    try {
      if (addType === 'sublist') {
        await sublistsAPI.createSublist(listId, addName.trim());
      } else {
        await tasksAPI.createTask(listId, { text: addName.trim(), sublist_id: addSublist, assignee_id: addAssignee, due: addDue || null, notes: '' });
      }
      setAddName(''); setAddSublist(null); setAddAssignee(null); setAddDue(''); setAddSheet(false);
    } catch {}
  };

  const looseTasks = list.tasks.filter((task) => !task.sublist_id && filterTask(task));

  const TaskRow = ({ task }: { task: DBTask }) => {
    const isOverdue = task.due && task.due < today && !task.done;
    const isDueSoon = task.due && task.due >= today && !task.done;
    const assignee = list.members?.find((m) => m.id === task.assignee_id);
    return (
      <div onClick={() => setTaskSheet(task)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer' }}>
        <div onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}>
          <CheckCircle done={task.done} onToggle={() => toggleTask(task.id)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: task.done ? 'var(--text-disabled)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            {assignee && <Avatar member={assignee} size={16} />}
            {assignee && <span>{assignee.name.split(' ')[0]}</span>}
            {task.due && <span>· {task.due}</span>}
          </div>
        </div>
        {isOverdue && <Badge variant="danger">{t('overdue_badge')}</Badge>}
        {isDueSoon && <Badge variant="warn">{t('soon_badge')}</Badge>}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('back_lists')}
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.5 }}>{list.emoji} {list.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {(list.members || []).slice(0, 4).map((m, i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, border: '2px solid var(--bg-card)', borderRadius: '50%' }}>
              <Avatar member={m} size={22} />
            </div>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{(list.members || []).length} {t('members')}</span>
        </div>
      </div>

      <FilterChips
        options={['All', 'Open', 'Done', 'Mine']}
        labels={[t('filter_all'), t('filter_open'), t('filter_done'), t('filter_mine')]}
        value={filter}
        onChange={setFilter}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
        {(list.sublists || []).map((sl) => {
          const tasks = list.tasks.filter((task) => task.sublist_id === sl.id && filterTask(task));
          return (
            <div key={sl.id} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
              <div onClick={() => setCollapsed((c) => ({ ...c, [sl.id]: !c[sl.id] }))} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sl.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)' }}>{tasks.filter((task) => task.done).length}/{tasks.length}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" style={{ transform: collapsed[sl.id] ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {!collapsed[sl.id] && (
                <div style={{ padding: '0 14px' }}>
                  {tasks.length === 0
                    ? <div style={{ fontSize: 12, color: 'var(--text-disabled)', padding: '12px 0' }}>{t('no_tasks_yet')}</div>
                    : tasks.map((task) => <TaskRow key={task.id} task={task} />)}
                </div>
              )}
            </div>
          );
        })}

        {looseTasks.length > 0 && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '0 14px', marginBottom: 10 }}>
            {looseTasks.map((task) => <TaskRow key={task.id} task={task} />)}
          </div>
        )}

        <button onClick={() => setAddSheet(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, border: '0.5px dashed var(--border-mid)', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer', width: '100%' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {t('add_task_sublist')}
        </button>
      </div>

      <Sheet open={addSheet} onClose={() => setAddSheet(false)} title={`${t('add_to')} ${list.name}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {['task', 'sublist'].map((type) => (
            <button key={type} onClick={() => setAddType(type)}
              style={{ padding: 14, borderRadius: 12, border: addType === type ? '2px solid var(--primary)' : '0.5px solid var(--border)', background: addType === type ? 'var(--primary-bg)' : 'var(--bg-input)', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{type === 'task' ? '✅' : '📂'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: addType === type ? 'var(--primary)' : 'var(--text)' }}>{type === 'task' ? t('type_task') : t('type_sublist')}</div>
              <div style={{ fontSize: 11, color: addType === type ? 'var(--primary-dim)' : 'var(--text-muted)', marginTop: 2 }}>{type === 'task' ? t('single_todo') : t('group_tasks')}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{addType === 'task' ? t('task_name') : t('sublist_name')}</div>
          <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={addType === 'task' ? t('task_ph') : t('sublist_ph')}
            style={{ width: '100%', height: 38, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--primary)', padding: '0 12px', fontSize: 14, color: 'var(--text)', outline: 'none' }} />
        </div>

        {addType === 'task' && (list.sublists || []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{t('add_to_sublist')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setAddSublist(null)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '0.5px solid', background: !addSublist ? 'var(--primary)' : 'var(--bg-input)', color: !addSublist ? '#fff' : 'var(--text-dim)', borderColor: !addSublist ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                {t('none')}
              </button>
              {(list.sublists || []).map((sl) => (
                <button key={sl.id} onClick={() => setAddSublist(sl.id)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: '0.5px solid', background: addSublist === sl.id ? 'var(--primary)' : 'var(--bg-input)', color: addSublist === sl.id ? '#fff' : 'var(--text-dim)', borderColor: addSublist === sl.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                  {sl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {addType === 'task' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{t('assignee_opt')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(list.members || []).map((m) => (
                <button key={m.id} onClick={() => setAddAssignee(addAssignee === m.id ? null : m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 6px', borderRadius: 999, border: '0.5px solid', background: addAssignee === m.id ? 'var(--primary-bg)' : 'var(--bg-input)', borderColor: addAssignee === m.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                  <Avatar member={m} size={18} />
                  <span style={{ fontSize: 12, color: addAssignee === m.id ? 'var(--primary)' : 'var(--text-dim)' }}>{m.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={doAdd} style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {addType === 'task' ? t('add_task') : t('add_sublist')}
        </button>
      </Sheet>

      {taskSheet && (
        <TaskDetailSheet task={taskSheet} listId={listId} onClose={() => setTaskSheet(null)} onSave={() => setTaskSheet(null)} onDelete={() => setTaskSheet(null)} />
      )}
    </div>
  );
}
