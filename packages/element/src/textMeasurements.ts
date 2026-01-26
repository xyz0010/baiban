import {
  BOUND_TEXT_PADDING,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  getFontString,
  getStyledFontString,
  isTestEnv,
  normalizeEOL,
  parseInlineMarkdown,
  parseMarkdownToBlocks,
} from "@excalidraw/common";

import type { FontString, ExcalidrawTextElement } from "./types";

import { layoutMarkdownTable } from "./markdownTable";

export const measureText = (
  text: string,
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  maxWidth: number | null = null,
) => {
  const _text = text
    .split("\n")
    // replace empty lines with single space because leading/trailing empty
    // lines would be stripped from computation
    .map((x) => x || " ")
    .join("\n");
  const fontSize = parseFloat(font);
  const height = getTextHeight(_text, font, lineHeight, maxWidth);
  const width = getTextWidth(_text, font, maxWidth);
  return { width, height };
};

const DUMMY_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLocaleUpperCase();

// FIXME rename to getApproxMinContainerWidth
export const getApproxMinLineWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  const maxCharWidth = getMaxCharWidth(font);
  if (maxCharWidth === 0) {
    return (
      measureText(DUMMY_TEXT.split("").join("\n"), font, lineHeight).width +
      BOUND_TEXT_PADDING * 2
    );
  }
  return maxCharWidth + BOUND_TEXT_PADDING * 2;
};

export const getMinTextElementWidth = (
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return measureText("", font, lineHeight).width + BOUND_TEXT_PADDING * 2;
};

export const isMeasureTextSupported = () => {
  const width = getTextWidth(
    DUMMY_TEXT,
    getFontString({
      fontSize: DEFAULT_FONT_SIZE,
      fontFamily: DEFAULT_FONT_FAMILY,
    }),
  );
  return width > 0;
};

export const normalizeText = (text: string) => {
  return (
    normalizeEOL(text)
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
  );
};

const splitIntoBlocks = (text: string) => {
  return parseMarkdownToBlocks(normalizeText(text));
};

/**
 * To get unitless line-height (if unknown) we can calculate it by dividing
 * height-per-line by fontSize.
 */
export const detectLineHeight = (textElement: ExcalidrawTextElement) => {
  const lineCount = splitIntoBlocks(textElement.text).reduce((count, block) => {
    if (block.type === "line") {
      return count + 1;
    }
    const rowCount = block.table.rows.length;
    return count + Math.max(1, rowCount);
  }, 0);
  return (textElement.height /
    lineCount /
    textElement.fontSize) as ExcalidrawTextElement["lineHeight"];
};

/**
 * We calculate the line height from the font size and the unitless line height,
 * aligning with the W3C spec.
 */
export const getLineHeightInPx = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return fontSize * lineHeight;
};

// FIXME rename to getApproxMinContainerHeight
export const getApproxMinLineHeight = (
  fontSize: ExcalidrawTextElement["fontSize"],
  lineHeight: ExcalidrawTextElement["lineHeight"],
) => {
  return getLineHeightInPx(fontSize, lineHeight) + BOUND_TEXT_PADDING * 2;
};

let textMetricsProvider: TextMetricsProvider | undefined;

const getHeadingScale = (headingLevel: number) => {
  switch (headingLevel) {
    case 1:
      return 2;
    case 2:
      return 1.5;
    case 3:
      return 1.25;
    case 4:
      return 1;
    case 5:
      return 0.875;
    case 6:
      return 0.85;
    default:
      return 1;
  }
};

const scaleFontString = (font: FontString, scale: number): FontString => {
  if (scale === 1) {
    return font;
  }
  const fontSize = parseFloat(font);
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    return font;
  }
  const nextSize = fontSize * scale;
  return font.replace(/^(\d+(?:\.\d+)?)px\s+/, `${nextSize}px `) as FontString;
};

/**
 * Set a custom text metrics provider.
 *
 * Useful for overriding the width calculation algorithm where canvas API is not available / desired.
 */
export const setCustomTextMetricsProvider = (provider: TextMetricsProvider) => {
  textMetricsProvider = provider;
};

export interface TextMetricsProvider {
  getLineWidth(text: string, fontString: FontString): number;
}

class CanvasTextMetricsProvider implements TextMetricsProvider {
  private canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement("canvas");
  }

  /**
   * We need to use the advance width as that's the closest thing to the browser wrapping algo, hence using it for:
   * - text wrapping
   * - wysiwyg editor (+padding)
   *
   * > The advance width is the distance between the glyph's initial pen position and the next glyph's initial pen position.
   */
  public getLineWidth(text: string, fontString: FontString): number {
    const context = this.canvas.getContext("2d")!;
    context.font = fontString;
    const metrics = context.measureText(text);
    const advanceWidth = metrics.width;

    // since in test env the canvas measureText algo
    // doesn't measure text and instead just returns number of
    // characters hence we assume that each letteris 10px
    if (isTestEnv()) {
      return advanceWidth * 10;
    }

    return advanceWidth;
  }
}

