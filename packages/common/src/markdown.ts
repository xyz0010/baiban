import { FONT_FAMILY } from "./constants";
import { getFontFamilyString } from "./utils";

export type InlineMarkdownRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
  link: string | null;
};

export type MarkdownLine = {
  runs: InlineMarkdownRun[];
  indentEm: number;
  blockquote: boolean;
  headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  isCodeBlock: boolean;
};

export type MarkdownTableAlignment = "left" | "center" | "right";

export type MarkdownTable = {
  rows: string[][];
  alignments: MarkdownTableAlignment[];
  hasHeader: boolean;
};

export type MarkdownBlock =
  | {
      type: "line";
      line: MarkdownLine;
    }
  | {
      type: "table";
      table: MarkdownTable;
      indentEm: number;
      blockquote: boolean;
    };

const hasClosingMarker = (text: string, fromIndex: number, marker: string) => {
  return text.indexOf(marker, fromIndex) !== -1;
};

const shouldTreatSingleMarkerAsDelimiter = (
  text: string,
  index: number,
  marker: string,
) => {
  const next = text[index + marker.length] ?? "";
  if (next === " " || next === "\t" || next === "\n") {
    return false;
  }
  return true;
};

export const parseInlineMarkdown = (line: string): InlineMarkdownRun[] => {
  const runs: InlineMarkdownRun[] = [];

  let bold = false;
  let italic = false;
  let strikethrough = false;
  let underline = false;
  let code = false;
  let link: string | null = null;

  let buffer = "";

  const flush = () => {
    if (!buffer) {
      return;
    }
    runs.push({
      text: buffer,
      bold,
      italic,
      strikethrough,
      underline,
      code,
      link,
    });
    buffer = "";
  };

  const toggleHtmlTag = (tagName: string, enabled: boolean) => {
    switch (tagName) {
      case "strong":
        bold = enabled;
        break;
      case "b":
        bold = enabled;
        break;
      case "em":
        italic = enabled;
        break;
      case "i":
        italic = enabled;
        break;
      case "del":
        strikethrough = enabled;
        break;
      case "s":
        strikethrough = enabled;
        break;
      case "u":
        underline = enabled;
        break;
      case "code":
        code = enabled;
        break;
      default:
        break;
    }
  };

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === "\\" && i + 1 < line.length) {
      buffer += line[i + 1];
      i++;
      continue;
    }

    if (!code && char === "<") {
      const closeIndex = line.indexOf(">", i + 1);
      if (closeIndex !== -1) {
        const rawTag = line.slice(i + 1, closeIndex).trim();
        const isClosing = rawTag.startsWith("/");
        const tagName = (isClosing ? rawTag.slice(1) : rawTag)
          .toLowerCase()
          .split(/\s+/)[0];
        if (
          tagName === "strong" ||
          tagName === "b" ||
          tagName === "em" ||
          tagName === "i" ||
          tagName === "del" ||
          tagName === "s" ||
          tagName === "u" ||
          tagName === "code"
        ) {
          flush();
          toggleHtmlTag(tagName, !isClosing);
          i = closeIndex;
          continue;
        }
      }
    }

    if (!code) {
      if (line.startsWith("![", i)) {
        const endAlt = line.indexOf("]", i + 2);
        if (endAlt !== -1 && line[endAlt + 1] === "(") {
          const endUrl = line.indexOf(")", endAlt + 2);
          if (endUrl !== -1) {
            flush();
            const alt = line.slice(i + 2, endAlt);
            buffer += alt || "[image]";
            flush();
            i = endUrl;
            continue;
          }
        }
      }

      if (line.startsWith("[", i)) {
        const endText = line.indexOf("]", i + 1);
        if (endText !== -1 && line[endText + 1] === "(") {
          const endUrl = line.indexOf(")", endText + 2);
          if (endUrl !== -1) {
            flush();
            const text = line.slice(i + 1, endText);
            const url = line.slice(endText + 2, endUrl);
            const savedLink: string | null = link;
            const savedUnderline: boolean = underline;
            link = url || null;
            underline = true;
            buffer += text;
            flush();
            link = savedLink;
            underline = savedUnderline;
            i = endUrl;
            continue;
          }
        }
      }

      if (line.startsWith("**", i)) {
        if (bold || hasClosingMarker(line, i + 2, "**")) {
          flush();
          bold = !bold;
          i++;
          continue;
        }
        buffer += "**";
        i++;
        continue;
      }

      if (line.startsWith("__", i)) {
        if (bold || hasClosingMarker(line, i + 2, "__")) {
          flush();
          bold = !bold;
          i++;
          continue;
        }
        buffer += "__";
        i++;
        continue;
      }

      if (line.startsWith("~~", i)) {
        if (strikethrough || hasClosingMarker(line, i + 2, "~~")) {
          flush();
          strikethrough = !strikethrough;
          i++;
          continue;
        }
        buffer += "~~";
        i++;
        continue;
      }

      if (char === "`") {
        if (hasClosingMarker(line, i + 1, "`")) {
          flush();
          code = !code;
          continue;
        }
        buffer += "`";
        continue;
      }

      if (char === "*" || char === "_") {
        if (
          italic ||
          (shouldTreatSingleMarkerAsDelimiter(line, i, char) &&
            hasClosingMarker(line, i + 1, char))
        ) {
          flush();
          italic = !italic;
          continue;
        }
      }
    } else if (char === "`") {
      flush();
      code = !code;
      continue;
    }

    buffer += char;
  }

  flush();
  return runs;
};

