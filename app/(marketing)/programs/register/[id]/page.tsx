import { notFound } from "next/navigation";
import Link from "next/link";
import ProgramRegistrationForm from "@/components/site/ProgramRegistrationForm";
import { getPublicProgram } from "@/lib/operations";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getPublicProgram(id);
  return {
    title: program ? `Register — ${program.name} — BOW Sports Capital` : "Register — BOW Sports Capital",
    description: program?.shortDescription ?? "Register for a BOW Sports Capital program.",
  };
}

export default async function ProgramRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getPublicProgram(id);
  if (!program || program.status === "closed") notFound();

  return (
    <div data-screen-label="Program Registration">
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ maxWidth: 640 }}>
          <Link href="/programs" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            ← All Programs
          </Link>
          <h1 style={{ margin: "14px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.02, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
            Register for {program.name}
          </h1>
          {program.shortDescription && (
            <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {program.shortDescription}
            </p>
          )}
          {program.status === "full" && program.fullCapacityBehavior === "waitlist" && (
            <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-orange)" }}>
              This program is currently full — registering here adds your student to the waitlist.
            </p>
          )}
          <ProgramRegistrationForm programId={program.id} programName={program.name} />
        </div>
      </section>
    </div>
  );
}
