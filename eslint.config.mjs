import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Standalone apps with their own toolchain, deployed as their own Vercel
    // projects. They are not part of this app's program: their `@/*` resolves
    // to their own src/, so linting or typechecking them from here reports
    // errors that do not exist.
    "apps/**",
    // Agent scratch worktrees. Nested checkouts with their own .next build
    // output; not part of this app's program.
    ".claude/worktrees/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "reports/**",
    ".stryker-tmp/**",
    "stryker.log",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
