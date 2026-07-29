import Link from "next/link";
import ContentNotice from "@/components/site/ContentNotice";
import ProgramRegistrationForm from "@/components/site/ProgramRegistrationForm";
import { Paragraphs } from "@/components/site/sections/shell";
import { getPublicProgramBySlug, type PublicProgram } from "@/lib/cms/offerings";
import { getGlobalSettings } from "@/lib/cms/read";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe, notice, type ContentNotice as Notice } from "@/lib/cms/errors";
import { staffDiagnosticsEnabled } from "@/lib/cms/preview";
import { interestListIsOpen, registrationIsOpen } from "@/lib/cms/status";
import { DEFAULT_GLOBAL_SETTINGS } from "@/lib/cms/sections";

/**
 * Registration for one program.
 *
 * The gate here is the program's registration status, checked before the form
 * is rendered — and checked again by the submit action, which reads the same
 * fields. A visitor who arrives on a closed program gets the reason and a way
 * onward rather than a form that will reject them after they have typed
 * everything in.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const program = await getPublicProgramBySlug(id);
    return contentMetadata(null, {
      title: program ? `Register — ${program.title}` : "Register",
      description: program?.shortDescription || "Register for a BOW Sports Capital program.",
      noindex: true,
    });
  } catch {
    return contentMetadata(null, { title: "Register", noindex: true });
  }
}

type Loaded =
  | { ok: true; program: PublicProgram; waitlistable: boolean; explanation: string }
  | { ok: false; notice: Notice };

async function loadRegistration(idOrSlug: string): Promise<Loaded> {
  const staff = await staffDiagnosticsEnabled();
  try {
    const program = await getPublicProgramBySlug(idOrSlug);
    if (!program) {
      return { ok: false, notice: notice("program_not_found", { staff, detail: `program "${idOrSlug}"` }) };
    }

    const settings = await getGlobalSettings().catch(() => DEFAULT_GLOBAL_SETTINGS);
    const open = registrationIsOpen(program.registrationStatus);
    const waitlistable =
      program.registrationStatus === "full" &&
      interestListIsOpen(program.registrationStatus, program.interestListEnabled);

    if (!open && !waitlistable) {
      return {
        ok: false,
        notice: notice("registration_closed", {
          staff,
          detail: `${program.slug} \u00b7 ${program.registrationStatus}`,
          overrides: {
            body: program.cta.explanation || undefined,
            action: program.interestListEnabled
              ? { label: "Join the interest list", href: "/sign-up" }
              : { label: "See open programs", href: "/programs" },
          },
        }),
      };
    }

    return {
      ok: true,
      program,
      waitlistable,
      explanation:
        program.cta.explanation ||
        (open ? settings.defaultRegistrationExplanation : settings.defaultInterestListExplanation),
    };
  } catch (error) {
    return { ok: false, notice: describe(error, { staff }) };
  }
}

export default async function ProgramRegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadRegistration(id);

  if (!result.ok) return <ContentNotice notice={result.notice} />;
  const { program, waitlistable, explanation } = result;

  return (
    <div id="main" data-screen-label="Program Registration">
      <section style={{ background: "var(--bow-paper)", padding: "clamp(40px,6vw,72px) clamp(18px,4vw,40px)" }}>
        <div className="bow-container" style={{ maxWidth: 640 }}>
          <Link href={`/programs/p/${program.slug}`} style={{ fontFamily: "var(--font-data)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--bow-slate)" }}>
            \u2190 {program.title}
          </Link>
          <h1 style={{ margin: "14px 0 6px", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "clamp(28px,4vw,44px)", lineHeight: 1.02, letterSpacing: "-0.01em", textTransform: "uppercase" }}>
            Register for {program.title}
          </h1>
          {program.shortDescription ? (
            <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 16, lineHeight: 1.6, color: "var(--bow-slate)" }}>
              {program.shortDescription}
            </p>
          ) : null}
          {waitlistable ? (
            <p style={{ margin: "0 0 20px", fontFamily: "var(--font-interface)", fontSize: 14, color: "var(--bow-orange)" }}>
              This program is currently full \u2014 registering here adds your student to the waitlist.
            </p>
          ) : null}
          {explanation ? (
            <Paragraphs
              text={explanation}
              style={{ margin: "0 0 24px", fontFamily: "var(--font-interface)", fontSize: 15, lineHeight: 1.6, color: "var(--bow-slate)" }}
            />
          ) : null}
          <ProgramRegistrationForm programId={program.id} programName={program.title} />
        </div>
      </section>
    </div>
  );
}
