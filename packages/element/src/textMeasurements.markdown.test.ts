import { FONT_FAMILY, getFontString } from "@excalidraw/common";
import { getLineWidth } from "@excalidraw/element";

describe("@excalidraw/element/textMeasurements markdown", () => {
  it("measures rendered markdown text width (markers excluded)", () => {
    const font = getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Virgil });
    expect(getLineWidth("**a**", font)).toBe(getLineWidth("a", font));
    expect(getLineWidth("a **b** c", font)).toBe(getLineWidth("a b c", font));
    expect(getLineWidth("`a`", font)).toBe(getLineWidth("a", font));
  });
});

