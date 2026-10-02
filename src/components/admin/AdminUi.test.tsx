import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminBar, AdminMetricPanel } from "./AdminUi";

describe("AdminMetricPanel", () => {
  it("groups thousands in a numeric value", () => {
    const html = renderToStaticMarkup(
      <AdminMetricPanel label="Booked" value={4276} caption="calls" />,
    );
    expect(html).toContain(">4,276<");
  });

  it("passes pre-formatted strings through untouched", () => {
    const html = renderToStaticMarkup(
      <AdminMetricPanel label="Rate" value="12%" caption="of leads" />,
    );
    expect(html).toContain(">12%<");
    const dash = renderToStaticMarkup(
      <AdminMetricPanel label="Rate" value="—" caption="no data" />,
    );
    expect(dash).toContain(">—<");
  });
});

describe("AdminBar", () => {
  it("draws nothing for a zero share instead of a full row", () => {
    const html = renderToStaticMarkup(<AdminBar share={0} />);
    expect(html).toContain("width:0");
  });
});
