import { getCurrentUser } from "@/lib/dal";
import { hasCompletedAllModules } from "@/lib/self-paced";
import { issueCertificate, buildCertificateHtml, certificateFilename, CERT_TRACK } from "@/lib/certificate";

/**
 * Renders the signed-in student's Track 101 certificate. Verifies all four
 * modules are complete server-side, then streams a self-contained HTML
 * certificate. `?download=1` serves it as a file attachment; otherwise it
 * renders inline so the student can screenshot or print it.
 */
export async function GET(request: Request): Promise<Response> {
  const me = await getCurrentUser();
  if (!me || me.role !== "student") {
    return new Response("Sign in as a student to view your certificate.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!hasCompletedAllModules(me.id)) {
    return new Response("Finish all four Track 101 modules to earn your certificate.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const cert = issueCertificate(me.id, CERT_TRACK);
  const dateLabel = new Date(cert.issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const html = buildCertificateHtml({ name: me.name, dateLabel, certId: cert.id });

  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (new URL(request.url).searchParams.get("download") === "1") {
    headers["content-disposition"] = `attachment; filename="${certificateFilename(me.name)}"`;
  }
  return new Response(html, { headers });
}
