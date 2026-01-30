import { EDITOR_LS_KEYS } from "@excalidraw/common";

import { nanoid } from "nanoid";

import type { JSONValue } from "../types";
import { EditorLocalStorage } from "./EditorLocalStorage";
import bundledDefaults from "./promptLibrary.defaults.json";

export type PromptTemplate = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags?: readonly string[];
  useCount?: number;
};

export type PromptLibraryData = {
  version: 1;
  items: readonly PromptTemplate[];
  settings?: {
    trigger: "backtick" | "ctrl_backtick" | "disabled";
    anchor: "textarea" | "caret";
  };
};

const DEFAULT_DATA: PromptLibraryData = {
  version: 1,
  items: [],
  settings: {
    trigger: "backtick",
    anchor: "textarea",
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const toNumberOrNull = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeSettings = (
  value: unknown,
): NonNullable<PromptLibraryData["settings"]> => {
  if (!isRecord(value)) {
    return DEFAULT_DATA.settings!;
  }
  const trigger = value.trigger;
  const anchor = value.anchor;
  if (
    (trigger === "backtick" ||
      trigger === "ctrl_backtick" ||
      trigger === "disabled") &&
    (anchor === "textarea" || anchor === "caret")
  ) {
    return { trigger, anchor };
  }
  return DEFAULT_DATA.settings!;
};

const normalizeTemplate = (value: unknown): PromptTemplate | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }
  if (typeof value.content !== "string") {
    return null;
  }
  const createdAt = toNumberOrNull(value.createdAt);
  const updatedAt = toNumberOrNull(value.updatedAt);
  if (createdAt === null || updatedAt === null) {
    return null;
  }
  const tags = value.tags;
  const useCount = toNumberOrNull(value.useCount);
  return {
    id: value.id,
    title: value.title,
    content: value.content,
    createdAt,
    updatedAt,
    ...(isStringArray(tags) ? { tags } : null),
    ...(useCount !== null ? { useCount } : null),
  };
};

const normalizeData = (value: unknown): PromptLibraryData => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) {
    return DEFAULT_DATA;
  }
  const items = value.items
    .map(normalizeTemplate)
    .filter((item): item is PromptTemplate => !!item)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const settings = normalizeSettings(value.settings);

  return {
    version: 1,
    items,
    settings,
  };
};

const normalizeBundledDefaults = (value: unknown): PromptLibraryData => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.items)) {
    return { version: 1, items: [], settings: DEFAULT_DATA.settings };
  }
  const items: PromptTemplate[] = [];
  for (const item of value.items) {
    if (!isRecord(item)) {
      continue;
    }
    const title = typeof item.title === "string" ? item.title.trim() : "";
    const content = typeof item.content === "string" ? item.content : "";
    if (!title) {
      continue;
    }
    const tags = isStringArray(item.tags) ? item.tags : undefined;
    items.push({
      id: `default:${title.toLowerCase()}`,
      title,
      content,
      createdAt: 0,
      updatedAt: 0,
      useCount: 0,
      ...(tags ? { tags } : null),
    });
  }
  const settings = normalizeSettings(value.settings);
  return { version: 1, items, settings };
};

export const loadPromptLibrary = (): PromptLibraryData => {
  const raw = EditorLocalStorage.get<JSONValue>(EDITOR_LS_KEYS.PROMPT_LIBRARY);
  const stored = normalizeData(raw);
  const defaults = normalizeBundledDefaults(bundledDefaults as unknown);
  if (!defaults.items.length) {
    return stored;
  }
  const existingTitles = new Set(
    stored.items.map((item) => item.title.trim().toLowerCase()),
  );
  const mergedItems = stored.items.slice();
  for (const item of defaults.items) {
    const key = item.title.trim().toLowerCase();
    if (!existingTitles.has(key)) {
      mergedItems.push(item);
    }
  }
  return {
    version: 1,
    items: mergedItems.sort((a, b) => b.updatedAt - a.updatedAt),
    settings: stored.settings ?? defaults.settings ?? DEFAULT_DATA.settings,
  };
};

export const savePromptLibrary = (data: PromptLibraryData) => {
  return EditorLocalStorage.set(EDITOR_LS_KEYS.PROMPT_LIBRARY, data);
};

export const createPromptTemplate = (opts: {
  title: string;
  content: string;
  tags?: readonly string[];
}): PromptTemplate => {
  const now = Date.now();
  return {
    id: nanoid(),
    title: opts.title,
    content: opts.content,
    createdAt: now,
    updatedAt: now,
    ...(opts.tags ? { tags: opts.tags } : null),
    useCount: 0,
  };
};

export const upsertPromptTemplate = (
  data: PromptLibraryData,
  template: PromptTemplate,
): PromptLibraryData => {
  const now = Date.now();
  const next: PromptTemplate = {
    ...template,
    updatedAt: now,
  };
  const existingIndex = data.items.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return {
      version: 1,
      items: [next, ...data.items],
      settings: data.settings ?? DEFAULT_DATA.settings,
    };
  }
  const items = data.items.slice();
  items.splice(existingIndex, 1, next);
  return {
    version: 1,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
    settings: data.settings ?? DEFAULT_DATA.settings,
  };
};

export const deletePromptTemplate = (
  data: PromptLibraryData,
  templateId: string,
): PromptLibraryData => {
  return {
    version: 1,
    items: data.items.filter((item) => item.id !== templateId),
    settings: data.settings ?? DEFAULT_DATA.settings,
  };
};

export const markPromptTemplateUsed = (
  data: PromptLibraryData,
  templateId: string,
): PromptLibraryData => {
  const idx = data.items.findIndex((item) => item.id === templateId);
  if (idx === -1) {
    return data;
  }
  const template = data.items[idx];
  const next: PromptTemplate = {
    ...template,
    useCount: (template.useCount ?? 0) + 1,
    updatedAt: Date.now(),
  };
  const items = data.items.slice();
  items.splice(idx, 1, next);
  return {
    version: 1,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
    settings: data.settings ?? DEFAULT_DATA.settings,
  };
};

export const updatePromptLibrarySettings = (
  data: PromptLibraryData,
  settings: PromptLibraryData["settings"],
): PromptLibraryData => {
  return {
    version: 1,
    items: data.items,
    settings: settings ?? DEFAULT_DATA.settings,
  };
};

const formatDateParts = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, "0");
  return { year, month, day, hour, minute };
};

export const expandPromptVariables = (
  content: string,
  date: Date = new Date(),
) => {
  const { year, month, day, hour, minute } = formatDateParts(date);
  return content.replace(
    /\{\{\s*(date|time|datetime)\s*\}\}/g,
    (_match, key: "date" | "time" | "datetime") => {
      if (key === "date") {
        return `${year}/${month}/${day}`;
      }
      if (key === "time") {
        return `${hour}:${minute}`;
      }
      return `${year}/${month}/${day}/${hour}:${minute}`;
    },
  );
};
