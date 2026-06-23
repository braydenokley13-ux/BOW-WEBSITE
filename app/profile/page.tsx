import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getProfileData } from "@/lib/profile";
import ProfileView from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Your BOW Profile",
  description: "Your BOW Sports Capital record — rank, modules, certificate, BOW Daily, and Econ Quiz score.",
  // The private profile is personal; keep it out of search indexes.
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const me = await requireRole("student");
  const data = getProfileData(me.id);
  if (!data) return null;
  return <ProfileView data={data} />;
}
