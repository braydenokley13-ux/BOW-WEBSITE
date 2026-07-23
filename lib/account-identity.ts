/** Lightweight account identity primitives for narrow authentication paths. */
export type Role = "student" | "instructor" | "admin" | "growth";

export const roleHomePath = (role: Role): string =>
  role === "admin" || role === "growth" ? "/app" : role === "instructor" ? "/app/teach" : "/app/student";

/** BOW owns the default self-paced organization and cohort. */
export const SELF_PACED_ORG_ID = "org-bow";
export const SELF_PACED_COHORT_ID = "coh-self";
