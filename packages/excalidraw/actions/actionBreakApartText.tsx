import {
  getFontString,
  MOBILE_ACTION_BUTTON_BG,
} from "@excalidraw/common";
import {
  isTextElement,
  newTextElement,
  measureText,
  newElementWith,
} from "@excalidraw/element";
import { register } from "./register";
import { BreakApartIcon } from "../components/icons";
import { CaptureUpdateAction } from "@excalidraw/element";
import type { ExcalidrawTextElement, OrderedExcalidrawElement } from "@excalidraw/element/types";
import { ToolButton } from "../components/ToolButton";
import { useStylesPanelMode } from "../components/App";
import { useI18n } from "../i18n";

export const actionBreakApartText = register({
  name: "breakApartText",
  label: "labels.breakApartText",
  contextItemLabel: "labels.breakApartText",
  icon: BreakApartIcon,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    return selectedElements.some(
      (element) => isTextElement(element) && element.text.includes("\n"),
    );
  },
  perform: (elements, appState, _, app) => {
    const selectedElements = app.scene.getSelectedElements(appState);
    const textElements = selectedElements.filter(isTextElement);

    if (textElements.length === 0) {
      return false;
    }

    const newElements: ExcalidrawTextElement[] = [];
    const elementsToDelete = new Map<string, ExcalidrawTextElement>();
    const containersToUpdate = new Map<string, string>();

    textElements.forEach((element) => {
      if (!element.text.includes("\n")) {
        return;
      }
      elementsToDelete.set(element.id, element);
      if (element.containerId) {
        containersToUpdate.set(element.containerId, element.id);
      }
    });

    if (elementsToDelete.size === 0) {
      return false;
    }

    const nextElements = elements.flatMap((element) => {
      if (containersToUpdate.has(element.id)) {
        const textIdToRemove = containersToUpdate.get(element.id);
        const nextBoundElements = element.boundElements?.filter(
          (be) => be.id !== textIdToRemove,
        );
        return [
          newElementWith(element, {
            boundElements: nextBoundElements?.length ? nextBoundElements : null,
          }),
        ];
      }

      if (elementsToDelete.has(element.id)) {
        const textElement = elementsToDelete.get(element.id)!;
        const lines = textElement.text.split("\n");
        const fontString = getFontString(textElement);
        const lineHeight = textElement.lineHeight;
        
        let currentY = textElement.y;
        const replacements: ExcalidrawTextElement[] = [];

        lines.forEach((line) => {
            const metrics = measureText(line, fontString, lineHeight);
            const newEl = newTextElement({
                x: textElement.x,
                y: currentY,
                text: line,
                originalText: line,
                fontSize: textElement.fontSize,
                fontFamily: textElement.fontFamily,
                textAlign: textElement.textAlign,
                verticalAlign: textElement.verticalAlign,
                strokeColor: textElement.strokeColor,
                backgroundColor: textElement.backgroundColor,
                fillStyle: textElement.fillStyle,
                strokeWidth: textElement.strokeWidth,
                strokeStyle: textElement.strokeStyle,
                roughness: textElement.roughness,
                opacity: textElement.opacity,
                angle: textElement.angle,
                groupIds: textElement.groupIds,
                frameId: textElement.frameId,
                roundness: textElement.roundness,
                boundElements: null, 
                containerId: null,
                link: textElement.link,
                locked: textElement.locked,
                lineHeight: textElement.lineHeight,
                autoResize: true,
            });
            replacements.push(newEl);
            newElements.push(newEl);
            currentY += metrics.height;
        });

        // Push the original deleted element and then the new replacements
        // This ensures the original is marked deleted in history and new ones appear
        return [newElementWith(textElement, { isDeleted: true }), ...replacements] as OrderedExcalidrawElement[];
      }
      return [element];
    });

    return {
      elements: nextElements as unknown as OrderedExcalidrawElement[],
      appState: {
        ...appState,
        selectedElementIds: Object.fromEntries(newElements.map(e => [e.id, true])),
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const { t } = useI18n();
    const stylesPanelMode = useStylesPanelMode();
    const isMobile = stylesPanelMode === "mobile";
    const selectedElements = app.scene.getSelectedElements(appState);
    const textElements = selectedElements.filter(isTextElement);
    const hasMultiLineText = textElements.some((e) => e.text.includes("\n"));

    if (!hasMultiLineText) {
      return null;
    }

    return (
      <ToolButton
        type="button"
        icon={BreakApartIcon}
        title={t("labels.breakApartText")}
        aria-label={t("labels.breakApartText")}
        onClick={() => updateData(null)}
        style={{
          ...(isMobile && appState.openPopup !== "compactOtherProperties"
            ? MOBILE_ACTION_BUTTON_BG
            : {}),
        }}
      />
    );
  },
});
