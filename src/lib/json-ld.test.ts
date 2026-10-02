import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./json-ld";

describe("jsonLdHtml", () => {
  it("never emits a raw < so a title cannot close the script element", () => {
    const html = jsonLdHtml({ name: "</script><img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<");
    expect(html.toLowerCase()).not.toContain("</script");
  });

  it("round-trips to the original value", () => {
    const value = {
      "@type": "Article",
      headline: "A </script> B & C",
      list: [1, "two", { three: "<3" }],
    };
    expect(JSON.parse(jsonLdHtml(value))).toEqual(value);
  });

  it("leaves ordinary JSON untouched", () => {
    expect(jsonLdHtml({ a: 1, b: "plain" })).toBe('{"a":1,"b":"plain"}');
  });
});
