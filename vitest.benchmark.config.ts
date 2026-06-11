import { defineConfig } from "vitest/config";
import fs from "node:fs";
import path from "node:path";

// Live AI model benchmark runner — `npm run ai-benchmark`. Loads real keys
// from .env.local (shell env wins) because the harness spends real money.
// The normal vitest.config.ts never includes scripts/, so this cannot leak
// into CI or the default suite.
function envLocal(): Record<string, string> {
  const file = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]!] === undefined) {
      out[match[1]!] = match[2]!;
    }
  }
  return out;
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest.server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["scripts/ai-benchmark/benchmark.test.ts"],
    env: envLocal(),
    testTimeout: 30 * 60 * 1000,
    hookTimeout: 60 * 1000,
  },
});
