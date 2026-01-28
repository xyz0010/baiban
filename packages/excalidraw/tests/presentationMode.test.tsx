import React from "react";
import { vi } from "vitest";

import { Excalidraw } from "../index";
import { actionTogglePresentationMode } from "../actions/actionTogglePresentationMode";

import { API } from "./helpers/api";
import { act, render, waitFor } from "./test-utils";

const { h } = window;

const waitForNextAnimationFrame = () => {
  return act(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      }),
  );
};

describe("presentation mode navigation", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame");

    (document as any).fullscreenElement = null;
    (document.documentElement as any).requestFullscreen = vi
      .fn()
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should animate camera when navigating to next frame", async () => {
    await render(<Excalidraw />);

    API.setAppState({ width: 800, height: 600 });

    const frame1 = API.createElement({
      type: "frame",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const frame2 = API.createElement({
      type: "frame",
      x: 1000,
      y: 500,
      width: 100,
      height: 100,
    });

    API.updateScene({ elements: [frame1, frame2] });
    API.executeAction(actionTogglePresentationMode);

    await waitFor(() => {
      expect(h.state.presentationModeEnabled).toBe(true);
      expect(h.state.activeTool.type).toBe("laser");
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(h.state.activeTool.type).toBe("hand");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
    });
    expect(h.state.activeTool.type).toBe("laser");

    (window.requestAnimationFrame as any).mockClear();

    const initialScrollX = h.state.scrollX;
    const initialScrollY = h.state.scrollY;

    act(() => {
      (h.app as any).navigatePresentation(1);
    });

    expect(window.requestAnimationFrame).toHaveBeenCalled();
    expect(h.state.scrollX).toBe(initialScrollX);
    expect(h.state.scrollY).toBe(initialScrollY);

    await waitForNextAnimationFrame();

    const prevScrollX = h.state.scrollX;
    const prevScrollY = h.state.scrollY;

    expect(h.state.scrollX).not.toBe(initialScrollX);
    expect(h.state.scrollY).not.toBe(initialScrollY);

    await waitForNextAnimationFrame();

    expect(h.state.scrollX).not.toBe(prevScrollX);
    expect(h.state.scrollY).not.toBe(prevScrollY);
  });
});
