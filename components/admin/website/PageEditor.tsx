"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { FieldGroup, SmallButton } from "@/components/admin/website/Fields";
import { editorialSectionFields } from "@/lib/cms/fields";
import { sectionSpec } from "@/lib/cms/sections";
import type { EditablePage, PageDraftInput, VersionRow } from "@/lib/cms/admin";
import {
  discardDraftAction,
  publishPageAction,
  restoreVersionAction,
  savePageDraftAction,
  unpublishPageAction,
  type ActionResult,
} from "@/app/actions/website";

/* ============================================================
 * The owner-facing page editor.
 *
 * The page's section order and presentation stay in code. This screen edits
 * only the content inside those sections and saves the whole working copy in
 * one explicit operation. Preview and publish never race unsaved local state.
 * ============================================================ */

type Operation = "save" | "publish" | "discard" | "restore" | "unpublish";

function editorState(page: EditablePage): PageDraftInput {
  return {
    meta: {
      name: page.page.name,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      socialImageUrl: page.socialImageUrl,
      noindex: page.noindex,
    },
    sections: page.sections.map((section) => ({
      ordinal: section.ordinal,
      kind: section.kind,
      data: section.data,
    })),
  };
}

const snapshot = (value: PageDraftInput) => JSON.stringify(value);

