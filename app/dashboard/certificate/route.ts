import { getCurrentUser } from "@/lib/dal";
import { hasCompletedAllModules } from "@/lib/self-paced";
import { issueCertificate, buildCertificateHtml, certificateFilename, certTrackTitle, CERT_TRACK, CERT_TRACK_201 } from "@/lib/certificate";

/**
 * Renders the signed-in student's certificate for a track (Track 101 by
 * default, `?track=201` for Track 201). Verifies all of that track's modules
 * are complete server-side, then streams a self-contained HTML certificate.
 * `?download=1` serves it as a file attachment; otherwise it renders inline so
 * the student can screenshot or print it.
 */
export async function GET(request: Request): Promise<Response> {
  const me = await getCurrentUser();
  if (!me || me.role !== "student") {
    return new Response("Sign in as a student to view your certificate.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const url = new URL(request.url);
  const track = url.searchParams.get("track") === CERT_TRACK_201 ? CERT_TRACK_201 : CERT_TRACK;
  if (!hasCompletedAllModules(me.id, track)) {
    return new Response(`Finish all four Track ${track} modules to earn your certificate.`, {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const cert = issueCertificate(me.id, track);
  const dateLabel = new Date(cert.issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const html = buildCertificateHtml({ name: me.name, dateLabel, certId: cert.id, trackTitle: certTrackTitle(track) });

  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (url.searchParams.get("download") === "1") {
    headers["content-disposition"] = `attachment; filename="${certificateFilename(me.name, track)}"`;
  }
  return new Response(html, { headers });
}
