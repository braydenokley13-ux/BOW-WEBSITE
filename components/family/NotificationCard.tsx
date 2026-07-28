"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acknowledgeNotification, type ActionState } from "@/app/actions/family-portal";
import type { FamilyNotificationRow } from "@/lib/family-portal";

/**
 * Urgency is shown with both a label and a border weight/color together —
 * never color alone — so it still reads correctly for a viewer who can't
 * distinguish the color difference.
 */
export default function NotificationCard({ notification }: { notification: FamilyNotificationRow }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(acknowledgeNotification, {});
  const acknowledged = Boolean(notification.acknowledgedAt) || state.status === "success";

  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${notification.urgency === "urgent" ? "#e2b4a5" : "#e4e2dc"}`,
        borderLeft: `4px solid ${notification.urgency === "urgent" ? "#c0442b" : notification.urgency === "important" ? "#d4531f" : "#c7c9cf"}`,
        borderRadius: 6,
        padding: "12px 14px",
      }}
    >
      <p style={{ margin: 0, fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate, #6b6e75)" }}>
        {new Date(notification.createdAt).toLocaleDateString()}
        {notification.studentName ? ` · ${notification.studentName}` : ""}
        {notification.urgency !== "normal" ? ` · ${notification.urgency === "urgent" ? "Urgent" : "Important"}` : ""}
      </p>
      <p style={{ margin: "4px 0 0", fontWeight: 700, fontSize: 14 }}>{notification.title}</p>
      {notification.body && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--bow-slate, #55585f)", lineHeight: 1.5 }}>{notification.body}</p>}
      <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
        {notification.actionHref && (
          <Link href={notification.actionHref} style={{ fontSize: 13, fontWeight: 700, color: "var(--bow-orange, #d4531f)" }}>
            {notification.actionLabel ?? "View"}
          </Link>
        )}
        {notification.requiresAcknowledgment && !acknowledged && (
          <form action={action}>
            <input type="hidden" name="notificationId" value={notification.id} />
            <button type="submit" disabled={pending} style={{ fontSize: 13, background: "none", border: "none", color: "var(--bow-slate, #55585f)", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
              {pending ? "Saving…" : "Mark as read"}
            </button>
          </form>
        )}
        {notification.requiresAcknowledgment && acknowledged && (
          <span style={{ fontSize: 12, color: "var(--bow-slate, #6b6e75)" }}>Acknowledged</span>
        )}
      </div>
      {state.status === "error" && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#8a3820" }}>{state.message}</p>}
    </div>
  );
}
