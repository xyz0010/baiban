import type { Point, RecordingFrame, RecordingSettings } from "./types";

type RenderOptions = {
  ctx: CanvasRenderingContext2D;
  outputWidth: number;
  outputHeight: number;
  excalidrawContainer: HTMLElement | null;
  frame: RecordingFrame | null;
  settings: RecordingSettings;
  webcamVideo: HTMLVideoElement | null;
  webcamPosition: Point;
  mousePosition: Point;
  mousePressed: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const parseLinearGradient = (
  ctx: CanvasRenderingContext2D,
  gradientValue: string,
  width: number,
  height: number,
) => {
  const match = gradientValue.match(
    /linear-gradient\(\s*(\d+)deg\s*,\s*([^,]+)\s+\d+%\s*,\s*([^)]+)\s+\d+%\s*\)/i,
  );
  if (!match) {
    return gradientValue;
  }
  const angleDeg = Number(match[1]);
  const color1 = match[2].trim();
  const color2 = match[3].trim().split(/\s+/)[0];

  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  const x1 = width / 2 - Math.cos(angleRad) * width;
  const y1 = height / 2 - Math.sin(angleRad) * height;
  const x2 = width / 2 + Math.cos(angleRad) * width;
  const y2 = height / 2 + Math.sin(angleRad) * height;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
};

const backgroundImageCache = new Map<string, HTMLImageElement>();

const getBackgroundImage = (src: string) => {
  if (!src) {
    return null;
  }
  const cached = backgroundImageCache.get(src);
  if (cached) {
    return cached;
  }
  const image = new Image();
  if (!src.startsWith("data:")) {
    image.crossOrigin = "anonymous";
  }
  image.src = src;
  backgroundImageCache.set(src, image);
  return image;
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) => {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (!imageWidth || !imageHeight) {
    return;
  }
  const targetRatio = width / height;
  const imageRatio = imageWidth / imageHeight;
  let drawWidth = width;
  let drawHeight = height;
  if (imageRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
  }
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
};

const drawBackground = ({
  ctx,
  settings,
  outputWidth,
  outputHeight,
}: Pick<RenderOptions, "ctx" | "settings" | "outputWidth" | "outputHeight">) => {
  if (settings.backgroundType === "none") {
    ctx.clearRect(0, 0, outputWidth, outputHeight);
    return;
  }

  if (settings.backgroundType === "linearGradient") {
    const fill = parseLinearGradient(
      ctx,
      settings.backgroundValue,
      outputWidth,
      outputHeight,
    );
    ctx.fillStyle = fill as any;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    return;
  }

  if (settings.backgroundType === "image") {
    const image = getBackgroundImage(settings.backgroundValue);
    if (!image || !image.complete) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      return;
    }
    drawImageCover(ctx, image, outputWidth, outputHeight);
    return;
  }

  ctx.fillStyle = settings.backgroundValue || "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
};

const drawExcalidrawContent = ({
  ctx,
  excalidrawContainer,
  frame,
  settings,
  outputWidth,
  outputHeight,
}: Pick<
  RenderOptions,
  "ctx" | "excalidrawContainer" | "frame" | "settings" | "outputWidth" | "outputHeight"
>) => {
  if (!excalidrawContainer || !frame) {
    return;
  }

  const canvases = Array.from(
    excalidrawContainer.querySelectorAll<HTMLCanvasElement>("canvas.excalidraw__canvas"),
  ).filter((c) => c.width > 0 && c.height > 0);
  if (!canvases.length) {
    return;
  }

  const containerRect = excalidrawContainer.getBoundingClientRect();
  const padding = settings.padding;
  const contentX = padding;
  const contentY = padding;
  const contentW = outputWidth - padding * 2;
  const contentH = outputHeight - padding * 2;

  const cornerRadius = settings.cornerRadius;
  createRoundedRectPath(ctx, contentX, contentY, contentW, contentH, cornerRadius);
  ctx.save();
  ctx.clip();

  canvases.forEach((srcCanvas) => {
    const scaleX = srcCanvas.width / containerRect.width;
    const scaleY = srcCanvas.height / containerRect.height;

    const srcX = (frame.x - containerRect.left) * scaleX;
    const srcY = (frame.y - containerRect.top) * scaleY;
    const srcW = frame.width * scaleX;
    const srcH = frame.height * scaleY;

    ctx.drawImage(
      srcCanvas,
      srcX,
      srcY,
      srcW,
      srcH,
      contentX,
      contentY,
      contentW,
      contentH,
    );
  });

  ctx.restore();
};

