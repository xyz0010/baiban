import { describe, expect, it } from "vitest";

import { buildObsidianMarkdown, sanitizeFilenameBase } from "../data/obsidianMarkdown";

const textEl = (opts: {
  id: string;
  x: number;
  y: number;
  originalText: string;
  isDeleted?: boolean;
}) =>
  ({
    id: opts.id,
    type: "text",
    x: opts.x,
    y: opts.y,
    text: opts.originalText,
    originalText: opts.originalText,
    isDeleted: opts.isDeleted ?? false,
  }) as any;

describe("obsidian markdown export helpers", () => {
  it("sanitizes base filename", () => {
    expect(sanitizeFilenameBase('  a/b:c*?"<>|  ')).toBe("a-b-c");
    expect(sanitizeFilenameBase("")).toBe("Untitled");
  });

  it("builds markdown with preview image link and sorted text extract", () => {
    const markdown = buildObsidianMarkdown({
      title: "My Note",
      previewImageName: "My Note.png",
      elements: [
        textEl({ id: "a", x: 50, y: 200, originalText: "Second" }),
        textEl({ id: "b", x: 10, y: 100, originalText: "First" }),
        textEl({ id: "c", x: 10, y: 300, originalText: "Third", isDeleted: true }),
      ],
    });

    expect(markdown).toContain("# My Note");
    expect(markdown).toContain("![](My Note.png)");
    expect(markdown).toContain("## 文本摘录");
    expect(markdown.indexOf("First")).toBeLessThan(markdown.indexOf("Second"));
    expect(markdown).not.toContain("Third");
  });
});
