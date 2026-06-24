import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getPlayerCardData } from "@/lib/player-card";
import PlayerCardView from "@/components/selfpaced/PlayerCardView";

export const metadata: Metadata = {
  title: "Your Player Card",
  description: "Your BOW Sports Capital player card — your rank, position, and stats on a collectible card.",
  robots: { index: false, follow: false },
};

export default async function CardPage() {
  const me = await requireRole("student");
  const data = getPlayerCardData(me.id);
  if (!data) return null;
  return <PlayerCardView data={data} />;
}
