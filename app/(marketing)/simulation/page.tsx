import Simulation from "@/components/site/Simulation";

export const metadata = {
  title: "Simulation — BOW Sports Capital",
  description:
    "Step into the war room. You’re the GM: across three rounds, decide what your young star is really worth — and what you’re willing to give up to win now.",
};

export default function SimulationPage() {
  return (
    <div data-screen-label="Simulation">
      <Simulation />
    </div>
  );
}
