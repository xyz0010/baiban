import React from "react";

import { createPromptTemplate, loadPromptLibrary, savePromptLibrary } from "../data/promptLibrary";
import { t } from "../i18n";
import type { UIAppState } from "../types";

import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { LoadIcon, PlusIcon, TrashIcon, checkIcon, slashIcon } from "./icons";

import "./PromptLibraryDialog.scss";

type PromptTemplate = ReturnType<typeof loadPromptLibrary>["items"][number];
type PromptLibraryData = ReturnType<typeof loadPromptLibrary>;

type BulkImportItem = { title: string; content: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const toBulkImportItems = (raw: string): BulkImportItem[] => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") {
            const content = item.trimEnd();
            const title = content.split(/\r?\n/, 1)[0]?.trim() ?? "";
            return { title, content };
          }
          if (isRecord(item)) {
            const title = typeof item.title === "string" ? item.title : "";
            const content = typeof item.content === "string" ? item.content : "";
            return { title, content };
          }
          return null;
        })
        .filter((item): item is BulkImportItem => !!item && !!item.title.trim());
    }

    if (
      isRecord(parsed) &&
      parsed.version === 1 &&
      Array.isArray(parsed.items)
    ) {
      return parsed.items
        .map((item) => {
          if (!isRecord(item)) {
            return null;
          }
          const title = typeof item.title === "string" ? item.title : "";
          const content = typeof item.content === "string" ? item.content : "";
          return { title, content };
        })
        .filter((item): item is BulkImportItem => !!item && !!item.title.trim());
    }
  } catch {
  }

  const headingMatches = trimmed.match(/^#{1,3}\s+.+$/gm);
  if (headingMatches?.length) {
    const lines = trimmed.split(/\r?\n/);
    const items: BulkImportItem[] = [];
    let currentTitle = "";
    let currentContent: string[] = [];
    const flush = () => {
      const title = currentTitle.trim();
      if (!title) {
        currentTitle = "";
        currentContent = [];
        return;
      }
      items.push({ title, content: currentContent.join("\n").trimEnd() });
      currentTitle = "";
      currentContent = [];
    };
    for (const line of lines) {
      const match = line.match(/^#{1,3}\s+(.*)$/);
      if (match) {
        if (currentTitle) {
          flush();
        }
        currentTitle = match[1] ?? "";
        continue;
      }
      if (currentTitle) {
        currentContent.push(line);
      }
    }
    if (currentTitle) {
      flush();
    }
    return items;
  }

  const blocks = trimmed
    .split(/\r?\n-{3,}\r?\n/g)
    .flatMap((chunk) => chunk.split(/\r?\n\s*\r?\n\s*\r?\n+/g))
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const [firstLine, ...rest] = block.split(/\r?\n/);
      const title = (firstLine ?? "").trim();
      const content = rest.join("\n").trimEnd();
      return { title, content: content || title };
    })
    .filter((item) => !!item.title);
};

const getDefaultSelectedId = (data: PromptLibraryData) => {
  return data.items[0]?.id ?? null;
};

