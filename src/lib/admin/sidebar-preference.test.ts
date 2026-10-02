import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentSidebarCollapsed,
  serverSidebarCollapsed,
  subscribeSidebarCollapsed,
  loadSidebarCollapsed,
  resetSidebarPreferenceForTests,
  saveSidebarCollapsed,
} from "./sidebar-preference";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("sidebar preference", () => {
  beforeEach(() => resetSidebarPreferenceForTests());

  it("starts expanded when nothing was chosen", () => {
    expect(currentSidebarCollapsed(memoryStorage())).toBe(false);
    expect(loadSidebarCollapsed(memoryStorage())).toBeNull();
  });

  it("renders expanded on the server", () => {
    saveSidebarCollapsed(true, memoryStorage());
    expect(serverSidebarCollapsed()).toBe(false);
  });

  it("tells subscribers when the choice changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSidebarCollapsed(listener);
    saveSidebarCollapsed(true, memoryStorage());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    saveSidebarCollapsed(false, memoryStorage());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("remembers a choice across remounts without touching storage", () => {
    saveSidebarCollapsed(true, memoryStorage());
    expect(currentSidebarCollapsed(memoryStorage())).toBe(true);
    saveSidebarCollapsed(false, memoryStorage());
    expect(currentSidebarCollapsed(memoryStorage())).toBe(false);
  });

  it("restores the saved choice after a reload", () => {
    const storage = memoryStorage({ "admin-sidebar-collapsed": "1" });
    expect(loadSidebarCollapsed(storage)).toBe(true);
    expect(currentSidebarCollapsed(memoryStorage())).toBe(true);
  });

  it("logs and keeps working when storage is unavailable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadSidebarCollapsed(broken)).toBeNull();
    saveSidebarCollapsed(true, broken);
    expect(currentSidebarCollapsed(memoryStorage())).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
