import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawFrameElement } from "@excalidraw/element/types";

import { presentationIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionTogglePresentationMode = register({
  name: "presentationMode",
  label: "labels.presentationMode",
  icon: presentationIcon,
  viewMode: true,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => !appState.presentationModeEnabled,
  },
  perform(elements, appState, value, app) {
    if (appState.presentationModeEnabled) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      return {
        appState: {
          ...appState,
          presentationModeEnabled: false,
          viewModeEnabled: false,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    const frames = elements.filter(
      (el) => el.type === "frame" && !el.isDeleted,
    ) as ExcalidrawFrameElement[];

    const sortedFrames = frames.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      if (nameA && nameB) {
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      }
      if (nameA) {
        return -1;
      }
      if (nameB) {
        return 1;
      }
      if (Math.abs(a.y - b.y) > 10) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    let newAppState: AppState = {
      ...appState,
      presentationModeEnabled: true,
      viewModeEnabled: true,
      activeTool: { ...appState.activeTool, type: "laser", customType: null },
    };

    if (sortedFrames.length > 0) {
      const frame = sortedFrames[0];
      const scaleX = appState.width / frame.width;
      const scaleY = appState.height / frame.height;
      const zoomValue = Math.min(scaleX, scaleY);

      newAppState = {
        ...newAppState,
        scrollX: -(frame.x + frame.width / 2) + appState.width / 2 / zoomValue,
        scrollY:
          -(frame.y + frame.height / 2) + appState.height / 2 / zoomValue,
        zoom: { value: zoomValue as any },
      };
    }

    return {
      appState: newAppState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.presentationModeEnabled,
  predicate: (elements, appState, appProps, app) => {
    return true;
  },
});
