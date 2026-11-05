import { describe, expect, it } from "vitest";
import { asNoteDocument } from "./close-note";

describe("asNoteDocument", () => {
  it("wraps sibling top-level tags in one <body> (Close 400s otherwise)", () => {
    expect(asNoteDocument("<p>a</p><p>b</p>")).toBe(
      "<body><p>a</p><p>b</p></body>",
    );
  });
  it("self-closes <br> (Close parses note_html as XML)", () => {
    expect(asNoteDocument("<p>a<br>b<BR >c</p>")).toBe(
      "<body><p>a<br/>b<br/>c</p></body>",
    );
  });
  it("drops inline styles (Close rejects the attribute)", () => {
    expect(asNoteDocument('<p style="color:#999">ref</p>')).toBe(
      "<body><p>ref</p></body>",
    );
  });
  it("leaves an already-wrapped note alone", () => {
    expect(asNoteDocument("<body><p>a</p></body>")).toBe(
      "<body><p>a</p></body>",
    );
  });
});
