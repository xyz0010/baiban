import React from "react";

import { CURSOR_TYPE, KEYS } from "@excalidraw/common";
import { act } from "@testing-library/react";
import { vi } from "vitest";

import { Excalidraw } from "../index";
import type { DataURL } from "../types";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { render, GlobalTestState } from "./test-utils";

const mouse = new Pointer("mouse");
const touch = new Pointer("touch");
const pen = new Pointer("pen");
const pointerTypes = [mouse, touch, pen];

describe("view mode", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  it("after switching to view mode – cursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });
    expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
      CURSOR_TYPE.GRAB,
    );
  });

  it("after switching to view mode, moving, clicking, and pressing space key – cursor type should be pointer", async () => {
    API.setAppState({ viewModeEnabled: true });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;
      pointer.reset();
      pointer.move(100, 100);
      pointer.click();
      Keyboard.keyPress(KEYS.SPACE);
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it("cursor should stay as grabbing type when hovering over canvas elements", async () => {
    // create a rectangle, then hover over it – cursor should be
    // move type for mouse and grab for touch & pen
    // then switch to view-mode and cursor should be grabbing type
    UI.createElement("rectangle", { size: 100 });

    pointerTypes.forEach((pointerType) => {
      const pointer = pointerType;

      pointer.moveTo(50, 50);
      // eslint-disable-next-line dot-notation
      if (pointerType["pointerType"] === "mouse") {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.MOVE,
        );
      } else {
        expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
          CURSOR_TYPE.GRAB,
        );
      }

      API.setAppState({ viewModeEnabled: true });
      expect(GlobalTestState.interactiveCanvas.style.cursor).toBe(
        CURSOR_TYPE.GRAB,
      );
    });
  });

  it("clicking Office attachment in view mode opens Microsoft online preview for remote URL", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const fileId = "file-id" as any;
    const remoteURL = "https://example.com/test.docx";

    const attachmentElement = API.createElement({
      type: "image",
      fileId,
      width: 200,
      height: 120,
    });

    API.updateScene({ elements: [attachmentElement] });

    act(() => {
      // @ts-ignore
      window.h.app.addFiles([
        {
          id: fileId,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          dataURL: remoteURL as DataURL,
          created: Date.now(),
        },
      ]);
    });

    API.setAppState({ viewModeEnabled: true });

    mouse.clickOn(attachmentElement);

    expect(openSpy).toHaveBeenCalledWith(
      `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        remoteURL,
      )}`,
    );

    openSpy.mockRestore();
  });
});
