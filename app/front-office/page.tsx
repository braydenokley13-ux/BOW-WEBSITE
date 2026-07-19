import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getSelfModuleViews } from "@/lib/self-paced";
import { getCurrentSimulation } from "@/lib/sim-store";
import { EASTFIELD_TURNS, TRACK_201_SIM_TYPE } from "@/lib/sim-eastfield";
import FrontOffice from "@/components/simulation/FrontOffice";

export const metadata: Metadata = {
  title: "The Front Office",
  description: "Run the Eastfield Eagles: eight turns fixing a messy cap, each one a Track 201 front-office concept. Earn a cap-efficiency report card.",
  robots: { index: false, follow: false },
};

export default async function FrontOfficePage() {
  const me = await requireRole("student");
  // Gate: The Front Office unlocks after Module 201-2.
  const module201_2 = (await getSelfModuleViews(me.id, "201")).find((v) => v.module.ordinal === 2)?.completed ?? false;
  if (!module201_2) redirect("/dashboard");

  const state = (await getCurrentSimulation(me.id, TRACK_201_SIM_TYPE));
  // Pre-pick content only — outcomes, cap, and win impacts stay server-side.
  const turns = EASTFIELD_TURNS.map((t) => ({
    turn: t.turn,
    concept: t.concept,
    title: t.title,
    situation: t.situation,
    choices: t.choices.map((c) => ({ id: c.id, label: c.label, description: c.description })),
  }));

  return <FrontOffice firstName={me.first} turns={turns} initialState={state} />;
}
