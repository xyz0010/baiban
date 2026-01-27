import { getNonDeletedElements } from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

export const sanitizeFilenameBase = (name: string) => {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s-]+|[\s-]+$/g, "")
    .replace(/\.$/, "");
  return cleaned || "Untitled";
};

export const buildObsidianMarkdown = (opts: {
  title: string;
  previewImageName: string;
  elements: readonly ExcalidrawElement[];
}) => {
  const { title, previewImageName, elements } = opts;

  const texts = getNonDeletedElements(elements).filter((el) => el.type === "text");
  texts.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 10) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const blocks = texts
    .map((el) => {
      if (el.type !== "text") {
        return "";
      }
      return (el.originalText || el.text || "").trim();
    })
    .filter(Boolean);

  const textSection = blocks.length
    ? `\n\n## 文本摘录\n\n${blocks.join("\n\n")}\n`
    : "";

  return `# ${title}\n\n![](${previewImageName})${textSection}`;
};
