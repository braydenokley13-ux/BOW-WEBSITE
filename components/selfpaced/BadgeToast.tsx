"use client";

import { useCallback, useEffect, useState } from "react";

const GOLD = "#C9A84C";

export interface ToastBadge {
  id: string;
  name: string;
  icon: string;
}

/** One toast: holds 4s, slides out (0.35s), then a 1s gap before expiring. */
function ToastCard({ badge, position, total, onExpire }: { badge: ToastBadge; position: number; total: number; onExpire: () => void }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), 4000);
    const hide = setTimeout(() => setVisible(false), 4350);
    const expire = setTimeout(onExpire, 5350); // 4s hold + 0.35s out + 1s gap
    return () => {
      clearTimeout(hold);
      clearTimeout(hide);
      clearTimeout(expire);
    };
  }, [onExpire]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={leaving ? "bow-toast-out" : "bow-toast-in"}
      style={{
        position: "fixed",
        right: "clamp(16px,3vw,28px)",
        bottom: "clamp(16px,3vw,28px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: 340,
        background: "var(--bow-ink)",
        color: "#fff",
        border: `1px solid ${GOLD}`,
        boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
        borderRadius: 10,
        padding: "14px 18px",
      }}
    >
      <span aria-hidden style={{ fontSize: 32, lineHeight: 1 }}>{badge.icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
          Achievement Unlocked
        </span>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em", marginTop: 2 }}>
          {badge.name}
        </span>
      </span>
      {total > 1 && (
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-data)", fontSize: 10.5, color: "#9a9da6", flexShrink: 0 }}>
          {position + 1}/{total}
        </span>
      )}
    </div>
  );
}

/**
 * Achievement-unlocked toast queue. Renders newly earned badges one at a time
 * in the bottom-right, then calls onDone once the queue is exhausted so the
 * parent can clear it.
 */
export default function BadgeToast({ badges, onDone }: { badges: ToastBadge[]; onDone?: () => void }) {
  const [index, setIndex] = useState(0);
  const next = useCallback(() => setIndex((i) => i + 1), []);

  useEffect(() => {
    if (index >= badges.length) onDone?.();
  }, [index, badges.length, onDone]);

  if (index >= badges.length) return null;

  return (
    <ToastCard
      key={index}
      badge={badges[index]}
      position={index}
      total={badges.length}
      onExpire={next}
    />
  );
}
