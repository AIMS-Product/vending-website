import { describe, expect, it, vi } from "vitest";
import { sendPasswordSetupEmail } from "./password-email";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config")>();
  return { ...actual, config: { ...actual.config, RESEND_API_KEY: "re_test" } };
});

function adminWith(result: unknown) {
  const generateLink = vi.fn().mockResolvedValue(result);
  return { client: { auth: { admin: { generateLink } } }, generateLink };
}

describe("sendPasswordSetupEmail", () => {
  it("emails a token_hash link to the callback on the sending origin", async () => {
    const { client, generateLink } = adminWith({
      data: { properties: { hashed_token: "th_abc" } },
      error: null,
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}"));

    await sendPasswordSetupEmail(
      client as never,
      "emma@example.com",
      "https://www.vendingpreneurs.com",
      fetchImpl,
    );

    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "emma@example.com",
    });
    const body = JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string);
    expect(body.to).toEqual(["emma@example.com"]);
    const link = new URL(
      (body.text as string).match(/https:\/\/\S+/)?.[0] ?? "",
    );
    expect(link.origin).toBe("https://www.vendingpreneurs.com");
    expect(link.pathname).toBe("/auth/callback");
    expect(link.searchParams.get("token_hash")).toBe("th_abc");
    expect(link.searchParams.get("type")).toBe("recovery");
    expect(link.searchParams.get("next")).toBe(
      "/admin/reset-password?email=emma%40example.com",
    );
  });

  it("throws when Supabase cannot make a link, and sends nothing", async () => {
    const { client } = adminWith({
      data: { properties: null },
      error: { message: "User not found" },
    });
    const fetchImpl = vi.fn();

    await expect(
      sendPasswordSetupEmail(
        client as never,
        "x@example.com",
        "https://www.vendingpreneurs.com",
        fetchImpl,
      ),
    ).rejects.toThrow("User not found");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws when Resend rejects the email", async () => {
    const { client } = adminWith({
      data: { properties: { hashed_token: "th_abc" } },
      error: null,
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("bad", { status: 422 }));

    await expect(
      sendPasswordSetupEmail(
        client as never,
        "x@example.com",
        "https://www.vendingpreneurs.com",
        fetchImpl,
      ),
    ).rejects.toThrow(/422/);
  });
});
