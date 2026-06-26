import type { Json } from "@/types/database";

export function jsonObjectAt(value: Json, key: string): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const child = value[key];
  if (!child || typeof child !== "object" || Array.isArray(child)) return {};
  return child as Record<string, Json>;
}

export function jsonArrayAt(value: Json, key: string): Json[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const child = value[key];
  return Array.isArray(child) ? child : [];
}

export function jsonStringAt(value: Record<string, Json>, key: string) {
  const result = value[key];
  if (typeof result === "string" && result.trim()) return result;
  if (typeof result === "number" || typeof result === "boolean") {
    return String(result);
  }
  return null;
}
