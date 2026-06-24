"use client";

/**
 * Downloads a self-contained standards-alignment HTML file (prebuilt on the
 * server and passed in as a string) — same pattern as the certificate download.
 */
export default function StandardsDownloadButton({ html }: { html: string }) {
  const onDownload = () => {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "BOW-Standards-Alignment.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={onDownload}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 14.5,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "13px 26px",
        border: "none",
        background: "var(--bow-blue)",
        color: "#fff",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Download Standards Alignment ↓
    </button>
  );
}
