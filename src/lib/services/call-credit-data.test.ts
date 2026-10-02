import { describe, expect, it, vi } from "vitest";
import { fetchChatIndex } from "./call-credit-data";

type ChatRow = {
  id: string;
  captured_email: string | null;
  created_at: string;
};

/** chatbot_conversations stand-in that honours `.range()` and caps pages at 1,000 rows. */
function chatClient(rows: ChatRow[], failure: { message: string } | null) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "not", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.range = vi.fn((from: number, to: number) =>
    Promise.resolve({
      data: failure ? null : rows.slice(from, Math.min(to + 1, from + 1000)),
      count: rows.length,
      error: failure,
    }),
  );
  return { from: () => builder } as unknown as Parameters<
    typeof fetchChatIndex
  >[0];
}

describe("fetchChatIndex", () => {
  it("indexes chats past the 1,000-row API cap", async () => {
    const rows: ChatRow[] = Array.from({ length: 1400 }, (_, i) => ({
      id: `chat-${i}`,
      captured_email: `Visitor${i}@Example.com`,
      created_at: "2026-09-01T00:00:00.000Z",
    }));

    const index = await fetchChatIndex(chatClient(rows, null));

    expect(index.size).toBe(1400);
    expect(index.get("visitor1399@example.com")).toHaveLength(1);
  });

  it("logs and returns an empty index when the read fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const index = await fetchChatIndex(chatClient([], { message: "boom" }));

    expect(index.size).toBe(0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
