import { getCurrentFeedUser, ensureCertificateId } from "@/lib/feed";

/** Escape user-supplied text before interpolating it into the certificate HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns a self-contained, styled HTML certificate for the current Daily Feed
 * visitor. The completion ID is a UUID stored in the database. `?download=1`
 * serves it as a file attachment; otherwise it renders in the browser to print.
 */
export async function GET(request: Request): Promise<Response> {
  const me = await getCurrentFeedUser();
  if (!me) {
    return new Response("Sign in to the BOW Daily Feed to view your certificate.", {
      status: 401,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!me.simCompleted) {
    return new Response("Finish the Track 101 preview simulation to earn your certificate.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const certId = me.certificateId ?? ensureCertificateId(me.id);
  const name = escapeHtml(me.displayName);
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const download = new URL(request.url).searchParams.get("download") === "1";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOW Sports Capital — Track 101 Preview Certificate</title>
  <meta name="description" content="BOW Sports Capital Track 101 Preview completion certificate for ${name}." />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800;900&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root { --ink:#0a0a0b; --blue:#3157ff; --blue-soft:#6f8bff; --orange:#ff5a36; --positive:#158a55; --line:#2a2a2f; --muted:#9a9da6; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { background: var(--ink); color: #fff; font-family: "Newsreader", Georgia, serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 18px; }
    .cert { width: 100%; max-width: 760px; border: 1px solid var(--line); background: #151518; padding: clamp(28px,6vw,64px); position: relative; }
    .cert::before { content: ""; position: absolute; inset: 14px; border: 1px solid var(--line); pointer-events: none; }
    .eyebrow { font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--orange); }
    .label { font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-top: 28px; }
    .name { font-family: "Barlow Condensed", sans-serif; font-weight: 900; font-size: clamp(38px,8vw,68px); line-height: 0.95; letter-spacing: -0.01em; text-transform: uppercase; margin: 10px 0 0; }
    .for { font-size: clamp(18px,3vw,22px); color: #d4d6db; margin: 22px 0 0; }
    .track { font-family: "Barlow Condensed", sans-serif; font-weight: 800; font-size: clamp(22px,4vw,34px); text-transform: uppercase; letter-spacing: -0.01em; color: var(--blue-soft); margin: 8px 0 0; }
    .rule { height: 4px; width: 90px; background: var(--blue); margin: 26px 0; }
    .meta { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 18px; margin-top: 32px; font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: 0.04em; color: var(--muted); }
    .print { position: fixed; top: 18px; right: 18px; font-family: "Barlow Condensed", sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; padding: 10px 16px; background: var(--blue); color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    @media print { body { background: #fff; color: #0a0a0b; } .cert { border-color: #d8d5ce; background: #fff; } .cert::before { border-color: #d8d5ce; } .name, .for, .track { color: #0a0a0b; } .track { color: var(--blue); } .print { display: none; } .meta { color: #6d7078; border-color: #d8d5ce; } }
  </style>
</head>
<body>
  <button class="print" onclick="window.print()">Print / Save PDF</button>
  <div class="cert">
    <span class="eyebrow">BOW Sports Capital</span>
    <p class="label">This certifies that</p>
    <h1 class="name">${name}</h1>
    <p class="for">completed the</p>
    <p class="track">BOW Sports Capital Track 101 Preview</p>
    <div class="rule"></div>
    <div class="meta">
      <span>Completed · ${date}</span>
      <span>Completion ID · ${certId}</span>
    </div>
  </div>
</body>
</html>`;

  const headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
  if (download) headers["content-disposition"] = `attachment; filename="bow-track-101-certificate.html"`;
  return new Response(html, { headers });
}
