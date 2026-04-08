import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { fileSave } from "@excalidraw/excalidraw/data/filesystem";
import { t } from "@excalidraw/excalidraw/i18n";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { Island } from "@excalidraw/excalidraw/components/Island";
import Stack from "@excalidraw/excalidraw/components/Stack";
import {
  CloseIcon,
  adjustmentsIcon,
  eyeIcon,
  playerPauseIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  recordingIcon,
} from "@excalidraw/excalidraw/components/icons";

import {
  CompositeRenderer,
  computeDefaultFrameToFit,
} from "../../recording/CompositeRenderer";
import { RecorderController } from "../../recording/RecorderController";
import { RecordingSettingsDialog } from "./RecordingSettingsDialog";
import {
  DEFAULT_RECORDING_SETTINGS,
  RECORDING_SETTINGS_STORAGE_KEY,
  getRecordingDimensions,
  type Point,
  type RecordingFrame,
  type RecordingSettings,
} from "../../recording/types";
import "./Recording.scss";

type Props = {
  open: boolean;
  onClose: () => void;
};

const formatElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const RecordingButtonContent = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => {
  return (
    <span className="excalidraw-recording-button-content">
      {icon}
      <span>{label}</span>
    </span>
  );
};

const getDefaultPanelPosition = () => {
  const fallback = { x: 16, y: Math.max(16, window.innerHeight - 96) };
  const toolbarEl = document.querySelector<HTMLElement>(".App-toolbar-container");
  const toolbarRect = toolbarEl?.getBoundingClientRect();
  if (!toolbarRect) {
    return fallback;
  }
  const margin = 12;
  return {
    x: Math.max(margin, toolbarRect.right + margin),
    y: Math.max(margin, toolbarRect.top),
  };
};

const isLegacyDefaultPanelPosition = (point: Point) => {
  return point.x <= 24 && point.y >= window.innerHeight - 140;
};

