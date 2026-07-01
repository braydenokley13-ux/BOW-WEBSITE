"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { REACTION_TYPES, type Role } from "@/lib/account";
import type { PostDetail } from "@/lib/discussion";
import { addReply, toggleReaction, deletePost, togglePin } from "@/app/actions/discussion";
import RankChip from "@/components/discussion/RankChip";

interface Props {
  post: PostDetail;
  firstName: string;
  role: Role;
}

/**
 * A single discussion thread: the full post, reaction buttons (toggle on click,
 * the viewer's active reactions highlighted), the chronological reply list, a
 * reply composer, plus delete (own + reply-free) and pin (instructor/admin)
 * controls. Every mutation calls router.refresh() to re-read the server state.
 */
export default function PostThread({ post, firstName, role }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = role === "instructor" || role === "admin";

  const refresh = () => startTransition(() => router.refresh());

  const onReact = async (reactionType: string) => {
    if (busy) return;
    setBusy(true);
    await toggleReaction(post.id, reactionType);
    setBusy(false);
    refresh();
  };

  const onReply = async () => {
    if (reply.trim() === "" || busy) return;
    setBusy(true);
    setError(null);
    const res = await addReply(post.id, reply);
    setBusy(false);
    if (res.ok) {
      setReply("");
      refresh();
    } else {
      setError(res.error ?? "Couldn't post your reply. Please try again.");
    }
  };

  const onDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await deletePost(post.id);
    setBusy(false);
    if (res.ok) {
      startTransition(() => router.push("/discussion"));
    } else {
      setError(res.error ?? "Couldn't delete this post.");
    }
  };

  const onPin = async () => {
    if (busy) return;
    setBusy(true);
    await togglePin(post.id);
    setBusy(false);
    refresh();
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <Link
            href={`/discussion?channel=${post.channel}`}
            style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}
          >
            ← Back to {post.channelLabel}
          </Link>
          {isStaff && (
            <button
              onClick={onPin}
              disabled={busy}
              style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: post.pinned ? "var(--bow-orange)" : "var(--bow-ink)", background: "transparent", border: "1px solid var(--border-strong)", borderRadius: 999, padding: "7px 14px", cursor: busy ? "wait" : "pointer" }}
            >
              {post.pinned ? "📌 Unpin" : "📌 Pin"}
            </button>
          )}
        </div>

        {/* POST */}
        <article style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-ink)", borderRadius: 6, padding: "clamp(22px,3vw,32px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 3, padding: "3px 9px" }}>
              {post.channelLabel}
            </span>
            {post.pinned && (
              <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
                📌 Pinned
              </span>
            )}
          </div>

          <h1 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(26px,3.6vw,42px)", lineHeight: 0.98, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
            {post.title}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
              {post.authorName}
            </span>
            <RankChip rank={post.authorRank} />
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>· {post.when}</span>
          </div>

          <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontSize: "clamp(16px,1.9vw,18px)", lineHeight: 1.6, color: "var(--bow-ink)", whiteSpace: "pre-wrap" }}>
            {post.body}
          </p>

          {/* REACTIONS */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--border-rule)" }}>
            {REACTION_TYPES.map((r) => {
              const n = post.reactions[r.key];
              const mine = post.viewerReactions.includes(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => onReact(r.key)}
                  disabled={busy}
                  aria-pressed={mine}
                  title={r.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontFamily: "var(--font-data)",
                    fontSize: 12.5,
                    color: mine ? "var(--bow-blue)" : "var(--bow-ink)",
                    background: mine ? "var(--bow-blue-tint)" : "transparent",
                    border: `1px solid ${mine ? "var(--bow-blue)" : "var(--border-strong)"}`,
                    borderRadius: 999,
                    padding: "8px 14px",
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  <span aria-hidden style={{ fontSize: 15 }}>{r.emoji}</span>
                  <span>{r.label}</span>
                  <span style={{ fontWeight: 700 }}>{n}</span>
                </button>
              );
            })}
          </div>

          {/* DELETE (own, reply-free) */}
          {post.canDelete && (
            <div style={{ marginTop: 18 }}>
              <button
                onClick={onDelete}
                disabled={busy}
                style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-warning)", background: "transparent", border: "1px solid var(--bow-warning)", borderRadius: 999, padding: "8px 16px", cursor: busy ? "wait" : "pointer" }}
              >
                Delete Post
              </button>
            </div>
          )}
        </article>

        {error && (
          <p style={{ margin: "16px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-warning-text)" }}>
            {error}
          </p>
        )}

        {/* REPLIES */}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "32px 0 12px" }}>
          {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
        </span>

        {post.replies.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {post.replies.map((r) => (
              <div key={r.id} style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
                    {r.authorName}
                  </span>
                  <RankChip rank={r.authorRank} />
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>· {r.when}</span>
                </div>
                <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-ink)", whiteSpace: "pre-wrap" }}>
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* REPLY COMPOSER */}
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24, marginTop: post.replies.length > 0 ? 0 : 4 }}>
          <label
            htmlFor="disc-reply"
            style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}
          >
            Add your reply
          </label>
          <textarea
            id="disc-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder={`Jump in, ${firstName} — what's your take?`}
            style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
          />
          <div style={{ marginTop: 14 }}>
            <button
              onClick={onReply}
              disabled={reply.trim() === "" || busy}
              style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: reply.trim() === "" || busy ? "var(--bow-inactive)" : "var(--bow-blue)", color: "var(--bow-white)", borderRadius: 4, cursor: reply.trim() === "" || busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "Posting…" : "Post Reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