const getVisibleText = (text: string) => {
  return parseInlineMarkdown(text)
    .map((r) => r.text)
    .join("");
};

const isCombiningMark = (codePoint: number) => {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
  );
};

const isWide = (codePoint: number) => {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
};

const getDisplayWidth = (text: string) => {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0) {
      continue;
    }
    if (isCombiningMark(cp)) {
      continue;
    }
    width += isWide(cp) ? 2 : 1;
  }
  return width;
};

const padCellByDisplayWidth = (text: string, width: number, align: TableAlign) => {
  const raw = text;
  const len = getDisplayWidth(raw);
  const spaceCount = Math.max(0, width - len);
  if (align === "right") {
    return " ".repeat(spaceCount) + raw;
  }
  if (align === "center") {
    const left = Math.floor(spaceCount / 2);
    const right = spaceCount - left;
    return " ".repeat(left) + raw + " ".repeat(right);
  }
  return raw + " ".repeat(spaceCount);
};

const splitTableRow = (row: string): string[] | null => {
  let s = row.trim();
  if (!s.includes("|")) {
    return null;
  }

  if (s.startsWith("|")) {
    s = s.slice(1);
  }
  if (s.endsWith("|")) {
    s = s.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
};

type TableAlign = "left" | "center" | "right";

const parseTableAlignmentRow = (row: string): TableAlign[] | null => {
  const cells = splitTableRow(row);
  if (!cells) {
    return null;
  }
  const aligns: TableAlign[] = [];
  for (const cell of cells) {
    const trimmed = cell.replace(/\s+/g, "");
    if (!/^:?-{1,}:?$/.test(trimmed)) {
      return null;
    }
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    aligns.push(left && right ? "center" : right ? "right" : "left");
  }
  return aligns;
};

const buildBoxTableLines = ({
  rows,
  alignments,
  linePrefix,
}: {
  rows: string[][];
  alignments: TableAlign[];
  linePrefix: string;
}): string[] => {
  if (rows.length === 0) {
    return [];
  }
  const colCount = Math.max(...rows.map((r) => r.length));
  if (colCount === 0) {
    return [];
  }

  const widths = new Array(colCount).fill(3);
  rows.forEach((r) => {
    for (let c = 0; c < colCount; c++) {
      const visible = getVisibleText(r[c] ?? "");
      widths[c] = Math.max(widths[c], getDisplayWidth(visible) || 0);
    }
  });

  const segs = widths.map((w) => "-".repeat(Math.max(3, w) + 2));
  const top = `${linePrefix}+${segs.join("+")}+`;
  const mid = `${linePrefix}+${segs.join("+")}+`;
  const bottom = `${linePrefix}+${segs.join("+")}+`;

  const rowToLine = (cells: string[]) => {
    const parts: string[] = [];
    for (let c = 0; c < colCount; c++) {
      const width = Math.max(3, widths[c]);
      const align = alignments[c] ?? "left";
      const text = getVisibleText(cells[c] ?? "");
      parts.push(` ${padCellByDisplayWidth(text, width, align)} `);
    }
    return linePrefix + "|" + parts.join("|") + "|";
  };

  const out: string[] = [];
  out.push(top);
  out.push(rowToLine(rows[0]));
  out.push(mid);
  for (let r = 1; r < rows.length; r++) {
    out.push(rowToLine(rows[r]));
    if (r !== rows.length - 1) {
      out.push(mid);
    }
  }
  out.push(bottom);
  return out;
};

const parseHtmlTableToRows = (inputLines: string[], startIndex: number) => {
  const collected: string[] = [];
  let endIndex = startIndex;
  for (let j = startIndex; j < inputLines.length; j++) {
    collected.push(inputLines[j]);
    if (inputLines[j].includes("</table>")) {
      endIndex = j;
      break;
    }
  }

  const html = collected.join("\n");
  const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows: string[][] = [];
  const rowHasTh: boolean[] = [];

  for (const rowHtml of rowMatches) {
    const cellMatches = [
      ...rowHtml.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi),
    ];
    if (cellMatches.length === 0) {
      continue;
    }
    rowHasTh.push(cellMatches.some((m) => m[1].toLowerCase() === "th"));
    rows.push(
      cellMatches.map((m) =>
        m[2]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim(),
      ),
    );
  }

  return { rows, endIndex, rowHasTh };
};

