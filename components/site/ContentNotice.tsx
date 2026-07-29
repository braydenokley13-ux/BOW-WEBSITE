import { Button, CapLine } from "@/components/ds";
import type { ContentNotice as Notice } from "@/lib/cms/errors";
import { STAFF_REMEDIATION } from "@/lib/cms/errors";

/**
 * The one component that renders "this didn't work" or "there's nothing here".
 *
 * It replaces a single generic apology with whatever the situation actually is
 * — see lib/cms/errors.ts for the list. Two audiences, one component:
 *
 *   Visitors get the plain sentence and a way onward.
 *   Staff additionally get the reason code and, for faults, the sentence that
 *   says what to do about it. That extra block is rendered only when the caller
 *   passes a notice built with `staff: true`, which is gated on an admin
 *   session, not on a query parameter.
 */
export default function ContentNotice({ notice, compact = false }: { notice: Notice; compact?: boolean }) {
  const remediation = notice.diagnostic ? STAFF_REMEDIATION[notice.reason] : undefined;

  if (compact) {
    return (
      <div
        role={notice.isFault ? "alert" : "status"}
        style={{
          border: "1px dashed var(--border-rule)",
          borderRadius: "var(--radius-control)",
          padding: "28px 24px",
          background: "var(--bow-white)",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontFamily: "var(--font-editorial)", fontWeight: 600, fontSize: "var(--type-card)" }}>{notice.title}</p>
        <p style={{ margin: "10px auto 0", maxWidth: 520, fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.55, color: "var(--text-secondary)" }}>
          {notice.body}
        </p>
        {notice.action ? (
          <div style={{ marginTop: 18 }}>
            <Button href={notice.action.href} variant="primary" size="md">{notice.action.label}</Button>
          </div>
        ) : null}
        <StaffDetail diagnostic={notice.diagnostic} remediation={remediation} />
      </div>
    );
  }

  return (
    <section
      className="bow-front-office"
      role={notice.isFault ? "alert" : "status"}
      style={{
        background: "var(--bow-ink)",
        color: "#fff",
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        padding: "clamp(48px,8vw,120px) clamp(18px,4vw,40px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
          {notice.isFault ? "We hit a problem" : "Nothing here yet"}
        </span>
        <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(30px,5.5vw,64px)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}>
          {notice.title}
        </h1>
        <CapLine weight={7} step={18} stepAt={0.4} style={{ maxWidth: 320, margin: "20px 0" }} />
        <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: "clamp(16px,1.5vw,20px)", lineHeight: 1.55, color: "#b9bcc4", maxWidth: 520 }}>
          {notice.body}
        </p>
        {notice.action ? (
          <Button href={notice.action.href} variant="primary" size="lg">{notice.action.label}</Button>
        ) : null}
        <StaffDetail diagnostic={notice.diagnostic} remediation={remediation} onInk />
      </div>
    </section>
  );
}

function StaffDetail({
  diagnostic,
  remediation,
  onInk = false,
}: {
  diagnostic?: string;
  remediation?: string;
  onInk?: boolean;
}) {
  if (!diagnostic) return null;
  return (
    <div
      style={{
        marginTop: 28,
        padding: "14px 16px",
        border: `1px solid ${onInk ? "var(--bow-dark-border)" : "var(--border-rule)"}`,
        borderLeft: "3px solid var(--bow-orange)",
        background: onInk ? "var(--bow-dark-surface)" : "var(--bow-paper)",
        textAlign: "left",
      }}
    >
      <div style={{ fontFamily: "var(--font-data)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-orange)" }}>
        Staff diagnostic
      </div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-data)", fontSize: 13, color: onInk ? "var(--bow-on-ink-subtle)" : "var(--text-secondary)" }}>
        {diagnostic}
      </div>
      {remediation ? (
        <p style={{ margin: "10px 0 0", fontFamily: "var(--font-interface)", fontSize: 14, lineHeight: 1.5, color: onInk ? "var(--bow-on-ink-muted)" : "var(--text-secondary)" }}>
          {remediation}
        </p>
      ) : null}
    </div>
  );
}
