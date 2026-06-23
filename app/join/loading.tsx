/** Skeleton shown while the /join sign-up screen mounts. */
export default function JoinLoading() {
  return (
    <div className="bow-front-office" style={{ background: "var(--bow-ink)", color: "#fff", minHeight: "80vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div style={{ padding: "clamp(36px,5vw,72px) clamp(18px,4vw,48px)", borderRight: "1px solid var(--bow-dark-border)" }}>
          <div className="bow-skeleton" style={{ width: 180, height: 12, marginBottom: 18 }} />
          <div className="bow-skeleton" style={{ width: "90%", height: 56, marginBottom: 12 }} />
          <div className="bow-skeleton" style={{ width: "70%", height: 56, marginBottom: 28 }} />
          <div className="bow-skeleton" style={{ width: "85%", height: 16, marginBottom: 10 }} />
          <div className="bow-skeleton" style={{ width: "80%", height: 16 }} />
        </div>
        <div style={{ padding: "clamp(32px,4vw,64px) clamp(18px,4vw,48px)" }}>
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="bow-skeleton" style={{ width: 200, height: 26, marginBottom: 24 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ marginBottom: 18 }}>
                <div className="bow-skeleton" style={{ width: 90, height: 11, marginBottom: 8 }} />
                <div className="bow-skeleton" style={{ width: "100%", height: 46 }} />
              </div>
            ))}
            <div className="bow-skeleton" style={{ width: "100%", height: 50, marginTop: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
