import React from "react";
import { DefaultSidebar } from "@excalidraw/excalidraw/components/DefaultSidebar";
import { Sidebar } from "@excalidraw/excalidraw/components/Sidebar/Sidebar";

import { FileListSidebar } from "./FileListSidebar";

interface Props {
  onLoadFile: (id: string) => void;
  currentFileId: string | null;
}

export const AppSidebar = ({ onLoadFile, currentFileId }: Props) => {
  return (
    <>
      <DefaultSidebar.Content>
        <Sidebar.Tab tab="file-list">
          <FileListSidebar
            onLoadFile={onLoadFile}
            currentFileId={currentFileId}
          />
        </Sidebar.Tab>
      </DefaultSidebar.Content>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger tab="file-list" title="My Files">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2-2z"></path>
            </svg>
          </div>
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
    </>
  );
};
