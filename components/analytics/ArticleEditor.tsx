"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds";
import MarkdownView from "@/components/analytics/MarkdownView";
import { restoreRevision, saveArticle, setArticleStatus, type ArticleInput } from "@/app/actions/articles";
import { ARTICLE_CATEGORIES, type Article, type ArticleRevision } from "@/lib/articles-shared";
import { parseMarkdown } from "@/lib/markdown";
import type { AnalyticsPlayer } from "@/lib/aasv";
import type { SeasonStat } from "@/lib/nba";

/**
 * The authoring interface: markdown editor with a live preview that
 * renders through the exact same MarkdownView (and data embeds) as the
 * public article page — what you see IS what ships. Every save
 * snapshots a revision server-side; the history panel restores any of
 * them.
 */
export default function ArticleEditor({
  article,
  players,
  playerHistories = {},
  revisions,
}: {
  article: Article | null;
  players: Record<string, AnalyticsPlayer>;
  /** Season histories keyed by slug, for the live preview's <TrendChart/>. */
  playerHistories?: Record<string, SeasonStat[]>;
  revisions: ArticleRevision[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(article?.title ?? "");
  const [dek, setDek] = useState(article?.dek ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [author, setAuthor] = useState(article?.author ?? "BOW Front Office");
  const [category, setCategory] = useState(article?.category ?? ARTICLE_CATEGORIES[0]);
  const [tags, setTags] = useState(article?.tags.join(", ") ?? "");
  const [coverImage, setCoverImage] = useState(article?.coverImage ?? "");
  const [metaTitle, setMetaTitle] = useState(article?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(article?.metaDescription ?? "");
  const [mode, setMode] = useState<"split" | "write" | "preview">("split");
  const [showMeta, setShowMeta] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const blocks = useMemo(() => parseMarkdown(body), [body]);

  const input = (): ArticleInput => ({ title, dek, body, author, category, tags, coverImage, metaTitle, metaDescription });

  const save = () =>
    startTransition(async () => {
      const res = await saveArticle(article?.id ?? null, input());
      if (!res.ok) {
        setMessage(res.error ?? "Save failed.");
        return;
      }
      setDirty(false);
      setMessage("Saved. Revision recorded.");
      if (!article && res.id) {
        router.replace(`/analytics/admin/editor/${res.id}`);
      }
      router.refresh();
    });

  const togglePublish = () => {
    if (!article) return;
    startTransition(async () => {
      // Publishing ships the CURRENT fields — save first, then flip.
      const res = await saveArticle(article.id, input());
      if (!res.ok) {
        setMessage(res.error ?? "Save failed.");
        return;
      }
      await setArticleStatus(article.id, article.status !== "published");
      setDirty(false);
      setMessage(article.status === "published" ? "Unpublished — back to draft." : "Published.");
      router.refresh();
    });
  };

  const restore = (rev: ArticleRevision) => {
    if (!article) return;
    startTransition(async () => {
      const res = await restoreRevision(article.id, rev.id);
      if (!res.ok) {
        setMessage("Restore failed.");
        return;
      }
      // Mirror the server's new state locally — the fields ARE the revision.
      setTitle(rev.title);
      setDek(rev.dek);
      setBody(rev.body);
      setCategory(rev.category);
      setTags(rev.tags.split(",").filter(Boolean).join(", "));
      setDirty(false);
      setMessage("Revision restored (the previous state was snapshotted too).");
      router.refresh();
    });
  };

  /** Wrap the current selection (or insert a template) in the body textarea. */
  const applyMd = (before: string, after = "", placeholder = "") => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertBlock = (snippet: string) => {
    const el = bodyRef.current;
    const at = el?.selectionStart ?? body.length;
    const needsNL = at > 0 && body[at - 1] !== "\n";
    const next = body.slice(0, at) + (needsNL ? "\n\n" : "") + snippet + "\n\n" + body.slice(at);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => el?.focus());
  };

  const slugList = Object.keys(players).sort();
  const exampleSlug = slugList[0] ?? "player-slug";

  const set = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const field: React.CSSProperties = {
    fontFamily: "var(--font-interface)",
    fontSize: 14,
    padding: "9px 11px",
    border: "1px solid var(--border-rule)",
    background: "var(--bow-white)",
    color: "var(--bow-ink)",
    width: "100%",
    borderRadius: 0,
  };
  const fieldLabel: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 10.5,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--bow-slate)",
  };
  const toolBtn: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: 12,
    padding: "5px 9px",
    border: "1px solid var(--border-rule)",
    background: "var(--bow-white)",
    color: "var(--bow-ink)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  const showEditor = mode !== "preview";
  const showPreview = mode !== "write";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* top bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <Link href="/analytics/admin" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.05em", color: "var(--bow-blue)", textDecoration: "none" }}>
          ← All articles
        </Link>
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 8px",
            border: "1px solid var(--border-rule)",
            color: article?.status === "published" ? "var(--bow-positive)" : "var(--bow-warning-text)",
            background: article?.status === "published" ? "var(--bow-positive-tint)" : "var(--bow-warning-tint)",
          }}
        >
          {article?.status ?? "new draft"}
        </span>
        {article?.status === "published" && (
          <Link href={`/analytics/articles/${article.slug}`} style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--bow-blue)", textDecoration: "none" }}>
            /analytics/articles/{article.slug}
          </Link>
        )}
        <span aria-live="polite" style={{ fontFamily: "var(--font-data)", fontSize: 12, color: dirty ? "var(--bow-orange)" : "var(--bow-slate)", marginLeft: "auto" }}>
          {pending ? "Working…" : dirty ? "Unsaved changes" : (message ?? "")}
        </span>
        {article && (
          <button type="button" style={toolBtn} onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
            History ({revisions.length})
          </button>
        )}
        <Button variant="secondary" size="sm" onClick={save} disabled={pending}>
          Save draft
        </Button>
        {article && (
          <Button variant={article.status === "published" ? "ghost" : "primary"} size="sm" onClick={togglePublish} disabled={pending}>
            {article.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        )}
      </div>

      {/* revision history */}
      {showHistory && article && (
        <div style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", padding: 16 }}>
          <span style={fieldLabel}>Revision history — every save is kept (newest first)</span>
          {revisions.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--bow-slate)" }}>
              No revisions yet — they appear after your next save.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column" }}>
              {revisions.map((r) => (
                <li key={r.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid var(--border-rule)" }}>
                  <span style={{ fontFamily: "var(--font-data)", fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: "var(--bow-slate)", whiteSpace: "nowrap" }}>
                    {new Date(r.savedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span style={{ fontFamily: "var(--font-interface)", fontSize: 13.5, flex: 1, minWidth: 180 }}>
                    {r.title} <span style={{ color: "var(--bow-slate)" }}>· {r.body.length.toLocaleString("en-US")} chars</span>
                  </span>
                  <button type="button" style={toolBtn} disabled={pending} onClick={() => restore(r)}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* headline fields */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12 }} className="bow-editor-heads">
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Title</span>
          <input value={title} onChange={(e) => set(setTitle)(e.target.value)} placeholder="Why the …" style={{ ...field, fontFamily: "var(--font-editorial)", fontSize: 20, fontWeight: 600 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Category</span>
          <select value={category} onChange={(e) => set(setCategory)(e.target.value)} style={{ ...field, cursor: "pointer" }}>
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={fieldLabel}>Dek / subhead</span>
        <input value={dek} onChange={(e) => set(setDek)(e.target.value)} placeholder="One-sentence setup under the headline" style={field} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Author</span>
          <input value={author} onChange={(e) => set(setAuthor)(e.target.value)} style={field} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Tags (comma-separated)</span>
          <input value={tags} onChange={(e) => set(setTags)(e.target.value)} placeholder="aprons, celtics" style={field} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={fieldLabel}>Cover image URL (also the OG image)</span>
          <input value={coverImage} onChange={(e) => set(setCoverImage)(e.target.value)} placeholder="/assets/… or https://…" style={field} />
        </label>
      </div>

      {/* SEO */}
      <button type="button" onClick={() => setShowMeta((v) => !v)} aria-expanded={showMeta} style={{ ...toolBtn, alignSelf: "flex-start" }}>
        {showMeta ? "− Hide" : "+ SEO"} meta fields
      </button>
      {showMeta && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={fieldLabel}>Meta title (defaults to the headline)</span>
            <input value={metaTitle} onChange={(e) => set(setMetaTitle)(e.target.value)} style={field} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={fieldLabel}>Meta description (defaults to the dek)</span>
            <input value={metaDescription} onChange={(e) => set(setMetaDescription)(e.target.value)} style={field} />
          </label>
        </div>
      )}

      {/* toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <button type="button" style={toolBtn} onClick={() => applyMd("## ", "", "Section head")}>H2</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("### ", "", "Sub head")}>H3</button>
        <button type="button" style={{ ...toolBtn, fontWeight: 700 }} onClick={() => applyMd("**", "**", "bold")}>B</button>
        <button type="button" style={{ ...toolBtn, fontStyle: "italic" }} onClick={() => applyMd("*", "*", "italic")}>I</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("- ", "", "list item")}>• List</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("1. ", "", "list item")}>1. List</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("> ", "", "pull quote")}>&ldquo; Quote</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("[", "](https://)", "link text")}>Link</button>
        <button type="button" style={toolBtn} onClick={() => applyMd("![", "](https://)", "caption")}>Image</button>
        <span style={{ width: 1, height: 20, background: "var(--border-rule)", margin: "0 4px" }} />
        <button type="button" style={{ ...toolBtn, color: "var(--bow-blue)" }} onClick={() => insertBlock(`<PlayerCard player="${exampleSlug}" />`)}>
          + Player card
        </button>
        <button type="button" style={{ ...toolBtn, color: "var(--bow-blue)" }} onClick={() => insertBlock(`<AASVChart players="${slugList.slice(0, 3).join(",")}" />`)}>
          + AASV chart
        </button>
        <button type="button" style={{ ...toolBtn, color: "var(--bow-blue)" }} onClick={() => insertBlock(`<AASVTable players="${slugList.slice(0, 3).join(",")}" />`)}>
          + AASV table
        </button>
        <button type="button" style={{ ...toolBtn, color: "var(--bow-blue)" }} onClick={() => insertBlock(`<TeamCapSheet team="OKC" />`)}>
          + Team cap sheet
        </button>
        <button type="button" style={{ ...toolBtn, color: "var(--bow-blue)" }} onClick={() => insertBlock(`<TrendChart player="${exampleSlug}" />`)}>
          + Trend chart
        </button>
        <span style={{ marginLeft: "auto", display: "flex", gap: 0 }}>
          {(["write", "split", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              style={{ ...toolBtn, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11, background: mode === m ? "var(--bow-ink)" : "var(--bow-white)", color: mode === m ? "#fff" : "var(--bow-ink)" }}
            >
              {m}
            </button>
          ))}
        </span>
      </div>

      {/* slug reference for embeds */}
      <details style={{ fontFamily: "var(--font-interface)", fontSize: 13 }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--font-data)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          Player slugs for embeds ({slugList.length})
        </summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {slugList.map((s) => (
            <code key={s} style={{ fontFamily: "var(--font-data)", fontSize: 11.5, border: "1px solid var(--border-rule)", background: "var(--bow-white)", padding: "3px 7px" }}>
              {s}
            </code>
          ))}
        </div>
      </details>

      {/* editor + live preview */}
      <div style={{ display: "grid", gridTemplateColumns: showEditor && showPreview ? "1fr 1fr" : "1fr", gap: 14, alignItems: "start" }} className="bow-editor-panes">
        {showEditor && (
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => set(setBody)(e.target.value)}
            placeholder={"Write in markdown…\n\n## A section\n\nDrop a live embed anywhere:\n\n<PlayerCard player=\"" + exampleSlug + "\" />"}
            spellCheck
            style={{
              width: "100%",
              minHeight: "70vh",
              resize: "vertical",
              fontFamily: "var(--font-data)",
              fontSize: 13.5,
              lineHeight: 1.65,
              padding: 16,
              border: "1px solid var(--border-rule)",
              background: "var(--bow-white)",
              color: "var(--bow-ink)",
              borderRadius: 0,
            }}
          />
        )}
        {showPreview && (
          <div style={{ border: "1px solid var(--border-rule)", background: "#fff", padding: "clamp(16px,2.4vw,32px)", minHeight: "70vh", overflowX: "auto" }}>
            <span style={{ ...fieldLabel, display: "block", marginBottom: 16 }}>Live preview — embeds render with current model values</span>
            {title && (
              <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "clamp(24px,2.6vw,34px)", lineHeight: 1.1, letterSpacing: "-0.015em" }}>
                {title}
              </h1>
            )}
            {dek && <p style={{ margin: "0 0 22px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.55, color: "var(--bow-slate)" }}>{dek}</p>}
            <MarkdownView blocks={blocks} players={players} playerHistories={playerHistories} />
          </div>
        )}
      </div>

      <style>{`@media (max-width: 980px) { .bow-editor-panes, .bow-editor-heads { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
