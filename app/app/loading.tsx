/** Skeleton shown while the authenticated app shell loads its data (loadAppData). */
export default function AppLoading() {
  return (
    <div style={{ background: "var(--bow-paper)", minHeight: "100vh", padding: "clamp(24px,4vw,44px) clamp(16px,4vw,32px) 96px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="bow-skeleton" style={{ width: 160, height: 12, marginBottom: 16 }} />
        <div className="bow-skeleton" style={{ width: "70%", maxWidth: 460, height: 44, marginBottom: 28 }} />
        <div className="bow-skeleton" style={{ width: "100%", height: 160, borderRadius: 6, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bow-skeleton" style={{ height: 120, borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
