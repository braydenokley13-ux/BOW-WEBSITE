import ContentPage from "@/components/site/ContentPage";
import ContentNotice from "@/components/site/ContentNotice";
import FamilyRegistrationWizard from "@/components/site/programs/FamilyRegistrationWizard";
import { listRegisterablePrograms } from "@/lib/program-discovery";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe, notice } from "@/lib/cms/errors";
import { staffDiagnosticsEnabled } from "@/lib/cms/preview";

/**
 * Family registration — one form covering every child and every program.
 *
 * The instructions above the wizard are content (slug `programs-register`).
 * When nothing is open for registration the page says so plainly instead of
 * showing a wizard with an empty program list.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("programs-register", { path: "/programs/register" });
}

export default async function FamilyRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string }>;
}) {
  const { program } = await searchParams;
  return <ContentPage slug="programs-register" screenLabel="Family Registration" extras={<Wizard preselect={program} />} />;
}

async function Wizard({ preselect }: { preselect?: string }) {
  const staff = await staffDiagnosticsEnabled();
  const result = await loadRegisterablePrograms();

  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(24px,4vw,48px) clamp(18px,4vw,40px) clamp(36px,6vw,64px)" }}>
      <div className="bow-container" style={{ maxWidth: 720 }}>
        {!result.ok ? (
          <ContentNotice notice={describe(result.error, { staff })} compact />
        ) : result.programs.length === 0 ? (
          <ContentNotice notice={notice("no_programs_available", { staff })} compact />
        ) : (
          <FamilyRegistrationWizard
            programs={result.programs}
            preselectedProgramId={preselect && result.programs.some((p) => p.id === preselect) ? preselect : null}
          />
        )}
      </div>
    </section>
  );
}

type WizardData =
  | { ok: true; programs: Awaited<ReturnType<typeof listRegisterablePrograms>> }
  | { ok: false; error: unknown };

async function loadRegisterablePrograms(): Promise<WizardData> {
  try {
    return { ok: true, programs: await listRegisterablePrograms() };
  } catch (error) {
    return { ok: false, error };
  }
}
