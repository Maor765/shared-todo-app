import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "shared-todo-app-data";

const INITIAL_DATA = {
  currentUser: { id: "u1", name: "Alex Chen", initials: "AC", color: "#B5D4F4", textColor: "#0C447C" },
  members: [
    { id: "u1", name: "Alex Chen", initials: "AC", color: "#B5D4F4", textColor: "#0C447C", role: "admin", status: "active", email: "alex@company.com" },
    { id: "u2", name: "Jamie Lee", initials: "JL", color: "#9FE1CB", textColor: "#085041", role: "member", status: "active", email: "jamie@company.com" },
    { id: "u3", name: "Maya Rodriguez", initials: "MR", color: "#F4C0D1", textColor: "#72243E", role: "member", status: "active", email: "maya@company.com" },
    { id: "u4", name: "Tom Kim", initials: "TK", color: "#FAC775", textColor: "#633806", role: "member", status: "away", email: "tom@company.com" },
  ],
  lists: [
    {
      id: "l1", name: "Website Redesign", emoji: "🎨", shared: true,
      memberIds: ["u1","u2","u3","u4"],
      sublists: [
        { id: "sl1", listId: "l1", name: "Design" },
        { id: "sl2", listId: "l1", name: "Content" },
      ],
      tasks: [
        { id: "t1", listId: "l1", sublistId: "sl1", text: "Create wireframes", done: true, assigneeId: "u1", due: null, notes: "" },
        { id: "t2", listId: "l1", sublistId: "sl1", text: "Design homepage mockup", done: false, assigneeId: "u2", due: "2026-05-14", notes: "Focus on hero section and CTA placement" },
        { id: "t3", listId: "l1", sublistId: "sl1", text: "Finalize pricing page", done: false, assigneeId: null, due: null, notes: "" },
        { id: "t4", listId: "l1", sublistId: "sl2", text: "Write onboarding copy", done: false, assigneeId: "u3", due: null, notes: "" },
        { id: "t5", listId: "l1", sublistId: "sl2", text: "Review brand guidelines", done: false, assigneeId: "u1", due: null, notes: "" },
      ]
    },
    {
      id: "l2", name: "Launch Sprint", emoji: "⚙️", shared: true,
      memberIds: ["u1","u2","u3"],
      sublists: [
        { id: "sl3", listId: "l2", name: "Dev" },
        { id: "sl4", listId: "l2", name: "QA" },
      ],
      tasks: [
        { id: "t6", listId: "l2", sublistId: "sl3", text: "Set up CI pipeline", done: true, assigneeId: "u2", due: null, notes: "" },
        { id: "t7", listId: "l2", sublistId: "sl3", text: "Deploy staging env", done: true, assigneeId: "u1", due: null, notes: "" },
        { id: "t8", listId: "l2", sublistId: "sl3", text: "API rate limiting", done: false, assigneeId: "u1", due: null, notes: "" },
        { id: "t9", listId: "l2", sublistId: "sl4", text: "QA regression testing", done: false, assigneeId: "u3", due: null, notes: "" },
        { id: "t10", listId: "l2", sublistId: "sl4", text: "Performance audit", done: false, assigneeId: null, due: null, notes: "" },
      ]
    },
    {
      id: "l3", name: "Q2 Planning", emoji: "📋", shared: true,
      memberIds: ["u1","u2","u3","u4"],
      sublists: [],
      tasks: [
        { id: "t11", listId: "l3", sublistId: null, text: "Kick-off meeting notes", done: true, assigneeId: "u1", due: null, notes: "" },
        { id: "t12", listId: "l3", sublistId: null, text: "Define OKRs", done: true, assigneeId: "u1", due: null, notes: "" },
        { id: "t13", listId: "l3", sublistId: null, text: "Budget sign-off", done: true, assigneeId: "u4", due: null, notes: "" },
      ]
    },
    {
      id: "l4", name: "Personal tasks", emoji: "🔒", shared: false,
      memberIds: ["u1"],
      sublists: [],
      tasks: [
        { id: "t14", listId: "l4", sublistId: null, text: "Renew gym membership", done: false, assigneeId: "u1", due: null, notes: "" },
        { id: "t15", listId: "l4", sublistId: null, text: "Book dentist appointment", done: false, assigneeId: "u1", due: null, notes: "" },
        { id: "t16", listId: "l4", sublistId: null, text: "Read design systems book", done: true, assigneeId: "u1", due: null, notes: "" },
        { id: "t17", listId: "l4", sublistId: null, text: "Tidy up Figma workspace", done: false, assigneeId: "u1", due: null, notes: "" },
      ]
    }
  ],
  notifications: [
    { id: "n1", text: "Jamie Lee completed \"Set up CI pipeline\"", context: "Launch Sprint", time: "2h ago", read: false, type: "done" },
    { id: "n2", text: "Maya R. assigned you \"Review brand guidelines\"", context: "Website Redesign", time: "4h ago", read: false, type: "assign" },
    { id: "n3", text: "\"Design homepage mockup\" is due tomorrow", context: "Website Redesign", time: "5h ago", read: false, type: "due" },
    { id: "n4", text: "Tom Kim was added to Website Redesign", context: "Yesterday · 3:12 PM", time: "", read: true, type: "member" },
    { id: "n5", text: "Alex created the \"Content\" sublist", context: "Yesterday · 11:44 AM", time: "", read: true, type: "create" },
  ]
};

