// @ts-check

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
    related: true,
  },
  mutate: [
    "src/lib/page-builder/{blocks,content-ops,seo-readiness,structured-data-settings}.ts",
    "src/lib/services/{seo-pages,seo-page-public,leads,ai-page-proposals,openai-seo-agent}.ts",
    "src/app/admin/pages/actions.ts",
    "!src/**/*.test.ts",
    "!src/**/*.d.ts",
  ],
  reporters: ["progress", "clear-text", "html"],
  htmlReporter: {
    fileName: "reports/mutation/mutation.html",
  },
  tempDirName: ".stryker-tmp",
  ignoreStatic: true,
  ignorePatterns: [
    "coverage/**",
    "plans/**",
    "public/**",
    "supabase/**",
    "tmp-*",
  ],
};

export default config;
