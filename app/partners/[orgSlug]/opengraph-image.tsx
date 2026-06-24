import { ImageResponse } from "next/og";
import { getPartnerBySlug } from "@/lib/partners";
import { partnerTypeLabel } from "@/lib/account";

export const alt = "BOW Sports Capital — partner program";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Uses node:sqlite via getPartnerBySlug, so this must run on the Node.js runtime.
export const runtime = "nodejs";

/** A dynamic 1200×630 OG card for LinkedIn / email previews of a partner page. */
export default async function Image({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = getPartnerBySlug(orgSlug);

  const name = org?.name ?? "BOW Sports Capital";
  const headline = org?.customHeadline ?? "The front office for the next generation";
  const typeLabel = org ? `${partnerTypeLabel(org.orgType)} Partnership` : "Partner Program";

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
            {typeLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#9fb0c8", fontSize: 26, marginBottom: 12 }}>{name}</div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 72, fontWeight: 900, lineHeight: 1.02, letterSpacing: -2 }}>
            {headline}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ display: "flex", color: "#C9A84C", fontSize: 28, fontWeight: 700 }}>
            Read the game. Run the business. Make the decision.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