export const RecordingRoot = ({ open, onClose }: Props) => {
  const storedPanelPositionRef = useRef(false);
  const appliedDefaultPanelPositionRef = useRef(false);
  const [settings, setSettings] = useState<RecordingSettings>(() => {
    try {
      const raw = window.localStorage.getItem(RECORDING_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_RECORDING_SETTINGS;
      }
      const parsed = JSON.parse(raw) as Partial<RecordingSettings>;
      const next = { ...DEFAULT_RECORDING_SETTINGS, ...parsed };
      if (next.backgroundType !== "image") {
        next.backgroundType = "image";
      }
      if (!next.backgroundValue) {
        next.backgroundValue = DEFAULT_RECORDING_SETTINGS.backgroundValue;
      }
      next.cursorEnabled = false;
      return next;
    } catch {
      return DEFAULT_RECORDING_SETTINGS;
    }
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [frame, setFrame] = useState<RecordingFrame | null>(null);
  const [webcamPosition, setWebcamPosition] = useState<Point>({ x: 0, y: 0 });
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 });
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [panelPosition, setPanelPosition] = useState<Point>(() => {
    try {
      const raw = window.localStorage.getItem("excalidraw.recording.panelPosition");
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Point>;
        if (
          typeof parsed.x === "number" &&
          Number.isFinite(parsed.x) &&
          typeof parsed.y === "number" &&
          Number.isFinite(parsed.y)
        ) {
          const candidate = { x: parsed.x, y: parsed.y };
          if (!isLegacyDefaultPanelPosition(candidate)) {
            storedPanelPositionRef.current = true;
            return candidate;
          }
        }
      }
    } catch {
      return getDefaultPanelPosition();
    }
    return getDefaultPanelPosition();
  });

  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const renderer = useMemo(() => new CompositeRenderer(), []);
  const recorderRef = useRef<RecorderController | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef<RecordingFrame | null>(null);
  const webcamPositionRef = useRef<Point>({ x: 0, y: 0 });
  const mousePositionRef = useRef<Point>({ x: 0, y: 0 });
  const settingsRef = useRef(settings);
  const mousePressedRef = useRef(false);
  const webcamPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const lastFrameTimeRef = useRef(0);
  const elapsedBaseRef = useRef(0);
  const elapsedStartRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);

  const stopWebcam = useCallback(() => {
    webcamPromiseRef.current = null;
    if (webcamStream) {
      webcamStream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    }
    const video = webcamVideoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, [webcamStream]);

  useEffect(() => {
    if (storedPanelPositionRef.current || appliedDefaultPanelPositionRef.current) {
      return;
    }
    const panelEl = panelRef.current;
    if (!panelEl) {
      return;
    }
    const toolbarEl = document.querySelector<HTMLElement>(".App-toolbar-container");
    const toolbarRect = toolbarEl?.getBoundingClientRect();
    if (!toolbarRect) {
      return;
    }
    const panelRect = panelEl.getBoundingClientRect();
    const margin = 12;
    const maxX = Math.max(0, window.innerWidth - panelRect.width - margin);
    const maxY = Math.max(0, window.innerHeight - panelRect.height - margin);
    const next = {
      x: Math.min(maxX, Math.max(margin, toolbarRect.right + margin)),
      y: Math.min(maxY, Math.max(margin, toolbarRect.top)),
    };
    setPanelPosition(next);
    appliedDefaultPanelPositionRef.current = true;
  }, []);

  useEffect(() => {
    if (storedPanelPositionRef.current || appliedDefaultPanelPositionRef.current) {
      return;
    }
    let tries = 0;
    const tick = () => {
      if (storedPanelPositionRef.current || appliedDefaultPanelPositionRef.current) {
        return;
      }
      const panelEl = panelRef.current;
      const toolbarEl = document.querySelector<HTMLElement>(".App-toolbar-container");
      const toolbarRect = toolbarEl?.getBoundingClientRect();
      if (!panelEl || !toolbarRect) {
        tries++;
        if (tries < 30) {
          rafRef.current = window.requestAnimationFrame(tick);
        }
        return;
      }
      const panelRect = panelEl.getBoundingClientRect();
      const margin = 12;
      const maxX = Math.max(0, window.innerWidth - panelRect.width - margin);
      const maxY = Math.max(0, window.innerHeight - panelRect.height - margin);
      const next = {
        x: Math.min(maxX, Math.max(margin, toolbarRect.right + margin)),
        y: Math.min(maxY, Math.max(margin, toolbarRect.top)),
      };
      setPanelPosition(next);
      appliedDefaultPanelPositionRef.current = true;
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    webcamPositionRef.current = webcamPosition;
  }, [webcamPosition]);

  useEffect(() => {
    mousePositionRef.current = mousePosition;
  }, [mousePosition]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!open) {
      setIsPreviewing(false);
      setIsRecording(false);
      setIsPaused(false);
      setFrame(null);
      setIsSettingsOpen(false);
      setElapsedMs(0);
      elapsedBaseRef.current = 0;
      elapsedStartRef.current = null;
      stopWebcam();
    }
  }, [open, stopWebcam]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "excalidraw.recording.panelPosition",
        JSON.stringify(panelPosition),
      );
    } catch {
      return;
    }
  }, [panelPosition]);

  useEffect(() => {
    const clampToViewport = () => {
      const panelEl = panelRef.current;
      if (!panelEl) {
        return;
      }
      const rect = panelEl.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - rect.height);
      setPanelPosition((prev) => ({
        x: Math.max(0, Math.min(maxX, prev.x)),
        y: Math.max(0, Math.min(maxY, prev.y)),
      }));
    };
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  useEffect(() => {
    if (!isRecording || isPaused) {
      if (elapsedIntervalRef.current != null) {
        window.clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      return;
    }

    if (elapsedStartRef.current == null) {
      elapsedStartRef.current = performance.now();
    }
    if (elapsedIntervalRef.current != null) {
      return;
    }

    elapsedIntervalRef.current = window.setInterval(() => {
      if (elapsedStartRef.current == null) {
        return;
      }
      setElapsedMs(elapsedBaseRef.current + (performance.now() - elapsedStartRef.current));
    }, 200);

    return () => {
      if (elapsedIntervalRef.current != null) {
        window.clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [isPaused, isRecording]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        RECORDING_SETTINGS_STORAGE_KEY,
        JSON.stringify(settings),
      );
    } catch {
      return;
    }
  }, [settings]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY };
      mousePressedRef.current = (event.buttons & 1) !== 0;
      if (isRecording) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    };
    const onMouseDown = () => {
      mousePressedRef.current = true;
    };
    const onMouseUp = () => {
      mousePressedRef.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isRecording]);

  const ensureWebcam = useCallback(async () => {
    if (!settings.webcamEnabled) {
      return null;
    }
    if (webcamStream) {
      return webcamStream;
    }
    if (webcamPromiseRef.current) {
      return webcamPromiseRef.current;
    }
    webcamPromiseRef.current = (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });
    setWebcamStream(stream);
    const video = webcamVideoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play();
    }
    return stream;
    })();
    try {
      return await webcamPromiseRef.current;
    } finally {
      webcamPromiseRef.current = null;
    }
  }, [settings.webcamEnabled, webcamStream]);

  const computeFrame = useCallback((nextSettings: RecordingSettings) => {
    const container = document.querySelector<HTMLElement>(".excalidraw-container");
    if (!container) {
      return null;
    }
    const { width, height } = getRecordingDimensions(nextSettings);
    const targetAspect = width / height;
    const containerRect = container.getBoundingClientRect();
    const nextFrame = computeDefaultFrameToFit({ containerRect, targetAspect });
    return nextFrame;
  }, []);

  const clampWebcamPositionToFrame = useCallback(
    (frame: RecordingFrame) => {
      const next = {
        x: Math.max(
          frame.x,
          Math.min(frame.x + frame.width - settings.webcamSize, webcamPositionRef.current.x),
        ),
        y: Math.max(
          frame.y,
          Math.min(frame.y + frame.height - settings.webcamSize, webcamPositionRef.current.y),
        ),
      };
      setWebcamPosition(next);
    },
    [settings.webcamSize],
  );

  useEffect(() => {
    if (!frame) {
      return;
    }
    clampWebcamPositionToFrame(frame);
  }, [clampWebcamPositionToFrame, frame]);

  const enterPreview = useCallback(async () => {
    const nextFrame = computeFrame(settings);
    if (!nextFrame) {
      return;
    }
    setFrame(nextFrame);
    const webcamMargin = 20;
    setWebcamPosition({
      x: nextFrame.x + nextFrame.width - settings.webcamSize - webcamMargin,
      y: nextFrame.y + nextFrame.height - settings.webcamSize - webcamMargin,
    });
    setIsPreviewing(true);
    await ensureWebcam();
  }, [computeFrame, ensureWebcam, settings]);

  const onPanelPointerDown = useCallback((event: ReactPointerEvent) => {
    event.preventDefault();
    const targetEl = event.target as HTMLElement | null;
    if (targetEl?.closest("button, a, input, select, textarea")) {
      return;
    }
    const panelEl = panelRef.current;
    if (!panelEl) {
      return;
    }
    const startPointer = { x: event.clientX, y: event.clientY };
    const startPos = panelPosition;
    const panelRect = panelEl.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - panelRect.width);
    const maxY = Math.max(0, window.innerHeight - panelRect.height);

    panelEl.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startPointer.x;
      const dy = moveEvent.clientY - startPointer.y;
      const next = {
        x: Math.max(0, Math.min(maxX, startPos.x + dx)),
        y: Math.max(0, Math.min(maxY, startPos.y + dy)),
      };
      setPanelPosition(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [panelPosition]);

  const onFramePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!isPreviewing || isRecording) {
        return;
      }
      const startFrame = frameRef.current;
      if (!startFrame) {
        return;
      }
      const container = document.querySelector<HTMLElement>(".excalidraw-container");
      const containerRect = container?.getBoundingClientRect();
      if (!containerRect) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const handle =
        (event.target as HTMLElement)?.dataset?.handle ||
        (event.currentTarget as HTMLElement)?.dataset?.handle;

      const startPointer = { x: event.clientX, y: event.clientY };
      const targetAspect = (() => {
        const { width, height } = getRecordingDimensions(settings);
        return width / height;
      })();

      const minWidth = 240;
      const minHeight = minWidth / targetAspect;

      const getAnchor = (h: string) => {
        switch (h) {
          case "nw":
            return { x: startFrame.x + startFrame.width, y: startFrame.y + startFrame.height };
          case "ne":
            return { x: startFrame.x, y: startFrame.y + startFrame.height };
          case "sw":
            return { x: startFrame.x + startFrame.width, y: startFrame.y };
          case "se":
          default:
            return { x: startFrame.x, y: startFrame.y };
        }
      };

      const computeResized = (h: string, pointerX: number, pointerY: number) => {
        const anchor = getAnchor(h);
        const dx = pointerX - anchor.x;
        const dy = pointerY - anchor.y;
        const widthCandidate = Math.abs(dx);
        const heightCandidate = Math.abs(dy);

        let width = widthCandidate;
        let height = width / targetAspect;
        if (height > heightCandidate) {
          height = heightCandidate;
          width = height * targetAspect;
        }

        width = Math.max(width, minWidth);
        height = Math.max(height, minHeight);

        const maxWidthByX = (() => {
          if (h === "nw" || h === "sw") {
            return anchor.x - containerRect.left;
          }
          return containerRect.right - anchor.x;
        })();
        const maxHeightByY = (() => {
          if (h === "nw" || h === "ne") {
            return anchor.y - containerRect.top;
          }
          return containerRect.bottom - anchor.y;
        })();
        const maxWidth = Math.min(maxWidthByX, maxHeightByY * targetAspect);
        width = Math.min(width, Math.max(0, maxWidth));
        height = width / targetAspect;

        const next = (() => {
          switch (h) {
            case "nw":
              return { x: anchor.x - width, y: anchor.y - height, width, height };
            case "ne":
              return { x: anchor.x, y: anchor.y - height, width, height };
            case "sw":
              return { x: anchor.x - width, y: anchor.y, width, height };
            case "se":
            default:
              return { x: anchor.x, y: anchor.y, width, height };
          }
        })();

        const clamped = {
          x: Math.max(containerRect.left, Math.min(containerRect.right - next.width, next.x)),
          y: Math.max(containerRect.top, Math.min(containerRect.bottom - next.height, next.y)),
          width: next.width,
          height: next.height,
        };
        return clamped;
      };

      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);

      if (handle) {
        const onMove = (moveEvent: PointerEvent) => {
          const next = computeResized(handle, moveEvent.clientX, moveEvent.clientY);
          setFrame(next);
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startPointer.x;
        const dy = moveEvent.clientY - startPointer.y;
        const next = {
          x: startFrame.x + dx,
          y: startFrame.y + dy,
          width: startFrame.width,
          height: startFrame.height,
        };
        const clamped = {
          x: Math.max(containerRect.left, Math.min(containerRect.right - next.width, next.x)),
          y: Math.max(containerRect.top, Math.min(containerRect.bottom - next.height, next.y)),
          width: next.width,
          height: next.height,
        };
        setFrame(clamped);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [isPreviewing, isRecording, settings],
  );

  const cancelPreview = useCallback(() => {
    setIsPreviewing(false);
    setFrame(null);
    stopWebcam();
  }, [stopWebcam]);

  const startRenderLoop = useCallback(() => {
    const outputCanvas = outputCanvasRef.current;
    if (!outputCanvas) {
      return;
    }
    const ctx = outputCanvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const { width, height } = getRecordingDimensions(settings);
    outputCanvas.width = width;
    outputCanvas.height = height;

    const tick = () => {
      const frameRate = Math.max(1, settingsRef.current.frameRate);
      const frameInterval = 1000 / frameRate;
      const now = performance.now();
      if (lastFrameTimeRef.current !== 0 && now - lastFrameTimeRef.current < frameInterval) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      lastFrameTimeRef.current = now;
      const excalidrawContainer = document.querySelector<HTMLElement>(".excalidraw-container");
      const renderSettings = { ...settingsRef.current, cursorEnabled: true };
      renderer.render({
        ctx,
        outputWidth: width,
        outputHeight: height,
        excalidrawContainer,
        frame: frameRef.current,
        settings: renderSettings,
        webcamVideo: webcamVideoRef.current,
        webcamPosition: webcamPositionRef.current,
        mousePosition: mousePositionRef.current,
        mousePressed: mousePressedRef.current,
      });

      recorderRef.current?.addFrame(outputCanvas);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [renderer, settings]);

  const stopRenderLoop = useCallback(() => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastFrameTimeRef.current = 0;
  }, []);

  const startRecording = useCallback(async () => {
    if (!frameRef.current) {
      await enterPreview();
    }

    lastFrameTimeRef.current = 0;
    const outputCanvas = outputCanvasRef.current;
    if (!outputCanvas) {
      return;
    }
    const webcamStreamForRecording = await ensureWebcam();
    const { width, height } = getRecordingDimensions(settings);
    outputCanvas.width = width;
    outputCanvas.height = height;

    const ctrl = new RecorderController();
    recorderRef.current = ctrl;
    setIsPreviewing(false);
    setIsRecording(true);
    setIsPaused(false);
    setElapsedMs(0);
    elapsedBaseRef.current = 0;
    elapsedStartRef.current = performance.now();

    await ctrl.start({
      canvas: outputCanvas,
      settings,
      audioStream: settings.webcamEnabled ? webcamStreamForRecording ?? undefined : undefined,
    });

    startRenderLoop();
  }, [enterPreview, ensureWebcam, settings, startRenderLoop]);

  const togglePause = useCallback(() => {
    const ctrl = recorderRef.current;
    if (!ctrl) {
      return;
    }
    if (ctrl.isPaused) {
      ctrl.resume();
      setIsPaused(false);
      elapsedStartRef.current = performance.now();
    } else {
      ctrl.pause();
      setIsPaused(true);
      if (elapsedStartRef.current != null) {
        elapsedBaseRef.current =
          elapsedBaseRef.current + (performance.now() - elapsedStartRef.current);
        elapsedStartRef.current = null;
        setElapsedMs(elapsedBaseRef.current);
      }
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const ctrl = recorderRef.current;
    if (!ctrl) {
      return;
    }
    stopRenderLoop();
    setIsRecording(false);
    setIsPaused(false);
    setFrame(null);
    if (elapsedStartRef.current != null) {
      elapsedBaseRef.current =
        elapsedBaseRef.current + (performance.now() - elapsedStartRef.current);
      elapsedStartRef.current = null;
      setElapsedMs(elapsedBaseRef.current);
    }

    const result = await ctrl.stop();
    recorderRef.current = null;
    stopWebcam();

    const name = `excalidraw-recording-${Date.now()}`;
    const mimeType = result.mimeType.split(";")[0];
    const exportBlob =
      result.blob.type === mimeType ? result.blob : new Blob([result.blob], { type: mimeType });
    await fileSave(exportBlob, {
      name,
      extension: result.extension,
      description: t("buttons.exportVideo"),
      mimeTypes: [mimeType],
    } as any);
  }, [settings.webcamEnabled, stopRenderLoop, stopWebcam, webcamStream]);

  useEffect(() => {
    return () => {
      stopRenderLoop();
      webcamStream?.getTracks().forEach((t) => t.stop());
      if (elapsedIntervalRef.current != null) {
        window.clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  }, [stopRenderLoop, webcamStream]);

  useEffect(() => {
    if (settings.webcamEnabled) {
      return;
    }
    if (webcamStream) {
      stopWebcam();
    }
  }, [settings.webcamEnabled, webcamStream, stopWebcam]);

  const onWebcamPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!frameRef.current) {
        return;
      }
      event.preventDefault();
      const startPointer = { x: event.clientX, y: event.clientY };
      const startPos = webcamPositionRef.current;
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startPointer.x;
        const dy = moveEvent.clientY - startPointer.y;
        const frame = frameRef.current;
        const nextUnclamped = { x: startPos.x + dx, y: startPos.y + dy };
        if (!frame) {
          setWebcamPosition(nextUnclamped);
          return;
        }
        const minX = frame.x;
        const minY = frame.y;
        const maxX = frame.x + frame.width - settings.webcamSize;
        const maxY = frame.y + frame.height - settings.webcamSize;
        const next = {
          x: Math.max(minX, Math.min(maxX, nextUnclamped.x)),
          y: Math.max(minY, Math.min(maxY, nextUnclamped.y)),
        };
        setWebcamPosition(next);
      };
      const onUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [settings.webcamSize, setWebcamPosition],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="excalidraw-recording-overlay">
      <div
        ref={panelRef}
        className="excalidraw-recording-panel"
        style={{ transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)` }}
        onPointerDown={onPanelPointerDown}
      >
        <div
          className="excalidraw-recording-status"
          data-state={
            isPreviewing ? "preview" : isRecording ? (isPaused ? "paused" : "recording") : "idle"
          }
        >
          <span className="excalidraw-recording-status__dot" />
          <span className="excalidraw-recording-status__time">
            {formatElapsed(isRecording || isPreviewing ? elapsedMs : 0)}
          </span>
        </div>

        <Island padding={2}>
          <Stack.Row
            gap={1}
            align="center"
            className="excalidraw-recording-controls"
          >
          {!isPreviewing && !isRecording && (
            <Button onSelect={enterPreview} className="excalidraw-recording-button">
              <RecordingButtonContent
                icon={eyeIcon}
                label={t("labels.recordingPreview")}
              />
            </Button>
          )}
          {isPreviewing && !isRecording && (
            <>
              <Button onSelect={startRecording} className="excalidraw-recording-button">
                <RecordingButtonContent
                  icon={recordingIcon}
                  label={t("labels.recordingStart")}
                />
              </Button>
              <Button onSelect={cancelPreview} className="excalidraw-recording-button">
                <RecordingButtonContent icon={CloseIcon} label={t("buttons.cancel")} />
              </Button>
            </>
          )}
          {isRecording && (
            <>
              <Button onSelect={togglePause} className="excalidraw-recording-button">
                <RecordingButtonContent
                  icon={isPaused ? playerPlayIcon : playerPauseIcon}
                  label={
                    isPaused ? t("labels.recordingResume") : t("labels.recordingPause")
                  }
                />
              </Button>
              <Button onSelect={stopRecording} className="excalidraw-recording-button">
                <RecordingButtonContent
                  icon={playerStopFilledIcon}
                  label={t("labels.recordingStop")}
                />
              </Button>
            </>
          )}
          <Button
            onSelect={() => setIsSettingsOpen(true)}
            disabled={isRecording}
            className="excalidraw-recording-button"
          >
            <RecordingButtonContent
              icon={adjustmentsIcon}
              label={t("labels.recordingSettings")}
            />
          </Button>
          {!isRecording && (
            <Button onSelect={onClose} className="excalidraw-recording-button">
              <span className="excalidraw-recording-button-content">{CloseIcon}</span>
            </Button>
          )}
          </Stack.Row>
        </Island>
      </div>

      {frame && (isPreviewing || isRecording) && (
        <div
          className="excalidraw-recording-frame"
          data-state={
            isPreviewing ? "preview" : isPaused ? "paused" : "recording"
          }
          data-editable={isPreviewing && !isRecording}
          onPointerDown={onFramePointerDown}
          style={{
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
          }}
        >
          {isPreviewing && !isRecording && (
            <>
              <div className="excalidraw-recording-frame__handle" data-handle="nw" />
              <div className="excalidraw-recording-frame__handle" data-handle="ne" />
              <div className="excalidraw-recording-frame__handle" data-handle="sw" />
              <div className="excalidraw-recording-frame__handle" data-handle="se" />
            </>
          )}
        </div>
      )}

      <div
        className="excalidraw-recording-webcam"
        style={{
          left: webcamPosition.x,
          top: webcamPosition.y,
          width: settings.webcamSize,
          height: settings.webcamSize,
          display: settings.webcamEnabled && webcamStream ? "block" : "none",
        }}
        onPointerDown={onWebcamPointerDown}
      >
        <video ref={webcamVideoRef} muted playsInline />
      </div>

      <canvas ref={outputCanvasRef} style={{ display: "none" }} />

      <RecordingSettingsDialog
        open={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onChange={(next) => {
          setSettings(next);
          if (!isRecording) {
            const nextFrame = computeFrame(next);
            if (nextFrame) {
              setFrame(nextFrame);
            }
          }
        }}
      />
    </div>
  );
};
