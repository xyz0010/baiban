import {
  register,
} from "./register";
import { getSelectedElements } from "../scene";
import {
  getNonDeletedElements,
  isTextElement,
  getBoundTextElement
} from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import { createIcon } from "../components/icons";
import { ToolButton } from "../components/ToolButton";

const FlomoIcon = createIcon(
  <>
    <path
      fill="currentColor"
      d="M437.077333 309.290667c-11.306667 0-21.248 4.266667-29.354666 12.416l-0.170667 0.170666a42.410667 42.410667 0 0 0-12.245333 29.781334v356.992c0 11.434667 3.882667 21.461333 11.818666 29.354666 8.106667 8.149333 18.048 12.416 29.354667 12.416 11.605333 0 21.845333-4.181333 30.378667-12.245333l0.170666-0.128a40.448 40.448 0 0 0 12.373334-29.397333v-140.202667h164.181333c10.88 0 20.48-4.053333 28.586667-11.648l0.170666-0.213333a38.826667 38.826667 0 0 0 11.861334-28.16 39.509333 39.509333 0 0 0-11.861334-28.8 39.466667 39.466667 0 0 0-28.757333-11.818667h-164.138667V389.930667h184.533334c10.88 0 20.522667-4.010667 28.586666-11.648l0.213334-0.170667a38.826667 38.826667 0 0 0 11.818666-28.202667 39.466667 39.466667 0 0 0-11.818666-28.8 39.466667 39.466667 0 0 0-28.8-11.818666h-226.901334z"
    />
    <path
      fill="currentColor"
      d="M512 42.666667C252.8 42.666667 42.666667 252.8 42.666667 512s210.133333 469.333333 469.333333 469.333333 469.333333-210.133333 469.333333-469.333333S771.2 42.666667 512 42.666667zM128 512a384 384 0 1 1 768 0 384 384 0 0 1-768 0z"
    />
  </>,
  1024,
);

const flomoActionPredicate = (elements: any, appState: any, _: any, app: any) => {
  const selectedElements = getSelectedElements(elements, appState);
  if (selectedElements.length === 0) {
    return false;
  }
  return selectedElements.some((element: any) => {
    if (isTextElement(element)) {
      return true;
    }
    const boundText = getBoundTextElement(
      element,
      app.scene.getNonDeletedElementsMap(),
    );
    return !!boundText;
  });
};

export const actionSendToFlomo = register({
  name: "sendToFlomo",
  label: "发送到 Flomo",
  icon: FlomoIcon,
  trackEvent: { category: "element", action: "sendToFlomo" },
  perform: async (elements, appState, _, app) => {
    const selectedElements = getSelectedElements(
      getNonDeletedElements(elements),
      appState,
    );

    if (selectedElements.length === 0) {
      return {
        commitToHistory: false,
        appState: {
          ...appState,
          toast: {
            message: "No elements selected",
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const texts = selectedElements
      .map((element) => {
        if (isTextElement(element)) {
          return element.text;
        }
        const boundText = getBoundTextElement(
          element,
          app.scene.getNonDeletedElementsMap()
        );
        if (boundText) {
          return boundText.text;
        }
        return null;
      })
      .filter((text) => text !== null)
      .join("\n\n");

    if (!texts.trim()) {
      return {
        commitToHistory: false,
        appState: {
          ...appState,
          toast: {
            message: "选中元素没有文本内容",
            closable: true,
            duration: 3000,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    let flomoUrl = localStorage.getItem("FLOMO_API_URL");
    if (!flomoUrl) {
      flomoUrl = window.prompt("请输入您的 Flomo API URL:");
      if (flomoUrl) {
        localStorage.setItem("FLOMO_API_URL", flomoUrl);
      }
    }

    if (!flomoUrl) {
      return {
        commitToHistory: false,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    try {
      const response = await fetch(flomoUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: texts }),
      });

      if (response.ok) {
        return {
          commitToHistory: false,
          appState: {
            ...appState,
            toast: {
              message: "成功发送到 Flomo！",
              closable: true,
              duration: 3000,
            },
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        };
      } else {
        throw new Error(`发送失败: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(error);
      return {
        commitToHistory: false,
        appState: {
          ...appState,
          toast: {
            message: `发送到 Flomo 出错: ${error.message}`,
            closable: true,
          },
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }
  },
  predicate: flomoActionPredicate,
  PanelComponent: ({ elements, appState, updateData, app }) => {
    return (
      <ToolButton
        type="button"
        icon={FlomoIcon}
        title="发送到 Flomo"
        aria-label="发送到 Flomo"
        onClick={() => updateData(null)}
        hidden={!flomoActionPredicate(elements, appState, null, app)}
      />
    );
  },
});
