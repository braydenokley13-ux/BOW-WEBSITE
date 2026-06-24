"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NotificationView } from "@/lib/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/notifications";

interface Props {
  notifications: NotificationView[];
  unreadCount: number;
}

const TYPE_ICON: Record<string, string> = {
  module_unlocked: "🔓",
  quiz_available: "📝",
  weekly_challenge: "🏆",
  certificate_earned: "🎓",
  discussion_reply: "💬",
  rank_up: "⭐",
};

/** The bell icon + unread badge + dropdown for the student dashboard nav (Feature 6). */
export default function NotificationBell({ notifications, unreadCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onOpenItem = async (n: NotificationView) => {
    setOpen(false);
    if (!n.read) await markNotificationRead(n.id);
    if (n.link) router.push(n.link);
    else startTransition(() => router.refresh());
  };

  const onMarkAll = async () => {
    await markAllNotificationsRead();
    startTransition(() => router.refresh());
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          background: "var(--bow-white)",
          color: "var(--bow-ink)",
          fontSize: 17,
          // (bell glyph inherits ink; badge below uses the white token on orange)
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--bow-orange)",
              color: "var(--bow-white)",
              fontFamily: "var(--font-data)",
              fontSize: 10.5,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            role="menu"
            style={{
              position: "absolute",
              top: 48,
              right: 0,
              width: "min(360px, 86vw)",
              maxHeight: 460,
              overflowY: "auto",
              background: "var(--bow-white)",
              border: "1px solid var(--border-rule)",
              borderRadius: 8,
              boxShadow: "var(--shadow-pop)",
              zIndex: 41,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border-rule)" }}>
              <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAll}
                  style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.03em", color: "var(--bow-blue)", background: "transparent", border: "none", cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div style={{ padding: "26px 16px", textAlign: "center", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-slate)" }}>
                You’re all caught up.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpenItem(n)}
                  style={{
                    display: "flex",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    border: "none",
                    borderBottom: "1px solid var(--border-rule)",
                    background: n.read ? "var(--bow-white)" : "var(--bow-blue-tint)",
                    cursor: "pointer",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 16, lineHeight: 1.3 }}>{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-interface)", fontWeight: 600, fontSize: 13.5, color: "var(--bow-ink)" }}>
                      {n.title}
                    </span>
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-interface)", fontSize: 12.5, lineHeight: 1.4, color: "var(--bow-slate)" }}>
                      {n.body}
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--bow-slate)" }}>
                      {n.when}
                    </span>
                  </span>
                  {!n.read && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "var(--bow-blue)", flexShrink: 0, marginTop: 5 }} />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
