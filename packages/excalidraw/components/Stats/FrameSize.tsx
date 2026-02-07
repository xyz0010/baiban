import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

import { MIN_WIDTH_OR_HEIGHT } from "@excalidraw/common";
import { cloneJSON } from "@excalidraw/common";
import { round } from "@excalidraw/math";

import {
  CaptureUpdateAction,
  deepCopyElement,
  getElementsInResizingFrame,
  isFrameLikeElement,
  replaceAllElementsInFrame,
  resizeSingleElement,
} from "@excalidraw/element";
import type { Scene } from "@excalidraw/element";
import type {
  ExcalidrawFrameLikeElement,
  ElementsMap,
} from "@excalidraw/element/types";

import "./FrameSize.scss";

import type { AppClassProperties, AppState } from "../../types";

type AspectPreset = Readonly<{
  id: string;
  label: string;
  w: number;
  h: number;
}>;

const parseNumber = (value: string) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const FrameSize = ({
  element,
  scene,
  appState,
  app,
}: {
  element: ExcalidrawFrameLikeElement;
  scene: Scene;
  appState: AppState;
  app: AppClassProperties;
}) => {
  const presets = useMemo<readonly AspectPreset[]>(
    () => [
      { id: "1:1", label: "1:1", w: 1, h: 1 },
      { id: "4:3", label: "4:3", w: 4, h: 3 },
      { id: "3:4", label: "3:4", w: 3, h: 4 },
      { id: "16:9", label: "16:9", w: 16, h: 9 },
      { id: "9:16", label: "9:16", w: 9, h: 16 },
      { id: "21:9", label: "21:9", w: 21, h: 9 },
    ],
    [],
  );

  const [customWidth, setCustomWidth] = useState(() => String(element.width));
  const [customHeight, setCustomHeight] = useState(() => String(element.height));
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const autoApplyTimeoutRef = useRef<number | null>(null);
  const isEditingCustomSizeRef = useRef(false);

  useEffect(() => {
    if (isEditingCustomSizeRef.current) {
      return;
    }
    setCustomWidth(String(round(element.width, 2)));
    setCustomHeight(String(round(element.height, 2)));
  }, [element.id, element.width, element.height]);

  if (!isFrameLikeElement(element)) {
    return null;
  }

  const resizeFrame = (nextWidth: number, nextHeight: number) => {
    const originalAppState = cloneJSON(appState);
    const originalElementsMap: ElementsMap = scene
      .getNonDeletedElements()
      .reduce((acc: ElementsMap, el) => {
        acc.set(el.id, deepCopyElement(el));
        return acc;
      }, new Map());

    const origElement = originalElementsMap.get(element.id);
    const latestElement = scene.getNonDeletedElementsMap().get(element.id);

    if (
      !origElement ||
      !latestElement ||
      !isFrameLikeElement(origElement) ||
      !isFrameLikeElement(latestElement)
    ) {
      return;
    }

    const latestFrame = latestElement as ExcalidrawFrameLikeElement;

    const clampedWidth = Math.max(MIN_WIDTH_OR_HEIGHT, round(nextWidth, 2));
    const clampedHeight = Math.max(MIN_WIDTH_OR_HEIGHT, round(nextHeight, 2));

    resizeSingleElement(
      clampedWidth,
      clampedHeight,
      latestFrame,
      origElement,
      originalElementsMap,
      scene,
      "se",
    );

    const nextElementsInFrame = getElementsInResizingFrame(
      scene.getElementsIncludingDeleted(),
      latestFrame,
      originalAppState,
      scene.getNonDeletedElementsMap(),
    );

    replaceAllElementsInFrame(
      scene.getElementsIncludingDeleted(),
      nextElementsInFrame,
      latestFrame,
      app,
    );

    app.syncActionResult({
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };

  const applyAspectPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) {
      return;
    }

    const aspect = preset.w / preset.h;
    const keepWidth = element.width >= element.height;

    let nextWidth = keepWidth ? element.width : element.height * aspect;
    let nextHeight = keepWidth ? element.width / aspect : element.height;

    if (nextWidth < MIN_WIDTH_OR_HEIGHT || nextHeight < MIN_WIDTH_OR_HEIGHT) {
      if (keepWidth) {
        nextHeight = MIN_WIDTH_OR_HEIGHT;
        nextWidth = nextHeight * aspect;
      } else {
        nextWidth = MIN_WIDTH_OR_HEIGHT;
        nextHeight = nextWidth / aspect;
      }
    }

    resizeFrame(nextWidth, nextHeight);
  };

  const applyCustomSize = () => {
    if (autoApplyTimeoutRef.current !== null) {
      window.clearTimeout(autoApplyTimeoutRef.current);
      autoApplyTimeoutRef.current = null;
    }
    const nextWidth = parseNumber(customWidth);
    const nextHeight = parseNumber(customHeight);
    if (nextWidth === null || nextHeight === null) {
      setCustomWidth(String(round(element.width, 2)));
      setCustomHeight(String(round(element.height, 2)));
      return;
    }
    if (
      round(nextWidth, 2) === round(element.width, 2) &&
      round(nextHeight, 2) === round(element.height, 2)
    ) {
      return;
    }
    resizeFrame(nextWidth, nextHeight);
  };

  useEffect(() => {
    if (autoApplyTimeoutRef.current !== null) {
      window.clearTimeout(autoApplyTimeoutRef.current);
    }
    const nextWidth = parseNumber(customWidth);
    const nextHeight = parseNumber(customHeight);
    if (nextWidth === null || nextHeight === null) {
      return;
    }
    if (
      round(nextWidth, 2) === round(element.width, 2) &&
      round(nextHeight, 2) === round(element.height, 2)
    ) {
      return;
    }
    autoApplyTimeoutRef.current = window.setTimeout(() => {
      resizeFrame(nextWidth, nextHeight);
      autoApplyTimeoutRef.current = null;
      isEditingCustomSizeRef.current = false;
    }, 1000);
    return () => {
      if (autoApplyTimeoutRef.current !== null) {
        window.clearTimeout(autoApplyTimeoutRef.current);
        autoApplyTimeoutRef.current = null;
      }
    };
  }, [customWidth, customHeight, element.id, element.width, element.height]);

  return (
    <fieldset className="exc-frame-size">
      <legend>画框尺寸</legend>
      <div className="exc-frame-size__row">
        <select
          className={clsx("exc-frame-size__control", "exc-frame-size__select")}
          value={selectedPresetId}
          onChange={(event) => {
            const nextId = event.target.value;
            setSelectedPresetId(nextId);
            if (nextId) {
              applyAspectPreset(nextId);
            }
          }}
          data-testid="frame-size-preset"
        >
          <option value="">常用比例</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div className="exc-frame-size__row exc-frame-size__row--custom">
        <input
          className={clsx("exc-frame-size__control", "exc-frame-size__input")}
          value={customWidth}
          inputMode="decimal"
          onChange={(event) => setCustomWidth(event.target.value)}
          onFocus={(event) => {
            isEditingCustomSizeRef.current = true;
            event.currentTarget.select();
          }}
          onBlur={() => {
            isEditingCustomSizeRef.current = false;
            applyCustomSize();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              isEditingCustomSizeRef.current = false;
              applyCustomSize();
            }
          }}
          aria-label="Custom width"
          data-testid="frame-size-custom-width"
        />
        <span className="exc-frame-size__sep">×</span>
        <input
          className={clsx("exc-frame-size__control", "exc-frame-size__input")}
          value={customHeight}
          inputMode="decimal"
          onChange={(event) => setCustomHeight(event.target.value)}
          onFocus={(event) => {
            isEditingCustomSizeRef.current = true;
            event.currentTarget.select();
          }}
          onBlur={() => {
            isEditingCustomSizeRef.current = false;
            applyCustomSize();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              isEditingCustomSizeRef.current = false;
              applyCustomSize();
            }
          }}
          aria-label="Custom height"
          data-testid="frame-size-custom-height"
        />
      </div>
    </fieldset>
  );
};

export default FrameSize;
