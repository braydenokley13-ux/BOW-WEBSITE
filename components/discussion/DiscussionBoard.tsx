"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DISCUSSION_CHANNELS,
  REACTION_TYPES,
  type DiscussionChannel,
  type Role,
} from "@/lib/account";
import type { ChannelCounts, PostSummary } from "@/lib/discussion";
import { createPost } from "@/app/actions/discussion";
import RankChip from "@/components/discussion/RankChip";

interface Props {
  channel: DiscussionChannel;
  posts: PostSummary[];
  page: number;
  totalPages: number;
  total: number;
  counts: ChannelCounts;
  firstName: string;
  role: Role;
}

/**
 * The discussion board: three channel tabs (with post counts), a collapsible
 * "Start a discussion" composer, a paginated list of post-summary cards, and
 * prev/next pagination. URL-driven (channel + page) so it deep-links and shares.
 */
export default function DiscussionBoard({
  channel,
  posts,
  page,
  totalPages,
  total,
  counts,
  firstName,
  role,
}: Props) {
  const router = useRouter();
  const activeMeta = DISCUSSION_CHANNELS.find((c) => c.key === channel) ?? DISCUSSION_CHANNELS[0];

  const goTo = (nextChannel: DiscussionChannel, nextPage = 1) => {
    const params = new URLSearchParams();
    params.set("channel", nextChannel);
    if (nextPage > 1) params.set("page", String(nextPage));
    router.push(`/discussion?${params.toString()}`);
  };

  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            BOW Community
          </span>
          <Link
            href={role === "student" ? "/dashboard" : role === "admin" ? "/admin" : "/instructor"}
            style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-blue)", textDecoration: "none" }}
          >
            ← Back
          </Link>
        </div>
        <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 0.94, letterSpacing: "-0.02em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          The discussion board.
        </h1>
        <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)", maxWidth: 560 }}>
          Three rooms, one community. Debate the moves, spot the economics, and help each other through the course.
        </p>

        {/* CHANNEL TABS */}
        <div role="tablist" aria-label="Discussion channels" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          {DISCUSSION_CHANNELS.map((c) => {
            const active = c.key === channel;
            return (
              <button
                key={c.key}
                role="tab"
                aria-selected={active}
                onClick={() => goTo(c.key)}
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 11.5,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: active ? "var(--bow-white)" : "var(--bow-ink)",
                  background: active ? "var(--bow-ink)" : "transparent",
                  border: active ? "1px solid var(--bow-ink)" : "1px solid var(--border-strong)",
                  borderRadius: 999,
                  padding: "9px 16px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {c.label}
                <span
                  style={{
                    fontFamily: "var(--font-data)",
                    fontSize: 10.5,
                    color: active ? "var(--bow-paper)" : "var(--bow-slate)",
                    background: active ? "rgba(255,255,255,0.16)" : "var(--bow-paper)",
                    border: active ? "none" : "1px solid var(--border-rule)",
                    borderRadius: 999,
                    padding: "1px 7px",
                  }}
                >
                  {counts[c.key]}
                </span>
              </button>
            );
          })}
        </div>

        <p style={{ margin: "0 0 18px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
          {activeMeta.blurb}
        </p>

        {/* COMPOSER */}
        <Composer channel={channel} firstName={firstName} />

        {/* POST LIST */}
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", margin: "32px 0 12px" }}>
          {total} {total === 1 ? "discussion" : "discussions"}
        </span>

        {posts.length === 0 ? (
          <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 6, padding: 24 }}>
            <p style={{ margin: 0, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              No posts here yet. Be the first to start a discussion in {activeMeta.label}.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 24 }}>
            <button
              onClick={() => goTo(channel, page - 1)}
              disabled={page <= 1}
              style={pageBtnStyle(page <= 1)}
            >
              ← Newer
            </button>
            <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => goTo(channel, page + 1)}
              disabled={page >= totalPages}
              style={pageBtnStyle(page >= totalPages)}
            >
              Older →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: "var(--font-data)",
    fontSize: 11.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--bow-ink)",
    background: "transparent",
    border: "1px solid var(--border-strong)",
    borderRadius: 999,
    padding: "9px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