export const getLineWidth = (text: string, font: FontString) => {
  if (!textMetricsProvider) {
    textMetricsProvider = new CanvasTextMetricsProvider();
  }

  const headingMatch = text.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2];
    const headingFont = scaleFontString(font, getHeadingScale(level));
    const runs = parseInlineMarkdown(content).map((r) => ({ ...r, bold: true }));
    let width = 0;
    for (const run of runs) {
      if (!run.text) {
        continue;
      }
      const styledFontString = getStyledFontString(headingFont, run) as FontString;
      width += textMetricsProvider.getLineWidth(run.text, styledFontString);
    }
    return width;
  }

  const runs = parseInlineMarkdown(text);
  if (
    runs.length === 1 &&
    runs[0].text === text &&
    !runs[0].bold &&
    !runs[0].italic &&
    !runs[0].strikethrough &&
    !runs[0].underline &&
    !runs[0].code &&
    !runs[0].link
  ) {
    return textMetricsProvider.getLineWidth(text, font);
  }

  let width = 0;
  for (const run of runs) {
    if (!run.text) {
      continue;
    }
    const styledFontString = getStyledFontString(font, run) as FontString;
    width += textMetricsProvider.getLineWidth(run.text, styledFontString);
  }

  return width;
};

export const getTextWidth = (
  text: string,
  font: FontString,
  maxWidth: number | null = null,
) => {
  if (!textMetricsProvider) {
    textMetricsProvider = new CanvasTextMetricsProvider();
  }
  const blocks = splitIntoBlocks(text);
  let width = 0;
  const fontSize = parseFloat(font);
  const approxLineHeightPx = fontSize * 1.25;
  blocks.forEach((block) => {
    if (block.type === "line") {
      const indentPx = block.line.indentEm * fontSize;
      let contentWidth = 0;
      const headingScale = getHeadingScale(block.line.headingLevel);
      const lineFont = scaleFontString(font, headingScale);
      for (const run of block.line.runs) {
        if (!run.text) {
          continue;
        }
        const styledFontString = getStyledFontString(lineFont, run) as FontString;
        contentWidth += textMetricsProvider!.getLineWidth(run.text, styledFontString);
      }
      width = Math.max(width, indentPx + contentWidth);
      return;
    }

    const indentPx = block.indentEm * fontSize;
    const availableWidth =
      maxWidth == null ? null : Math.max(0, maxWidth - indentPx);
    const layout = layoutMarkdownTable({
      table: block.table,
      baseFont: font,
      fontSize,
      lineHeightPx: approxLineHeightPx,
      maxWidth: availableWidth,
      headerBold: true,
    });
    width = Math.max(width, indentPx + layout.width);
  });

  return width;
};

export const getTextHeight = (
  text: string,
  font: FontString,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  maxWidth: number | null = null,
) => {
  const fontSize = parseFloat(font);
  const baseLineHeightPx = getLineHeightInPx(fontSize, lineHeight);
  const blocks = splitIntoBlocks(text);
  let height = 0;
  for (const block of blocks) {
    if (block.type === "line") {
      const headingScale = getHeadingScale(block.line.headingLevel);
      height += getLineHeightInPx(fontSize * headingScale, lineHeight);
      continue;
    }
    const indentPx = block.indentEm * fontSize;
    const availableWidth =
      maxWidth == null ? null : Math.max(0, maxWidth - indentPx);
    const layout = layoutMarkdownTable({
      table: block.table,
      baseFont: font,
      fontSize,
      lineHeightPx: baseLineHeightPx,
      maxWidth: availableWidth,
      headerBold: true,
    });
    height += layout.height + Math.round(baseLineHeightPx * 0.2);
  }
  return height;
};

export const charWidth = (() => {
  const cachedCharWidth: { [key: FontString]: Array<number> } = {};

  const calculate = (char: string, font: FontString) => {
    const unicode = char.charCodeAt(0);
    if (!cachedCharWidth[font]) {
      cachedCharWidth[font] = [];
    }
    if (!cachedCharWidth[font][unicode]) {
      const width = getLineWidth(char, font);
      cachedCharWidth[font][unicode] = width;
    }

    return cachedCharWidth[font][unicode];
  };

  const getCache = (font: FontString) => {
    return cachedCharWidth[font];
  };

  const clearCache = (font: FontString) => {
    cachedCharWidth[font] = [];
  };

  return {
    calculate,
    getCache,
    clearCache,
  };
})();

export const getMinCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);

  return Math.min(...cacheWithOutEmpty);
};

export const getMaxCharWidth = (font: FontString) => {
  const cache = charWidth.getCache(font);
  if (!cache) {
    return 0;
  }
  const cacheWithOutEmpty = cache.filter((val) => val !== undefined);
  return Math.max(...cacheWithOutEmpty);
};
