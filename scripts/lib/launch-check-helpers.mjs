import { spawnSync } from "node:child_process";

export function requireValue(argv, index) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${argv[index]}`);
  }
  return value;
}

export function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

export function commandFailureDetail(child) {
  if (child.error) return child.error.message;
  return (child.stderr || child.stdout || `exit ${child.status}`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}
