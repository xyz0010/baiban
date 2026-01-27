import { DEFAULT_EXPORT_PADDING, MIME_TYPES } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getNonDeletedElements,
} from "@excalidraw/element";
import { strToU8, zipSync } from "fflate";

import { canvasToBlob, blobToArrayBuffer } from "../data/blob";
import { buildObsidianMarkdown, sanitizeFilenameBase } from "../data/obsidianMarkdown";
import { fileSave } from "../data/filesystem";
import { exportToCanvas } from "../scene/export";
import type { AppState } from "../types";

import { register } from "./register";

export const actionExportToObsidianMarkdownZip = register({
  name: "exportToObsidianMarkdownZip",
  label: "Export to Obsidian Markdown (zip)",
  trackEvent: { category: "export", action: "exportToObsidianMarkdownZip" },
  perform: async (elements, appState, _, app) => {
    try {
      const exportedElements = getNonDeletedElements(elements);
      const baseName = sanitizeFilenameBase(appState.name || "Untitled");
      const previewImageName = `${baseName}.png`;
      const markdownName = `${baseName}.md`;

      const canvas = await exportToCanvas(exportedElements, appState, app.files, {
        exportBackground: appState.exportBackground,
        viewBackgroundColor: appState.viewBackgroundColor,
        exportPadding: DEFAULT_EXPORT_PADDING,
      });

      const pngBlob = await canvasToBlob(canvas);
      const pngBytes = new Uint8Array(await blobToArrayBuffer(pngBlob));

      const markdown = buildObsidianMarkdown({
        title: baseName,
        previewImageName,
        elements,
      });

      const zipBytes = zipSync({
        [previewImageName]: pngBytes,
        [markdownName]: strToU8(markdown),
      });

      const zipBlob = new Blob([zipBytes as any], { type: MIME_TYPES.zip });

      fileSave(zipBlob, {
        name: baseName,
        extension: "zip",
        description: "Export to Obsidian Markdown",
        mimeTypes: [MIME_TYPES.zip],
      });
    } catch (error: any) {
      return {
        commitToHistory: false,
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          ...appState,
          errorMessage: error?.message || "导出失败",
        },
      };
    }

    return {
      commitToHistory: false,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
