import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDetail = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/app/admin/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/auth", () => ({
  requireReadAccess: async () => ({
    user: { email: "admin@example.com" },
    role: "admin",
  }),
}));
vi.mock("@/lib/services/chatbot-admin", () => ({
  adminGetConversationDetail: getDetail,
}));
vi.mock("@/components/admin/ChatbotConversationDetail", () => ({
  ChatbotConversationDetail: () => <div>transcript</div>,
}));

import AdminChatbotConversationPage from "./page";

const ID = "3f2b8a52-1c64-4d0e-9b0a-6f0c2d9e7a11";

async function render(id: string) {
  const element = await AdminChatbotConversationPage({
    params: Promise.resolve({ id }),
  });
  return renderToStaticMarkup(element);
}

describe("chatbot conversation page", () => {
  beforeEach(() => {
    getDetail.mockReset();
    notFound.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("shows a reload message, not a 404, when the loader fails", async () => {
    getDetail.mockRejectedValue(new Error("db down"));
    const html = await render(ID);
    expect(html).toContain("could not be loaded just now");
    expect(notFound).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it("404s only when the conversation really is missing", async () => {
    getDetail.mockResolvedValue(null);
    await expect(render(ID)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("404s a malformed id without asking the database", async () => {
    await expect(render("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getDetail).not.toHaveBeenCalled();
  });
});
