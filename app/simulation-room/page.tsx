import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getSelfModuleViews } from "@/lib/self-paced";
import { getCurrentSimulation } from "@/lib/sim-store";
import { SIM_TURNS } from "@/lib/sim-game";
import SimulationRoom from "@/components/simulation/SimulationRoom";

export const metadata: Metadata = {
  title: "Simulation Room",
  description: "Run the Westbrook Wolves: ten turns, one salary cap, ten economic decisions. Earn a BOW Economics Grade.",
  robots: { index: false, follow: false },
};

export default async function SimulationRoomPage() {
  const me = await requireRole("student");
  // Gate: the Simulation Room unlocks after Module 2.
  const module2 = (await getSelfModuleViews(me.id)).find((v) => v.module.ordinal === 2)?.completed ?? false;
  if (!module2) redirect("/dashboard");

  const state = (await getCurrentSimulation(me.id));
  // Pre-pick content only — outcomes, cap, and win impacts stay server-side.
  const turns = SIM_TURNS.map((t) => ({
    turn: t.turn,
    concept: t.concept,
    title: t.title,
    situation: t.situation,
    choices: t.choices.map((c) => ({ id: c.id, label: c.label, description: c.description })),
  }));

  return <SimulationRoom firstName={me.first} turns={turns} initialState={state} />;
}
