import { register } from "./register";
import { getNonDeletedElements, CaptureUpdateAction } from "@excalidraw/element";
import { isFrameLikeElement, getFrameChildren } from "@excalidraw/element";
import { exportToCanvas } from "../scene/export";
import { jsPDF } from "jspdf";
import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";
import { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";

export const actionExportToPdf = register({
  name: "exportToPdf",
  label: "buttons.exportToPdf",
  trackEvent: { category: "export", action: "pdf" },
  perform: async (elements, appState, _, app) => {
    const frames = getNonDeletedElements(elements).filter((element) =>
      isFrameLikeElement(element),
    ) as unknown as ExcalidrawFrameLikeElement[];

    if (frames.length === 0) {
      return {
        commitToHistory: false,
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          ...appState,
          errorMessage: "No frames found to export to PDF.",
        },
      };
    }

    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });

    const compareByPosition = (a: ExcalidrawFrameLikeElement, b: ExcalidrawFrameLikeElement) => {
      if (Math.abs(a.y - b.y) > 10) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id.localeCompare(b.id);
    };

    const getNormalizedName = (frame: ExcalidrawFrameLikeElement) => {
      const name = frame.name?.trim();
      return name ? name : null;
    };

    frames.sort((a, b) => {
      const aName = getNormalizedName(a);
      const bName = getNormalizedName(b);

      if (aName && bName) {
        const byName = collator.compare(aName, bName);
        return byName !== 0 ? byName : compareByPosition(a, b);
      }

      if (aName || bName) {
        return aName ? -1 : 1;
      }

      return compareByPosition(a, b);
    });

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
      });

      for (const frame of frames) {
        const children = getFrameChildren(getNonDeletedElements(elements), frame.id);
        
        const canvas = await exportToCanvas(
          children,
          {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: "#ffffff",
          },
          app.files,
          {
            exportBackground: true,
            viewBackgroundColor: "#ffffff",
            exportingFrame: frame,
            exportPadding: DEFAULT_EXPORT_PADDING,
          }
        );

        const width = canvas.width;
        const height = canvas.height;

        // Add page matching the canvas size
        pdf.addPage([width, height], width > height ? "l" : "p");
        
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, width, height);
      }

      // Delete the default initial page
      pdf.deletePage(1);

      pdf.save("export.pdf");
    } catch (error: any) {
      console.error(error);
      return {
        commitToHistory: false,
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          ...appState,
          errorMessage: error.message,
        },
      };
    }

    return {
      commitToHistory: false,
      captureUpdate: CaptureUpdateAction.NEVER,
    };
  },
});
