import { useState } from "react";
import { useLists } from "../hooks/useLists";
import { useSettings } from "../context/SettingsContext";
import { ListWithMembers, DBTask } from "../types";
import { TopBar } from "./ui/TopBar";
import { IconBtn } from "./ui/IconBtn";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";
import { Avatar } from "./ui/Avatar";
import { Sheet } from "./ui/Sheet";
import { listsAPI } from "../api/lists.api";
import React from "react";

const EMOJIS = [
  "📋",
  "🎨",
  "⚙️",
  "🔬",
  "🚀",
  "💡",
  "📊",
  "🎯",
  "🔧",
  "📝",
  "🌟",
  "💼",
  "🎪",
  "🔥",
  "📱",
];

interface ListsProps {
  onSelectList: (listId: string) => void;
}

export default function Lists({ onSelectList }: ListsProps) {
  const { lists } = useLists();
  const { t } = useSettings();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [newShared, setNewShared] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const shared = lists.filter((l) => l.shared);
  const priv = lists.filter((l) => !l.shared);

  const createList = async () => {
    if (!newName.trim()) return;
    try {
      await listsAPI.createList(newName.trim(), newEmoji, newShared);
      setNewName("");
      setNewEmoji("📋");
      setNewShared(true);
      setShowCreate(false);
    } catch {}
  };

  const taskResults: Array<{ task: DBTask; list: ListWithMembers }> = search
    ? lists.flatMap((l) =>
        (l.tasks || [])
          .filter((task) =>
            task.text.toLowerCase().includes(search.toLowerCase()),
          )
          .map((task) => ({ task, list: l })),
      )
    : [];

  const progress = (list: ListWithMembers) => {
    if (!list.tasks?.length) return 0;
    return (
      (list.tasks.filter((task) => task.done).length / list.tasks.length) * 100
    );
  };

  const ListCard = ({ list }: { list: ListWithMembers }) => {
    const prog = progress(list);
    const taskCount = list.tasks?.length || 0;
    const doneCount = list.tasks?.filter((task) => task.done).length || 0;
    return (
      <div
        onClick={() => onSelectList(list.id)}
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "0.5px solid var(--border)",
          padding: 14,
          marginBottom: 10,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>{list.emoji}</span>
            <span
              style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}
            >
              {list.name}
            </span>
          </div>
          {prog === 100 ? (
            <Badge variant="success">{t("done_badge")}</Badge>
          ) : taskCount > 0 ? (
            <Badge variant={prog > 50 ? "warn" : "info"}>
              {taskCount} {t("tasks_badge")}
            </Badge>
          ) : (
            <Badge variant="neutral">{t("empty_badge")}</Badge>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 0a4 4 0 10-8 0 4 4 0 008 0z" />
          </svg>
          {list.members?.length || 0} {t("members")}
          <div style={{ display: "flex", marginLeft: "auto" }}>
            {(list.members || []).slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                style={{
                  marginLeft: i > 0 ? -5 : 0,
                  border: "2px solid var(--bg-card)",
                  borderRadius: "50%",
                }}
              >
                <Avatar member={m} size={20} />
              </div>
            ))}
            {(list.members?.length || 0) > 3 && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--bg)",
                  fontSize: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: -5,
                  border: "2px solid var(--bg-card)",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                }}
              >
                +{(list.members?.length || 0) - 3}
              </div>
            )}
          </div>
        </div>
        <ProgressBar
          value={prog}
          color={prog === 100 ? "var(--success)" : "var(--primary)"}
        />
        {taskCount > 0 && (
          <div
            style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}
          >
            {doneCount}/{taskCount} {t("done_badge").toLowerCase()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      <TopBar
        title={t("my_lists")}
        sub={`${lists.length} ${t("nav_lists")} · ${shared.length} ${t("shared_section").toLowerCase()}`}
        right={
          <>
            <IconBtn
              icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
              onClick={() => setShowSearch((s) => !s)}
            />
            <IconBtn
              icon="M12 5v14M5 12h14"
              onClick={() => setShowCreate(true)}
            />
          </>
        }
      />

      {showSearch && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--bg)",
            borderRadius: 10,
            border: "0.5px solid var(--border)",
            padding: "0 12px",
            height: 36,
            margin: "0 16px 8px",
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_ph")}
            style={{
              border: "none",
              background: "none",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
              flex: 1,
            }}
          />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        {search ? (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-faint)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                margin: "8px 0",
              }}
            >
              {taskResults.length}{" "}
              {taskResults.length !== 1 ? t("results") : t("result")}
            </div>
            {taskResults.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--text-faint)",
                  fontSize: 13,
                }}
              >
                {t("no_tasks_match")} "{search}"
              </div>
            ) : (
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 14,
                  border: "0.5px solid var(--border)",
                  padding: "0 14px",
                }}
              >
                {taskResults.map(({ task, list }, i) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectList(list.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "11px 0",
                      borderBottom:
                        i < taskResults.length - 1
                          ? "0.5px solid var(--border-subtle)"
                          : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        flexShrink: 0,
                        marginTop: 1,
                        background: task.done
                          ? "var(--success)"
                          : "transparent",
                        border: task.done
                          ? "none"
                          : "1.5px solid var(--border-mid)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {task.done && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: task.done
                            ? "var(--text-faint)"
                            : "var(--text)",
                          textDecoration: task.done ? "line-through" : "none",
                          lineHeight: 1.3,
                        }}
                      >
                        {task.text}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          marginTop: 3,
                        }}
                      >
                        {list.emoji} {list.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {shared.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-faint)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    margin: "8px 0",
                  }}
                >
                  {t("shared_section")}
                </div>
                {shared.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </>
            )}
            {priv.length > 0 && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-faint)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    margin: "14px 0 8px",
                  }}
                >
                  {t("private_section")}
                </div>
                {priv.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </>
            )}
          </>
        )}

        {!search && lists.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              {t("no_lists")}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              {t("no_lists_sub")}
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("create_list_btn")}
            </button>
          </div>
        )}
      </div>

      <Sheet
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("new_list")}
      >
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 4,
              fontWeight: 600,
            }}
          >
            {t("name_label")}
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("list_ph")}
            style={{
              width: "100%",
              height: 38,
              borderRadius: 10,
              background: "var(--bg-input)",
              border: "0.5px solid var(--primary)",
              padding: "0 12px",
              fontSize: 14,
              color: "var(--text)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            {t("emoji_label")}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setNewEmoji(e)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 18,
                  cursor: "pointer",
                  background:
                    newEmoji === e ? "var(--primary-bg)" : "var(--bg-input)",
                  border:
                    newEmoji === e
                      ? "2px solid var(--primary)"
                      : "0.5px solid var(--border)",
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: "0.5px solid var(--border)",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, color: "var(--text)" }}>
            {t("shared_with_team")}
          </span>
          <div
            onClick={() => setNewShared((s) => !s)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: newShared ? "var(--primary)" : "var(--border)",
              position: "relative",
              cursor: "pointer",
              transition: "background .2s",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                top: 2,
                left: newShared ? 20 : 2,
                transition: "left .2s",
              }}
            />
          </div>
        </div>

        <button
          onClick={createList}
          style={{
            width: "100%",
            padding: 13,
            borderRadius: 10,
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("create_list")}
        </button>
      </Sheet>
    </div>
  );
}
