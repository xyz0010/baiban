import { useEffect, useRef } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { t } from "@excalidraw/excalidraw/i18n";

import type { RecordingSettings } from "../../recording/types";

type Props = {
  open: boolean;
  settings: RecordingSettings;
  onChange: (next: RecordingSettings) => void;
  onClose: () => void;
};

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (nextValue: number) => void;
  valueFormatter?: (value: number) => string;
};

const recordingBackgroundImages = [
  { label: "bg-1.jpg", value: "/recording-backgrounds/bg-1.jpg" },
  { label: "bg-2.jpg", value: "/recording-backgrounds/bg-2.jpg" },
  { label: "bg-3.jpg", value: "/recording-backgrounds/bg-3.jpg" },
  { label: "bg-4.jpg", value: "/recording-backgrounds/bg-4.jpg" },
];

const recordingQualityPresets = [
  { id: "low", frameRate: 24, videoBitrate: 3_000_000, audioBitrate: 96_000 },
  { id: "medium", frameRate: 30, videoBitrate: 6_000_000, audioBitrate: 128_000 },
  { id: "high", frameRate: 60, videoBitrate: 12_000_000, audioBitrate: 192_000 },
];

const RecordingSliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueFormatter,
}: SliderFieldProps) => {
  const rangeRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const clampedValue = Math.min(max, Math.max(min, value));
  const percent =
    max === min ? 0 : ((clampedValue - min) / (max - min)) * 100;

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth = 15;
      const position = (percent / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track, var(--color-primary-light)) 0%, var(--color-slider-track, var(--color-primary-light)) ${percent}%, var(--button-bg, var(--color-surface-high)) ${percent}%, var(--button-bg, var(--color-surface-high)) 100%)`;
    }
  }, [percent]);

  return (
    <label className="excalidraw-recording-settings__range">
      <span>{label}</span>
      <div className="range-wrapper">
        <input
          style={{
            ["--button-bg" as string]: "var(--color-surface-high)",
          }}
          ref={rangeRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={clampedValue}
          onChange={(e) =>
            onChange(setNumber(e.target.value, clampedValue, { min, max }))
          }
          className="range-input"
        />
        <div className="value-bubble" ref={valueRef}>
          {valueFormatter ? valueFormatter(clampedValue) : clampedValue}
        </div>
        {min === 0 ? <div className="zero-label">0</div> : null}
      </div>
    </label>
  );
};

const setNumber = (
  value: string,
  fallback: number,
  bounds?: { min?: number; max?: number },
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (bounds?.min != null && parsed < bounds.min) {
    return bounds.min;
  }
  if (bounds?.max != null && parsed > bounds.max) {
    return bounds.max;
  }
  return parsed;
};

export const RecordingSettingsDialog = ({
  open,
  settings,
  onChange,
  onClose,
}: Props) => {
  if (!open) {
    return null;
  }

  const qualityOptions = [
    {
      ...recordingQualityPresets[0],
      label: t("labels.recordingQualityLow"),
    },
    {
      ...recordingQualityPresets[1],
      label: t("labels.recordingQualityMedium"),
    },
    {
      ...recordingQualityPresets[2],
      label: t("labels.recordingQualityHigh"),
    },
  ];
  const defaultQuality = qualityOptions[1];
  const activeQuality =
    qualityOptions.find(
      (option) =>
        option.frameRate === settings.frameRate &&
        option.videoBitrate === settings.videoBitrate &&
        option.audioBitrate === settings.audioBitrate,
    ) ?? defaultQuality;

  const selectedImageValue = recordingBackgroundImages.some(
    (option) => option.value === settings.backgroundValue,
  )
    ? settings.backgroundValue
    : recordingBackgroundImages[0].value;

  useEffect(() => {
    if (
      settings.frameRate !== activeQuality.frameRate ||
      settings.videoBitrate !== activeQuality.videoBitrate ||
      settings.audioBitrate !== activeQuality.audioBitrate
    ) {
      onChange({
        ...settings,
        frameRate: activeQuality.frameRate,
        videoBitrate: activeQuality.videoBitrate,
        audioBitrate: activeQuality.audioBitrate,
      });
      return;
    }
    if (
      settings.backgroundType !== "image" ||
      settings.backgroundValue !== selectedImageValue
    ) {
      onChange({
        ...settings,
        backgroundType: "image",
        backgroundValue: selectedImageValue,
      });
    }
  }, [activeQuality, onChange, selectedImageValue, settings]);

  return (
    <Dialog
      title={t("labels.recordingSettings")}
      onCloseRequest={onClose}
      size="small"
    >
      <div className="excalidraw-recording-settings">
        <label>
          <span>{t("labels.recordingAspectRatio")}</span>
          <select
            value={settings.aspectRatioPreset}
            onChange={(e) =>
              onChange({ ...settings, aspectRatioPreset: e.target.value as any })
            }
          >
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="custom">{t("labels.recordingCustom")}</option>
          </select>
        </label>

        {settings.aspectRatioPreset === "custom" && (
          <div className="excalidraw-recording-settings__grid2">
            <RecordingSliderField
              label={t("labels.recordingWidth")}
              value={settings.customWidth}
              min={320}
              max={7680}
              onChange={(value) =>
                onChange({
                  ...settings,
                  customWidth: value,
                })
              }
            />
            <RecordingSliderField
              label={t("labels.recordingHeight")}
              value={settings.customHeight}
              min={240}
              max={4320}
              onChange={(value) =>
                onChange({
                  ...settings,
                  customHeight: value,
                })
              }
            />
          </div>
        )}

        <label>
          <span>{t("labels.recordingQuality")}</span>
          <select
            value={activeQuality.id}
            onChange={(e) => {
              const next =
                qualityOptions.find((option) => option.id === e.target.value) ??
                defaultQuality;
              onChange({
                ...settings,
                frameRate: next.frameRate,
                videoBitrate: next.videoBitrate,
                audioBitrate: next.audioBitrate,
              });
            }}
          >
            {qualityOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="excalidraw-recording-settings__background">
          <span>{t("labels.recordingBackground")}</span>
          <div className="excalidraw-recording-settings__background-grid">
            {recordingBackgroundImages.map((option) => (
              <button
                key={option.value}
                type="button"
                className="excalidraw-recording-settings__background-option"
                data-selected={option.value === selectedImageValue}
                style={{ backgroundImage: `url(${option.value})` }}
                onClick={() => onChange({ ...settings, backgroundValue: option.value })}
              >
              </button>
            ))}
          </div>
        </div>

        <label className="excalidraw-recording-settings__toggle">
          <input
            type="checkbox"
            checked={settings.webcamEnabled}
            onChange={(e) => onChange({ ...settings, webcamEnabled: e.target.checked })}
          />
          <span>{t("labels.recordingWebcam")}</span>
        </label>

        {settings.webcamEnabled && (
          <RecordingSliderField
            label={t("labels.recordingWebcamSize")}
            value={settings.webcamSize}
            min={80}
            max={360}
            onChange={(value) =>
              onChange({
                ...settings,
                webcamSize: value,
              })
            }
          />
        )}

        <label className="excalidraw-recording-settings__toggle">
          <input
            type="checkbox"
            checked={settings.titleEnabled}
            onChange={(e) => onChange({ ...settings, titleEnabled: e.target.checked })}
          />
          <span>{t("labels.recordingTitle")}</span>
        </label>

        {settings.titleEnabled && (
          <div className="excalidraw-recording-settings">
            <label>
              <span>{t("labels.recordingText")}</span>
              <input
                type="text"
                value={settings.titleText}
                onChange={(e) => onChange({ ...settings, titleText: e.target.value })}
              />
            </label>
            <label>
              <span>{t("labels.recordingPosition")}</span>
              <select
                value={settings.titlePosition}
                onChange={(e) =>
                  onChange({ ...settings, titlePosition: e.target.value as any })
                }
              >
                <option value="bottom-left">{t("labels.recordingBottomLeft")}</option>
                <option value="bottom-right">{t("labels.recordingBottomRight")}</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </Dialog>
  );
};
