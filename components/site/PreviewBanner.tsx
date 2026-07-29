import Link from "next/link";

/**
 * The strip that makes it impossible to mistake a draft for the live site.
 *
 * Shown only when `previewEnabled()` returned true — which requires both the
 * Draft Mode cookie and a live founder session — so a visitor never sees it,
 * and a founder never publishes something believing it was already public.
 */
export default function PreviewBanner({ pageLabel, editHref }: { pageLabel: string; editHref?: string }) {
  return (
    <div
      role="status"
      style={{
        background: "var(--bow-orange)",
        color: "#fff",
        padding: "10px var(--page-inset)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "var(--font-data)",
        fontSize: 12,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <span>Draft preview — {pageLabel} is not live yet</span>
      {editHref ? (
        <Link href={editHref} style={{ color: "#fff", textDecoration: "underline" }}>
          Back to the editor
        </Link>
      ) : null}
      <Link href="/api/website/preview/exit" prefetch={false} style={{ color: "#fff", textDecoration: "underline" }}>
        Exit preview
      </Link>
    </div>
  );
}