const drawWebcamBubble = ({
  ctx,
  settings,
  webcamVideo,
  webcamPosition,
  frame,
  outputWidth,
  outputHeight,
}: Pick<
  RenderOptions,
  | "ctx"
  | "settings"
  | "webcamVideo"
  | "webcamPosition"
  | "frame"
  | "outputWidth"
  | "outputHeight"
>) => {
  if (!settings.webcamEnabled || !webcamVideo || !frame) {
    return;
  }
  if (webcamVideo.readyState < 2 || webcamVideo.videoWidth <= 0 || webcamVideo.videoHeight <= 0) {
    return;
  }

  const padding = settings.padding;
  const contentX = padding;
  const contentY = padding;
  const contentW = outputWidth - padding * 2;
  const contentH = outputHeight - padding * 2;

  const scaleX = contentW / frame.width;
  const scaleY = contentH / frame.height;

  const relX = webcamPosition.x - frame.x;
  const relY = webcamPosition.y - frame.y;
  const x = contentX + relX * scaleX;
  const y = contentY + relY * scaleY;

  const bubbleSize = settings.webcamSize * Math.min(scaleX, scaleY);

  const videoW = webcamVideo.videoWidth;
  const videoH = webcamVideo.videoHeight;
  const videoAspect = videoW / videoH;
  let cropX = 0;
  let cropY = 0;
  let cropW = videoW;
  let cropH = videoH;

  if (videoAspect > 1) {
    cropW = videoH;
    cropX = (videoW - cropW) / 2;
  } else {
    cropH = videoW;
    cropY = (videoH - cropH) / 2;
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + bubbleSize / 2, y + bubbleSize / 2, bubbleSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.translate(x + bubbleSize, y);
  ctx.scale(-1, 1);
  ctx.drawImage(webcamVideo, cropX, cropY, cropW, cropH, 0, 0, bubbleSize, bubbleSize);

  ctx.restore();
};

const drawCursor = ({
  ctx,
  settings,
  mousePosition,
  mousePressed,
  frame,
  outputWidth,
  outputHeight,
}: Pick<
  RenderOptions,
  | "ctx"
  | "settings"
  | "mousePosition"
  | "mousePressed"
  | "frame"
  | "outputWidth"
  | "outputHeight"
>) => {
  if (!settings.cursorEnabled || !frame) {
    return;
  }

  const isInside =
    mousePosition.x >= frame.x &&
    mousePosition.x <= frame.x + frame.width &&
    mousePosition.y >= frame.y &&
    mousePosition.y <= frame.y + frame.height;
  if (!isInside) {
    return;
  }

  const padding = settings.padding;
  const contentX = padding;
  const contentY = padding;
  const contentW = outputWidth - padding * 2;
  const contentH = outputHeight - padding * 2;

  const scaleX = contentW / frame.width;
  const scaleY = contentH / frame.height;
  const cursorX = contentX + (mousePosition.x - frame.x) * scaleX;
  const cursorY = contentY + (mousePosition.y - frame.y) * scaleY;

  ctx.save();
  ctx.translate(cursorX, cursorY);
  ctx.scale(mousePressed ? 1.2 : 1.8, mousePressed ? 1.2 : 1.8);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(6, 20);
  ctx.lineTo(11, 30);
  ctx.lineTo(15, 28);
  ctx.lineTo(9, 18);
  ctx.lineTo(20, 18);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#111827";
  ctx.stroke();
  ctx.restore();
};

const drawTitle = ({
  ctx,
  settings,
  outputWidth,
  outputHeight,
}: Pick<RenderOptions, "ctx" | "settings" | "outputWidth" | "outputHeight">) => {
  if (!settings.titleEnabled || !settings.titleText) {
    return;
  }

  const paddingX = 20;
  const margin = 36;
  const bannerHeight = 48;
  const isLeft = settings.titlePosition === "bottom-left";

  ctx.save();
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(settings.titleText).width;
  const bannerWidth = textWidth + paddingX * 2;
  const x = isLeft ? margin : outputWidth - bannerWidth - margin;
  const y = outputHeight - bannerHeight - margin;

  ctx.fillStyle = "rgba(254, 252, 249, 0.92)";
  createRoundedRectPath(ctx, x, y, bannerWidth, bannerHeight, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#1c1917";
  ctx.fillText(settings.titleText, x + paddingX, y + bannerHeight / 2);
  ctx.restore();
};

export class CompositeRenderer {
  render(options: RenderOptions) {
    drawBackground(options);
    drawExcalidrawContent(options);
    drawWebcamBubble(options);
    drawCursor(options);
    drawTitle(options);
  }
}

export const computeDefaultFrameToFit = (opts: {
  containerRect: DOMRect;
  targetAspect: number;
}): RecordingFrame => {
  const { containerRect, targetAspect } = opts;
  const containerAspect = containerRect.width / containerRect.height;

  let width: number;
  let height: number;
  if (containerAspect > targetAspect) {
    height = containerRect.height * 0.9;
    width = height * targetAspect;
  } else {
    width = containerRect.width * 0.9;
    height = width / targetAspect;
  }

  const x = containerRect.left + (containerRect.width - width) / 2;
  const y = containerRect.top + (containerRect.height - height) / 2;
  return { x, y, width, height };
};
