import { DEMO_VERIFIED_SUMMARY, PORTAL_FIXTURES } from "./fixtures";
import type { PortalData } from "./types";

/** Demo email-verification session cookie, scoped to one portal path. */
export const verifiedCookieName = (token: string) =>
  `vp_portal_verified_${token}`;

/**
 * The single read seam between the portal UI and the backend.
 *
 * Returns null for an unknown/revoked link (the page 404s). `verified` means
 * the request carries a valid email-verification session for this portal;
 * only then may private material (call summary) be included. The UI trusts
 * this function to omit what the visitor may not see.
 *
 * SteelTrap: replace with the portal read model (arch doc §5.2 "Generated-link
 * safe read" / "Verified personal read"). Resolve the token via a hashed
 * access grant, never use the raw token as a primary key, never log it.
 */
export async function getPortalData(
  token: string,
  { verified }: { verified: boolean },
): Promise<PortalData | null> {
  const data = PORTAL_FIXTURES[token];
  if (!data) return null;
  if (!verified || data.access === "verified") return data;
  return {
    ...data,
    access: "verified",
    callSummary: DEMO_VERIFIED_SUMMARY[token] ?? data.callSummary,
    completedSteps: [...data.completedSteps],
  };
}
