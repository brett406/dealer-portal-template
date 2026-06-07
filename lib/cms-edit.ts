import { cache } from "react";
import { auth } from "@/lib/auth";

/**
 * Whether the current session may edit content inline ("edit on the page").
 * Wrapped in React.cache so the many EditableField wrappers on a page resolve
 * it once per request. Returns false for anonymous visitors — which is what
 * keeps the inline-editing client bundle off public pages entirely.
 */
export const isEditor = cache(async (): Promise<boolean> => {
  try {
    const session = await auth();
    const role = session?.user?.role;
    return role === "SUPER_ADMIN" || role === "STAFF";
  } catch {
    return false;
  }
});
