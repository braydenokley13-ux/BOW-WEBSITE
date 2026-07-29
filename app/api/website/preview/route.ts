import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { WEBSITE_EDITOR_ROLES } from "@/lib/cms/preview";

/**
 * Enter draft preview.
 *
 * Authorization happens here, before the cookie is set — this is the only
 * place in the application that can enable Draft Mode. The redirect target is
 * restricted to a same-site absolute path, so the route cannot be used as an
 * open redirect by appending `?path=https://…`.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(WEBSITE_EDITOR_ROLES as readonly string[]).includes(user.role)) {
    redirect("/sign-in?next=/app/website");
  }

  const requested = new URL(request.url).searchParams.get("path") ?? "/";
  // A single leading slash, no scheme, no protocol-relative "//host" form.
  const path = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(requested) ? requested : "/";

  (await draftMode()).enable();
  redirect(path);
}
