import type { Metadata } from "next";
import { requireStaff } from "@/lib/dal";
import { getConceptMap } from "@/lib/concept-map";
import { getSelfModules, getQuizQuestions } from "@/lib/self-paced";
import { SIM_TURNS, SIM_TEAM, TOTAL_TURNS } from "@/lib/sim-game";
import { TRACK_201 } from "@/lib/account";
import DemoTour, { type DemoData } from "@/components/site/DemoTour";

const TITLE = "BOW Sports Capital — Partner Demo";
const DESCRIPTION =
  "A guided, read-only walkthrough of the BOW Sports Capital platform for league and partnership contacts — curriculum, a sample module, a simulation, student outcomes, and partnership details.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
};

export default async function DemoPage() {
  // Staff-led only: this tour exposes live curriculum content and quiz
  // answer keys, so it stays behind sign-in rather than being publicly
  // browsable — a BOW staff member presents it during a partner call.
  await requireStaff();
  // Pull real, live curriculum data so the demo always reflects the platform.
  const concepts = (await getConceptMap()).map((c) => ({
    name: c.conceptName,
    track: c.track,
    category: c.category as string,
    application: c.frontofficeApplication,
  }));

  const module201 = (await getSelfModules(TRACK_201)).find((m) => m.ordinal === 1) ?? null;
  const q201 = (await getQuizQuestions(TRACK_201)).filter((q) => q.moduleUnlock === 1);
  const mc = q201.find((q) => q.type === "mc") ?? null;
  const fr = q201.find((q) => q.type === "fr") ?? null;
  const math =
    q201.find((q) => q.type === "mc" && q.id !== mc?.id && /[$\d]/.test(q.question)) ??
    q201.find((q) => q.type === "mc" && q.id !== mc?.id) ??
    null;

  const toSample = (q: typeof mc, label: string) =>
    q
      ? {
          label,
          type: q.type,
          question: q.question,
          choices:
            q.type === "mc"
              ? [
                  { key: "A", text: q.choiceA ?? "" },
                  { key: "B", text: q.choiceB ?? "" },
                  { key: "C", text: q.choiceC ?? "" },
                  { key: "D", text: q.choiceD ?? "" },
                ].filter((c) => c.text)
              : [],
          correctAnswer: q.correctAnswer ?? null,
          explanation: q.explanation,
        }
      : null;

  const sampleQuestions = [
    toSample(mc, "Multiple choice"),
    toSample(math, "Math"),
    toSample(fr, "Free response"),
  ].filter(Boolean) as DemoData["sampleQuestions"];

  const t1 = SIM_TURNS[0];
  const sound = t1.choices.find((c) => c.sound) ?? t1.choices[0];

  const data: DemoData = {
    concepts,
    module: module201
      ? { title: module201.title, summary: module201.summary, concept: module201.concept, centralQuestion: module201.centralQuestion }
      : { title: "The Salary Cap Machine", summary: "", concept: "Cap Mechanics & Exceptions", centralQuestion: "" },
    sampleQuestions,
    simTeam: SIM_TEAM,
    simTotalTurns: TOTAL_TURNS,
    simTurn: {
      title: t1.title,
      situation: t1.situation,
      concept: t1.conceptLabel,
      choices: t1.choices.map((c) => ({ label: c.label, description: c.description, sound: c.sound })),
      soundLabel: sound.label,
      soundOutcome: sound.outcome,
    },
    leaderboard: [
      { name: "Jordan A.", rank: "Front Office", score: 1480, streak: 22 },
      { name: "Maya C.", rank: "Analyst", score: 1255, streak: 14 },
      { name: "Andre W.", rank: "Analyst", score: 1190, streak: 9 },
      { name: "Sofia R.", rank: "Scout", score: 940, streak: 6 },
      { name: "Liam P.", rank: "Scout", score: 815, streak: 3 },
    ],
  };

  return <DemoTour data={data} />;
}
