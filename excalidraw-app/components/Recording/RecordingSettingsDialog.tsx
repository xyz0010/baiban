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

        <div className="excalidraw-recording-settings__grid2">
          <RecordingSliderField
            label={t("labels.recordingFrameRate")}
            value={settings.frameRate}
            min={5}
            max={60}
            onChange={(value) =>
              onChange({
                ...settings,
                frameRate: value,
              })
            }
          />
          <RecordingSliderField
            label={t("labels.recordingPadding")}
            value={settings.padding}
            min={0}
            max={200}
            onChange={(value) =>
              onChange({
                ...settings,
                padding: value,
              })
            }
          />
        </div>

        <div className="excalidraw-recording-settings__grid2">
          <RecordingSliderField
            label={t("labels.recordingCornerRadius")}
            value={settings.cornerRadius}
            min={0}
            max={64}
            onChange={(value) =>
              onChange({
                ...settings,
                cornerRadius: value,
              })
            }
          />
          <RecordingSliderField
            label={t("labels.recordingVideoBitrate")}
            value={Math.round(settings.videoBitrate / 1_000_000)}
            min={1}
            max={50}
            onChange={(value) =>
              onChange({ ...settings, videoBitrate: value * 1_000_000 })
            }
          />
        </div>

        <RecordingSliderField
          label={t("labels.recordingAudioBitrate")}
          value={Math.round(settings.audioBitrate / 1_000)}
          min={32}
          max={320}
          onChange={(value) =>
            onChange({ ...settings, audioBitrate: value * 1_000 })
          }
        />

        <label>
          <span>{t("labels.recordingBackground")}</span>
          <select
            value={settings.backgroundType}
            onChange={(e) =>
              onChange({ ...settings, backgroundType: e.target.value as any })
            }
          >
            <option value="solid">{t("labels.recordingSolid")}</option>
            <option value="linearGradient">{t("labels.recordingGradient")}</option>
            <option value="none">{t("labels.recordingNone")}</option>
          </select>
        </label>

        {settings.backgroundType === "solid" && (
          <label>
            <span>{t("labels.recordingColor")}</span>
            <input
              type="color"
              value={settings.backgroundValue}
              onChange={(e) => onChange({ ...settings, backgroundValue: e.target.value })}
            />
          </label>
        )}

        {settings.backgroundType === "linearGradient" && (
          <label>
            <span>{t("labels.recordingGradient")}</span>
            <input
              type="text"
              value={settings.backgroundValue}
              onChange={(e) => onChange({ ...settings, backgroundValue: e.target.value })}
              placeholder="linear-gradient(135deg, #fff 0%, #000 100%)"
            />
          </label>
        )}

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
            checked={settings.cursorEnabled}
            onChange={(e) => onChange({ ...settings, cursorEnabled: e.target.checked })}
          />
          <span>{t("labels.recordingCursor")}</span>
        </label>

        {settings.cursorEnabled && (
          <label>
            <span>{t("labels.recordingCursorColor")}</span>
            <input
              type="color"
              value={settings.cursorColor}
              onChange={(e) => onChange({ ...settings, cursorColor: e.target.value })}
            />
          </label>
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