export default function PageEditor({
  page,
  versions,
  faqPageSlug,
}: {
  page: EditablePage;
  versions: VersionRow[];
  faqPageSlug: string;
}) {
  const [draft, setDraft] = useState<PageDraftInput>(() => editorState(page));
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshot(editorState(page)));
  const [hasSavedDraft, setHasSavedDraft] = useState(page.page.hasDraft);
  const [published, setPublished] = useState(page.page.isPublished);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string; problems?: string[] } | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [pending, startTransition] = useTransition();

  const currentSnapshot = snapshot(draft);
  const dirty = currentSnapshot !== savedSnapshot;
  const busy = pending || operation !== null;

  useEffect(() => {
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptNavigation = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (window.confirm("You have unsaved website changes. Leave without saving them?")) return;
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", interceptNavigation, true);
    };
  }, [dirty]);

  const report = (result: ActionResult, fallback: string) => {
    if (result.ok) setNotice({ tone: "ok", text: result.message ?? fallback });
    else setNotice({ tone: "bad", text: result.error, problems: result.problems });
  };

  const run = (
    nextOperation: Operation,
    action: () => Promise<ActionResult>,
    fallback: string,
    onSuccess?: () => void,
  ) => {
    if (busy) return;
    setOperation(nextOperation);
    startTransition(async () => {
      try {
        const result = await action();
        report(result, fallback);
        if (result.ok) onSuccess?.();
      } finally {
        setOperation(null);
      }
    });
  };

  const saveDraft = () => {
    if (!dirty) return;
    const savingSnapshot = currentSnapshot;
    run(
      "save",
      () => savePageDraftAction(page.page.id, draft),
      "Draft saved.",
      () => {
        setSavedSnapshot(savingSnapshot);
        setHasSavedDraft(true);
      },
    );
  };

  const previewHref = page.page.path
    ? hasSavedDraft || !published
      ? `/api/website/preview?path=${encodeURIComponent(page.page.path)}`
      : page.page.path
    : null;

  const saveLabel = operation === "save" ? "Saving…" : dirty ? "Save draft" : "Draft saved";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <header className="website-editor-toolbar">
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 20 }}>{draft.meta.name}</strong>
            <Badge status={published ? "positive" : page.page.status === "archived" ? "neutral" : "warning"}>
              {published ? "Published" : page.page.status === "archived" ? "Archived" : "Unpublished"}
            </Badge>
            {hasSavedDraft ? <Badge status="info">Draft changes</Badge> : null}
            {dirty ? <Badge status="warning">Unsaved changes</Badge> : null}
          </div>
          <div style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            {page.page.path ?? "Shared site content"} · {dirty
              ? "Changes are only in this browser until you save."
              : hasSavedDraft
                ? "Saved privately. The public site is unchanged."
                : published
                  ? "Matches the live site."
                  : "This page is currently off the public site."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button onClick={saveDraft} variant="secondary" size="sm" disabled={busy || !dirty}>
            {saveLabel}
          </Button>
          {previewHref && !dirty ? (
            <a
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="bow-button bow-button-secondary bow-button-sm"
            >
              {hasSavedDraft || !published ? "Preview page" : "View live page"}
            </a>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              Preview draft
            </Button>
          )}
          <Button
            onClick={() => run(
              "publish",
              () => publishPageAction(page.page.id, page.page.path),
              "Published.",
              () => {
                setHasSavedDraft(false);
                setPublished(true);
              },
            )}
            variant="primary"
            size="sm"
            disabled={busy || dirty || (published && !hasSavedDraft)}
          >
            {operation === "publish" ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "12px 14px",
            borderRadius: "var(--radius-control)",
            border: `1px solid ${notice.tone === "ok" ? "var(--bow-positive)" : "var(--bow-negative)"}`,
            background: "var(--bow-white)",
            fontFamily: "var(--font-interface)",
            fontSize: 14.5,
          }}
        >
          {notice.text}
          {notice.problems && notice.problems.length > 0 ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              {notice.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <MetaCard
        data={draft.meta}
        onChange={(meta) => setDraft((current) => ({ ...current, meta }))}
      />

      <section>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
            Page content
          </h2>
          <p style={{ margin: "5px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
            Sections stay in the same designed order. Open the section whose wording you want to change.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {draft.sections.map((section, index) => (
            <SectionCard
              key={`${section.ordinal}-${section.kind}`}
              section={section}
              index={index}
              faqPageSlug={faqPageSlug}
              onChange={(data) => setDraft((current) => ({
                ...current,
                sections: current.sections.map((entry) =>
                  entry.ordinal === section.ordinal ? { ...entry, data } : entry,
                ),
              }))}
            />
          ))}
        </div>
      </section>

      <RecoveryCard
        page={page}
        versions={versions}
        pending={busy}
        hasSavedDraft={hasSavedDraft}
        published={published}
        onDiscard={() => {
          if (!window.confirm("Discard the saved draft and return to exactly what is live?")) return;
          run("discard", () => discardDraftAction(page.page.id), "Draft discarded.", () => setHasSavedDraft(false));
        }}
        onUnpublish={() => {
          if (!window.confirm("Take this page off the public website? Its content and history will be kept.")) return;
          run("unpublish", () => unpublishPageAction(page.page.id, page.page.path), "Unpublished.", () => setPublished(false));
        }}
        onRestore={(versionId) => {
          if (!window.confirm("Replace the current saved draft with this earlier version?")) return;
          run("restore", () => restoreVersionAction(page.page.id, versionId), "Restored into a draft.", () => setHasSavedDraft(true));
        }}
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px 20px" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function MetaCard({
  data,
  onChange,
}: {
  data: PageDraftInput["meta"];
  onChange: (next: PageDraftInput["meta"]) => void;
}) {
  return (
    <Card title="Page name and search listing">
      <FieldGroup
        fields={[
          { name: "name", label: "Page name", type: "text", help: "Shown in your list of pages. Not visible to visitors." },
          { name: "seoTitle", label: "Search-result title", type: "text", help: "What Google and social shares show as the headline." },
          { name: "seoDescription", label: "Search-result description", type: "textarea", help: "One or two sentences. Around 155 characters reads best." },
          { name: "socialImageUrl", label: "Sharing image", type: "image", help: "Used when this page is shared. Leave blank to use the site default." },
          { name: "noindex", label: "Hide from search engines", type: "boolean", help: "Keep this page out of Google." },
        ]}
        data={data as unknown as Record<string, unknown>}
        onChange={(next) => onChange(next as unknown as PageDraftInput["meta"])}
      />
    </Card>
  );
}

function SectionCard({
  section,
  index,
  faqPageSlug,
  onChange,
}: {
  section: PageDraftInput["sections"][number];
  index: number;
  faqPageSlug: string;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const spec = sectionSpec(section.kind);
  const [open, setOpen] = useState(index === 0);
  const title = sectionTitle(section.data, spec.label);

  return (
    <article className="website-section-card">
      <div className="website-section-card-header">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
            {String(index + 1).padStart(2, "0")} · {spec.label}
          </div>
          <strong style={{ display: "block", fontFamily: "var(--font-editorial)", fontSize: 17, marginTop: 3 }}>{title}</strong>
          <div style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {spec.summary}
          </div>
        </div>
        <SmallButton onClick={() => setOpen((value) => !value)} label={open ? `Close ${title}` : `Edit ${title}`}>
          {open ? "Close" : "Edit"}
        </SmallButton>
      </div>

      {open ? (
        <div style={{ borderTop: "1px solid var(--border-rule)", padding: "16px 16px 2px" }}>
          {section.kind === "faq" ? (
            <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
              The questions themselves live in <Link href="/app/website/faqs" className="bow-link">Website → FAQs</Link>. Assign them to <strong>{faqPageSlug}</strong> and they appear here.
            </p>
          ) : null}
          <FieldGroup fields={editorialSectionFields(section.kind)} data={section.data} onChange={onChange} />
        </div>
      ) : null}
    </article>
  );
}

function sectionTitle(data: Record<string, unknown>, fallback: string): string {
  for (const key of ["headline", "message", "prompt", "organizationName", "description", "eyebrow"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  }
  const items = data.items;
  if (Array.isArray(items) && items.length > 0) return `${fallback} · ${items.length} item${items.length === 1 ? "" : "s"}`;
  return fallback;
}

function RecoveryCard({
  page,
  versions,
  pending,
  hasSavedDraft,
  published,
  onDiscard,
  onUnpublish,
  onRestore,
}: {
  page: EditablePage;
  versions: VersionRow[];
  pending: boolean;
  hasSavedDraft: boolean;
  published: boolean;
  onDiscard: () => void;
  onUnpublish: () => void;
  onRestore: (versionId: string) => void;
}) {
  const restorable = versions.filter((version) => version.state !== "draft");
  return (
    <Card title="Restore or take offline">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <Button onClick={onDiscard} variant="secondary" size="sm" disabled={pending || !hasSavedDraft}>
          Discard saved draft
        </Button>
        {page.page.isSystem ? null : (
          <Button onClick={onUnpublish} variant="secondary" size="sm" disabled={pending || !published}>
            Unpublish this page
          </Button>
        )}
      </div>
      <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
        Discard returns to exactly what visitors see. Earlier published versions remain available below.
      </p>
      {restorable.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {restorable.slice(0, 8).map((version) => (
            <div key={version.id} className="website-version-row">
              <span style={{ fontFamily: "var(--font-interface)", fontSize: 14 }}>
                Version {version.versionNo}
                {version.state === "published" ? " — currently live" : ""}
                {version.publishedAt ? ` · published ${new Date(version.publishedAt).toLocaleDateString()}` : ""}
                {version.note ? ` · ${version.note}` : ""}
              </span>
              <SmallButton onClick={() => onRestore(version.id)} disabled={pending} label={`Restore version ${version.versionNo}`}>
                Restore
              </SmallButton>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