const EMOJIS = ["📋","🎨","⚙️","🔬","🚀","💡","📊","🎯","🔧","📝","🌟","💼","🎪","🔥","📱"];

function uid() { return Math.random().toString(36).slice(2,9); }

function Avatar({ member, size = 24 }) {
  if (!member) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: member.color, color: member.textColor,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0
    }}>{member.initials}</div>
  );
}

function Badge({ children, variant = "neutral" }) {
  const styles = {
    neutral: { bg: "#f0ede8", color: "#888" },
    info: { bg: "#e6f1fb", color: "#185FA5" },
    success: { bg: "#eaf3de", color: "#3B6D11" },
    warn: { bg: "#faeeda", color: "#854F0B" },
    danger: { bg: "#FCEBEB", color: "#A32D2D" },
  };
  const s = styles[variant] || styles.neutral;
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 999,
      fontWeight: 600, background: s.bg, color: s.color, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function ProgressBar({ value, color = "#178AE8" }) {
  return (
    <div style={{ height: 3, background: "#f0ede8", borderRadius: 2, marginTop: 8 }}>
      <div style={{ height: "100%", width: `${Math.round(value)}%`, background: color, borderRadius: 2, transition: "width .3s" }} />
    </div>
  );
}

function CheckCircle({ done, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: 22, height: 22, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
      border: done ? "none" : "1.5px solid #ccc",
      background: done ? "#639922" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all .15s", marginTop: 1
    }}>
      {done && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  );
}

function NavBar({ tab, setTab, notifCount }) {
  const items = [
    { id: "dash", label: "Dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
    { id: "lists", label: "Lists", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    { id: "alerts", label: "Alerts", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    { id: "team", label: "Team", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  ];
  return (
    <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 0 20px", background: "#fff", borderTop: "0.5px solid #e8e4de" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => setTab(item.id)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          background: "none", border: "none", cursor: "pointer",
          color: tab === item.id ? "#178AE8" : "#aaa", fontSize: 10, fontWeight: 500,
          position: "relative"
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon}/>
          </svg>
          {item.label}
          {item.id === "alerts" && notifCount > 0 && (
            <div style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: "50%", background: "#178AE8", border: "1.5px solid #fff" }} />
          )}
        </button>
      ))}
    </div>
  );
}

function TopBar({ title, sub, right }) {
  return (
    <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#1a1a1a", letterSpacing: -0.5 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{right}</div>
    </div>
  );
}

function IconBtn({ icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 34, height: 34, borderRadius: "50%", background: "#f5f2ed",
      border: "0.5px solid #e8e4de", display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", color: "#666", flexShrink: 0
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon}/>
      </svg>
    </button>
  );
}

function Sheet({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50,
      display: "flex", alignItems: "flex-end", borderRadius: 28
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "16px 16px 0 0", padding: "16px 16px 32px",
        width: "100%", maxHeight: "85%", overflowY: "auto"
      }}>
        <div style={{ width: 36, height: 4, background: "#ddd", borderRadius: 2, margin: "0 auto 14px" }} />
        {title && <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 16 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function FilterChips({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 16px", overflowX: "auto", borderBottom: "0.5px solid #e8e4de" }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          fontSize: 12, padding: "5px 12px", borderRadius: 999, border: "0.5px solid",
          fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
          background: value === opt ? "#178AE8" : "#f5f2ed",
          color: value === opt ? "#fff" : "#666",
          borderColor: value === opt ? "#178AE8" : "#e8e4de"
        }}>{opt}</button>
      ))}
    </div>
  );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────
