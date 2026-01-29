import React from "react";

import { loadPromptLibrary, savePromptLibrary } from "../data/promptLibrary";
import { t } from "../i18n";
import type { UIAppState } from "../types";

import { Dialog } from "./Dialog";
import { ToolButton } from "./ToolButton";
import { PlusIcon, TrashIcon } from "./icons";

import "./PromptLibraryDialog.scss";

type PromptTemplate = ReturnType<typeof loadPromptLibrary>["items"][number];
type PromptLibraryData = ReturnType<typeof loadPromptLibrary>;

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

  const handleClose = React.useCallback(() => {
    setAppState({ openDialog: null });
  }, [setAppState]);

  const handleCreate = React.useCallback(() => {
    const now = Date.now();
    const template: PromptTemplate = {
      id: String(now),
      title: t("promptLibrary.untitled"),
      content: "",
      createdAt: now,
      updatedAt: now,
      useCount: 0,
    };
    const latest = loadPromptLibrary();
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
          </div>
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
