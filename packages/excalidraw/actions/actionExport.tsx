import {
  KEYS,
  DEFAULT_EXPORT_PADDING,
  EXPORT_SCALES,
  THEME,
} from "@excalidraw/common";

import { getNonDeletedElements } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import type { Theme } from "@excalidraw/element/types";

import { useEditorInterface } from "../components/App";
import { CheckboxItem } from "../components/CheckboxItem";
import { DarkModeToggle } from "../components/DarkModeToggle";
import { ProjectName } from "../components/ProjectName";
import { ToolButton } from "../components/ToolButton";
import { Tooltip } from "../components/Tooltip";
import { ExportIcon, questionCircle, saveAs } from "../components/icons";
import { loadFromJSON, saveAsJSON } from "../data";
import { isImageFileHandle } from "../data/blob";
import { nativeFileSystemSupported, fileSave } from "../data/filesystem";
import { resaveAsImageWithScene } from "../data/resave";

import { t } from "../i18n";
import { getSelectedElements, isSomeElementSelected } from "../scene";
import { getExportSize } from "../scene/export";

import "../components/ToolIcon.scss";

import { register } from "./register";

import type { AppState } from "../types";

export const actionChangeProjectName = register<AppState["name"]>({
  name: "changeProjectName",
  label: "labels.fileTitle",
  trackEvent: false,
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, name: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData, appProps, data, app }) => (
    <ProjectName
      label={t("labels.fileTitle")}
      value={app.getName()}
      onChange={(name: string) => updateData(name)}
      ignoreFocus={data?.ignoreFocus ?? false}
    />
  ),
});

export const actionChangeExportScale = register<AppState["exportScale"]>({
  name: "changeExportScale",
  label: "imageExportDialog.scale",
  trackEvent: { category: "export", action: "scale" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportScale: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements: allElements, appState, updateData }) => {
    const elements = getNonDeletedElements(allElements);
    const exportSelected = isSomeElementSelected(elements, appState);
    const exportedElements = exportSelected
      ? getSelectedElements(elements, appState)
      : elements;

    return (
      <>
        {EXPORT_SCALES.map((s) => {
          const [width, height] = getExportSize(
            exportedElements,
            DEFAULT_EXPORT_PADDING,
            s,
          );

          const scaleButtonTitle = `${t(
            "imageExportDialog.label.scale",
          )} ${s}x (${width}x${height})`;

          return (
            <ToolButton
              key={s}
              size="small"
              type="radio"
              icon={`${s}x`}
              name="export-canvas-scale"
              title={scaleButtonTitle}
              aria-label={scaleButtonTitle}
              id="export-canvas-scale"
              checked={s === appState.exportScale}
              onChange={() => updateData(s)}
            />
          );
        })}
      </>
    );
  },
});

export const actionChangeExportBackground = register<boolean>({
  name: "changeExportBackground",
  label: "imageExportDialog.label.withBackground",
  trackEvent: { category: "export", action: "background" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportBackground: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportBackground}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.withBackground")}
    </CheckboxItem>
  ),
});

export const actionChangeExportEmbedScene = register<boolean>({
  name: "changeExportEmbedScene",
  label: "imageExportDialog.label.embedScene",
  trackEvent: { category: "export", action: "embedScene" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportEmbedScene: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportEmbedScene}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.embedScene")}
    </CheckboxItem>
  ),
});

export const actionSaveToActiveFile = register({
  name: "saveToActiveFile",
  label: "buttons.save",
  trackEvent: { category: "export", action: "saveToActiveFile" },
  perform: async (elements, appState, _, app) => {
    const { fileHandle } = await saveAsJSON(
      elements,
      appState,
      app.files,
      appState.name || undefined,
    );
    return {
      commitToHistory: false,
      appState: {
        ...appState,
        fileHandle,
        toast: fileHandle
          ? {
              message: fileHandle.name
                ? t("toast.fileSavedToFilename").replace(
                    "{filename}",
                    `"${fileHandle.name}"`,
                  )
                : t("toast.fileSaved"),
            }
          : null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    event.key === KEYS.S && (event.ctrlKey || event.metaKey) && !event.shiftKey,
});

export const actionSaveFileToDisk = register({
  name: "saveFileToDisk",
  label: "buttons.saveAs",
  trackEvent: { category: "export", action: "saveFileToDisk" },
  perform: async (elements, appState, _, app) => {
    const { fileHandle } = await saveAsJSON(
      elements,
      { ...appState, fileHandle: null },
      app.files,
      appState.name || undefined,
    );
    return {
      commitToHistory: false,
      appState: {
        ...appState,
        fileHandle,
        toast: fileHandle
          ? {
              message: fileHandle.name
                ? t("toast.fileSavedToFilename").replace(
                    "{filename}",
                    `"${fileHandle.name}"`,
                  )
                : t("toast.fileSaved"),
            }
          : null,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  keyTest: (event) =>
    event.key === KEYS.S && (event.ctrlKey || event.metaKey) && event.shiftKey,
});

export const actionLoadScene = register({
  name: "loadScene",
  label: "buttons.load",
  trackEvent: { category: "export", action: "load" },
  perform: async (elements, appState, _, app) => {
    try {
      const {
        elements: loadedElements,
        appState: loadedAppState,
        files,
      } = await loadFromJSON(appState, elements);
      return {
        elements: loadedElements,
        appState: loadedAppState,
        files,
        commitToHistory: false,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error(error);
      }
      return { captureUpdate: CaptureUpdateAction.NEVER };
    }
  },
  keyTest: (event) =>
    event.key === KEYS.O && (event.ctrlKey || event.metaKey) && !event.shiftKey,
});

export const actionExportVideo = register({
  name: "exportVideo",
  label: "buttons.exportVideo",
  trackEvent: { category: "element", action: "exportVideo" },
  perform: (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (selectedElements.length !== 1) {
      return { appState, captureUpdate: CaptureUpdateAction.NEVER };
    }
    const element = selectedElements[0];
    if (
      element.type !== "embeddable" ||
      !element.link ||
      !element.link.startsWith("video-file:")
    ) {
      return { appState, captureUpdate: CaptureUpdateAction.NEVER };
    }

    const fileId = element.link.replace("video-file:", "");
    const fileData = app.files[fileId];
    if (!fileData || !fileData.dataURL) {
      return { appState, captureUpdate: CaptureUpdateAction.NEVER };
    }

    fetch(fileData.dataURL)
      .then((res) => res.blob())
      .then((blob) => {
        fileSave(blob, {
          name: "video",
          extension: "mp4",
          description: "Export Video",
          mimeTypes: [fileData.mimeType],
        });
      });

    return {
      appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
  contextItemLabel: "buttons.exportVideo",
  predicate: (elements, appState) => {
    const selectedElements = getSelectedElements(elements, appState);
    if (selectedElements.length !== 1) {
      return false;
    }
    const element = selectedElements[0];
    return (
      element.type === "embeddable" &&
      !!element.link &&
      element.link.startsWith("video-file:")
    );
  },
});
