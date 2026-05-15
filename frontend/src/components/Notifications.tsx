import { useNotifications } from "../hooks/useNotifications";
import { useSettings } from "../context/SettingsContext";
import { TopBar } from "./ui/TopBar";
import { IconBtn } from "./ui/IconBtn";
import React from "react";

export default function Notifications() {
  const { notifications, markRead, markAllRead } = useNotifications();
  const { t } = useSettings();

  const todayStr = new Date().toISOString().split("T")[0];
  const today = notifications.filter(
    (n) => n.created_at.split("T")[0] === todayStr,
  );
  const older = notifications.filter(
    (n) => n.created_at.split("T")[0] !== todayStr,
  );

  const getTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(createdAt).toLocaleDateString();
  };

  const NotifRow = ({ n, clickable }: { n: any; clickable?: boolean }) => (
    <div
      onClick={clickable ? () => markRead(n.id) : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 0",
        borderBottom: "0.5px solid var(--border-subtle)",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: n.read
            ? "var(--border)"
            : n.type === "due"
              ? "var(--warning)"
              : "var(--primary)",
          flexShrink: 0,
          marginTop: 5,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            color: n.read ? "var(--text-muted)" : "var(--text)",
            lineHeight: 1.4,
          }}
        >
          {n.text}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
          {n.context}
          {clickable ? ` · ${getTime(n.created_at)}` : ""}
        </div>
      </div>
    </div>
  );

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
        title={t("alerts")}
        right={
          <IconBtn
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0"
            onClick={markAllRead}
          />
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        {today.length > 0 && (
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
              {t("today")}
            </div>
            {today.map((n) => (
              <NotifRow key={n.id} n={n} clickable />
            ))}
          </>
        )}
        {older.length > 0 && (
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
              {t("earlier")}
            </div>
            {older.map((n) => (
              <NotifRow key={n.id} n={n} />
            ))}
          </>
        )}
        {notifications.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--text-faint)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-dim)",
              }}
            >
              {t("no_notifs")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
