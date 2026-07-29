"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ds";
import { SmallButton } from "@/components/admin/website/Fields";
import { deleteFaqAction, moveFaqAction, saveFaqAction, type ActionResult } from "@/app/actions/website";
import type { AdminFaq } from "@/lib/cms/admin";
import { PUBLICATION_STATUS_LABELS, type PublicationStatus } from "@/lib/cms/status";

/* ============================================================
 * FAQs.
 *
 * One question can appear on several surfaces, so placement is a checklist of
 * pages, tracks, and programs rather than a single parent. The page's FAQ
 * section then renders whatever is assigned to it — no per-page duplication.
 * ============================================================ */

type Scope = { scopeKind: "page" | "track" | "program"; scopeKey: string; label: string };

interface Draft {
  id?: string;
  question: string;
  answer: string;
  status: PublicationStatus;
  placements: { scopeKind: "page" | "track" | "program"; scopeKey: string }[];
}

const EMPTY: Draft = { question: "", answer: "", status: "published", placements: [] };

export default function FaqManager({ faqs, scopes }: { faqs: AdminFaq[]; scopes: Scope[] }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<ActionResult>, success: string) => {
    startTransition(async () => {
      const result = await fn();
      setNotice(result.ok ? success : result.error);
      if (result.ok) setEditing(null);
    });
  };

  const scopeLabel = (placement: { scopeKind: string; scopeKey: string }) =>
    scopes.find((scope) => scope.scopeKind === placement.scopeKind && scope.scopeKey === placement.scopeKey)?.label ??
    `${placement.scopeKind}: ${placement.scopeKey}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {notice ? (
        <p role="status" style={{ margin: 0, padding: "10px 12px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "var(--bow-white)", fontFamily: "var(--font-interface)", fontSize: 14.5 }}>
          {notice}
        </p>
      ) : null}

      <div>
        <Button onClick={() => setEditing({ ...EMPTY })} variant="secondary" size="sm" disabled={pending}>
          Add a question
        </Button>
      </div>

      {editing ? (
        <FaqForm
          draft={editing}
          scopes={scopes}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSave={(draft) => call(() => saveFaqAction(draft), draft.id ? "Question updated." : "Question added.")}
        />
      ) : null}

      {faqs.length === 0 ? (
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--text-secondary)" }}>
          No questions yet. Add one and assign it to the pages where it belongs.
        </p>
      ) : (
        <div style={{ border: "1px solid var(--border-rule)", background: "var(--bow-white)" }}>
          {faqs.map((faq, index) => (
            <div key={faq.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-rule)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                  <strong style={{ fontFamily: "var(--font-editorial)", fontSize: 16 }}>{faq.question}</strong>
                  <p style={{ margin: "4px 0 0", fontFamily: "var(--font-interface)", fontSize: 13.5, color: "var(--text-secondary)" }}>
                    {faq.answer.length > 160 ? `${faq.answer.slice(0, 160)}…` : faq.answer}
                  </p>
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Badge status={faq.status === "published" ? "positive" : "warning"}>{PUBLICATION_STATUS_LABELS[faq.status]}</Badge>
                    {faq.placements.length === 0 ? (
                      <span style={{ fontFamily: "var(--font-data)", fontSize: 11.5, color: "var(--text-secondary)" }}>Not on any page yet</span>
                    ) : (
                      faq.placements.map((placement) => (
                        <span
                          key={`${placement.scopeKind}-${placement.scopeKey}`}
                          style={{ fontFamily: "var(--font-data)", fontSize: 11.5, border: "1px solid var(--border-rule)", borderRadius: 999, padding: "2px 9px", color: "var(--text-secondary)" }}
                        >
                          {scopeLabel(placement)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <SmallButton onClick={() => call(() => moveFaqAction(faq.id, "up"), "Reordered.")} disabled={pending || index === 0} label="Move up">↑</SmallButton>
                  <SmallButton onClick={() => call(() => moveFaqAction(faq.id, "down"), "Reordered.")} disabled={pending || index === faqs.length - 1} label="Move down">↓</SmallButton>
                  <SmallButton
                    onClick={() => call(() => saveFaqAction({ ...faq, status: faq.status === "published" ? "draft" : "published" }), faq.status === "published" ? "Hidden." : "Published.")}
                    disabled={pending}
                    label={faq.status === "published" ? "Hide" : "Publish"}
                  >
                    {faq.status === "published" ? "Hide" : "Publish"}
                  </SmallButton>
                  <SmallButton onClick={() => setEditing({ ...faq })} label="Edit question">Edit</SmallButton>
                  <SmallButton onClick={() => call(() => deleteFaqAction(faq.id), "Question deleted.")} disabled={pending} label="Delete question" tone="danger">
                    Delete
                  </SmallButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqForm({
  draft,
  scopes,
  pending,
  onSave,
  onCancel,
}: {
  draft: Draft;
  scopes: Scope[];
  pending: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<Draft>(draft);

  const toggle = (scope: Scope) => {
    const has = value.placements.some((p) => p.scopeKind === scope.scopeKind && p.scopeKey === scope.scopeKey);
    setValue({
      ...value,
      placements: has
        ? value.placements.filter((p) => !(p.scopeKind === scope.scopeKind && p.scopeKey === scope.scopeKey))
        : [...value.placements, { scopeKind: scope.scopeKind, scopeKey: scope.scopeKey }],
    });
  };

  return (
    <section style={{ background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", padding: "18px 20px" }}>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={labelStyle}>Question</span>
        <input type="text" value={value.question} onChange={(event) => setValue({ ...value, question: event.target.value })} style={controlStyle} />
      </label>
      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={labelStyle}>Answer</span>
        <textarea rows={5} value={value.answer} onChange={(event) => setValue({ ...value, answer: event.target.value })} style={controlStyle} />
      </label>
      <fieldset style={{ margin: "0 0 16px", padding: "12px 14px", border: "1px solid var(--border-rule)", borderRadius: "var(--radius-control)", background: "var(--bow-paper)" }}>
        <legend style={{ ...labelStyle, padding: "0 6px" }}>Show this question on</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
          {scopes.map((scope) => (
            <label key={`${scope.scopeKind}-${scope.scopeKey}`} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-interface)", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={value.placements.some((p) => p.scopeKind === scope.scopeKind && p.scopeKey === scope.scopeKey)}
                onChange={() => toggle(scope)}
              />
              {scope.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={() => onSave(value)} variant="primary" size="sm" disabled={pending}>Save</Button>
        <Button onClick={onCancel} variant="secondary" size="sm" disabled={pending}>Cancel</Button>
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const controlStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-interface)",
  fontSize: 14.5,
  lineHeight: 1.5,
  padding: "9px 11px",
  border: "1px solid var(--border-rule)",
  borderRadius: "var(--radius-control)",
  background: "var(--bow-white)",
};
