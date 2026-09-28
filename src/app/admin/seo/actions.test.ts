import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  setTaskStatus: vi.fn(),
  createTask: vi.fn(),
  setPieceStatus: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/services/seo-command-center", () => ({
  getSeoOverview: vi.fn(),
  getSeoKeywords: vi.fn(),
}));
vi.mock("@/lib/services/seo-task-writes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  setTaskStatus: mocks.setTaskStatus,
  createTask: mocks.createTask,
  setPieceStatus: mocks.setPieceStatus,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { addTask, updatePieceStatus, updateTaskStatus } from "./actions";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
const ID = "2b1c6c1e-5d7a-4c4b-9a53-2f4a7f0e6f11";

describe("SEO actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      user: { email: "a@b.com" },
      role: "admin",
    });
  });

  it("checks edit rights before writing", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      updateTaskStatus(form({ id: ID, status: "done" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.setTaskStatus).not.toHaveBeenCalled();
  });

  it("marks a task done and refreshes the page", async () => {
    await updateTaskStatus(form({ id: ID, status: "done" }));
    expect(mocks.setTaskStatus).toHaveBeenCalledWith({
      id: ID,
      status: "done",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/seo");
  });

  it("rejects a status or id it does not know", async () => {
    await expect(
      updateTaskStatus(form({ id: ID, status: "deleted" })),
    ).rejects.toThrow();
    await expect(
      updateTaskStatus(form({ id: "1 or 1=1", status: "done" })),
    ).rejects.toThrow();
    await expect(
      updatePieceStatus(form({ id: "1.1", status: "shipped" })),
    ).rejects.toThrow();
    expect(mocks.setTaskStatus).not.toHaveBeenCalled();
    expect(mocks.setPieceStatus).not.toHaveBeenCalled();
  });

  it("creates a task with blank optional fields stored as null", async () => {
    await addTask(
      form({
        title: "Fix title on /news/x",
        type: "optimize_ctr",
        priority: "high",
        url: "",
        owner: "",
        detail: "",
        due_date: "",
      }),
    );
    expect(mocks.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Fix title on /news/x",
        url: null,
        owner: null,
        due_date: null,
      }),
      "a@b.com",
    );
  });
});
