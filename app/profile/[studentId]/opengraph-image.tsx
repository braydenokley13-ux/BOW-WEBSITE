import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/profile";

export const alt = "BOW Sports Capital — student profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Uses node:sqlite via getPublicProfile, so this must run on the Node.js runtime.
export const runtime = "nodejs";

/** A dynamic 1200×630 OG card for LinkedIn / iMessage previews of a public profile. */
export default async function Image({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId: publicSlug } = await params;
  const profile = getPublicProfile(publicSlug);

  const name = profile?.name ?? "BOW Sports Capital";
  const rank = profile?.rank.name ?? "The front office for the next generation";
  const modules = profile ? `${profile.modulesCompleted}/${profile.totalModules} modules` : "Sports economics, made for students";
  const certified = profile?.certificateEarned ? "Certified" : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A1628",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 24, border: "2px solid #C9A84C", display: "flex" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", color: "#C9A84C", fontSize: 30, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>
            BOW Sports Capital
          </div>
          <div style={{ display: "flex", color: "#C8FF3D", fontSize: 20, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
            Verified Credential
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#9fb0c8", fontSize: 26, marginBottom: 12 }}>{rank}</div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 92, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{name}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", color: "#C9A84C", fontSize: 30, fontWeight: 700 }}>{modules}</div>
          {certified ? <div style={{ display: "flex", color: "#5fcf99", fontSize: 30, fontWeight: 700 }}>{certified}</div> : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
