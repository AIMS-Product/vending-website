import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, HEAD } from "./route";

describe("GET /api/health", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers 200 ok with the short build sha and environment", async () => {
    vi.stubEnv(
      "VERCEL_GIT_COMMIT_SHA",
      "0123456789abcdef0123456789abcdef01234567",
    );
    vi.stubEnv("VERCEL_ENV", "production");
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      sha: "0123456",
      env: "production",
    });
  });

  it("still answers ok when no deployment metadata exists", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    vi.stubEnv("VERCEL_ENV", "");
    const res = GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sha).toBeNull();
  });

  it("leaks no environment values beyond sha and env name", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-value");
    const text = JSON.stringify(await GET().json());
    expect(text).not.toContain("super-secret-value");
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["env", "ok", "sha"]);
  });

  it("supports HEAD for monitors that use it", () => {
    expect(HEAD().status).toBe(200);
  });
});
