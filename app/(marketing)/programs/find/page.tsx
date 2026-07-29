import ContentPage from "@/components/site/ContentPage";
import ProgramFinderClient from "@/components/site/programs/ProgramFinderClient";
import ContentNotice from "@/components/site/ContentNotice";
import { SectionHeader } from "@/components/ds";
import { listDiscoveryPrograms } from "@/lib/program-discovery";
import { contentMetadata } from "@/lib/cms/metadata";
import { describe } from "@/lib/cms/errors";
import { staffDiagnosticsEnabled } from "@/lib/cms/preview";

/**
 * The guided program finder.
 *
 * Its wording lives in the `programs-find` content document; the matcher below
 * it is live data. The finder is rendered inside its own error boundary here —
 * if the program query fails, the page still explains itself and says what
 * went wrong, instead of the whole route falling over.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return contentMetadata("programs-find", { path: "/programs/find" });
}

export default function ProgramFinderPage() {
  return <ContentPage slug="programs-find" screenLabel="Program Finder" extras={<Finder />} />;
}

async function Finder() {
  const staff = await staffDiagnosticsEnabled();
  const result = await loadFinder();
  return (
    <section style={{ background: "var(--bow-paper)", padding: "clamp(32px,5vw,56px) clamp(18px,4vw,40px)" }}>
      <div className="bow-container" style={{ maxWidth: 760 }}>
        {result.ok ? (
          <>
            <SectionHeader kicker="Guided Finder" title="Tell us about your student" style={{ marginBottom: 24 }} />
            <ProgramFinderClient programs={result.programs} />
          </>
        ) : (
          <ContentNotice notice={describe(result.error, { staff })} compact />
        )}
      </div>
    </section>
  );
}

type FinderResult =
  | { ok: true; programs: Awaited<ReturnType<typeof listDiscoveryPrograms>> }
  | { ok: false; error: unknown };

async function loadFinder(): Promise<FinderResult> {
  try {
    return { ok: true, programs: await listDiscoveryPrograms() };
  } catch (error) {
    return { ok: false, error };
  }
}
