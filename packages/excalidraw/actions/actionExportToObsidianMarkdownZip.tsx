import { DEFAULT_EXPORT_PADDING, MIME_TYPES } from "@excalidraw/common";
import {
  CaptureUpdateAction,
  getFrameChildren,
  getNonDeletedElements,
  isFrameLikeElement,
} from "@excalidraw/element";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";
import { strToU8, zipSync } from "fflate";

import { canvasToBlob, blobToArrayBuffer } from "../data/blob";
import { buildObsidianMarkdown, sanitizeFilenameBase } from "../data/obsidianMarkdown";
import { fileSave } from "../data/filesystem";
import { exportToCanvas } from "../scene/export";
import type { AppClassProperties, AppState } from "../types";

import { register } from "./register";

const exportObsidianMarkdownZip = async ({
  exportedElements,
  appState,
  app,
  baseName,
}: {
  exportedElements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  app: AppClassProperties;
  baseName: string;
}) => {
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
    elements: exportedElements,
  });

  const zipBytes = zipSync({
    [previewImageName]: pngBytes,
    [markdownName]: strToU8(markdown),
  });

  const zipBytesForBlob = new Uint8Array(zipBytes.byteLength);
  zipBytesForBlob.set(zipBytes);
  const zipBlob = new Blob([zipBytesForBlob], { type: MIME_TYPES.zip });

  fileSave(zipBlob, {
    name: baseName,
    extension: "zip",
    description: "Export to Obsidian Markdown",
    mimeTypes: [MIME_TYPES.zip],
  });
};

export const actionExportToObsidianMarkdownZip = register({
  name: "exportToObsidianMarkdownZip",
  label: "Export to Obsidian Markdown (zip)",
  trackEvent: { category: "export", action: "exportToObsidianMarkdownZip" },
  perform: async (elements, appState, _, app) => {
    try {
      const exportedElements = getNonDeletedElements(elements);
      const baseName = sanitizeFilenameBase(appState.name || "Untitled");
      await exportObsidianMarkdownZip({
        exportedElements,
        appState,
        app,
        baseName,
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

export const actionExportToObsidianMarkdownZipInFrame = register({
  name: "exportToObsidianMarkdownZipInFrame",
  label: "labels.exportToObsidianMarkdownZipInFrame",
  trackEvent: {
    category: "export",
    action: "exportToObsidianMarkdownZipInFrame",
  },
  predicate: (_elements, appState, _props, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return (
      selectedElements.length === 1 && isFrameLikeElement(selectedElements[0])
    );
  },
  perform: async (elements, appState, _, app) => {
    try {
      const selectedElement = app.scene.getSelectedElements(appState).at(0) || null;
      if (!isFrameLikeElement(selectedElement)) {
        return {
          commitToHistory: false,
          captureUpdate: CaptureUpdateAction.NEVER,
        };
      }

      const nonDeletedElements = getNonDeletedElements(elements);
      const frameChildren = getFrameChildren(
        nonDeletedElements,
        selectedElement.id,
      ) as NonDeletedExcalidrawElement[];
      const exportedElements: NonDeletedExcalidrawElement[] = [
        selectedElement as NonDeletedExcalidrawElement,
        ...frameChildren,
      ];

      const baseName = sanitizeFilenameBase(
        `${appState.name || "Untitled"}-${selectedElement.name || "Frame"}`,
      );

      await exportObsidianMarkdownZip({
        exportedElements,
        appState,
        app,
        baseName,
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
