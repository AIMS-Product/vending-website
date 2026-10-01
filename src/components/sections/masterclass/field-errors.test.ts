import { describe, expect, it } from "vitest";
import { liveErrors } from "./field-errors";

describe("liveErrors", () => {
  const errors = {
    email: "Enter a valid email",
    phone: "Enter a US or Canada mobile number",
    form: "We could not save your seat just now.",
  };

  it("shows every error until a field is edited", () => {
    expect(liveErrors(errors, new Set())).toEqual(errors);
  });

  it("hides only the errors of fields edited since the submit", () => {
    expect(liveErrors(errors, new Set(["email"]))).toEqual({
      phone: errors.phone,
      form: errors.form,
    });
  });

  it("never mutates the server's errors", () => {
    const copy = { ...errors };
    liveErrors(errors, new Set(["email", "phone"]));
    expect(errors).toEqual(copy);
  });
});