export const PromptLibraryDialog = ({
  appState,
  setAppState,
}: {
  appState: UIAppState;
  setAppState: React.Component<any, UIAppState>["setState"];
}) => {
  const isOpen = appState.openDialog?.name === "promptLibrary";

  const [data, setData] = React.useState<PromptLibraryData>(() =>
    loadPromptLibrary(),
  );
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(() =>
    getDefaultSelectedId(loadPromptLibrary()),
  );
  const [bulkImportOpen, setBulkImportOpen] = React.useState(false);
  const [bulkImportText, setBulkImportText] = React.useState("");
  const [bulkImportError, setBulkImportError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    const latest = loadPromptLibrary();
    setData(latest);
    setSelectedId((prev) =>
      prev && latest.items.some((item) => item.id === prev)
        ? prev
        : getDefaultSelectedId(latest),
    );
  }, [isOpen]);

  React.useEffect(() => {
    if (selectedId) {
      return;
    }
    setSelectedId(getDefaultSelectedId(data));
  }, [data, selectedId]);

  const filteredItems = React.useMemo(() => {
    if (!isOpen) {
      return [];
    }
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return data.items;
    }
    return data.items.filter((item) => {
      const hay = `${item.title}\n${item.content}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [data.items, isOpen, query]);

  const selected = React.useMemo(
    () =>
      isOpen ? data.items.find((item) => item.id === selectedId) ?? null : null,
    [data.items, isOpen, selectedId],
  );

  const persist = React.useCallback((next: PromptLibraryData) => {
    setData(next);
    savePromptLibrary(next);
  }, []);

  const handleBulkImport = React.useCallback(() => {
    setBulkImportError(null);
    const items = toBulkImportItems(bulkImportText);
    if (!items.length) {
      setBulkImportError("没有识别到可导入的提示词");
      return;
    }
    if (items.length > 200) {
      setBulkImportError("单次最多导入 200 条");
      return;
    }

    const latest = loadPromptLibrary();
    const now = Date.now();
    const existingByTitle = new Map(
      latest.items.map((item) => [item.title.trim().toLowerCase(), item]),
    );
    const nextItems = latest.items.slice();
    const importedIds: string[] = [];

    for (const item of items) {
      const title = item.title.trim();
      if (!title) {
        continue;
      }
      const key = title.toLowerCase();
      const existing = existingByTitle.get(key);
      if (existing) {
        const idx = nextItems.findIndex((i) => i.id === existing.id);
        if (idx !== -1) {
          nextItems.splice(idx, 1, {
            ...existing,
            title,
            content: item.content ?? "",
            updatedAt: now,
          });
          importedIds.push(existing.id);
        }
        continue;
      }
      const created = createPromptTemplate({ title, content: item.content ?? "" });
      nextItems.unshift(created);
      existingByTitle.set(key, created);
      importedIds.push(created.id);
    }

    const next: PromptLibraryData = {
      version: 1,
      items: nextItems.sort((a, b) => b.updatedAt - a.updatedAt),
      settings: latest.settings,
    };
    persist(next);
    setSelectedId(importedIds[0] ?? getDefaultSelectedId(next));
    setBulkImportText("");
    setBulkImportOpen(false);
  }, [bulkImportText, persist]);

  const handleClose = React.useCallback(() => {
    setAppState({ openDialog: null });
  }, [setAppState]);

  const handleCreate = React.useCallback(() => {
    const latest = loadPromptLibrary();
    const baseTitle = t("promptLibrary.untitled").trim();
    const existingTitles = new Set(
      latest.items.map((item) => item.title.trim().toLowerCase()),
    );
    let title = baseTitle;
    if (existingTitles.has(title.toLowerCase())) {
      for (let i = 2; i < 10_000; i++) {
        const next = `${baseTitle} ${i}`;
        if (!existingTitles.has(next.toLowerCase())) {
          title = next;
          break;
        }
      }
    }
    const template = createPromptTemplate({ title, content: "" });
    const next: PromptLibraryData = {
      version: 1,
      items: [template, ...latest.items],
      settings: latest.settings,
    };
    persist(next);
    setSelectedId(template.id);
  }, [persist]);

  const handleDelete = React.useCallback(() => {
    if (!selectedId) {
      return;
    }
    const latest = loadPromptLibrary();
    const nextItems = latest.items.filter((item) => item.id !== selectedId);
    const next: PromptLibraryData = {
      version: 1,
      items: nextItems,
      settings: latest.settings,
    };
    persist(next);
    setSelectedId(nextItems[0]?.id ?? null);
  }, [persist, selectedId]);

  const updateSelected = React.useCallback(
    (patch: Partial<Pick<PromptTemplate, "title" | "content">>) => {
      if (!selectedId) {
        return;
      }
      const latest = loadPromptLibrary();
      const idx = latest.items.findIndex((item) => item.id === selectedId);
      if (idx === -1) {
        return;
      }
      const updated: PromptTemplate = {
        ...latest.items[idx],
        ...patch,
        updatedAt: Date.now(),
      };
      const nextItems = latest.items.slice();
      nextItems.splice(idx, 1, updated);
      const next: PromptLibraryData = {
        version: 1,
        items: nextItems.sort((a, b) => b.updatedAt - a.updatedAt),
        settings: latest.settings,
      };
      persist(next);
    },
    [persist, selectedId],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      size="wide"
      onCloseRequest={handleClose}
      title={t("promptLibrary.title")}
    >
      <div className="PromptLibraryDialog">
        <div className="PromptLibraryDialog__sidebar">
          <div className="PromptLibraryDialog__row">
            <input
              className="PromptLibraryDialog__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("promptLibrary.searchPlaceholder")}
            />
            <ToolButton
              type="button"
              size="small"
              title={t("promptLibrary.add")}
              aria-label={t("promptLibrary.add")}
              onClick={handleCreate}
              icon={PlusIcon}
            />
            <ToolButton
              type="button"
              size="small"
              title="批量导入"
              aria-label="批量导入"
              onClick={() => {
                setBulkImportError(null);
                setBulkImportOpen((prev) => !prev);
              }}
              icon={bulkImportOpen ? slashIcon : LoadIcon}
            />
          </div>
          {bulkImportOpen && (
            <div className="PromptLibraryDialog__bulkImport">
              <textarea
                className="PromptLibraryDialog__bulkTextarea"
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder={
                  "粘贴批量内容：\n- JSON：[{\"title\":\"...\",\"content\":\"...\"}, ...]\n- 文本：每条用“### 标题”开头，或用空行/--- 分隔（首行当标题）"
                }
              />
              {bulkImportError && (
                <div className="PromptLibraryDialog__bulkError">
                  {bulkImportError}
                </div>
              )}
              <div className="PromptLibraryDialog__bulkActions">
                <ToolButton
                  type="button"
                  size="small"
                  title="导入"
                  aria-label="导入"
                  disabled={!bulkImportText.trim()}
                  onClick={handleBulkImport}
                  icon={checkIcon}
                />
                <ToolButton
                  type="button"
                  size="small"
                  title="取消"
                  aria-label="取消"
                  onClick={() => {
                    setBulkImportError(null);
                    setBulkImportText("");
                    setBulkImportOpen(false);
                  }}
                  icon={slashIcon}
                />
              </div>
            </div>
          )}
          <div className="PromptLibraryDialog__list" role="menu">
            {filteredItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={
                  item.id === selectedId
                    ? "PromptLibraryDialog__item PromptLibraryDialog__item--active"
                    : "PromptLibraryDialog__item"
                }
                onClick={() => setSelectedId(item.id)}
              >
                <div className="PromptLibraryDialog__itemTitle">
                  {item.title || t("promptLibrary.untitled")}
                </div>
                <div className="PromptLibraryDialog__itemMeta">
                  {(item.useCount ?? 0).toString()}
                </div>
              </button>
            ))}
            {!filteredItems.length && (
              <div className="PromptLibraryDialog__empty">
                {t("promptLibrary.empty")}
              </div>
            )}
          </div>
        </div>

        <div className="PromptLibraryDialog__editor">
          {!selected && (
            <div className="PromptLibraryDialog__placeholder">
              {t("promptLibrary.selectHint")}
            </div>
          )}

          {selected && (
            <>
              <div className="PromptLibraryDialog__row">
                <input
                  className="PromptLibraryDialog__title"
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  placeholder={t("promptLibrary.titlePlaceholder")}
                />
                <ToolButton
                  type="button"
                  size="small"
                  title={t("promptLibrary.delete")}
                  aria-label={t("promptLibrary.delete")}
                  onClick={handleDelete}
                  icon={TrashIcon}
                />
              </div>
              <textarea
                className="PromptLibraryDialog__content"
                value={selected.content}
                onChange={(e) => updateSelected({ content: e.target.value })}
                placeholder={t("promptLibrary.contentPlaceholder")}
              />
              <div className="PromptLibraryDialog__hint">
                {t("promptLibrary.variablesHint")}
              </div>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
};
