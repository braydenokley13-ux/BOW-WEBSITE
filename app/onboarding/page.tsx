import { requireRole } from "@/lib/dal";
import { RANK_LADDER } from "@/lib/scoring";
import { selfModules } from "@/lib/account";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

export default async function OnboardingPage() {
  const me = await requireRole("student");

  // Module 1 of Track 101 — the first lesson the student unlocks.
  const firstModule = selfModules.find((m) => m.track === "101" && m.ordinal === 1);
  const firstModuleTitle = firstModule?.title ?? "What Is Economics?";

  return (
    <OnboardingFlow firstName={me.first} ranks={RANK_LADDER} firstModuleTitle={firstModuleTitle} />
  );
}
