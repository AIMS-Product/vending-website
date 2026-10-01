import { PORTAL_FIXTURES } from "./fixtures";
import type { PortalData } from "./types";

/**
 * The single seam between the portal UI and SteelTrap.
 *
 * Returns null for an unknown/revoked token (the page 404s). Today only the
 * `demo*` fixtures resolve. Dom: replace the body with a server-side fetch to
 * SteelTrap by token, zod-parse the response into PortalData, keep the demo
 * branch for preview. See docs/client-portal/HANDOFF.md.
 */
export async function getPortalData(token: string): Promise<PortalData | null> {
  return PORTAL_FIXTURES[token] ?? null;
}
