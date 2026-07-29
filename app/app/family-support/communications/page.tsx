import Link from "next/link";
import { requireStaff } from "@/lib/dal";
import { PageHeader, PageSection, Badge } from "@/components/ds";
import { getDeliveryFeed } from "@/app/actions/family-notifications";
import RetryDeliveryButton from "@/components/admin/family-support/RetryDeliveryButton";

function fmt(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The resolution target for "failed communication" on the needs-action feed
 * and on a family record — a real retry queue, not a dead-end alert.
 */
export default async function FamilyCommunicationsPage() {
  await requireStaff();
  const failed = await getDeliveryFeed({ emailStatus: "failed", limit: 100 });

  return (
    <div>
      <PageHeader
        eyebrow="Family support centre"
        title="Failed communications"
        context="Every email that did not reach a family. Retrying records who requested it and never claims success it can't back up."
        action={
          <Link href="/app/family-support" className="bow-button bow-button-ghost bow-button-sm">
            Back to family search
          </Link>
        }
      />
      <PageSection noRule>
        {failed.length === 0 ? (
          <p style={{ color: "var(--bow-slate)" }}>No failed deliveries right now.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {failed.map((n) => (
              <div key={n.id} style={{ border: "1px solid var(--border-rule)", borderRadius: 6, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge status="negative">Failed</Badge>
                    <strong>{n.title}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--bow-slate)", marginTop: 4 }}>
                    {n.guardianName ?? "Unknown guardian"} ({n.guardianEmail ?? "no email"}) · {n.studentName ?? "—"} · {n.programName ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--bow-slate)" }}>
                    {n.deliveryAttempts} attempt{n.deliveryAttempts === 1 ? "" : "s"} · last {fmt(n.lastAttemptAt)}
                    {n.emailError ? ` · ${n.emailError}` : ""}
                  </div>
                </div>
                <RetryDeliveryButton
                  notificationId={n.id}
                  title={n.title}
                  studentName={n.studentName}
                  alreadySent={n.emailStatus === "sent"}
                  attempts={n.deliveryAttempts}
                />
              </div>
            ))}
          </div>
        )}
      </PageSection>
    </div>
  );
}