function Dashboard({ data, setData, setTab, setDetailListId }) {
  const [filter, setFilter] = useState("All");
  const [taskSheet, setTaskSheet] = useState(null);

  const allTasks = data.lists.flatMap(l => l.tasks.map(t => ({ ...t, list: l })));
  const today = new Date().toISOString().slice(0,10);

  const filtered = allTasks.filter(t => {
    if (filter === "Mine") return t.assigneeId === data.currentUser.id;
    if (filter === "Due today") return t.due === today;
    if (filter === "Overdue") return t.due && t.due < today && !t.done;
    return true;
  });

  const total = allTasks.length;
  const done = allTasks.filter(t => t.done).length;
  const inProg = allTasks.filter(t => !t.done).length;

  const toggleTask = (listId, taskId) => {
    setData(d => ({
      ...d,
      lists: d.lists.map(l => l.id !== listId ? l : {
        ...l, tasks: l.tasks.map(t => t.id !== taskId ? t : { ...t, done: !t.done })
      })
    }));
  };

  const unread = data.notifications.filter(n => !n.read).length;
  const member = id => data.members.find(m => m.id === id);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <TopBar
        title="Dashboard"
        sub={`Good morning, ${data.currentUser.name.split(" ")[0]} 👋`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f5f2ed", borderRadius: 999, padding: "4px 10px 4px 4px", border: "0.5px solid #e8e4de" }}>
            <Avatar member={data.currentUser} size={24} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>{data.currentUser.name.split(" ")[0]}</span>
          </div>
        }
      />
      <FilterChips options={["All","Mine","Due today","Overdue"]} value={filter} onChange={setFilter} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { num: total, lbl: "Total tasks", color: "#1a1a1a" },
            { num: done, lbl: "Completed", color: "#639922" },
            { num: inProg, lbl: "Open", color: "#BA7517" },
            { num: data.lists.length, lbl: "Lists", color: "#1a1a1a" },
          ].map(s => (
            <div key={s.lbl} style={{ background: "#f5f2ed", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.num}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>
          {filter === "All" ? `All tasks (${filtered.length})` : `${filter} (${filtered.length})`}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>Nothing here</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>No tasks match this filter</div>
          </div>
        )}

        {filtered.map(t => {
          const isOverdue = t.due && t.due < today && !t.done;
          const isDueSoon = t.due && t.due >= today && !t.done;
          const sublist = t.list.sublists.find(s => s.id === t.sublistId);
          const breadcrumb = sublist ? `${t.list.emoji} ${t.list.name} › ${sublist.name}` : `${t.list.emoji} ${t.list.name}`;
          return (
            <div key={t.id} onClick={() => setTaskSheet(t)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              background: "#fff", borderRadius: 12, border: "0.5px solid #e8e4de",
              marginBottom: 8, cursor: "pointer"
            }}>
              <div onClick={e => { e.stopPropagation(); toggleTask(t.listId, t.id); }}>
                <CheckCircle done={t.done} onToggle={() => toggleTask(t.listId, t.id)} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: t.done ? "#bbb" : "#1a1a1a", textDecoration: t.done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.text}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{breadcrumb}</div>
              </div>
              {isOverdue && <Badge variant="danger">Overdue</Badge>}
              {isDueSoon && <Badge variant="warn">Due soon</Badge>}
              {t.assigneeId && <Avatar member={member(t.assigneeId)} size={22} />}
            </div>
          );
        })}
      </div>

      {taskSheet && (
        <TaskDetailSheet
          task={taskSheet}
          list={taskSheet.list}
          data={data}
          onClose={() => setTaskSheet(null)}
          onSave={(updated) => {
            setData(d => ({
              ...d,
              lists: d.lists.map(l => l.id !== updated.listId ? l : {
                ...l, tasks: l.tasks.map(t => t.id !== updated.id ? t : updated)
              })
            }));
            setTaskSheet(null);
          }}
          onDelete={(taskId, listId) => {
            setData(d => ({
              ...d,
              lists: d.lists.map(l => l.id !== listId ? l : { ...l, tasks: l.tasks.filter(t => t.id !== taskId) })
            }));
            setTaskSheet(null);
          }}
        />
      )}
    </div>
  );
}

