import { describe, expect, it } from "vitest";

import {
  formatBlockingMessage,
  isNextServerCommand,
  parseFieldRecords,
} from "./guard-next-build.mjs";

describe("guard-next-build", () => {
  it("parses lsof field records", () => {
    expect(parseFieldRecords("p123\ncnode\np456\nn/tmp/project\n")).toEqual([
      { pid: "123", c: "node" },
      { pid: "456", n: "/tmp/project" },
    ]);
  });

  it("recognizes Next dev server commands", () => {
    expect(isNextServerCommand("next-server (v16.2.6)")).toBe(true);
    expect(isNextServerCommand("node ./node_modules/.bin/next dev")).toBe(
      true,
    );
    expect(isNextServerCommand("node scripts/check-launch-readiness.mjs")).toBe(
      false,
    );
  });

  it("explains the CSS failure mode in the blocking message", () => {
    expect(
      formatBlockingMessage([
        { pid: "123", command: "next-server (v16.2.6)" },
      ]),
    ).toContain("raw Times/8px browser styles");
  });
});