const withEmptyLineSafeguard = (runs: InlineMarkdownRun[]): InlineMarkdownRun[] =>
  runs.length === 0 || runs.every((r) => r.text === "")
    ? [
        {
          text: " ",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]
    : runs;

export const parseMarkdownToBlocks = (text: string): MarkdownBlock[] => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: MarkdownBlock[] = [];

  let inCodeBlock = false;
  let codeFence: "```" | "~~~" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimStart();
    const fence =
      trimmed.startsWith("```") ? "```" : trimmed.startsWith("~~~") ? "~~~" : null;

    if (!inCodeBlock && fence) {
      inCodeBlock = true;
      codeFence = fence;
      continue;
    }
    if (inCodeBlock && codeFence && trimmed.startsWith(codeFence)) {
      inCodeBlock = false;
      codeFence = null;
      continue;
    }

    if (inCodeBlock) {
      out.push({
        type: "line",
        line: {
          runs: withEmptyLineSafeguard([
            {
              text: rawLine,
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: true,
              link: null,
            },
          ]),
          indentEm: 0,
          blockquote: false,
          headingLevel: 0,
          isCodeBlock: true,
        },
      });
      continue;
    }

    if (trimmed.startsWith("<table")) {
      const { rows, endIndex, rowHasTh } = parseHtmlTableToRows(lines, i);
      if (rows.length) {
        const colCount = Math.max(...rows.map((r) => r.length));
        out.push({
          type: "table",
          table: {
            rows,
            alignments: new Array(colCount).fill("left"),
            hasHeader: rowHasTh[0] ?? false,
          },
          indentEm: 0,
          blockquote: false,
        });
        i = endIndex;
        continue;
      }
    }

    let blockquote = false;
    let working = rawLine;
    const bqMatch = working.match(/^\s{0,3}((?:>\s*)+)(.*)$/);
    let bqLevel = 0;
    if (bqMatch) {
      blockquote = true;
      bqLevel = (bqMatch[1].match(/>/g) || []).length;
      working = bqMatch[2];
    }

    const headerCells = splitTableRow(working);
    const alignments =
      i + 1 < lines.length ? parseTableAlignmentRow(lines[i + 1]) : null;
    if (headerCells && alignments && alignments.length === headerCells.length) {
      const rows: string[][] = [headerCells];
      const colCount = headerCells.length;
      let j = i + 2;
      while (j < lines.length) {
        const rowCells = splitTableRow(lines[j]);
        if (!rowCells || rowCells.length !== colCount) {
          break;
        }
        rows.push(rowCells);
        j++;
      }

      out.push({
        type: "table",
        table: {
          rows,
          alignments,
          hasHeader: true,
        },
        indentEm: bqLevel * 1.0,
        blockquote,
      });

      i = j - 1;
      continue;
    }

    const quotePrefix = blockquote ? "› ".repeat(bqLevel) : "";

    const hr = working.match(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/);
    if (hr) {
      out.push({
        type: "line",
        line: {
          runs: [
            {
              text: `${quotePrefix}────────────`,
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              link: null,
            },
          ],
          indentEm: bqLevel * 1.0,
          blockquote,
          headingLevel: 0,
          isCodeBlock: false,
        },
      });
      continue;
    }

    const headingMatch = working.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2];
      const runs = parseInlineMarkdown(quotePrefix + content);
      out.push({
        type: "line",
        line: {
          runs: withEmptyLineSafeguard(runs.map((r) => ({ ...r, bold: true }))),
          indentEm: bqLevel * 1.0,
          blockquote,
          headingLevel: level,
          isCodeBlock: false,
        },
      });
      continue;
    }

    const leadingWhitespace = working.match(/^[ \t]*/)?.[0] ?? "";
    const leadingSpaces = leadingWhitespace.replace(/\t/g, "  ").length;
    const indentLevel = Math.floor(leadingSpaces / 2);
    const rest = working.slice(leadingWhitespace.length);

    const taskMatch = rest.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      const prefix = checked ? "☑ " : "☐ ";
      const runs = parseInlineMarkdown(quotePrefix + prefix + taskMatch[2]);
      out.push({
        type: "line",
        line: {
          runs: withEmptyLineSafeguard(runs),
          indentEm: indentLevel * 1.5 + bqLevel * 1.0,
          blockquote,
          headingLevel: 0,
          isCodeBlock: false,
        },
      });
      continue;
    }

    const ulMatch = rest.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      const runs = parseInlineMarkdown(`${quotePrefix}• ${ulMatch[1]}`);
      out.push({
        type: "line",
        line: {
          runs: withEmptyLineSafeguard(runs),
          indentEm: indentLevel * 1.5 + bqLevel * 1.0,
          blockquote,
          headingLevel: 0,
          isCodeBlock: false,
        },
      });
      continue;
    }

    const olMatch = rest.match(/^(\d+)[.)]\s+(.*)$/);
    if (olMatch) {
      const runs = parseInlineMarkdown(
        `${quotePrefix}${olMatch[1]}. ${olMatch[2]}`,
      );
      out.push({
        type: "line",
        line: {
          runs: withEmptyLineSafeguard(runs),
          indentEm: indentLevel * 1.5 + bqLevel * 1.0,
          blockquote,
          headingLevel: 0,
          isCodeBlock: false,
        },
      });
      continue;
    }

    out.push({
      type: "line",
      line: {
        runs: withEmptyLineSafeguard(parseInlineMarkdown(quotePrefix + working.trimEnd())),
        indentEm: indentLevel * 1.5 + bqLevel * 1.0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: false,
      },
    });
  }

  return out;
};

