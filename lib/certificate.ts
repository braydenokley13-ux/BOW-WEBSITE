/* ============================================================
 * Certificate generator (Feature 2).
 *
 * Issues an idempotent certificate record per student+track and
 * renders a self-contained, navy/gold HTML certificate — modeled on
 * the BOW "Certificate Desk" design handoff (The Ringer vibe). The
 * markup is fully inline so the downloaded .html file looks right on
 * its own; brand display fonts load from Google Fonts when online and
 * fall back to system serif/sans faces offline.
 *
 * Server-only. Do not import from a client component.
 * ============================================================ */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export interface CertificateRecord {
  id: string;
  studentId: string;
  issuedAt: number;
  track: string;
}

/** The Track 101 certificate's stored track key and human title. */
export const CERT_TRACK = "101";
export const CERT_TRACK_TITLE = "Track 101: Rookie GM Economics";

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToCert(r: any): CertificateRecord {
  return { id: r.id, studentId: r.student_id, issuedAt: Number(r.issued_at), track: r.track };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The student's certificate for a track, or null if not yet issued. */
export function getCertificate(studentId: string, track: string = CERT_TRACK): CertificateRecord | null {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = getDb().prepare("SELECT * FROM certificates WHERE student_id = ? AND track = ?").get(studentId, track) as any;
  return row ? rowToCert(row) : null;
}

/**
 * Issue a certificate (idempotent): returns the existing record if one was
 * already issued, otherwise creates and returns a new one. The caller is
 * responsible for verifying completion before calling this.
 */
export function issueCertificate(studentId: string, track: string = CERT_TRACK): CertificateRecord {
  const existing = getCertificate(studentId, track);
  if (existing) return existing;
  const id = `cert-${randomUUID()}`;
  const issuedAt = Date.now();
  getDb()
    .prepare("INSERT OR IGNORE INTO certificates (id, student_id, issued_at, track) VALUES (?, ?, ?, ?)")
    .run(id, studentId, issuedAt, track);
  // Re-read in case of a race where another insert won (UNIQUE(student_id, track)).
  return getCertificate(studentId, track) ?? { id, studentId, issuedAt, track };
}

/** Escape user-supplied text before interpolating it into the certificate HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A filesystem-safe slug of the student's name for the download filename. */
export function certificateFilename(name: string): string {
  const slug = name.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Student";
  return `BOW-Certificate-${slug}.html`;
}

export interface CertificateHtmlOptions {
  name: string;
  /** Pre-formatted completion date, e.g. "June 23, 2026". */
  dateLabel: string;
  certId: string;
  trackTitle?: string;
}

/**
 * A self-contained landscape certificate (1056×816, 11×8.5in). Dark navy with a
 * gold double-border frame, gold serif name, BOW wordmark, the Brayden White
 * founder signature, and a QR placeholder reading bowsportscapital.com.
 */
export function buildCertificateHtml({ name, dateLabel, certId, trackTitle = CERT_TRACK_TITLE }: CertificateHtmlOptions): string {
  const safeName = escapeHtml(name.trim() || "Student");
  const safeTrack = escapeHtml(trackTitle);
  const safeDate = escapeHtml(dateLabel);
  const safeId = escapeHtml(certId);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BOW Sports Capital — Certificate of Completion · ${safeName}</title>
  <meta name="description" content="${safeName} completed ${safeTrack} with BOW Sports Capital." />
  <meta name="robots" content="noindex" />
  <meta property="og:title" content="${safeName} — BOW Sports Capital Certificate" />
  <meta property="og:description" content="Certificate of Completion · ${safeTrack}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Archivo:wght@600;700;800;900&family=Anton&family=Great+Vibes&display=swap" rel="stylesheet" />
  <style>
    :root {
      --navy:#0A1628; --navy-deep:#070f1c; --gold:#C9A84C; --gold-soft:rgba(201,168,76,0.45); --lime:#C8FF3D;
      --serif:'Playfair Display', Georgia, 'Times New Roman', serif;
      --display:'Anton', 'Arial Narrow', 'Inter', system-ui, sans-serif;
      --mono-ui:'Archivo', 'Inter', system-ui, sans-serif;
      --ui:'Inter', system-ui, -apple-system, sans-serif;
      --script:'Great Vibes', 'Snell Roundhand', cursive;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { background: var(--navy-deep); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px 64px; font-family: var(--ui); }
    .toolbar { display: flex; gap: 12px; margin-bottom: 22px; }
    .btn { font-family: var(--mono-ui); font-weight: 800; font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; padding: 13px 26px; border-radius: 7px; cursor: pointer; border: 1px solid var(--gold); background: var(--gold); color: var(--navy); }
    .btn.ghost { background: transparent; color: #fff; border-color: #3a3d40; }
    .stage { width: 1056px; max-width: 100%; }
    .scaler { transform-origin: top center; }
    .cert { width: 1056px; height: 816px; background: var(--navy); position: relative; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.55); }
    .frame-outer { position: absolute; inset: 20px; border: 2px solid var(--gold); }
    .frame-inner { position: absolute; inset: 29px; border: 1px solid var(--gold-soft); }
    .diamond { position: absolute; width: 11px; height: 11px; background: var(--gold); transform: rotate(45deg); }
    .content { position: absolute; inset: 56px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .pill { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 15px; border: 1px solid rgba(200,255,61,0.45); padding: 4px 13px; border-radius: 100px; }
    .pill span.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--lime); }
    .pill span.txt { font-family: var(--mono-ui); font-size: 10.5px; font-weight: 700; letter-spacing: 2.6px; text-transform: uppercase; color: var(--lime); }
    .wordmark { font-family: var(--display); color: var(--gold); font-size: 47px; font-weight: 400; letter-spacing: 2.5px; line-height: 1; text-transform: uppercase; white-space: nowrap; }
    .subhead { font-family: var(--mono-ui); color: rgba(255,255,255,0.9); font-size: 13px; letter-spacing: 5px; text-transform: uppercase; margin-top: 12px; font-weight: 600; }
    .divider { display: flex; align-items: center; justify-content: center; gap: 11px; margin-top: 17px; }
    .divider .ln-l { height: 1px; width: 130px; background: linear-gradient(90deg, transparent, var(--gold)); }
    .divider .ln-r { height: 1px; width: 130px; background: linear-gradient(90deg, var(--gold), transparent); }
    .divider .dmd { width: 7px; height: 7px; background: var(--gold); transform: rotate(45deg); }
    .certifies { color: rgba(255,255,255,0.78); font-style: italic; font-size: 17px; letter-spacing: 0.5px; }
    .name { font-family: var(--serif); color: var(--gold); font-size: 62px; font-weight: 600; line-height: 1.04; margin-top: 8px; }
    .name-rule { height: 1px; width: 440px; max-width: 80%; background: rgba(201,168,76,0.55); margin: 16px auto 18px; }
    .track { font-family: var(--display); color: #fff; font-size: 34px; font-weight: 400; letter-spacing: 1.4px; margin-top: 11px; text-transform: uppercase; }
    .blurb { color: rgba(255,255,255,0.72); font-size: 14.5px; line-height: 1.65; max-width: 720px; margin: 15px auto 0; }
    .foot { margin-top: auto; width: 100%; }
    .foot-div { display: flex; align-items: center; justify-content: center; gap: 11px; margin-bottom: 22px; }
    .foot-div .ln { height: 1px; flex: 1; }
    .foot-div .ln.l { background: linear-gradient(90deg, transparent, rgba(201,168,76,0.6)); }
    .foot-div .ln.r { background: linear-gradient(90deg, rgba(201,168,76,0.6), transparent); }
    .foot-div .dmd { width: 6px; height: 6px; background: var(--gold); transform: rotate(45deg); }
    .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; align-items: start; }
    .col { text-align: center; }
    .sig { font-family: var(--script); color: #fff; font-size: 38px; line-height: 1; height: 42px; }
    .col-val { color: #fff; font-size: 18px; font-weight: 600; line-height: 1; height: 42px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; }
    .col-rule { height: 1px; background: var(--gold); margin: 4px 18px 9px; }
    .col-label { color: rgba(255,255,255,0.72); font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; }
    .qr-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 14px; }
    .qr { width: 70px; height: 70px; border: 1px solid var(--gold); display: flex; align-items: center; justify-content: center; padding: 6px; }
    .qr span { color: rgba(201,168,76,0.9); font-size: 8px; line-height: 1.25; text-align: center; word-break: break-word; }
    .qr-label { color: rgba(255,255,255,0.6); font-size: 8.5px; letter-spacing: 0.8px; text-transform: uppercase; }
    .certid { color: rgba(255,255,255,0.5); font-size: 10.5px; letter-spacing: 1px; margin-top: 20px; text-align: center; font-family: var(--mono-ui); }
    @media print {
      @page { size: 11in 8.5in; margin: 0; }
      html, body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .scaler { transform: none !important; }
      .cert { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="stage">
    <div class="scaler" id="scaler">
      <div class="cert">
        <div class="frame-outer"></div>
        <div class="frame-inner"></div>
        <div class="diamond" style="left:33px;top:33px;"></div>
        <div class="diamond" style="right:33px;top:33px;"></div>
        <div class="diamond" style="left:33px;bottom:33px;"></div>
        <div class="diamond" style="right:33px;bottom:33px;"></div>

        <div class="content">
          <div>
            <div class="pill"><span class="dot"></span><span class="txt">Official Credential</span></div>
            <div class="wordmark">BOW Sports Capital</div>
            <div class="subhead">Certificate of Completion</div>
            <div class="divider"><div class="ln-l"></div><div class="dmd"></div><div class="ln-r"></div></div>
          </div>

          <div style="margin-top:24px;">
            <div class="certifies">This certifies that</div>
            <div class="name">${safeName}</div>
            <div class="name-rule"></div>
            <div class="certifies">has completed</div>
            <div class="track">${safeTrack}</div>
            <div class="blurb">a sports-economics program where students learn opportunity cost, scarcity, market value, and real financial decision-making by running the business of a team.</div>
          </div>

          <div style="margin-top:22px;">
            <svg width="118" height="118" viewBox="0 0 200 200" role="img" aria-label="BOW Sports Capital certified seal">
              <defs><path id="cgSealTop" d="M 26 100 a 74 74 0 0 1 148 0" fill="none"></path></defs>
              <circle cx="100" cy="100" r="94" fill="none" stroke="#C9A84C" stroke-width="2"></circle>
              <circle cx="100" cy="100" r="86" fill="#13243d" stroke="#C9A84C" stroke-width="1" opacity="0.7"></circle>
              <text fill="#C9A84C" font-family="'Playfair Display',serif" font-size="15" letter-spacing="2.4" font-weight="700"><textPath href="#cgSealTop" startOffset="50%" text-anchor="middle">BOW SPORTS CAPITAL</textPath></text>
              <text x="100" y="91" fill="#FFFFFF" font-family="'Inter',sans-serif" font-size="12" letter-spacing="3" font-weight="700" text-anchor="middle">CERTIFIED</text>
              <rect x="89" y="102" width="22" height="22" transform="rotate(45 100 113)" fill="none" stroke="#C9A84C" stroke-width="1.5"></rect>
              <rect x="96" y="109" width="8" height="8" transform="rotate(45 100 113)" fill="#C8FF3D"></rect>
              <circle cx="74" cy="150" r="2.5" fill="#C9A84C"></circle>
              <circle cx="100" cy="156" r="2.5" fill="#C9A84C"></circle>
              <circle cx="126" cy="150" r="2.5" fill="#C9A84C"></circle>
            </svg>
          </div>

          <div class="foot">
            <div class="foot-div"><div class="ln l"></div><div class="dmd"></div><div class="ln r"></div></div>
            <div class="cols">
              <div class="col">
                <div class="sig">Brayden White</div>
                <div class="col-rule"></div>
                <div class="col-label">Brayden White, Founder</div>
              </div>
              <div class="col">
                <div class="col-val">BOW Sports Capital</div>
                <div class="col-rule"></div>
                <div class="col-label">The front office for the next generation</div>
              </div>
              <div class="col">
                <div class="col-val">${safeDate}</div>
                <div class="col-rule"></div>
                <div class="col-label">Date of Completion</div>
                <div class="qr-wrap">
                  <div class="qr"><span>bowsportscapital.com</span></div>
                  <div class="qr-label">Verify · bowsportscapital.com</div>
                </div>
              </div>
            </div>
            <div class="certid">Credential ID · ${safeId}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    // Scale the fixed 1056px certificate down to fit narrow screens (self-contained, no deps).
    (function () {
      var scaler = document.getElementById('scaler');
      function fit() {
        var avail = Math.min(window.innerWidth - 32, 1056);
        var s = avail / 1056;
        scaler.style.transform = s < 1 ? 'scale(' + s + ')' : 'none';
        scaler.style.height = s < 1 ? (816 * s) + 'px' : '';
      }
      fit();
      window.addEventListener('resize', fit);
    })();
  </script>
</body>
</html>`;
}