// ── LISTS ──────────────────────────────────────────────────────────────────────
function Lists({ data, setData, setDetailListId }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [newShared, setNewShared] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const shared = data.lists.filter(l => l.shared);
  const priv = data.lists.filter(l => !l.shared);

  const progress = (list) => {
    if (!list.tasks.length) return 0;
    return (list.tasks.filter(t => t.done).length / list.tasks.length) * 100;
  };

  const createList = () => {
    if (!newName.trim()) return;
    const list = {
      id: uid(), name: newName.trim(), emoji: newEmoji, shared: newShared,
      memberIds: [data.currentUser.id], sublists: [], tasks: []
    };
    setData(d => ({ ...d, lists: [...d.lists, list] }));
    setNewName(""); setNewEmoji("📋"); setNewShared(true);
    setShowCreate(false);
  };

  const filtered = (arr) => search ? arr.filter(l => l.name.toLowerCase().includes(search.toLowerCase())) : arr;

  const ListCard = ({ list }) => {
    const prog = progress(list);
    const members = list.memberIds.map(id => data.members.find(m => m.id === id)).filter(Boolean);
    const taskCount = list.tasks.length;
    const doneCount = list.tasks.filter(t => t.done).length;
    return (
      <div onClick={() => setDetailListId(list.id)} style={{
        background: "#fff", borderRadius: 14, border: "0.5px solid #e8e4de",
        padding: "14px", marginBottom: 10, cursor: "pointer"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{list.emoji}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{list.name}</span>
          </div>
          {prog === 100 ? <Badge variant="success">Done</Badge> :
           taskCount > 0 ? <Badge variant={prog > 50 ? "warn" : "info"}>{taskCount} tasks</Badge> :
           <Badge variant="neutral">Empty</Badge>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#888" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 0a4 4 0 10-8 0 4 4 0 008 0z"/></svg>
          {members.length} members
          {list.sublists.length > 0 && <><span>·</span><span>{list.sublists.length} sublists</span></>}
          <div style={{ display: "flex", marginLeft: "auto" }}>
            {members.slice(0,3).map((m,i) => (
              <div key={m.id} style={{ marginLeft: i > 0 ? -5 : 0, border: "2px solid #fff", borderRadius: "50%" }}>
                <Avatar member={m} size={20} />
              </div>
            ))}
            {members.length > 3 && <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#f0ede8", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: -5, border: "2px solid #fff", color: "#888", fontWeight: 600 }}>+{members.length-3}</div>}
          </div>
        </div>
        <ProgressBar value={prog} color={prog === 100 ? "#639922" : "#178AE8"} />
        {taskCount > 0 && <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>{doneCount}/{taskCount} done</div>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <TopBar
        title="My lists"
        sub={`${data.lists.length} lists · ${shared.length} shared`}
        right={<>
          <IconBtn icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" onClick={() => setShowSearch(s => !s)} />
          <IconBtn icon="M12 5v14M5 12h14" onClick={() => setShowCreate(true)} />
        </>}
      />
      {showSearch && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f5f2ed", borderRadius: 10, border: "0.5px solid #e8e4de", padding: "0 12px", height: 36, margin: "0 16px 8px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lists..." style={{ border: "none", background: "none", fontSize: 13, color: "#1a1a1a", outline: "none", flex: 1 }} />
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        {filtered(shared).length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, margin: "8px 0 8px" }}>Shared</div>
          {filtered(shared).map(l => <ListCard key={l.id} list={l} />)}
        </>}
        {filtered(priv).length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, margin: "14px 0 8px" }}>Private</div>
          {filtered(priv).map(l => <ListCard key={l.id} list={l} />)}
        </>}
        {data.lists.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>No lists yet</div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5, marginBottom: 20 }}>Create your first list to start organizing tasks with your team.</div>
            <button onClick={() => setShowCreate(true)} style={{ background: "#178AE8", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Create a list</button>
          </div>
        )}
      </div>

      <Sheet open={showCreate} onClose={() => setShowCreate(false)} title="New list">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Name</div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Q3 Roadmap" style={{ width: "100%", height: 38, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #178AE8", padding: "0 12px", fontSize: 14, color: "#1a1a1a", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontWeight: 600 }}>Emoji</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setNewEmoji(e)} style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: "pointer",
                background: newEmoji === e ? "#e6f1fb" : "#f5f2ed",
                border: newEmoji === e ? "2px solid #178AE8" : "0.5px solid #e8e4de"
              }}>{e}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #e8e4de", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "#1a1a1a" }}>Shared with team</span>
          <div onClick={() => setNewShared(s => !s)} style={{ width: 40, height: 22, borderRadius: 11, background: newShared ? "#178AE8" : "#e8e4de", position: "relative", cursor: "pointer", transition: "background .2s" }}>
            <div style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#fff", top: 2, left: newShared ? 20 : 2, transition: "left .2s" }} />
          </div>
        </div>
        <button onClick={createList} style={{ width: "100%", padding: 13, borderRadius: 10, background: "#178AE8", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Create list</button>
      </Sheet>
    </div>
  );
}