export const parseMarkdownToLines = (text: string): MarkdownLine[] => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: MarkdownLine[] = [];

  let inCodeBlock = false;
  let codeFence: "```" | "~~~" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    const trimmed = rawLine.trimStart();
    const fence =
      trimmed.startsWith("```") ? "```" : trimmed.startsWith("~~~") ? "~~~" : null;

    if (!inCodeBlock && fence) {
      inCodeBlock = true;
      codeFence = fence;
      continue;
    }
    if (inCodeBlock && codeFence && trimmed.startsWith(codeFence)) {
      inCodeBlock = false;
      codeFence = null;
      continue;
    }

    if (inCodeBlock) {
      out.push({
        runs: withEmptyLineSafeguard([
          {
            text: rawLine,
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: true,
            link: null,
          },
        ]),
        indentEm: 0,
        blockquote: false,
        headingLevel: 0,
        isCodeBlock: true,
      });
      continue;
    }

    if (trimmed.startsWith("<table")) {
      const collected: string[] = [];
      for (let j = i; j < lines.length; j++) {
        collected.push(lines[j]);
        if (lines[j].includes("</table>")) {
          i = j;
          break;
        }
      }

      const html = collected.join("\n");
      const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      const rows: string[][] = [];
      for (const rowHtml of rowMatches) {
        const cellMatches = [...rowHtml.matchAll(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi)];
        if (cellMatches.length === 0) {
          continue;
        }
        rows.push(
          cellMatches.map((m) =>
            m[2]
              .replace(/<br\s*\/?>/gi, "\n")
              .replace(/<[^>]+>/g, "")
              .trim(),
          ),
        );
      }

      if (rows.length) {
        const asCodeLine = (tableLine: string): MarkdownLine => ({
          runs: [
            {
              text: tableLine,
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: true,
              link: null,
            },
          ],
          indentEm: 0,
          blockquote: false,
          headingLevel: 0,
          isCodeBlock: true,
        });

        const tableLines = buildBoxTableLines({
          rows,
          alignments: new Array(Math.max(...rows.map((r) => r.length))).fill(
            "left",
          ),
          linePrefix: "",
        });
        for (const tableLine of tableLines) {
          out.push(asCodeLine(tableLine));
        }
      }

      continue;
    }

    let blockquote = false;
    let working = rawLine;
    const bqMatch = working.match(/^\s{0,3}((?:>\s*)+)(.*)$/);
    let bqLevel = 0;
    if (bqMatch) {
      blockquote = true;
      bqLevel = (bqMatch[1].match(/>/g) || []).length;
      working = bqMatch[2];
    }

    const quotePrefix = blockquote ? "› ".repeat(bqLevel) : "";

    const headerCells = splitTableRow(working);
    const alignments =
      i + 1 < lines.length ? parseTableAlignmentRow(lines[i + 1]) : null;
    if (headerCells && alignments && alignments.length === headerCells.length) {
      const rows: string[][] = [headerCells];
      const maxCols = headerCells.length;
      let j = i + 2;
      while (j < lines.length) {
        const rowCells = splitTableRow(lines[j]);
        if (!rowCells || rowCells.length !== maxCols) {
          break;
        }
        rows.push(rowCells);
        j++;
      }

      const asCodeLine = (tableLine: string): MarkdownLine => ({
        runs: [
          {
            text: tableLine,
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: true,
            link: null,
          },
        ],
        indentEm: 0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: true,
      });

      const tableLines = buildBoxTableLines({
        rows,
        alignments,
        linePrefix: quotePrefix,
      });
      for (const tableLine of tableLines) {
        out.push(asCodeLine(tableLine));
      }

      i = j - 1;
      continue;
    }

    const hr = working.match(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/);
    if (hr) {
      out.push({
        runs: [
          {
            text: `${quotePrefix}────────────`,
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            link: null,
          },
        ],
        indentEm: bqLevel * 1.0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: false,
      });
      continue;
    }

    const headingMatch = working.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const content = headingMatch[2];
      const runs = parseInlineMarkdown(quotePrefix + content);
      out.push({
        runs: withEmptyLineSafeguard(
          runs.map((r) => ({ ...r, bold: true })),
        ),
        indentEm: bqLevel * 1.0,
        blockquote,
        headingLevel: level,
        isCodeBlock: false,
      });
      continue;
    }

    const leadingWhitespace = working.match(/^[ \t]*/)?.[0] ?? "";
    const leadingSpaces = leadingWhitespace.replace(/\t/g, "  ").length;
    const indentLevel = Math.floor(leadingSpaces / 2);
    const rest = working.slice(leadingWhitespace.length);

    const taskMatch = rest.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const checked = taskMatch[1].toLowerCase() === "x";
      const prefix = checked ? "☑ " : "☐ ";
      const runs = parseInlineMarkdown(quotePrefix + prefix + taskMatch[2]);
      out.push({
        runs: withEmptyLineSafeguard(runs),
        indentEm: indentLevel * 1.5 + bqLevel * 1.0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: false,
      });
      continue;
    }

    const ulMatch = rest.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      const runs = parseInlineMarkdown(`${quotePrefix}• ${ulMatch[1]}`);
      out.push({
        runs: withEmptyLineSafeguard(runs),
        indentEm: indentLevel * 1.5 + bqLevel * 1.0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: false,
      });
      continue;
    }

    const olMatch = rest.match(/^(\d+)[.)]\s+(.*)$/);
    if (olMatch) {
      const runs = parseInlineMarkdown(
        `${quotePrefix}${olMatch[1]}. ${olMatch[2]}`,
      );
      out.push({
        runs: withEmptyLineSafeguard(runs),
        indentEm: indentLevel * 1.5 + bqLevel * 1.0,
        blockquote,
        headingLevel: 0,
        isCodeBlock: false,
      });
      continue;
    }

    out.push({
      runs: withEmptyLineSafeguard(
        parseInlineMarkdown(quotePrefix + working.trimEnd()),
      ),
      indentEm: indentLevel * 1.5 + bqLevel * 1.0,
      blockquote,
      headingLevel: 0,
      isCodeBlock: false,
    });
  }

  return out;
};

export const getStyledFontString = (
  baseFontString: string,
  {
    bold,
    italic,
    code,
  }: Pick<InlineMarkdownRun, "bold" | "italic" | "code">,
) => {
  const match = baseFontString.match(/^(\d+(?:\.\d+)?)px\s+(.+)$/);
  if (!match) {
    return baseFontString;
  }
  const [, fontSize, baseFamilyString] = match;
  const familyString = code
    ? getFontFamilyString({ fontFamily: FONT_FAMILY.Cascadia })
    : baseFamilyString;
  const fontStyle = italic ? "italic " : "";
  const fontWeight = bold ? "bold " : "";
  return `${fontStyle}${fontWeight}${fontSize}px ${familyString}`;
};
