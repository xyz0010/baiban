import { CODES, KEYS, easeOut, easeToValuesRAF } from "@excalidraw/common";
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
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] &&
    !event.altKey &&
    event.shiftKey &&
    event.code === CODES.R,
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
      const lastFrameId = (app as any).currentPresentationFrameId as
        | ExcalidrawFrameElement["id"]
        | null
        | undefined;

      let targetFrame: ExcalidrawFrameElement | null = null;

      if (lastFrameId) {
        targetFrame =
          (sortedFrames.find((frame) => frame.id === lastFrameId) as
            | ExcalidrawFrameElement
            | undefined) || null;
      }

      if (!targetFrame) {
        const viewportCenterX = appState.width / 2;
        const viewportCenterY = appState.height / 2;
        const sceneCenterX =
          viewportCenterX / appState.zoom.value - appState.scrollX;
        const sceneCenterY =
          viewportCenterY / appState.zoom.value - appState.scrollY;

        let currentFrameIndex = -1;
        let minDistance = Infinity;

        sortedFrames.forEach((frame, index) => {
          const frameCenterX = frame.x + frame.width / 2;
          const frameCenterY = frame.y + frame.height / 2;

          const dist = Math.hypot(
            frameCenterX - sceneCenterX,
            frameCenterY - sceneCenterY,
          );

          const isInside =
            sceneCenterX >= frame.x &&
            sceneCenterX <= frame.x + frame.width &&
            sceneCenterY >= frame.y &&
            sceneCenterY <= frame.y + frame.height;

          if (isInside) {
            if (dist < minDistance) {
              minDistance = dist;
              currentFrameIndex = index;
            }
          } else if (currentFrameIndex === -1) {
            if (dist < minDistance) {
              minDistance = dist;
              currentFrameIndex = index;
            }
          }
        });

        targetFrame =
          currentFrameIndex >= 0
            ? (sortedFrames[currentFrameIndex] as ExcalidrawFrameElement)
            : sortedFrames[0];
      }

      (app as any).currentPresentationFrameId = targetFrame.id;

      const scaleX = appState.width / targetFrame.width;
      const scaleY = appState.height / targetFrame.height;
      const zoomValue = Math.min(scaleX, scaleY);

      const targetScrollX =
        appState.width / 2 / zoomValue -
        (targetFrame.x + targetFrame.width / 2);
      const targetScrollY =
        appState.height / 2 / zoomValue -
        (targetFrame.y + targetFrame.height / 2);

      (app as any).cancelInProgressAnimation?.();

      const cancel = easeToValuesRAF({
        fromValues: {
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        },
        toValues: {
          scrollX: targetScrollX,
          scrollY: targetScrollY,
          zoom: zoomValue,
        },
        interpolateValue: (from, to, progress, key) => {
          if (key === "zoom") {
            return from * Math.pow(to / from, easeOut(progress));
          }
          return undefined;
        },
        onStep: ({ scrollX, scrollY, zoom }) => {
          (app as any).setState({
            scrollX,
            scrollY,
            zoom: { value: zoom as any },
          });
        },
        onStart: () => {
          (app as any).setState({ shouldCacheIgnoreZoom: true });
        },
        onEnd: () => {
          (app as any).setState({ shouldCacheIgnoreZoom: false });
        },
        onCancel: () => {
          (app as any).setState({ shouldCacheIgnoreZoom: false });
        },
        duration: 500,
      });

      (app as any).cancelInProgressAnimation = () => {
        cancel();
        (app as any).cancelInProgressAnimation = null;
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
