import { createStore, get, set, del, entries } from "idb-keyval";

import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";

import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

const filesStore = createStore("excalidraw-content-db", "files-store");
const metadataStore = createStore("excalidraw-meta-db", "metadata-store");
const deletedFiles = new Set<string>();

export interface LocalFileMetadata {
  id: string;
  name: string;
  lastModified: number;
  createdAt: number;
}

export interface LocalFileData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
}

export const getFilesMetadata = async (): Promise<LocalFileMetadata[]> => {
  const metadata = await entries(metadataStore);
  return metadata
    .map(([_, value]) => value as LocalFileMetadata)
    .sort((a, b) => b.createdAt - a.createdAt);
};

export const saveFile = async (
  id: string,
  elements: readonly ExcalidrawElement[],
  appState: Partial<AppState>,
  name?: string,
) => {
  if (deletedFiles.has(id)) {
    return;
  }
  const now = Date.now();
  let metadata: LocalFileMetadata | undefined = await get(id, metadataStore);

  if (!metadata) {
    return;
  }

  metadata = {
    ...metadata,
    lastModified: now,
  };
  if (name) {
    metadata.name = name;
  }

  if (deletedFiles.has(id)) {
    return;
  }

  await set(id, metadata, metadataStore);
  await set(
    id,
    { elements, appState: clearAppStateForLocalStorage(appState) },
    filesStore,
  );
  return metadata;
};

export const createNewFile = async (name: string = "Untitled") => {
  const id = randomId();
  const now = Date.now();
  const metadata: LocalFileMetadata = {
    id,
    name,
    lastModified: now,
    createdAt: now,
  };
  // Initialize with empty data
  await set(id, metadata, metadataStore);
  await set(id, { elements: [], appState: {} }, filesStore);
  return metadata;
};

export const loadFile = async (
  id: string,
): Promise<LocalFileData | undefined> => {
  return await get(id, filesStore);
};

export const deleteFile = async (id: string) => {
  deletedFiles.add(id);
  await del(id, metadataStore);
  await del(id, filesStore);
};

export const renameFile = async (id: string, newName: string) => {
  const metadata: LocalFileMetadata | undefined = await get(id, metadataStore);
  if (metadata) {
    metadata.name = newName;
    metadata.lastModified = Date.now();
    await set(id, metadata, metadataStore);
  }
};
