/** Skeleton shown while the instructor roster reads from SQLite. */
export default function InstructorLoading() {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="bow-skeleton" style={{ width: 160, height: 12, marginBottom: 16 }} />
        <div className="bow-skeleton" style={{ width: "60%", maxWidth: 420, height: 44, marginBottom: 20 }} />
        <div className="bow-skeleton" style={{ width: "100%", height: 54, borderRadius: 6, marginBottom: 24 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bow-skeleton" style={{ height: 220, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
