"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button } from "@/components/ds";
import { FieldGroup, SmallButton } from "@/components/admin/website/Fields";
import { sectionFields } from "@/lib/cms/fields";
import { AUTHORABLE_SECTION_KINDS, sectionSpec, type SectionKind } from "@/lib/cms/sections";
import type { EditablePage, VersionRow } from "@/lib/cms/admin";
import {
  addSectionAction,
  discardDraftAction,
  moveSectionAction,
  publishPageAction,
  removeSectionAction,
  restoreVersionAction,
  savePageMetaAction,
  saveSectionAction,
  setSectionHiddenAction,
  unpublishPageAction,
  type ActionResult,
} from "@/app/actions/website";

/* ============================================================
 * The page editor.
 *
 * Sections appear in the order a visitor meets them, each as an ordinary form.
 * Everything the founder does here writes to the draft; the public site does
 * not change until Publish. The three recovery routes are always visible:
 * discard the draft, restore an earlier version, or unpublish entirely.
 * ============================================================ */

export default function PageEditor({
  page,
  versions,
  faqPageSlug,
}: {
  page: EditablePage;
  versions: VersionRow[];
  faqPageSlug: string;
}) {
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string; problems?: string[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<SectionKind>("text");

  const report = (result: ActionResult, fallback: string) => {
    if (result.ok) setNotice({ tone: "ok", text: result.message ?? fallback });
    else setNotice({ tone: "bad", text: result.error, problems: result.problems });
  };

  const call = (fn: () => Promise<ActionResult>, fallback: string) => {
    startTransition(async () => report(await fn(), fallback));
  };

  const previewHref = page.page.path ? `/api/website/preview?path=${encodeURIComponent(page.page.path)}` : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background: "var(--bow-white)",
          border: "1px solid var(--border-rule)",
          borderRadius: "var(--radius-control)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 20 }}>{page.page.name}</strong>
            <Badge status={page.page.isPublished ? "positive" : "warning"}>
              {page.page.isPublished ? "Published" : page.page.status === "archived" ? "Archived" : "Draft"}
            </Badge>
            {page.page.hasDraft && page.page.isPublished ? <Badge status="info">Unpublished changes</Badge> : null}
          </div>
          {page.page.path ? (
            <div style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {page.page.path}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {previewHref ? (
            <Button href={previewHref} variant="secondary" size="sm">Preview draft</Button>
          ) : null}
          <Button
            onClick={() => call(() => publishPageAction(page.page.id, page.page.path), "Published.")}
            variant="primary"
            size="sm"
            disabled={pending}
          >
            {pending ? "Working…" : "Publish"}
          </Button>
        </div>
      </header>

      {notice ? (
        <div
          role="status"
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
              {notice.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <MetaCard page={page} onSave={(input) => call(() => savePageMetaAction(page.page.id, input), "Saved.")} pending={pending} />

      <section>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
          Sections, in the order visitors see them
        </h2>

        {page.sections.length === 0 ? (
          <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
            This page has no sections yet. Add one below.
          </p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {page.sections.map((section, index) => (
            <SectionCard
              key={section.id}
              pageId={page.page.id}
              section={section}
              index={index}
              total={page.sections.length}
              pending={pending}
              faqPageSlug={faqPageSlug}
              onResult={report}
              onCall={call}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            padding: "14px 16px",
            border: "1px dashed var(--border-rule)",
            borderRadius: "var(--radius-control)",
            background: "var(--bow-paper)",
          }}
        >
          <label htmlFor="add-section" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase" }}>
            Add a section
          </label>
          <select
            id="add-section"
            value={adding}
            onChange={(event) => setAdding(event.target.value as SectionKind)}
            style={{ padding: "8px 10px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", fontFamily: "var(--font-interface)", fontSize: 14 }}
          >
            {AUTHORABLE_SECTION_KINDS.map((kind) => (
              <option key={kind} value={kind}>{sectionSpec(kind).label}</option>
            ))}
          </select>
          <Button onClick={() => call(() => addSectionAction(page.page.id, adding), "Section added.")} variant="secondary" size="sm" disabled={pending}>
            Add
          </Button>
          <span style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--text-secondary)" }}>
            {sectionSpec(adding).summary}
          </span>
        </div>
      </section>

      <RecoveryCard
        page={page}
        versions={versions}
        pending={pending}
        onDiscard={() => call(() => discardDraftAction(page.page.id), "Draft discarded.")}
        onUnpublish={() => call(() => unpublishPageAction(page.page.id, page.page.path), "Unpublished.")}
        onRestore={(versionId) => call(() => restoreVersionAction(page.page.id, versionId), "Restored into a draft.")}
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
  page,
  onSave,
  pending,
}: {
  page: EditablePage;
  onSave: (input: { name: string; seoTitle: string; seoDescription: string; socialImageUrl: string; noindex: boolean }) => void;
  pending: boolean;
}) {
  const [data, setData] = useState({
    name: page.page.name,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    socialImageUrl: page.socialImageUrl,
    noindex: page.noindex,
  });

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
        onChange={(next) => setData(next as typeof data)}
      />
      <Button onClick={() => onSave(data)} variant="secondary" size="sm" disabled={pending}>Save</Button>
    </Card>
  );
}

function SectionCard({
  pageId,
  section,
  index,
  total,
  pending,
  faqPageSlug,
  onCall,
}: {
  pageId: string;
  section: EditablePage["sections"][number];
  index: number;
  total: number;
  pending: boolean;
  faqPageSlug: string;
  onResult: (result: ActionResult, fallback: string) => void;
  onCall: (fn: () => Promise<ActionResult>, fallback: string) => void;
}) {
  const spec = sectionSpec(section.kind);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>(section.data);

  return (
    <article
      style={{
        background: "var(--bow-white)",
        border: "1px solid var(--border-rule)",
        borderLeft: `4px solid ${section.hidden ? "var(--border-rule)" : "var(--bow-blue)"}`,
        borderRadius: "var(--radius-control)",
        opacity: section.hidden ? 0.65 : 1,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--text-secondary)", marginRight: 10 }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 17 }}>{spec.label}</strong>
          {section.hidden ? <span style={{ marginLeft: 10 }}><Badge status="neutral">Hidden</Badge></span> : null}
          <div style={{ fontFamily: "var(--font-interface)", fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {summarise(data) || spec.summary}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <SmallButton onClick={() => onCall(() => moveSectionAction(pageId, section.id, "up"), "Moved.")} disabled={pending || index === 0} label="Move section up">↑</SmallButton>
          <SmallButton onClick={() => onCall(() => moveSectionAction(pageId, section.id, "down"), "Moved.")} disabled={pending || index === total - 1} label="Move section down">↓</SmallButton>
          <SmallButton onClick={() => onCall(() => setSectionHiddenAction(pageId, section.id, !section.hidden), "Updated.")} disabled={pending} label={section.hidden ? "Show section" : "Hide section"}>
            {section.hidden ? "Show" : "Hide"}
          </SmallButton>
          <SmallButton onClick={() => setOpen((value) => !value)} label={open ? "Close" : "Edit section"}>
            {open ? "Close" : "Edit"}
          </SmallButton>
          <SmallButton onClick={() => onCall(() => removeSectionAction(pageId, section.id), "Section removed.")} disabled={pending} label="Remove section" tone="danger">
            Remove
          </SmallButton>
        </div>
      </div>

      {open ? (
        <div style={{ borderTop: "1px solid var(--border-rule)", padding: "16px 16px 18px" }}>
          {section.kind === "faq" ? (
            <p style={{ margin: "0 0 14px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
              The questions themselves live in{" "}
              <Link href="/app/website/faqs" className="bow-link">Website → FAQs</Link>. Assign them to{" "}
              <strong>{faqPageSlug}</strong> and they appear here.
            </p>
          ) : null}
          <FieldGroup fields={sectionFields(section.kind)} data={data} onChange={setData} />
          <Button onClick={() => onCall(() => saveSectionAction(pageId, section.id, data), "Saved to the draft.")} variant="secondary" size="sm" disabled={pending}>
            Save section
          </Button>
        </div>
      ) : null}
    </article>
  );
}

/** A one-line preview of a section, so a collapsed list is still readable. */
function summarise(data: Record<string, unknown>): string {
  for (const key of ["headline", "message", "prompt", "organizationName", "description"]) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  }
  const items = data.items;
  if (Array.isArray(items) && items.length > 0) return `${items.length} item${items.length === 1 ? "" : "s"}`;
  return "";
}

function RecoveryCard({
  page,
  versions,
  pending,
  onDiscard,
  onUnpublish,
  onRestore,
}: {
  page: EditablePage;
  versions: VersionRow[];
  pending: boolean;
  onDiscard: () => void;
  onUnpublish: () => void;
  onRestore: (versionId: string) => void;
}) {
  const restorable = versions.filter((version) => version.state !== "draft");
  return (
    <Card title="If something goes wrong">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <Button onClick={onDiscard} variant="secondary" size="sm" disabled={pending || !page.page.hasDraft}>
          Discard draft and go back to what’s live
        </Button>
        {page.page.isSystem ? null : (
          <Button onClick={onUnpublish} variant="secondary" size="sm" disabled={pending || !page.page.isPublished}>
            Unpublish this page
          </Button>
        )}
      </div>
      <p style={{ margin: "0 0 12px", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
        Nothing is ever deleted. Unpublishing takes a page off the public site and keeps every version.
      </p>
      {restorable.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {restorable.slice(0, 8).map((version) => (
            <div key={version.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid var(--border-rule)", paddingBottom: 8 }}>
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
