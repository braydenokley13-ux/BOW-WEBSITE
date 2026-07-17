import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { roleHomePath } from "@/lib/account";

/**
 * The app entry point. Authenticated users are routed straight to the
 * home screen for their role; everyone else is bounced to sign-in by
 * `requireUser`. `growth` has no separate home route yet (roleHomePath
 * points back at "/app"), so it renders a placeholder here instead of
 * redirecting to itself.
 */
export default async function AppHome() {
  const me = await requireUser();
  if (me.role === "growth") {
    return (
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
          BOW HQ
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 900, textTransform: "uppercase", fontSize: 32, margin: "10px 0 0" }}>
          Coming online
        </h1>
        <p style={{ fontFamily: "var(--font-interface)", fontSize: 15, color: "var(--bow-slate)", marginTop: 12 }}>
          The leadership home is being built. Use the nav above to reach instructors, training, classes, students, partners, tasks, and curriculum.
        </p>
      </section>
    );
  }
  redirect(roleHomePath(me.role));
}
