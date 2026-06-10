import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBuilderRedirectAction,
  deleteBuilderRedirectAction,
  updateBuilderRedirectAction,
} from "./actions";
import { SeoPageValidationError } from "@/lib/services/seo-pages";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  adminCreateBuilderRedirect: vi.fn(),
  adminUpdateBuilderRedirect: vi.fn(),
  adminDeleteBuilderRedirect: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/services/seo-pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/seo-pages")
  >("@/lib/services/seo-pages");
  return {
    ...actual,
    adminCreateBuilderRedirect: mocks.adminCreateBuilderRedirect,
    adminUpdateBuilderRedirect: mocks.adminUpdateBuilderRedirect,
    adminDeleteBuilderRedirect: mocks.adminDeleteBuilderRedirect,
  };
});

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "admin-1", email: "admin@example.com" },
    role: "admin",
  });
});

describe("createBuilderRedirectAction", () => {
  it("requires admin before creating", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("not allowed"));

    await expect(
      createBuilderRedirectAction(
        { status: "idle" },
        form({ sourcePath: "/blog/old", destinationPath: "/blog/new" }),
      ),
    ).rejects.toThrow();
    expect(mocks.adminCreateBuilderRedirect).not.toHaveBeenCalled();
  });

  it("returns an inline source error and persists nothing on a blank path", async () => {
    const result = await createBuilderRedirectAction(
      { status: "idle" },
      form({ sourcePath: "", destinationPath: "/blog/new", statusCode: "301" }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: expect.objectContaining({
          sourcePath: expect.any(String),
        }),
      }),
    );
    expect(mocks.adminCreateBuilderRedirect).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("echoes the submitted values back so the form can preserve them", async () => {
    mocks.adminCreateBuilderRedirect.mockRejectedValueOnce(
      new SeoPageValidationError([
        {
          code: "invalid_redirect_source",
          path: "source_path",
          message: "Builder redirect sources must be builder page paths.",
        },
      ]),
    );

    const result = await createBuilderRedirectAction(
      { status: "idle" },
      form({
        sourcePath: "/about",
        destinationPath: "/blog/keep-me",
        statusCode: "302",
      }),
    );

    expect(result).toMatchObject({
      status: "error",
      values: {
        sourcePath: "/about",
        destinationPath: "/blog/keep-me",
        statusCode: "302",
      },
    });
  });

  it("maps a service validation issue onto the destination field", async () => {
    mocks.adminCreateBuilderRedirect.mockRejectedValueOnce(
      new SeoPageValidationError([
        {
          code: "invalid_redirect_destination",
          path: "destination_path",
          message:
            "Redirect destination must be an internal path or http(s) URL.",
        },
      ]),
    );

    const result = await createBuilderRedirectAction(
      { status: "idle" },
      form({
        sourcePath: "/blog/old",
        destinationPath: "not-a-path",
        statusCode: "301",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        fieldErrors: {
          destinationPath:
            "Redirect destination must be an internal path or http(s) URL.",
        },
      }),
    );
  });

  it("does not leak internal errors to the client", async () => {
    mocks.adminCreateBuilderRedirect.mockRejectedValueOnce(
      new Error("connection to db_internal_host failed"),
    );

    const result = await createBuilderRedirectAction(
      { status: "idle" },
      form({
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: "301",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Could not create redirect.",
    });
  });

  it("revalidates and redirects on success", async () => {
    mocks.adminCreateBuilderRedirect.mockResolvedValueOnce({ id: "r1" });

    await createBuilderRedirectAction(
      { status: "idle" },
      form({
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: "301",
      }),
    );

    expect(mocks.adminCreateBuilderRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: 301,
        createdBy: "admin-1",
        createdReason: "manual",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages/redirects");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages/redirects?created=1",
    );
  });
});

describe("updateBuilderRedirectAction", () => {
  it("requires an id before updating", async () => {
    const result = await updateBuilderRedirectAction(
      { status: "idle" },
      form({
        id: "",
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: "301",
      }),
    );

    expect(result.status).toBe("error");
    expect(mocks.adminUpdateBuilderRedirect).not.toHaveBeenCalled();
  });

  it("surfaces a not-found service error as a plain message", async () => {
    mocks.adminUpdateBuilderRedirect.mockRejectedValueOnce(
      new SeoPageValidationError([
        {
          code: "redirect_not_found",
          path: "id",
          message: "That redirect no longer exists. Refresh and try again.",
        },
      ]),
    );

    const result = await updateBuilderRedirectAction(
      { status: "idle" },
      form({
        id: "r-missing",
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: "301",
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: "error",
        message: "That redirect no longer exists. Refresh and try again.",
      }),
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects on a successful update", async () => {
    mocks.adminUpdateBuilderRedirect.mockResolvedValueOnce({ id: "r1" });

    await updateBuilderRedirectAction(
      { status: "idle" },
      form({
        id: "r1",
        sourcePath: "/blog/old",
        destinationPath: "/blog/new",
        statusCode: "302",
      }),
    );

    expect(mocks.adminUpdateBuilderRedirect).toHaveBeenCalledWith({
      id: "r1",
      sourcePath: "/blog/old",
      destinationPath: "/blog/new",
      statusCode: 302,
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages/redirects?updated=1",
    );
  });
});

describe("deleteBuilderRedirectAction", () => {
  it("requires an id before deleting", async () => {
    const result = await deleteBuilderRedirectAction(
      { status: "idle" },
      form({ id: "" }),
    );

    expect(result.status).toBe("error");
    expect(mocks.adminDeleteBuilderRedirect).not.toHaveBeenCalled();
  });

  it("deletes, revalidates, and redirects on success", async () => {
    mocks.adminDeleteBuilderRedirect.mockResolvedValueOnce({ id: "r1" });

    await deleteBuilderRedirectAction({ status: "idle" }, form({ id: "r1" }));

    expect(mocks.adminDeleteBuilderRedirect).toHaveBeenCalledWith("r1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/pages/redirects");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages/redirects?deleted=1",
    );
  });

  it("surfaces a not-found delete as a plain message", async () => {
    mocks.adminDeleteBuilderRedirect.mockRejectedValueOnce(
      new SeoPageValidationError([
        {
          code: "redirect_not_found",
          path: "id",
          message: "That redirect no longer exists. Refresh and try again.",
        },
      ]),
    );

    const result = await deleteBuilderRedirectAction(
      { status: "idle" },
      form({ id: "r-missing" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "That redirect no longer exists. Refresh and try again.",
    });
  });
});