/* ---------------- composer ---------------- */

function Composer({ channel, firstName }: { channel: DiscussionChannel; firstName: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pickedChannel, setPickedChannel] = useState<DiscussionChannel>(channel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim() !== "" && body.trim() !== "" && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const res = await createPost(pickedChannel, title, body);
    setBusy(false);
    if (res.ok && res.postId) {
      setTitle("");
      setBody("");
      setOpen(false);
      startTransition(() => router.push(`/discussion/${res.postId}`));
    } else {
      setError(res.error ?? "Something went wrong. Please try again.");
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setPickedChannel(channel);
          setOpen(true);
        }}
        style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: "var(--bow-orange)", color: "var(--bow-white)", borderRadius: 4, cursor: "pointer" }}
      >
        + Start a Discussion
      </button>
    );
  }

  return (
    <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderTop: "4px solid var(--bow-orange)", borderRadius: 6, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Start a discussion
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>

      <label
        htmlFor="disc-channel"
        style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}
      >
        Channel
      </label>
      <select
        id="disc-channel"
        value={pickedChannel}
        onChange={(e) => setPickedChannel(e.target.value as DiscussionChannel)}
        style={{ width: "100%", marginBottom: 14, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "10px 12px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14, outline: "none", cursor: "pointer" }}
      >
        {DISCUSSION_CHANNELS.map((c) => (
          <option key={c.key} value={c.key}>{c.label}</option>
        ))}
      </select>

      <label
        htmlFor="disc-title"
        style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}
      >
        Title
      </label>
      <input
        id="disc-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`What's on your mind, ${firstName}?`}
        style={{ width: "100%", marginBottom: 14, background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "11px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 15, outline: "none" }}
      />

      <label
        htmlFor="disc-body"
        style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bow-slate)", display: "block", marginBottom: 8 }}
      >
        Your post
      </label>
      <textarea
        id="disc-body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Make your case — lay out the decision and the economics behind it."
        style={{ width: "100%", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", color: "var(--bow-ink)", padding: "12px 14px", borderRadius: 4, fontFamily: "var(--font-interface)", fontSize: 14.5, lineHeight: 1.55, resize: "vertical", outline: "none" }}
      />

      {error && (
        <p style={{ margin: "12px 0 0", fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--bow-warning)" }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "12px 24px", border: "none", background: canSubmit ? "var(--bow-orange)" : "var(--bow-inactive)", color: "var(--bow-white)", borderRadius: 4, cursor: canSubmit ? "pointer" : "not-allowed" }}
        >
          {busy ? "Posting…" : "Post Discussion"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- post card ---------------- */

function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/discussion/${post.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderLeft: post.pinned ? "4px solid var(--bow-orange)" : "1px solid var(--border-rule)",
        borderRadius: 6,
        padding: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-ink)", background: "var(--bow-paper)", border: "1px solid var(--border-rule)", borderRadius: 3, padding: "3px 9px" }}>
          {post.channelLabel}
        </span>
        {post.pinned && (
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
            📌 Pinned
          </span>
        )}
      </div>

      <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(19px,2.4vw,24px)", lineHeight: 1.05, letterSpacing: "-0.01em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
        {post.title}
      </h2>
      <p style={{ margin: "0 0 14px", fontFamily: "var(--font-editorial)", fontSize: 15.5, lineHeight: 1.5, color: "var(--bow-slate)" }}>
        {post.bodyExcerpt}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bow-ink)" }}>
          {post.authorName}
        </span>
        <RankChip rank={post.authorRank} />
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--bow-slate)" }}>· {post.when}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-rule)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--bow-slate)" }}>
          💬 {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
        </span>
        {REACTION_TYPES.map((r) => {
          const n = post.reactions[r.key];
          const mine = post.viewerReactions.includes(r.key);
          return (
            <span
              key={r.key}
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11.5,
                color: mine ? "var(--bow-blue)" : "var(--bow-slate)",
                fontWeight: mine ? 700 : 400,
              }}
            >
              {r.emoji} {n}
            </span>
          );
        })}
      </div>
    </Link>
  );
}
