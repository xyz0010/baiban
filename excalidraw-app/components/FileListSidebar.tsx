import React, { useEffect, useState } from "react";
import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";

import {
  getFilesMetadata,
  createNewFile,
  deleteFile,
  renameFile,
  type LocalFileMetadata,
} from "../data/LocalFileStorage";

import "./FileListSidebar.scss";

interface Props {
  onLoadFile: (id: string) => void;
  currentFileId: string | null;
  onRename: (id: string, newName: string) => void;
  currentFileName?: string;
}

export const FileListSidebar = ({
  onLoadFile,
  currentFileId,
  onRename,
  currentFileName,
}: Props) => {
  const [files, setFiles] = useState<LocalFileMetadata[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [fileToDelete, setFileToDelete] = useState<LocalFileMetadata | null>(
    null,
  );

  const refreshFiles = async () => {
    const metadata = await getFilesMetadata();
    setFiles(metadata);
  };

  useEffect(() => {
    refreshFiles();
  }, [currentFileId, currentFileName]);

  const handleCreate = async () => {
    const newFile = await createNewFile();
    await refreshFiles();
    onLoadFile(newFile.id);
  };

  const handleDelete = (e: React.MouseEvent, file: LocalFileMetadata) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDelete = async () => {
    if (fileToDelete) {
      await deleteFile(fileToDelete.id);
      await refreshFiles();

      if (currentFileId === fileToDelete.id) {
        const remaining = await getFilesMetadata();
        if (remaining.length > 0) {
          onLoadFile(remaining[0].id);
        } else {
          handleCreate();
        }
      }
      setFileToDelete(null);
    }
  };

  const startRenaming = (e: React.MouseEvent, file: LocalFileMetadata) => {
    e.stopPropagation();
    setEditingId(file.id);
    setEditingName(file.name);
  };

  const handleRename = async () => {
    if (editingId) {
      await renameFile(editingId, editingName);
      onRename(editingId, editingName);
      setEditingId(null);
      refreshFiles();
    }
  };

  return (
    <div className="file-list-sidebar-content">
      <div className="file-list-header">
        <h3>My Files</h3>
        <button onClick={handleCreate} className="create-btn" title="New File">
          +
        </button>
      </div>
      <div className="file-list">
        {files.map((file) => (
          <div
            key={file.id}
            className={`file-item ${currentFileId === file.id ? "active" : ""}`}
            onClick={() => onLoadFile(file.id)}
          >
            {editingId === file.id ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="file-info">
                <span className="file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="file-date">
                  {new Date(file.createdAt).toLocaleString()}
                </span>
              </div>
            )}
            <div className="file-actions">
              <button onClick={(e) => startRenaming(e, file)} title="Rename">
                ✎
              </button>
              <button
                onClick={(e) => handleDelete(e, file)}
                className="delete-btn"
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      {fileToDelete && (
        <ConfirmDialog
          onConfirm={confirmDelete}
          onCancel={() => setFileToDelete(null)}
          title="Delete File"
        >
          <p>Are you sure you want to delete "{fileToDelete.name}"?</p>
        </ConfirmDialog>
      )}
    </div>
  );
};
