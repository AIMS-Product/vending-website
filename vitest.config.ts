import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest.server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    // Satisfy `src/lib/config.ts`'s Zod schema at module load. The clients
    // themselves are never instantiated in tests — auth.test.ts injects
    // mock Supabase clients — so these placeholders never hit the network.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "vitest_anon_key_placeholder______",
      SUPABASE_SERVICE_ROLE_KEY: "vitest_service_role_key_placeholder______",
    },
  },
});
