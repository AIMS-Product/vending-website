import type { MouseEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MikeBioLink } from "./MikeBioLink";
import {
  emitAttributionEvent,
  refreshStoredSession,
} from "@/lib/attribution-client";
import { updateAttributionSessionFromPage } from "@/lib/attribution-session";
import { mikeBioLinks } from "@/lib/content/mike-bio";

vi.mock("@/lib/attribution-client", () => ({
  emitAttributionEvent: vi.fn(),
  refreshStoredSession: vi.fn(),
}));

const event = (button: number) =>
  ({
    button,
    currentTarget: { href: mikeBioLinks.video },
  }) as MouseEvent<HTMLAnchorElement>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshStoredSession).mockReturnValue(
    updateAttributionSessionFromPage({
      href: mikeBioLinks.entry,
      nowIso: "2026-10-18T12:00:00Z",
      sessionIdFactory: () => "bio-session",
    }),
  );
});

describe("bio outbound clicks", () => {
  it("records the selected path once while keeping entry tags separate", () => {
    const link = MikeBioLink({
      href: mikeBioLinks.video,
      linkId: "bio-video-first-machine",
      videoId: "3HDu68I0_-o",
    });
    link.props.onClick(event(0));
    expect(emitAttributionEvent).toHaveBeenCalledTimes(1);
    expect(emitAttributionEvent).toHaveBeenCalledWith(
      "cta_clicked",
      expect.objectContaining({ utm_content: "bio-v1" }),
      expect.objectContaining({
        source_path: "/mike",
        button_id: "bio-video-first-machine",
        video_id: "3HDu68I0_-o",
        destination_content: "bio-v1-video-first-machine",
      }),
    );
    expect(link.props.href).toBe(mikeBioLinks.video);
  });

  it("counts middle-click but ignores right-click", () => {
    const link = MikeBioLink({
      href: mikeBioLinks.video,
      linkId: "bio-video-first-machine",
    });
    link.props.onAuxClick(event(2));
    expect(emitAttributionEvent).not.toHaveBeenCalled();
    link.props.onAuxClick(event(1));
    expect(emitAttributionEvent).toHaveBeenCalledTimes(1);
  });

  it("leaves the destination usable when browser storage is blocked", () => {
    vi.mocked(refreshStoredSession).mockReturnValue(null);
    const link = MikeBioLink({
      href: mikeBioLinks.video,
      linkId: "bio-video-first-machine",
    });
    expect(() => link.props.onClick(event(0))).not.toThrow();
    expect(emitAttributionEvent).not.toHaveBeenCalled();
    expect(link.props.href).toBe(mikeBioLinks.video);
  });
});
