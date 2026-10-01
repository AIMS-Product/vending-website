import { z } from "zod";

// Live community wins from wins.vendingpreneurs.com/api/wins (auto-synced from
// Mighty Networks). Real proof only: we render what the feed says, verbatim,
// and link back to the wall so every win is checkable.

export const WINS_WALL_URL = "https://wins.vendingpreneurs.com";

const winSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  image: z.string().nullable(),
  excerpt: z.string(),
  winType: z.string().nullable(),
  postedAt: z.string().nullable(),
});
const feedSchema = z.object({ wins: z.array(winSchema) });

export type PortalWin = z.infer<typeof winSchema>;

/**
 * Newest wins matching `winTypes` (empty = any type). Returns [] when the feed
 * is down so the page still renders; the section then shows just the wall link.
 */
export async function loadWins(
  winTypes: readonly string[],
  limit = 4,
): Promise<PortalWin[]> {
  try {
    const response = await fetch(`${WINS_WALL_URL}/api/wins`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`wins feed ${response.status}`);
    const { wins } = feedSchema.parse(await response.json());
    return wins
      .filter(
        (win) =>
          winTypes.length === 0 ||
          (win.winType && winTypes.includes(win.winType)),
      )
      .slice(0, limit);
  } catch (error) {
    // Degrade, do not break the prospect's page over a proof widget.
    console.error("portal: wins feed unavailable", error);
    return [];
  }
}
