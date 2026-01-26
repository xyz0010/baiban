import {
  getStyledFontString,
  parseInlineMarkdown,
  type InlineMarkdownRun,
  type MarkdownTable,
  type MarkdownTableAlignment,
} from "@excalidraw/common";

import type { FontString } from "./types";

import { getLineWidth } from "./textMeasurements";
import { wrapText } from "./textWrapping";

export type MarkdownTableCellLayout = {
  textLines: string[];
  runsByLine: InlineMarkdownRun[][];
};

export type MarkdownTableLayout = {
  width: number;
  height: number;
  colWidths: number[];
  rowHeights: number[];
  cells: MarkdownTableCellLayout[][];
  borderWidth: number;
  paddingX: number;
  paddingY: number;
  hasHeader: boolean;
};

const normalizeCellText = (text: string) => {
  return text.replace(/<br\s*\/?>/gi, "\n");
};

const measureRunsWidth = (runs: InlineMarkdownRun[], baseFont: FontString) => {
  let width = 0;
  for (const run of runs) {
    if (!run.text) {
      continue;
    }
    const styledFontString = getStyledFontString(baseFont, run) as FontString;
    width += getLineWidth(run.text, styledFontString);
  }
  return width;
};

const computeLineWidth = (textLine: string, baseFont: FontString) => {
  const runs = parseInlineMarkdown(textLine);
  return measureRunsWidth(runs, baseFont);
};

const padToMin = (value: number, min: number) => Math.max(min, value);

export const layoutMarkdownTable = ({
  table,
  baseFont,
  fontSize,
  lineHeightPx,
  maxWidth,
  headerBold,
}: {
  table: MarkdownTable;
  baseFont: FontString;
  fontSize: number;
  lineHeightPx: number;
  maxWidth: number | null;
  headerBold: boolean;
}): MarkdownTableLayout => {
  const borderWidth = 1;
  const paddingX = Math.max(4, Math.round(fontSize * 0.4));
  const paddingY = Math.max(2, Math.round(fontSize * 0.2));

  const rows = table.rows;
  const colCount = Math.max(...rows.map((r) => r.length), 0);
  const alignments: MarkdownTableAlignment[] =
    table.alignments.length === colCount
      ? table.alignments
      : new Array(colCount).fill("left");

  const minColWidth = padToMin(fontSize, 28);
  const colWidths = new Array(colCount).fill(minColWidth);

  const wrappedCells: MarkdownTableCellLayout[][] = [];

  for (let r = 0; r < rows.length; r++) {
    wrappedCells[r] = [];
    for (let c = 0; c < colCount; c++) {
      const cellText = normalizeCellText(rows[r][c] ?? "");
      wrappedCells[r][c] = {
        textLines: cellText === "" ? [""] : cellText.split("\n"),
        runsByLine: [],
      };
    }
  }

  for (let c = 0; c < colCount; c++) {
    let maxCellWidth = minColWidth;
    for (let r = 0; r < rows.length; r++) {
      for (const line of wrappedCells[r][c].textLines) {
        maxCellWidth = Math.max(maxCellWidth, computeLineWidth(line, baseFont));
      }
    }
    colWidths[c] = Math.max(minColWidth, Math.ceil(maxCellWidth) + paddingX * 2);
  }

  const totalBorders = borderWidth * (colCount + 1);
  const availableWidth =
    maxWidth == null ? null : Math.max(0, maxWidth - totalBorders);

  if (availableWidth != null) {
    const sum = () => colWidths.reduce((a, b) => a + b, 0);
    const total = sum();
    if (total > availableWidth) {
      const minTotal = colCount * minColWidth;
      const target = Math.max(minTotal, availableWidth);
      let remainingToShrink = total - target;
      const shrinkables = colWidths.map((w) => w - minColWidth);
      while (remainingToShrink > 0) {
        let changed = false;
        for (let c = 0; c < colCount && remainingToShrink > 0; c++) {
          if (shrinkables[c] > 0) {
            colWidths[c] -= 1;
            shrinkables[c] -= 1;
            remainingToShrink -= 1;
            changed = true;
          }
        }
        if (!changed) {
          break;
        }
      }
    }
  }

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < colCount; c++) {
      const innerWidth = Math.max(1, colWidths[c] - paddingX * 2);
      const wrapped = wrapText(
        normalizeCellText(rows[r][c] ?? ""),
        baseFont,
        innerWidth,
      );
      const textLines = wrapped.split("\n");
      const isHeaderRow = table.hasHeader && r === 0;
      const runsByLine = textLines.map((line) => {
        const runs = parseInlineMarkdown(line);
        if (isHeaderRow && headerBold) {
          return runs.map((run) => ({ ...run, bold: true }));
        }
        return runs;
      });
      wrappedCells[r][c] = { textLines, runsByLine };
    }
  }

  const rowHeights = new Array(rows.length).fill(lineHeightPx + paddingY * 2);
  for (let r = 0; r < rows.length; r++) {
    let maxLines = 1;
    for (let c = 0; c < colCount; c++) {
      maxLines = Math.max(maxLines, wrappedCells[r][c].textLines.length);
    }
    rowHeights[r] = maxLines * lineHeightPx + paddingY * 2;
  }

  const width =
    colWidths.reduce((a, b) => a + b, 0) + borderWidth * (colCount + 1);
  const height =
    rowHeights.reduce((a, b) => a + b, 0) + borderWidth * (rows.length + 1);

  return {
    width,
    height,
    colWidths,
    rowHeights,
    cells: wrappedCells,
    borderWidth,
    paddingX,
    paddingY,
    hasHeader: table.hasHeader,
  };
};

export const computeTableCellX = (
  colWidths: number[],
  borderWidth: number,
  colIndex: number,
) => {
  let x = borderWidth;
  for (let c = 0; c < colIndex; c++) {
    x += colWidths[c] + borderWidth;
  }
  return x;
};

export const computeTableCellY = (
  rowHeights: number[],
  borderWidth: number,
  rowIndex: number,
) => {
  let y = borderWidth;
  for (let r = 0; r < rowIndex; r++) {
    y += rowHeights[r] + borderWidth;
  }
  return y;
};

export const computeAlignedTextX = ({
  cellX,
  cellWidth,
  paddingX,
  align,
  textWidth,
}: {
  cellX: number;
  cellWidth: number;
  paddingX: number;
  align: MarkdownTableAlignment;
  textWidth: number;
}) => {
  if (align === "right") {
    return cellX + cellWidth - paddingX - textWidth;
  }
  if (align === "center") {
    return cellX + cellWidth / 2 - textWidth / 2;
  }
  return cellX + paddingX;
};

export const measureCellLineWidth = (
  runs: InlineMarkdownRun[],
  baseFont: FontString,
) => {
  return measureRunsWidth(runs, baseFont);
};

