import { EDITOR_LS_KEYS } from "@excalidraw/common";

import {
  expandPromptVariables,
  loadPromptLibrary,
  markPromptTemplateUsed,
  savePromptLibrary,
} from "./promptLibrary";

describe("promptLibrary", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should return defaults on empty storage", () => {
    const data = loadPromptLibrary();
    expect(data.version).toBe(1);
    expect(data.items).toEqual([]);
    expect(data.settings).toEqual({ trigger: "backtick", anchor: "textarea" });
  });

  it("should roundtrip save/load", () => {
    const ok = savePromptLibrary({
      version: 1,
      items: [
        {
          id: "p1",
          title: "T",
          content: "C",
          createdAt: 1,
          updatedAt: 2,
          tags: ["a", "b"],
          useCount: 3,
        },
      ],
      settings: { trigger: "ctrl_backtick", anchor: "caret" },
    });
    expect(ok).toBe(true);

    const data = loadPromptLibrary();
    expect(data.items[0]).toMatchObject({
      id: "p1",
      title: "T",
      content: "C",
      tags: ["a", "b"],
      useCount: 3,
    });
    expect(data.settings).toEqual({ trigger: "ctrl_backtick", anchor: "caret" });
  });

  it("should fallback on invalid stored data", () => {
    window.localStorage.setItem(EDITOR_LS_KEYS.PROMPT_LIBRARY, "not-json");
    const data = loadPromptLibrary();
    expect(data.items).toEqual([]);
  });

  it("should expand variables", () => {
    const date = new Date(2020, 0, 2, 3, 4, 5);
    expect(expandPromptVariables("{{date}}", date)).toBe("2020/1/2");
    expect(expandPromptVariables("{{time}}", date)).toBe("3:04");
    expect(expandPromptVariables("{{datetime}}", date)).toBe("2020/1/2/3:04");
  });

  it("should increment use count beyond 5", () => {
    const ok = savePromptLibrary({
      version: 1,
      items: [
        {
          id: "p1",
          title: "T",
          content: "C",
          createdAt: 1,
          updatedAt: 2,
          useCount: 0,
        },
      ],
      settings: { trigger: "backtick", anchor: "textarea" },
    });
    expect(ok).toBe(true);

    let data = loadPromptLibrary();
    for (let i = 0; i < 6; i++) {
      data = markPromptTemplateUsed(data, "p1");
    }
    expect(data.items[0].useCount).toBe(6);
  });
});
