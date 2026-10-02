import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { loadOrCreateConversation } from "./conversation-store";

type StoreClient = Pick<SupabaseClient<Database>, "from">;

describe("loadOrCreateConversation, visitor recall", () => {
  it("logs a failed recall read and still starts the chat unprefilled", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const inserts: Array<Record<string, unknown>> = [];
    const row = { id: "conv-new", session_id: "session-1", messages: [] };
    const client = {
      from: () => {
        const builder: Record<string, unknown> = {};
        let recalling = false;
        for (const method of ["select", "eq", "order", "limit"]) {
          builder[method] = () => builder;
        }
        builder.or = () => {
          recalling = true;
          return builder;
        };
        builder.maybeSingle = () =>
          Promise.resolve(
            recalling
              ? { data: null, error: { code: "57P01", message: "dropped" } }
              : { data: null, error: null },
          );
        builder.insert = (values: Record<string, unknown>) => {
          inserts.push(values);
          return builder;
        };
        builder.single = () => Promise.resolve({ data: row, error: null });
        return builder;
      },
    } as unknown as StoreClient;

    const conversation = await loadOrCreateConversation(
      {
        sessionId: "session-1",
        pageUrl: null,
        userAgent: null,
        visitorHash: "hash",
      },
      { client },
    );

    expect(conversation.id).toBe("conv-new");
    expect(inserts[0]).toMatchObject({
      captured_name: null,
      captured_email: null,
      captured_phone: null,
    });
    expect(log).toHaveBeenCalledWith(
      "chatbot: visitor recall read failed",
      expect.objectContaining({ code: "57P01" }),
    );
    log.mockRestore();
  });
});
