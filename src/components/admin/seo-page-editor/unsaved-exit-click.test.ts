import { describe, expect, it, vi } from "vitest";
import {
  formPassesSaveValidation,
  isPlainNavigationClick,
} from "./useUnsavedExitGuard";

// isPlainNavigationClick only reads numeric/boolean fields of the event, so a
// plain object stands in for a real MouseEvent without needing a DOM env.
function clickEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...overrides,
  } as MouseEvent;
}

describe("isPlainNavigationClick", () => {
  it("accepts a plain unmodified left click", () => {
    expect(isPlainNavigationClick(clickEvent())).toBe(true);
  });

  it("ignores middle/right clicks", () => {
    expect(isPlainNavigationClick(clickEvent({ button: 1 }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ button: 2 }))).toBe(false);
  });

  it("ignores modifier-key clicks (open in new tab / window)", () => {
    expect(isPlainNavigationClick(clickEvent({ metaKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ ctrlKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ shiftKey: true }))).toBe(false);
    expect(isPlainNavigationClick(clickEvent({ altKey: true }))).toBe(false);
  });

  it("ignores clicks another handler already prevented", () => {
    expect(isPlainNavigationClick(clickEvent({ defaultPrevented: true }))).toBe(
      false,
    );
  });
});

// formPassesSaveValidation only calls checkValidity/reportValidity, so a plain
// object stands in for the real form without needing a DOM env.
function formStub(valid: boolean) {
  return {
    checkValidity: vi.fn(() => valid),
    reportValidity: vi.fn(),
  };
}

describe("formPassesSaveValidation", () => {
  it("allows navigation when the form passes native validation", () => {
    const form = formStub(true);
    expect(formPassesSaveValidation(form)).toBe(true);
    expect(form.reportValidity).not.toHaveBeenCalled();
  });

  it("blocks navigation and surfaces field hints when validation fails", () => {
    const form = formStub(false);
    expect(formPassesSaveValidation(form)).toBe(false);
    expect(form.reportValidity).toHaveBeenCalledTimes(1);
  });

  it("falls back to allowing navigation when no form is found", () => {
    expect(formPassesSaveValidation(null)).toBe(true);
  });
});
