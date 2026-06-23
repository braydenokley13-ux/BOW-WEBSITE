/** Skeleton shown while the student dashboard reads progress from SQLite. */
export default function DashboardLoading() {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="bow-skeleton" style={{ width: 160, height: 12, marginBottom: 16 }} />
        <div className="bow-skeleton" style={{ width: "65%", maxWidth: 420, height: 44, marginBottom: 16 }} />
        <div className="bow-skeleton" style={{ width: "100%", height: 80, borderRadius: 6, marginBottom: 28 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bow-skeleton" style={{ height: 110, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
