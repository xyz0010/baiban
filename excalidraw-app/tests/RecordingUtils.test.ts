import { describe, expect, it } from "vitest";

import { computeDefaultFrameToFit } from "../recording/CompositeRenderer";
import {
  DEFAULT_RECORDING_SETTINGS,
  getRecordingDimensions,
} from "../recording/types";

describe("recording utils", () => {
  it("should return preset dimensions", () => {
    expect(getRecordingDimensions(DEFAULT_RECORDING_SETTINGS)).toEqual({
      width: 1920,
      height: 1080,
    });

    expect(
      getRecordingDimensions({
        ...DEFAULT_RECORDING_SETTINGS,
        aspectRatioPreset: "9:16",
      }),
    ).toEqual({ width: 1080, height: 1920 });

    expect(
      getRecordingDimensions({
        ...DEFAULT_RECORDING_SETTINGS,
        aspectRatioPreset: "custom",
        customWidth: 1234,
        customHeight: 987,
      }),
    ).toEqual({ width: 1234, height: 987 });
  });

  it("should compute a centered frame matching target aspect", () => {
    const containerRect = new DOMRect(0, 0, 800, 600);
    const frame = computeDefaultFrameToFit({
      containerRect,
      targetAspect: 16 / 9,
    });

    expect(frame.width / frame.height).toBeCloseTo(16 / 9, 6);
    expect(frame.width).toBeCloseTo(720, 6);
    expect(frame.height).toBeCloseTo(405, 6);
    expect(frame.x).toBeCloseTo(40, 6);
    expect(frame.y).toBeCloseTo((600 - 405) / 2, 6);
  });
});

