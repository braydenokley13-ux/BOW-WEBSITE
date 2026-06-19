import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { roleHomePath } from "@/lib/account";

/**
 * The app entry point. Authenticated users are routed straight to the
 * home screen for their role; everyone else is bounced to sign-in by
 * `requireUser`.
 */
export default async function AppHome() {
  const me = await requireUser();
  redirect(roleHomePath(me.role));
}
