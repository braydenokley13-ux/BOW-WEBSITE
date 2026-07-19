import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ForcedPasswordChangeForm from "@/components/auth/ForcedPasswordChangeForm";
import { getCurrentUser } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Secure your account · BOW Sports Capital",
  robots: { index: false, follow: false },
};

export default async function RequiredPasswordChangePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  if (!me.passwordChangeRequired) redirect("/app");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bow-paper)", padding: 20 }}>
      <section aria-labelledby="secure-account-title" style={{ width: "min(100%, 480px)", background: "var(--bow-white)", border: "1px solid var(--border-rule)", borderRadius: 8, padding: "clamp(24px,5vw,40px)", boxShadow: "0 16px 48px rgba(10,22,40,0.08)" }}>
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-blue)" }}>
          Required security step
        </span>
        <h1 id="secure-account-title" style={{ margin: "8px 0 12px", fontFamily: "var(--font-display)", fontSize: "clamp(30px,7vw,44px)", fontWeight: 900, lineHeight: 0.95, textTransform: "uppercase", color: "var(--bow-ink)" }}>
          Secure your account
        </h1>
        <p style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
          Welcome, {me.first}. Replace the temporary bootstrap password before entering the BOW operating system. Use at least 12 characters and a password you do not use anywhere else.
        </p>
        <ForcedPasswordChangeForm />
      </section>
    </main>
  );
}
