import { prisma } from "@/lib/prisma";

let _setupComplete: boolean | null = null;

/**
 * Check if at least one SUPER_ADMIN user exists.
 * Result is cached in memory after first check — once setup is done, it's done forever.
 */
export async function isSetupComplete(): Promise<boolean> {
  if (_setupComplete === true) return true;

  try {
    const count = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    _setupComplete = count > 0;
    return _setupComplete;
  } catch {
    // DB not reachable yet — treat as not complete
    return false;
  }
}

/**
 * Clear the cached setup status (called after wizard completes).
 */
export function markSetupComplete() {
  _setupComplete = true;
}
