import { redirect } from "next/navigation";
import ContentNotice from "@/components/site/ContentNotice";
import { getPublicProgramBySlug, type PublicProgram } from "@/lib/cms/offerings";
import { getGlobalSettings } from "@/lib/cms/read";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe, notice, type ContentNotice as Notice } from "@/lib/cms/errors";
import { staffDiagnosticsEnabled } from "@/lib/cms/preview";
import { interestListIsOpen, registrationIsOpen } from "@/lib/cms/status";
import { DEFAULT_GLOBAL_SETTINGS } from "@/lib/cms/sections";

/**
 * Registration for one program — now a compatibility redirect.
 *
 * This route used to render its own form against a registration path that
 * counted seats without locking the class row, so two families racing for the
 * last seat could both be confirmed, and a full program had no waitlist. The
 * canonical family wizard does take the lock, enrols siblings in one flow, and
 * hands a full class to the waitlist engine.
 *
 * The route survives because families have this URL in their inbox. The
 * closed/full gate stays here so someone arriving on a program that has ended
 * still gets the reason and a way onward, rather than being bounced into a
 * wizard that cannot help them.
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

  // Registration is open (or waitlistable) — hand the family to the canonical
  // wizard, preselected on this program. redirect() throws, so it stays out of
  // loadRegistration's try/catch.
  redirect(`/programs/register?program=${encodeURIComponent(result.program.id)}`);
}
