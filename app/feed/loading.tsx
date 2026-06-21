/** Skeleton shown while the Daily Feed resolves the session and stories. */
export default function FeedLoading() {
  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "100vh" }}>
      <div style={{ borderBottom: "1px solid var(--bow-dark-border)", background: "var(--bow-dark-surface)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "12px clamp(18px,4vw,32px)", display: "flex", justifyContent: "space-between" }}>
          <div className="bow-skeleton" style={{ width: 180, height: 14 }} />
          <div className="bow-skeleton" style={{ width: 120, height: 14 }} />
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(24px,4vw,52px) clamp(18px,4vw,32px)" }}>
        <div className="bow-skeleton" style={{ width: 140, height: 12, marginBottom: 18 }} />
        <div className="bow-skeleton" style={{ width: "90%", height: 48, marginBottom: 12 }} />
        <div className="bow-skeleton" style={{ width: "75%", height: 48, marginBottom: 24 }} />
        <div className="bow-skeleton" style={{ width: "100%", height: 90, marginBottom: 18 }} />
        <div className="bow-skeleton" style={{ width: "100%", height: 130, borderRadius: 4 }} />
      </div>
    </div>
  );
}
