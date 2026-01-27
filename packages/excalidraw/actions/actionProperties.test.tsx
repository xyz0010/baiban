import { queryByTestId } from "@testing-library/react";

import { pointFrom } from "@excalidraw/math";

import {
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  FONT_FAMILY,
  STROKE_WIDTH,
} from "@excalidraw/common";

import { Excalidraw } from "../index";
import { API } from "../tests/helpers/api";
import { UI } from "../tests/helpers/ui";
import { fireEvent, render, waitFor } from "../tests/test-utils";

describe("element locking", () => {
  beforeEach(async () => {
    await render(<Excalidraw />);
  });

  describe("properties when tool selected", () => {
    it("should show active background top picks", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
      });
      const activeColor = queryByTestId(
        document.body,
        `color-top-pick-${color}`,
      );
      expect(activeColor).toHaveClass("active");
    });

    it("should show fill style when background non-transparent", () => {
      UI.clickTool("rectangle");

      const color = DEFAULT_ELEMENT_BACKGROUND_PICKS[1];

      // just in case we change it in the future
      expect(color).not.toBe(COLOR_PALETTE.transparent);

      API.setAppState({
        currentItemBackgroundColor: color,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toHaveClass("active");
      API.setAppState({
        currentItemFillStyle: "solid",
      });
      const solidFillStyle = queryByTestId(document.body, `fill-solid`);
      expect(solidFillStyle).toHaveClass("active");
    });

    it("should not show fill style when background transparent", () => {
      UI.clickTool("rectangle");

      API.setAppState({
        currentItemBackgroundColor: COLOR_PALETTE.transparent,
        currentItemFillStyle: "hachure",
      });
      const hachureFillButton = queryByTestId(document.body, `fill-hachure`);

      expect(hachureFillButton).toBe(null);
    });

    it("should show horizontal text align for text tool", () => {
      UI.clickTool("text");

      API.setAppState({
        currentItemTextAlign: "right",
      });

      const centerTextAlign = queryByTestId(document.body, `align-right`);
      expect(centerTextAlign).toBeChecked();
    });

    it("should toggle highlighter preset and restore previous freedraw style", async () => {
      UI.clickTool("freedraw");

      API.setAppState({
        currentItemStrokeColor: COLOR_PALETTE.black,
        currentItemOpacity: 100,
        currentItemStrokeWidth: STROKE_WIDTH.thin,
      });

      const button = queryByTestId(document.body, "apply-highlighter-preset");
      expect(button).not.toBe(null);
      fireEvent.click(button as HTMLElement);

      const { h } = window as any;
      await waitFor(() => {
        expect(h.state.currentItemStrokeColor).toBe(
          DEFAULT_ELEMENT_STROKE_PICKS[4],
        );
      });
      expect(h.state.currentItemOpacity).toBe(35);
      expect(h.state.currentItemStrokeWidth).toBe(STROKE_WIDTH.extraBold);
      expect(h.state.freedrawHighlighterEnabled).toBe(true);

      fireEvent.click(button as HTMLElement);
      await waitFor(() => {
        expect(h.state.currentItemStrokeColor).toBe(COLOR_PALETTE.black);
      });
      expect(h.state.currentItemOpacity).toBe(100);
      expect(h.state.currentItemStrokeWidth).toBe(STROKE_WIDTH.thin);
      expect(h.state.freedrawHighlighterEnabled).toBe(false);
    });
  });

  describe("properties when elements selected", () => {
    it("should show active styles when single element selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: "red",
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toHaveClass("active");
    });

    it("should not show fill style selected element's background is transparent", () => {
      const rect = API.createElement({
        type: "rectangle",
        backgroundColor: COLOR_PALETTE.transparent,
        fillStyle: "cross-hatch",
      });
      API.setElements([rect]);
      API.setSelectedElements([rect]);

      const crossHatchButton = queryByTestId(document.body, `fill-cross-hatch`);
      expect(crossHatchButton).toBe(null);
    });

    it("should highlight common stroke width of selected elements", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      const thinStrokeWidthButton = queryByTestId(
        document.body,
        `strokeWidth-thin`,
      );
      expect(thinStrokeWidthButton).toBeChecked();
    });

    it("should not highlight any stroke width button if no common style", () => {
      const rect1 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.thin,
      });
      const rect2 = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.bold,
      });
      API.setElements([rect1, rect2]);
      API.setSelectedElements([rect1, rect2]);

      expect(queryByTestId(document.body, `strokeWidth-thin`)).not.toBe(null);
      expect(
        queryByTestId(document.body, `strokeWidth-thin`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-bold`),
      ).not.toBeChecked();
      expect(
        queryByTestId(document.body, `strokeWidth-extraBold`),
      ).not.toBeChecked();
    });

    it("should show properties of different element types when selected", () => {
      const rect = API.createElement({
        type: "rectangle",
        strokeWidth: STROKE_WIDTH.bold,
      });
      const text = API.createElement({
        type: "text",
        fontFamily: FONT_FAMILY["Comic Shanns"],
      });
      API.setElements([rect, text]);
      API.setSelectedElements([rect, text]);

      expect(queryByTestId(document.body, `strokeWidth-bold`)).toBeChecked();
      expect(queryByTestId(document.body, `font-family-code`)).toHaveClass(
        "active",
      );
    });

    it("should apply highlighter preset to selected freedraw elements", async () => {
      const freedraw = API.createElement({
        type: "freedraw",
        strokeColor: COLOR_PALETTE.black,
        strokeWidth: STROKE_WIDTH.thin,
        opacity: 100,
        points: [pointFrom(0, 0), pointFrom(10, 10)],
      });
      API.setElements([freedraw]);
      API.setSelectedElements([freedraw]);

      const button = queryByTestId(document.body, "apply-highlighter-preset");
      expect(button).not.toBe(null);
      fireEvent.click(button as HTMLElement);

      await waitFor(() => {
        const updated = API.getSelectedElement();
        expect(updated.type).toBe("freedraw");
        expect(updated.strokeColor).toBe(DEFAULT_ELEMENT_STROKE_PICKS[4]);
        expect(updated.opacity).toBe(35);
        expect(updated.strokeWidth).toBe(STROKE_WIDTH.extraBold);
      });
    });
  });
});
