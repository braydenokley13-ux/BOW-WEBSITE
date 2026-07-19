import { requireUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/admin";
import { SELF_PACED_ORG_ID } from "@/lib/account";
import AdminDashboard from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const me = await requireUser();
  if (me.role !== "admin") redirect("/dashboard");

  const data = (await getAdminData(me.id));
  return <AdminDashboard adminName={me.name} data={data} defaultOrgId={SELF_PACED_ORG_ID} defaultTrack="101" />;
}
