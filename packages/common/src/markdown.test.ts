import {
  FONT_FAMILY,
  getFontString,
  getStyledFontString,
  parseInlineMarkdown,
  parseMarkdownToBlocks,
  parseMarkdownToLines,
} from "@excalidraw/common";

describe("@excalidraw/common/markdown", () => {
  describe("parseInlineMarkdown()", () => {
    it("parses bold and removes markers", () => {
      expect(parseInlineMarkdown("a **b** c")).toEqual([
        {
          text: "a ",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
        {
          text: "b",
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
        {
          text: " c",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });

    it("does not treat list markers as emphasis delimiters", () => {
      expect(parseInlineMarkdown("* item")).toEqual([
        {
          text: "* item",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });

    it("keeps unbalanced markers as literal text", () => {
      expect(parseInlineMarkdown("**bold")).toEqual([
        {
          text: "**bold",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });

    it("parses inline code and removes backticks", () => {
      expect(parseInlineMarkdown("`x`")).toEqual([
        {
          text: "x",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: true,
          link: null,
        },
      ]);
    });

    it("supports escaping markers", () => {
      expect(parseInlineMarkdown("\\*a\\*")).toEqual([
        {
          text: "*a*",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });

    it("parses links as underlined runs", () => {
      expect(parseInlineMarkdown("a [b](https://e.com) c")).toEqual([
        {
          text: "a ",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
        {
          text: "b",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: true,
          code: false,
          link: "https://e.com",
        },
        {
          text: " c",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });

    it("parses basic HTML tags", () => {
      expect(parseInlineMarkdown("<u>a</u>")).toEqual([
        {
          text: "a",
          bold: false,
          italic: false,
          strikethrough: false,
          underline: true,
          code: false,
          link: null,
        },
      ]);
      expect(parseInlineMarkdown("<strong>a</strong>")).toEqual([
        {
          text: "a",
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          link: null,
        },
      ]);
    });
  });

  describe("parseMarkdownToLines()", () => {
    it("handles fenced code blocks", () => {
      const lines = parseMarkdownToLines("a\n```js\nx\n```\nb");
      expect(lines.map((l) => l.runs.map((r) => r.text).join(""))).toEqual([
        "a",
        "x",
        "b",
      ]);
      expect(lines[1].isCodeBlock).toBe(true);
      expect(lines[1].runs[0].code).toBe(true);
    });

    it("handles headings and lists", () => {
      const lines = parseMarkdownToLines("# h\n- a\n1. b\n- [x] c");
      expect(lines[0].headingLevel).toBe(1);
      expect(lines[0].runs.some((r) => r.bold)).toBe(true);
      expect(lines[1].runs.map((r) => r.text).join("")).toBe("• a");
      expect(lines[2].runs.map((r) => r.text).join("")).toBe("1. b");
      expect(lines[3].runs.map((r) => r.text).join("")).toBe("☑ c");
    });

  });

  describe("parseMarkdownToBlocks()", () => {
    it("parses markdown tables into a table block", () => {
      const blocks = parseMarkdownToBlocks("| a | bb |\n|---|:--:|\n| c | d |");
      const tableBlock = blocks.find((b) => b.type === "table");
      expect(tableBlock?.type).toBe("table");
      expect(tableBlock && tableBlock.type === "table" ? tableBlock.table.rows[0] : null).toEqual([
        "a",
        "bb",
      ]);
    });

    it("parses html tables into a table block", () => {
      const blocks = parseMarkdownToBlocks(
        "<table><tr><th>a</th><th>bb</th></tr><tr><td>c</td><td>d</td></tr></table>",
      );
      const tableBlock = blocks.find((b) => b.type === "table");
      expect(tableBlock?.type).toBe("table");
      expect(
        tableBlock && tableBlock.type === "table"
          ? tableBlock.table.rows.flat().join(" ")
          : "",
      ).toContain("a");
    });
  });

  describe("getStyledFontString()", () => {
    it("adds bold/italic prefixes and keeps size", () => {
      const base = getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Virgil });
      const styled = getStyledFontString(base, {
        bold: true,
        italic: true,
        code: false,
      });
      expect(styled.startsWith("italic bold 20px ")).toBe(true);
    });

    it("switches to Cascadia for code runs", () => {
      const base = getFontString({ fontSize: 20, fontFamily: FONT_FAMILY.Virgil });
      const styled = getStyledFontString(base, {
        bold: false,
        italic: false,
        code: true,
      });
      expect(styled.includes("Cascadia")).toBe(true);
    });
  });
});
