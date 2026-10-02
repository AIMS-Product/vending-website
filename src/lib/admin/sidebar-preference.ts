/**
 * Whether the admin sidebar is collapsed. Every admin page renders its own
 * AdminShell, so the shell remounts on each navigation and a plain useState
 * forgot the choice on the next click.
 *
 * The choice is held in module memory (survives client navigations, where the
 * shell remounts but the module does not) and mirrored to localStorage (survives
 * a reload). The server always renders expanded; nothing here runs there.
 */
const STORAGE_KEY = "admin-sidebar-collapsed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

let remembered: boolean | null = null;
// A broken storage is reported once, not on every render.
let readFailed = false;

const listeners = new Set<() => void>();

/** For useSyncExternalStore: the shell re-renders when the choice changes. */
export function subscribeSidebarCollapsed(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The server snapshot: always expanded, so hydration matches the HTML. */
export function serverSidebarCollapsed(): boolean {
  return false;
}

/** The client snapshot: the in-memory choice, else the saved one, else expanded. */
export function currentSidebarCollapsed(storage?: StorageLike): boolean {
  return loadSidebarCollapsed(storage) ?? false;
}

/**
 * The saved choice from a previous visit. Null when none is saved. Only called
 * on the client, after hydration (useSyncExternalStore uses the server
 * snapshot until then).
 */
export function loadSidebarCollapsed(storage?: StorageLike): boolean | null {
  if (remembered !== null) return remembered;
  if (readFailed) return null;
  if (!storage && typeof window === "undefined") return null;
  try {
    const value = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    if (value === null) return null;
    remembered = value === "1";
    return remembered;
  } catch (error) {
    readFailed = true;
    console.warn("[admin] could not read the sidebar preference", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

export function saveSidebarCollapsed(
  collapsed: boolean,
  storage?: StorageLike,
): void {
  remembered = collapsed;
  listeners.forEach((listener) => listener());
  try {
    (storage ?? window.localStorage).setItem(
      STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  } catch (error) {
    // Private mode or a full quota: the choice still holds for this visit.
    console.warn("[admin] could not save the sidebar preference", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/** Test seam: forget the in-memory choice. */
export function resetSidebarPreferenceForTests(): void {
  remembered = null;
  readFailed = false;
}
