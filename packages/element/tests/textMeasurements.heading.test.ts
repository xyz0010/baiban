import { FONT_FAMILY, getFontString } from "@excalidraw/common";
import { measureText } from "@excalidraw/element";

describe("measureText markdown headings", () => {
  it("scales width/height for # headings", () => {
    const font = getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Virgil });
    const lineHeight = 1.25 as any;
    const h1 = measureText("# Title", font, lineHeight, null);
    const plain = measureText("Title", font, lineHeight, null);
    expect(h1.width).toBeGreaterThanOrEqual(plain.width);
    expect(h1.height).toBeGreaterThan(plain.height);
  });
});
