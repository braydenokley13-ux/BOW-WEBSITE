import Link from "next/link";
import { SectionHeader } from "@/components/ds";
import FamilyRegistrationWizard from "@/components/site/programs/FamilyRegistrationWizard";
import { listRegisterablePrograms } from "@/lib/program-discovery";

export const metadata = {
  title: "Register",
  description: "Register one or more children for BOW Sports Capital programs in a single form.",
};

export default async function FamilyRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const { program } = await searchParams;
  const programs = await listRegisterablePrograms();
  const preselectedProgramId = program && programs.some((p) => p.id === program) ? program : null;

  return (
    <div data-screen-label="Family Registration">
      <section style={{ background: "var(--bow-paper)", padding: "clamp(36px,6vw,64px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ maxWidth: 720 }}>
          <Link href="/programs" style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            ← All Programs
          </Link>
          <SectionHeader kicker="Registration" title="Register your family" style={{ margin: "16px 0 8px" }} />
          <p style={{ margin: "0 0 28px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}>
            Add every child you&apos;re registering and the programs each one is joining. No account is required —
            one submission covers your whole family.
          </p>
          <FamilyRegistrationWizard programs={programs} preselectedProgramId={preselectedProgramId} />
        </div>
      </section>
    </div>
  );
}
