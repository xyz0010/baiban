import { FONT_FAMILY, getFontString } from "@excalidraw/common";
import { measureText } from "@excalidraw/element";

describe("measureText markdown tables", () => {
  it("wraps table cell content when constrained by maxWidth", () => {
    const text = `| Mode | Pros | Cons |
| --- | --- | --- |
| Very very very very long text | ok | ok |`;

    const font = getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Virgil });
    const lineHeight = 1.25 as any;
    const unconstrained = measureText(text, font, lineHeight, null);
    const constrained = measureText(text, font, lineHeight, 180);

    expect(constrained.width).toBeLessThanOrEqual(180);
    expect(constrained.height).toBeGreaterThan(unconstrained.height);
  });
});
