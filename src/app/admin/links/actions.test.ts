import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLink } from "./actions";

const mocks = vi.hoisted(() => {
  class MarketingLinkServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "MarketingLinkServiceError";
    }
  }
  return {
    MarketingLinkServiceError,
    requireReadAccess: vi.fn(),
    revalidatePath: vi.fn(),
    createMarketingLink: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({
  requireReadAccess: mocks.requireReadAccess,
  canEditAdmin: (role: string) => role === "admin" || role === "super_admin",
}));
vi.mock("@/lib/services/marketing-links", () => ({
  MarketingLinkServiceError: mocks.MarketingLinkServiceError,
  createMarketingLink: mocks.createMarketingLink,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

const fields = {
  baseUrl: "https://www.vendingpreneurs.com/book",
  source: "instagram",
  medium: "organic",
  campaign: "webinar-sept15",
  content: "post-1",
  destination: "webinar-register",
  label: "IG bio",
};

describe("createLink action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireReadAccess.mockResolvedValue({
      user: { id: "u1", email: "adam@example.com" },
      role: "admin",
    });
  });

  it("saves as the signed-in admin and returns the URLs", async () => {
    mocks.createMarketingLink.mockResolvedValue({
      url: "https://www.vendingpreneurs.com/book?utm_source=instagram",
      bitly_url: "https://bit.ly/abc",
    });

    const result = await createLink(
      { status: "idle" },
      formData({ ...fields, shortLink: "on" }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Link saved and shortened.",
      url: "https://www.vendingpreneurs.com/book?utm_source=instagram",
      shortUrl: "https://bit.ly/abc",
    });
    expect(mocks.createMarketingLink).toHaveBeenCalledWith(
      expect.objectContaining({ ...fields, mintShortLink: true }),
      { createdBy: "adam@example.com" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/links");
  });

  it("tells a viewer they cannot save, without calling the service", async () => {
    mocks.requireReadAccess.mockResolvedValue({
      user: { id: "u2", email: "team@example.com" },
      role: "viewer",
    });

    const result = await createLink({ status: "idle" }, formData(fields));

    expect(result).toEqual({
      status: "error",
      message: expect.stringContaining("can view links but not save"),
    });
    expect(mocks.createMarketingLink).not.toHaveBeenCalled();
  });

  it("shows the service's validation message inline", async () => {
    mocks.createMarketingLink.mockRejectedValue(
      new mocks.MarketingLinkServiceError("Pick a source from the list."),
    );

    const result = await createLink({ status: "idle" }, formData(fields));

    expect(result).toEqual({
      status: "error",
      message: "Pick a source from the list.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("hides unexpected errors behind a generic message", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.createMarketingLink.mockRejectedValue(new Error("pg detail"));

    const result = await createLink({ status: "idle" }, formData(fields));

    expect(result).toEqual({
      status: "error",
      message: "Could not save the link.",
    });
    consoleError.mockRestore();
  });
});
