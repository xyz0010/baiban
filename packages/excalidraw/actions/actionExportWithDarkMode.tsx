import { CaptureUpdateAction } from "@excalidraw/element";

import { CheckboxItem } from "../components/CheckboxItem";
import { t } from "../i18n";

import { register } from "./register";

export const actionExportWithDarkMode = register<boolean>({
  name: "exportWithDarkMode",
  label: "imageExportDialog.label.darkMode",
  trackEvent: { category: "export", action: "darkMode" },
  perform: (_elements, appState, value) => {
    return {
      appState: { ...appState, exportWithDarkMode: value },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ appState, updateData }) => (
    <CheckboxItem
      checked={appState.exportWithDarkMode}
      onChange={(checked) => updateData(checked)}
    >
      {t("imageExportDialog.label.darkMode")}
    </CheckboxItem>
  ),
});
