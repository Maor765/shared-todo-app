import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask, ListDetail, ListWithMembers } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { Sheet } from './ui/Sheet';
import { listsAPI } from '../api/lists.api';
import { tasksAPI } from '../api/tasks.api';
import { sublistsAPI } from '../api/sublists.api';
import TaskDetailSheet from './TaskDetailSheet';

const EMOJIS = [
  "📋","🎨","⚙️","🔬","🚀","💡","📊","🎯","🔧","📝","🌟","💼","🎪","🔥","📱",
  "🛒","🏠","🍕","💪","📚","🎵","✈️","🌿","💰","🎮","🏋️","🧠","❤️","🌍","⚡",
  "🎁","🔑","🌈","🍎","🏆","🎬","🧪","🌙","☀️","🎓","🏖️","🐾","🌸","🍀","🔔",
  "💊","🛠️","📷","🎤","🚗","🏡","🧹","🍳","☕","🎂","🛁","🌻","🦋","🐶","🐱",
];

interface ListDetailProps { listId: string; onBack: () => void; }

export default function ListDetail({ listId, onBack }: ListDetailProps) {
  const auth = useAuth();
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addSheet, setAddSheet] = useState(false);
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);
  const [addType, setAddType] = useState('task');
  const [addName, setAddName] = useState('');
  const [addSublist, setAddSublist] = useState<string | null>(null);
  const [addAssignee, setAddAssignee] = useState<string | null>(null);
  const [addDue, setAddDue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('📋');
  const [editShared, setEditShared] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  const openEdit = () => {
    if (!list) return;
    setEditName(list.name);
    setEditEmoji(list.emoji);
    setEditShared(list.shared);
    setShowMenu(false);
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!list || !editName.trim()) return;
    setSaving(true);
    try {
      await listsAPI.updateList(listId, { name: editName.trim(), emoji: editEmoji, shared: editShared });
      queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
        (prev ?? []).map((l) => l.id === listId ? { ...l, name: editName.trim(), emoji: editEmoji, shared: editShared } : l),
      );
      queryClient.setQueryData(['list', listId], (prev: any) =>
        prev ? { ...prev, name: editName.trim(), emoji: editEmoji, shared: editShared } : prev,
      );
      setShowEdit(false);
    } catch {} finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await listsAPI.deleteList(listId);
      onBack();
    } catch {} finally { setDeleting(false); }
  };

  if (!list) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>{t('loading')}</div>;

  const today = new Date().toISOString().slice(0, 10);

  const filterTask = (task: DBTask) => {
    if (search) return task.text.toLowerCase().includes(search.toLowerCase());
    if (filter === 'Open') return !task.done;
    if (filter === 'Done') return task.done;
    if (filter === 'Mine') return task.assignee_id === auth.user?.id;
    return true;
  };

  const toggleTask = async (taskId: string) => {
    const task = list.tasks.find((task) => task.id === taskId);
    if (!task) return;
    const newDone = !task.done;
    const patch = (done: boolean) =>
      queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
        prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) } : prev,
      );
    patch(newDone);
    try { await tasksAPI.updateTask(listId, taskId, { done: newDone }); }
    catch { patch(task.done); }
  };

  const markAllDone = async () => {
    setShowMenu(false);
    const undone = list.tasks.filter((t) => !t.done);
    if (!undone.length) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, done: true })) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => ({ ...t, done: true })) } : l,
      ),
    );
    await Promise.allSettled(undone.map((t) => tasksAPI.updateTask(listId, t.id, { done: true })));
  };

  const unmarkAllDone = async () => {
    const done = list.tasks.filter((t) => t.done);
    if (!done.length) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, done: false })) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => ({ ...t, done: false })) } : l,
      ),
    );
    await Promise.allSettled(done.map((t) => tasksAPI.updateTask(listId, t.id, { done: false })));
  };

  const doAdd = async () => {
    if (!addName.trim() || adding) return;
    setAdding(true);
    try {
      if (addType === 'sublist') {
        await sublistsAPI.createSublist(listId, addName.trim());
      } else {
        await tasksAPI.createTask(listId, { text: addName.trim(), sublist_id: addSublist, assignee_id: addAssignee, due: addDue || null, notes: '' });
      }
      setAddName(''); setAddSublist(null); setAddAssignee(null); setAddDue(''); setAddSheet(false);
    } catch {} finally { setAdding(false); }
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
          <div style={{ fontSize: 15, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
            {assignee && <Avatar member={assignee} size={16} />}
            {assignee && <span>{assignee.name.split(' ')[0]}</span>}
          </div>
        </div>
        {isOverdue && <Badge variant="danger">{t('overdue_badge')}</Badge>}
        {isDueSoon && <Badge variant="warn">{t('soon_badge')}</Badge>}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div style={{ background: 'var(--bg-card)', padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 6, padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          {t('back_lists')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.5 }}>{list.emoji} {list.name}</div>
            {list.tasks.length > 0 && (
              <span style={{
                fontSize: 13, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                background: list.tasks.every(t => t.done) ? 'var(--success-bg)' : 'var(--bg)',
                color: list.tasks.every(t => t.done) ? 'var(--success-dim)' : 'var(--text-muted)',
                border: '0.5px solid var(--border)',
              }}>
                {list.tasks.every(t => t.done) ? t('done_badge') : `${list.tasks.filter(t => t.done).length}/${list.tasks.length}`}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => { setShowSearch((s) => !s); setSearch(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
            </button>
            <button onClick={() => setShowMenu((s) => !s)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>
              <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor"><circle cx="2" cy="2" r="2"/><circle cx="9" cy="2" r="2"/><circle cx="16" cy="2" r="2"/></svg>
            </button>
          </div>
          {showMenu && (
            <div style={{ position: 'absolute', top: 28, right: 0, zIndex: 20, background: 'var(--bg-card)', borderRadius: 10, border: '0.5px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: 130 }}>
              <button onClick={openEdit}
                style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {t('edit_list')}
              </button>
              <div style={{ height: '0.5px', background: 'var(--border)' }} />
              <button onClick={() => { setShowMenu(false); setShowDelete(true); }}
                style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--danger)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                {t('delete_list')}
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {(list.members || []).slice(0, 4).map((m, i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, border: '2px solid var(--bg-card)', borderRadius: '50%' }}>
              <Avatar member={m} size={22} />
            </div>
          ))}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>{(list.members || []).length} {t('members')}</span>
        </div>
      </div>

      {showSearch && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderRadius: 10, border: '0.5px solid var(--border)', padding: '0 12px', height: 38, margin: '8px 16px 0' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_ph')}
            style={{ border: 'none', background: 'none', fontSize: 15, color: 'var(--text)', outline: 'none', flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 16, padding: 0 }}>×</button>}
        </div>
      )}
      <FilterChips
        options={['All', 'Open', 'Done', 'Mine']}
        labels={[t('filter_all'), t('filter_open'), t('filter_done'), t('filter_mine')]}
        value={filter}
        onChange={setFilter}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        {(list.tasks.some((t) => !t.done) || list.tasks.some((t) => t.done)) && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {list.tasks.some((t) => !t.done) && (
              <button onClick={markAllDone}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'var(--success-bg)', border: '0.5px solid var(--success)', color: 'var(--success-dim)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                {t('mark_all_done')}
              </button>
            )}
            {list.tasks.some((t) => t.done) && (
              <button onClick={unmarkAllDone}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--border-mid)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                {t('unmark_all_done')}
              </button>
            )}
          </div>
        )}
        {(list.sublists || []).map((sl) => {
          const tasks = list.tasks.filter((task) => task.sublist_id === sl.id && filterTask(task));
          return (
            <div key={sl.id} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '0.5px solid var(--border)', marginBottom: 10, overflow: 'hidden' }}>
              <div onClick={() => setCollapsed((c) => ({ ...c, [sl.id]: !c[sl.id] }))} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{sl.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>{tasks.filter((task) => task.done).length}/{tasks.length}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" style={{ transform: collapsed[sl.id] ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }}>
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {!collapsed[sl.id] && (
                <div style={{ padding: '0 14px' }}>
                  {tasks.length === 0
                    ? <div style={{ fontSize: 14, color: 'var(--text-disabled)', padding: '12px 0' }}>{t('no_tasks_yet')}</div>
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

      </div>

      {/* Floating action button */}
      <button
        onClick={() => setAddSheet(true)}
        style={{
          position: 'absolute', bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 10,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <Sheet open={addSheet} onClose={() => setAddSheet(false)} title={`${t('add_to')} ${list.name}`}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {['task', 'sublist'].map((type) => (
            <button key={type} onClick={() => setAddType(type)}
              style={{ padding: 14, borderRadius: 12, border: addType === type ? '2px solid var(--primary)' : '0.5px solid var(--border)', background: addType === type ? 'var(--primary-bg)' : 'var(--bg-input)', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{type === 'task' ? '✅' : '📂'}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: addType === type ? 'var(--primary)' : 'var(--text)' }}>{type === 'task' ? t('type_task') : t('type_sublist')}</div>
              <div style={{ fontSize: 13, color: addType === type ? 'var(--primary-dim)' : 'var(--text-muted)', marginTop: 2 }}>{type === 'task' ? t('single_todo') : t('group_tasks')}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{addType === 'task' ? t('task_name') : t('sublist_name')}</div>
          <input value={addName} onChange={(e) => setAddName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doAdd()} placeholder={addType === 'task' ? t('task_ph') : t('sublist_ph')}
            style={{ width: '100%', height: 38, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--primary)', padding: '0 12px', fontSize: 16, color: 'var(--text)', outline: 'none' }} />
        </div>

        {addType === 'task' && (list.sublists || []).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{t('add_to_sublist')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setAddSublist(null)} style={{ fontSize: 14, padding: '4px 10px', borderRadius: 999, border: '0.5px solid', background: !addSublist ? 'var(--primary)' : 'var(--bg-input)', color: !addSublist ? '#fff' : 'var(--text-dim)', borderColor: !addSublist ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                {t('none')}
              </button>
              {(list.sublists || []).map((sl) => (
                <button key={sl.id} onClick={() => setAddSublist(sl.id)} style={{ fontSize: 14, padding: '4px 10px', borderRadius: 999, border: '0.5px solid', background: addSublist === sl.id ? 'var(--primary)' : 'var(--bg-input)', color: addSublist === sl.id ? '#fff' : 'var(--text-dim)', borderColor: addSublist === sl.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                  {sl.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {addType === 'task' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{t('assignee_opt')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(list.members || []).map((m) => (
                <button key={m.id} onClick={() => setAddAssignee(addAssignee === m.id ? null : m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px 4px 6px', borderRadius: 999, border: '0.5px solid', background: addAssignee === m.id ? 'var(--primary-bg)' : 'var(--bg-input)', borderColor: addAssignee === m.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
                  <Avatar member={m} size={18} />
                  <span style={{ fontSize: 14, color: addAssignee === m.id ? 'var(--primary)' : 'var(--text-dim)' }}>{m.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={doAdd} disabled={adding || !addName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: adding || !addName.trim() ? 0.6 : 1 }}>
          {adding ? '...' : addType === 'task' ? t('add_task') : t('add_sublist')}
        </button>
      </Sheet>

      {taskSheet && (
        <TaskDetailSheet task={taskSheet} listId={listId} onClose={() => setTaskSheet(null)} onSave={() => setTaskSheet(null)} onDelete={() => setTaskSheet(null)} />
      )}

      {showMenu && <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 15 }} />}

      <Sheet open={showEdit} onClose={() => setShowEdit(false)} title={t('edit_list')}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{t('name_label')}</div>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t('list_ph')}
            style={{ width: '100%', height: 38, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--primary)', padding: '0 12px', fontSize: 16, color: 'var(--text)', outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>{t('emoji_label')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEditEmoji(e)}
                style={{ width: 36, height: 36, borderRadius: 8, fontSize: 20, cursor: 'pointer', background: editEmoji === e ? 'var(--primary-bg)' : 'var(--bg-input)', border: editEmoji === e ? '2px solid var(--primary)' : '0.5px solid var(--border)' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--border)', marginBottom: 16 }}>
          <span style={{ fontSize: 16, color: 'var(--text)' }}>{t('shared_with_team')}</span>
          <div onClick={() => setEditShared((s) => !s)}
            style={{ width: 40, height: 22, borderRadius: 11, background: editShared ? 'var(--primary)' : 'var(--border)', position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
            <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: '#fff', top: 2, left: editShared ? 20 : 2, transition: 'left .2s' }} />
          </div>
        </div>
        <button onClick={saveEdit} disabled={saving || !editName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', opacity: saving || !editName.trim() ? 0.6 : 1 }}>
          {saving ? t('saving') : t('save')}
        </button>
      </Sheet>

      <Sheet open={showDelete} onClose={() => setShowDelete(false)} title={t('delete_list_confirm')}>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>{t('delete_list_sub')}</p>
        <button onClick={confirmDelete} disabled={deleting}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 16, fontWeight: 600, cursor: 'pointer', marginBottom: 10, opacity: deleting ? 0.6 : 1 }}>
          {deleting ? '...' : t('delete_list')}
        </button>
        <button onClick={() => setShowDelete(false)}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--bg)', color: 'var(--text-muted)', border: '0.5px solid var(--border)', fontSize: 16, cursor: 'pointer' }}>
          {t('cancel')}
        </button>
      </Sheet>
    </div>
  );
}
