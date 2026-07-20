import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteLead, retryCloseSyncEvent } from "./actions";

const mocks = vi.hoisted(() => {
  class LeadAdminServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "LeadAdminServiceError";
    }
  }

  return {
    LeadAdminServiceError,
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    adminRetryCloseSyncEvent: vi.fn(),
    adminDeleteLead: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/services/lead-admin", () => ({
  LeadAdminServiceError: mocks.LeadAdminServiceError,
  adminRetryCloseSyncEvent: mocks.adminRetryCloseSyncEvent,
  adminDeleteLead: mocks.adminDeleteLead,
}));

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "admin-1", email: "admin@example.com" },
    role: "admin",
  });
  mocks.adminRetryCloseSyncEvent.mockResolvedValue({
    status: "queued",
    eventId: "event_1",
    leadId: "lead_1",
  });
  mocks.adminDeleteLead.mockResolvedValue({
    status: "deleted",
    leadId: "lead_1",
  });
});

describe("retryCloseSyncEvent", () => {
  it("requires admin access, requeues the event, and revalidates lead admin routes", async () => {
    const result = await retryCloseSyncEvent(
      { status: "idle" },
      formData({ eventId: "event_1", leadId: "lead_1" }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Close sync retry queued.",
    });
    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.adminRetryCloseSyncEvent).toHaveBeenCalledWith({
      eventId: "event_1",
      requestedBy: "admin-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/leads");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/leads/lead_1");
  });

  it("returns service validation messages without leaking implementation details", async () => {
    mocks.adminRetryCloseSyncEvent.mockRejectedValue(
      new mocks.LeadAdminServiceError("Synced Close events cannot be retried."),
    );

    const result = await retryCloseSyncEvent(
      { status: "idle" },
      formData({ eventId: "event_1", leadId: "lead_1" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Synced Close events cannot be retried.",
    });
  });
});

describe("deleteLead", () => {
  it("requires admin, deletes the lead, revalidates, and redirects to the list", async () => {
    await deleteLead({ status: "idle" }, formData({ leadId: "lead_1" }));

    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.adminDeleteLead).toHaveBeenCalledWith({ leadId: "lead_1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/leads");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/leads?deleted=1");
  });

  it("rejects a missing lead id without calling the service", async () => {
    const result = await deleteLead({ status: "idle" }, formData({}));

    expect(result.status).toBe("error");
    expect(mocks.adminDeleteLead).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns the service error message and does not redirect", async () => {
    mocks.adminDeleteLead.mockRejectedValue(
      new mocks.LeadAdminServiceError("Lead not found."),
    );

    const result = await deleteLead(
      { status: "idle" },
      formData({ leadId: "missing" }),
    );

    expect(result).toEqual({ status: "error", message: "Lead not found." });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
