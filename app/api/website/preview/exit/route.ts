import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Leave draft preview. Safe for anyone to call: it only clears a cookie. */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("path") ?? "/";
  const path = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(requested) ? requested : "/";
  (await draftMode()).disable();
  redirect(path);
}