// ── LIST DETAIL ────────────────────────────────────────────────────────────────
function ListDetail({ listId, data, setData, onBack }) {
  const [filter, setFilter] = useState("All");
  const [collapsed, setCollapsed] = useState({});
  const [addSheet, setAddSheet] = useState(false);
  const [taskSheet, setTaskSheet] = useState(null);
  const [addType, setAddType] = useState("task");
  const [addName, setAddName] = useState("");
  const [addSublist, setAddSublist] = useState(null);
  const [addAssignee, setAddAssignee] = useState(null);
  const [addDue, setAddDue] = useState("");

  const list = data.lists.find(l => l.id === listId);
  if (!list) return null;

  const members = list.memberIds.map(id => data.members.find(m => m.id === id)).filter(Boolean);
  const today = new Date().toISOString().slice(0,10);

  const filterTask = t => {
    if (filter === "Open") return !t.done;
    if (filter === "Done") return t.done;
    if (filter === "Mine") return t.assigneeId === data.currentUser.id;
    return true;
  };

  const toggleTask = (taskId) => {
    setData(d => ({
      ...d,
      lists: d.lists.map(l => l.id !== listId ? l : {
        ...l, tasks: l.tasks.map(t => t.id !== taskId ? t : { ...t, done: !t.done })
      })
    }));
  };

  const doAdd = () => {
    if (!addName.trim()) return;
    if (addType === "sublist") {
      setData(d => ({
        ...d,
        lists: d.lists.map(l => l.id !== listId ? l : { ...l, sublists: [...l.sublists, { id: uid(), listId, name: addName.trim() }] })
      }));
    } else {
      setData(d => ({
        ...d,
        lists: d.lists.map(l => l.id !== listId ? l : {
          ...l, tasks: [...l.tasks, { id: uid(), listId, sublistId: addSublist, text: addName.trim(), done: false, assigneeId: addAssignee, due: addDue || null, notes: "" }]
        })
      }));
    }
    setAddName(""); setAddSublist(null); setAddAssignee(null); setAddDue("");
    setAddSheet(false);
  };

  const looseTasks = list.tasks.filter(t => !t.sublistId && filterTask(t));
  const member = id => data.members.find(m => m.id === id);

  const TaskRow = ({ task }) => {
    const isOverdue = task.due && task.due < today && !task.done;
    const isDueSoon = task.due && task.due >= today && !task.done;
    return (
      <div onClick={() => setTaskSheet(task)} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ede8", cursor: "pointer" }}>
        <div onClick={e => { e.stopPropagation(); toggleTask(task.id); }}>
          <CheckCircle done={task.done} onToggle={() => toggleTask(task.id)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: task.done ? "#bbb" : "#1a1a1a", textDecoration: task.done ? "line-through" : "none" }}>{task.text}</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
            {task.assigneeId && <Avatar member={member(task.assigneeId)} size={16} />}
            {task.assigneeId && <span>{member(task.assigneeId)?.name.split(" ")[0]}</span>}
            {task.due && <span>· {task.due}</span>}
          </div>
        </div>
        {isOverdue && <Badge variant="danger">Overdue</Badge>}
        {isDueSoon && <Badge variant="warn">Soon</Badge>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ background: "#fff", padding: "12px 16px", borderBottom: "0.5px solid #e8e4de" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#178AE8", background: "none", border: "none", cursor: "pointer", marginBottom: 6, padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Lists
        </button>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: -0.5 }}>{list.emoji} {list.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          {members.slice(0,4).map((m,i) => (
            <div key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, border: "2px solid #fff", borderRadius: "50%" }}>
              <Avatar member={m} size={22} />
            </div>
          ))}
          <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>{members.length} members</span>
        </div>
      </div>
      <FilterChips options={["All","Open","Done","Mine"]} value={filter} onChange={setFilter} />
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px" }}>
        {list.sublists.map(sl => {
          const tasks = list.tasks.filter(t => t.sublistId === sl.id && filterTask(t));
          const allDone = tasks.every(t => t.done);
          return (
            <div key={sl.id} style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #e8e4de", marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => setCollapsed(c => ({ ...c, [sl.id]: !c[sl.id] }))} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, background: "#f5f2ed", borderBottom: "0.5px solid #e8e4de", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{sl.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#aaa" }}>{tasks.filter(t=>t.done).length}/{tasks.length}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" style={{ transform: collapsed[sl.id] ? "rotate(-90deg)" : "none", transition: "transform .2s" }}><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              {!collapsed[sl.id] && (
                <div style={{ padding: "0 14px" }}>
                  {tasks.length === 0 ? <div style={{ fontSize: 12, color: "#bbb", padding: "12px 0" }}>No tasks yet</div> : tasks.map(t => <TaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          );
        })}
        {looseTasks.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #e8e4de", padding: "0 14px", marginBottom: 10 }}>
            {looseTasks.map(t => <TaskRow key={t.id} task={t} />)}
          </div>
        )}
        <button onClick={() => setAddSheet(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f5f2ed", borderRadius: 10, border: "0.5px dashed #ccc", color: "#aaa", fontSize: 13, cursor: "pointer", width: "100%" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add sublist or task...
        </button>
      </div>

      <Sheet open={addSheet} onClose={() => setAddSheet(false)} title={`Add to ${list.name}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {["task","sublist"].map(type => (
            <button key={type} onClick={() => setAddType(type)} style={{
              padding: 14, borderRadius: 12, border: addType === type ? "2px solid #178AE8" : "0.5px solid #e8e4de",
              background: addType === type ? "#e6f1fb" : "#f5f2ed", cursor: "pointer", textAlign: "center"
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{type === "task" ? "✅" : "📂"}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: addType === type ? "#178AE8" : "#1a1a1a", textTransform: "capitalize" }}>{type}</div>
              <div style={{ fontSize: 11, color: addType === type ? "#178AE8" : "#888", marginTop: 2 }}>{type === "task" ? "A single to-do" : "A group of tasks"}</div>
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>{addType === "task" ? "Task name" : "Sublist name"}</div>
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={addType === "task" ? "What needs to be done?" : "e.g. Design"} style={{ width: "100%", height: 38, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #178AE8", padding: "0 12px", fontSize: 14, outline: "none" }} />
        </div>
        {addType === "task" && list.sublists.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>Add to sublist (optional)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setAddSublist(null)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "0.5px solid", background: !addSublist ? "#178AE8" : "#f5f2ed", color: !addSublist ? "#fff" : "#666", borderColor: !addSublist ? "#178AE8" : "#e8e4de", cursor: "pointer" }}>None</button>
              {list.sublists.map(sl => (
                <button key={sl.id} onClick={() => setAddSublist(sl.id)} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "0.5px solid", background: addSublist === sl.id ? "#178AE8" : "#f5f2ed", color: addSublist === sl.id ? "#fff" : "#666", borderColor: addSublist === sl.id ? "#178AE8" : "#e8e4de", cursor: "pointer" }}>{sl.name}</button>
              ))}
            </div>
          </div>
        )}
        {addType === "task" && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontWeight: 600 }}>Assignee (optional)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {members.map(m => (
                <button key={m.id} onClick={() => setAddAssignee(addAssignee === m.id ? null : m.id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px 4px 6px", borderRadius: 999, border: "0.5px solid", background: addAssignee === m.id ? "#e6f1fb" : "#f5f2ed", borderColor: addAssignee === m.id ? "#178AE8" : "#e8e4de", cursor: "pointer" }}>
                  <Avatar member={m} size={18} />
                  <span style={{ fontSize: 12, color: addAssignee === m.id ? "#178AE8" : "#666" }}>{m.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={doAdd} style={{ width: "100%", padding: 13, borderRadius: 10, background: "#178AE8", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {addType === "task" ? "Add task" : "Add sublist"}
        </button>
      </Sheet>

      {taskSheet && (
        <TaskDetailSheet
          task={taskSheet}
          list={list}
          data={data}
          onClose={() => setTaskSheet(null)}
          onSave={(updated) => {
            setData(d => ({
              ...d,
              lists: d.lists.map(l => l.id !== updated.listId ? l : {
                ...l, tasks: l.tasks.map(t => t.id !== updated.id ? t : updated)
              })
            }));
            setTaskSheet(null);
          }}
          onDelete={(taskId, listId) => {
            setData(d => ({
              ...d,
              lists: d.lists.map(l => l.id !== listId ? l : { ...l, tasks: l.tasks.filter(t => t.id !== taskId) })
            }));
            setTaskSheet(null);
          }}
        />
      )}
    </div>
  );
}

// ── TASK DETAIL SHEET ──────────────────────────────────────────────────────────
function TaskDetailSheet({ task, list, data, onClose, onSave, onDelete }) {
  const [text, setText] = useState(task.text);
  const [notes, setNotes] = useState(task.notes || "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [due, setDue] = useState(task.due || "");
  const [sublistId, setSublistId] = useState(task.sublistId);
  const members = list.memberIds.map(id => data.members.find(m => m.id === id)).filter(Boolean);

  return (
    <Sheet open={true} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <CheckCircle done={task.done} onToggle={() => {}} />
        <input value={text} onChange={e => setText(e.target.value)} style={{ flex: 1, fontSize: 16, fontWeight: 600, color: "#1a1a1a", border: "none", outline: "none", background: "none" }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes..." rows={3} style={{ width: "100%", borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #e8e4de", padding: "8px 12px", fontSize: 13, outline: "none", resize: "none", color: "#1a1a1a" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Assignee</div>
          <select value={assigneeId || ""} onChange={e => setAssigneeId(e.target.value || null)} style={{ width: "100%", height: 36, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #e8e4de", padding: "0 8px", fontSize: 13, outline: "none" }}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Due date</div>
          <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ width: "100%", height: 36, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #e8e4de", padding: "0 8px", fontSize: 13, outline: "none" }} />
        </div>
      </div>
      {list.sublists.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Sublist</div>
          <select value={sublistId || ""} onChange={e => setSublistId(e.target.value || null)} style={{ width: "100%", height: 36, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #e8e4de", padding: "0 8px", fontSize: 13, outline: "none" }}>
            <option value="">No sublist</option>
            {list.sublists.map(sl => <option key={sl.id} value={sl.id}>{sl.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave({ ...task, text, notes, assigneeId, due: due || null, sublistId })} style={{ flex: 1, padding: 12, borderRadius: 10, background: "#178AE8", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Save</button>
        <button onClick={() => onDelete(task.id, task.listId)} style={{ width: 44, height: 44, borderRadius: 10, background: "#FCEBEB", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </Sheet>
  );
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────────
function Notifications({ data, setData }) {
  const markAll = () => setData(d => ({ ...d, notifications: d.notifications.map(n => ({ ...n, read: true })) }));
  const today = data.notifications.filter(n => n.time);
  const older = data.notifications.filter(n => !n.time);
  const typeIcon = type => ({ done: "✅", assign: "👤", due: "⏰", member: "👋", create: "📂" })[type] || "•";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <TopBar title="Alerts" right={<IconBtn icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0" onClick={markAll} />} />
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, margin: "8px 0 8px" }}>Today</div>
        {today.map(n => (
          <div key={n.id} onClick={() => setData(d => ({ ...d, notifications: d.notifications.map(x => x.id === n.id ? { ...x, read: true } : x) }))} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ede8", cursor: "pointer" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.read ? "#ddd" : (n.type === "due" ? "#BA7517" : "#178AE8"), flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.4 }}>{n.text}</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{n.context} {n.time && `· ${n.time}`}</div>
            </div>
          </div>
        ))}
        {older.length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, margin: "14px 0 8px" }}>Earlier</div>
          {older.map(n => (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderBottom: "0.5px solid #f0ede8" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ddd", flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.4 }}>{n.text}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>{n.context}</div>
              </div>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}

// ── TEAM ───────────────────────────────────────────────────────────────────────
function Team({ data, setData }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [invited, setInvited] = useState(false);

  const current = data.members.find(m => m.id === data.currentUser.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <TopBar
        title="Team"
        sub="Workspace members"
        right={<IconBtn icon="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" onClick={() => setShowInvite(true)} />}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #e8e4de", padding: "20px 16px", textAlign: "center", marginBottom: 14 }}>
          <div style={{ margin: "0 auto 10px", width: 64, height: 64, borderRadius: "50%", background: current.color, color: current.textColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>{current.initials}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{current.name}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 3 }}>{current.email}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <Badge variant="info">Admin</Badge>
            <Badge variant="success">{data.lists.filter(l => l.memberIds.includes(current.id)).length} active lists</Badge>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: .6, marginBottom: 8 }}>All members</div>
        <div style={{ background: "#fff", borderRadius: 14, border: "0.5px solid #e8e4de", padding: "0 14px" }}>
          {data.members.map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < data.members.length - 1 ? "0.5px solid #f0ede8" : "none" }}>
              <Avatar member={m} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2, textTransform: "capitalize" }}>{m.role} · {data.lists.filter(l => l.memberIds.includes(m.id)).length} lists</div>
              </div>
              <Badge variant={m.status === "active" ? "info" : "neutral"}>{m.status === "active" ? "Active" : "Away"}</Badge>
            </div>
          ))}
        </div>
        {invited && <div style={{ marginTop: 12, padding: "10px 14px", background: "#eaf3de", borderRadius: 10, fontSize: 13, color: "#3B6D11", fontWeight: 500 }}>✅ Invite sent!</div>}
      </div>

      <Sheet open={showInvite} onClose={() => { setShowInvite(false); setInvited(false); }} title="Invite to workspace">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontWeight: 600 }}>Email address</div>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" style={{ width: "100%", height: 38, borderRadius: 10, background: "#f5f2ed", border: "0.5px solid #178AE8", padding: "0 12px", fontSize: 14, outline: "none" }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontWeight: 600 }}>Role</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {["member","admin"].map(r => (
              <button key={r} onClick={() => setInviteRole(r)} style={{
                padding: 12, borderRadius: 12,
                border: inviteRole === r ? "2px solid #178AE8" : "0.5px solid #e8e4de",
                background: inviteRole === r ? "#e6f1fb" : "#f5f2ed", cursor: "pointer", textAlign: "left"
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: inviteRole === r ? "#178AE8" : "#1a1a1a", textTransform: "capitalize" }}>{r}</div>
                <div style={{ fontSize: 11, color: inviteRole === r ? "#185FA5" : "#888", marginTop: 2 }}>{r === "member" ? "Can view and edit tasks" : "Can also manage members"}</div>
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { if (inviteEmail) { setInvited(true); setInviteEmail(""); setTimeout(() => setShowInvite(false), 1500); } }} style={{ width: "100%", padding: 13, borderRadius: 10, background: "#178AE8", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Send invite</button>
      </Sheet>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dash");
  const [detailListId, setDetailListId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res?.value) {
          setData(JSON.parse(res.value));
        } else {
          setData(INITIAL_DATA);
        }
      } catch {
        setData(INITIAL_DATA);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!data || loading) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loading]);

  const handleSetDetailListId = (id) => { setDetailListId(id); setTab("lists"); };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "system-ui", color: "#aaa", fontSize: 14 }}>Loading...</div>
  );

  const notifCount = data.notifications.filter(n => !n.read).length;

  const renderScreen = () => {
    if (tab === "lists" && detailListId) {
      return <ListDetail listId={detailListId} data={data} setData={setData} onBack={() => setDetailListId(null)} />;
    }
    switch (tab) {
      case "dash": return <Dashboard data={data} setData={setData} setTab={setTab} setDetailListId={handleSetDetailListId} />;
      case "lists": return <Lists data={data} setData={setData} setDetailListId={handleSetDetailListId} />;
      case "alerts": return <Notifications data={data} setData={setData} />;
      case "team": return <Team data={data} setData={setData} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "16px 0", minHeight: "100vh", background: "#f0ede8" }}>
      <div style={{
        width: 390, minHeight: 780, background: "#f5f2ed", borderRadius: 32,
        border: "0.5px solid #ddd", overflow: "hidden", display: "flex", flexDirection: "column",
        position: "relative", boxShadow: "0 8px 40px rgba(0,0,0,0.08)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 4px", fontSize: 12, fontWeight: 600, color: "#888" }}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: 5 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M23 7l-7 5 7 5V7z M1 5h15a2 2 0 012 2v10a2 2 0 01-2 2H1z"/></svg>
          </span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {renderScreen()}
        </div>
        <NavBar tab={detailListId ? "lists" : tab} setTab={(t) => { setDetailListId(null); setTab(t); }} notifCount={notifCount} />
      </div>
    </div>
  );
}
