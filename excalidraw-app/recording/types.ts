export type AspectRatioPreset = "16:9" | "4:3" | "9:16" | "1:1" | "custom";

export type BackgroundType = "none" | "solid" | "linearGradient";

export type TitlePosition = "bottom-left" | "bottom-right";

export type RecordingSettings = {
  aspectRatioPreset: AspectRatioPreset;
  customWidth: number;
  customHeight: number;
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  backgroundType: BackgroundType;
  backgroundValue: string;
  padding: number;
  cornerRadius: number;
  webcamEnabled: boolean;
  webcamSize: number;
  cursorEnabled: boolean;
  cursorColor: string;
  titleEnabled: boolean;
  titleText: string;
  titlePosition: TitlePosition;
};

export type RecordingFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = { x: number; y: number };

export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  aspectRatioPreset: "16:9",
  customWidth: 1920,
  customHeight: 1080,
  frameRate: 30,
  videoBitrate: 6_000_000,
  audioBitrate: 128_000,
  backgroundType: "solid",
  backgroundValue: "#ffffff",
  padding: 32,
  cornerRadius: 12,
  webcamEnabled: true,
  webcamSize: 160,
  cursorEnabled: true,
  cursorColor: "#ef4444",
  titleEnabled: false,
  titleText: "",
  titlePosition: "bottom-left",
};

export const RECORDING_SETTINGS_STORAGE_KEY = "excalidraw-recording-settings";

export const getRecordingDimensions = (settings: RecordingSettings) => {
  if (settings.aspectRatioPreset === "custom") {
    return { width: settings.customWidth, height: settings.customHeight };
  }

  switch (settings.aspectRatioPreset) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "4:3":
      return { width: 1440, height: 1080 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    default:
      return { width: 1920, height: 1080 };
  }
};
