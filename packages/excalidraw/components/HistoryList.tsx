import React, { useEffect, useReducer, useRef } from "react";
import { useApp } from "./App";
import { HistoryEntry } from "../history";
import "./HistoryList.scss";
import { KEYS } from "@excalidraw/common";

const HistoryListItem = ({
  entry,
  isActive,
  onClick,
}: {
  entry: HistoryEntry | null;
  isActive: boolean;
  onClick: () => void;
}) => {
  const name = entry?.name || (entry ? "Action" : "Initial State");
  const time = entry ? new Date(entry.timestamp).toLocaleTimeString() : "";

  return (
    <div
      className={`history-entry ${isActive ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="history-entry-name">{name}</div>
      {time && <div className="history-entry-time">{time}</div>}
    </div>
  );
};

export const HistoryList = () => {
  const app = useApp();
  const history = app.history;

  // Force update when history changes
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    return history.onHistoryChangedEmitter.on(() => {
      forceUpdate();
    });
  }, [history]);

  const undoStack = history.undoStack;
  const redoStack = history.redoStack;

  const handleJumpToState = (targetIndex: number, isRedo: boolean) => {
    let entryToScroll: HistoryEntry | undefined;

    if (isRedo) {
        // Redo i + 1 times
        const actionRedo = app.actionManager.actions["redo"];
        // In redo stack loop below, we calculate `redos = redoStack.length - realIndex`
        // Here targetIndex is the index passed from the list item.
        // If coming from redo list, it's already calculated as `realIndex` if we pass it correctly?
        // Wait, the redo list logic below uses inline function.
        // Let's standardise to use this function.
        // But the inline function uses `realIndex`.
        // If I change the call in redo list to `handleJumpToState(realIndex, true)`,
        // then `targetIndex` here IS `realIndex`.
        
        // Number of redos needed = redoStack.length - targetIndex
        let count = redoStack.length - targetIndex;
        
        // The entry we are moving TO is the one at targetIndex in redoStack.
        entryToScroll = redoStack[targetIndex];

        while(count > 0 && actionRedo) {
            app.actionManager.executeAction(actionRedo, "ui");
            count--;
        }
    } else {
        // Undo
        // targetIndex is -1 for Initial State
        const actionUndo = app.actionManager.actions["undo"];
        const currentLength = undoStack.length;
        const targetLength = targetIndex + 1;
        let count = currentLength - targetLength;
        
        // The entry we are moving TO (staying at) is undoStack[targetIndex].
        if (targetIndex >= 0) {
            entryToScroll = undoStack[targetIndex];
        }

        while(count > 0 && actionUndo) {
            app.actionManager.executeAction(actionUndo, "ui");
            count--;
        }
    }

    if (entryToScroll) {
        const ids = [
            ...Object.keys(entryToScroll.delta.elements.added),
            ...Object.keys(entryToScroll.delta.elements.removed),
            ...Object.keys(entryToScroll.delta.elements.updated)
        ];
        
        const elements = app.scene.getElementsIncludingDeleted().filter(el => ids.includes(el.id));
        if (elements.length > 0) {
            app.scrollToContent(elements);
        }
    }
  };

  return (
    <div className="history-list">
      {/* Initial State */}
      <HistoryListItem
        entry={null}
        isActive={undoStack.length === 0}
        onClick={() => handleJumpToState(-1, false)}
      />

      {/* Undo Stack */}
      {undoStack.map((entry: HistoryEntry, index: number) => (
        <HistoryListItem
          key={entry.timestamp + index}
          entry={entry}
          isActive={index === undoStack.length - 1} 
          // If redoStack is empty, the last undo item is current.
          // Wait, current state is always "after last undo item".
          // If I highlight the state I am IN, it corresponds to the last applied action.
          // So undoStack[last] is active.
          onClick={() => handleJumpToState(index, false)}
        />
      ))}

      {/* Redo Stack (reversed for display: future down) */}
      {/* redoStack[0] is the NEXT action to redo. So it should be right below current. */}
      {[...redoStack].reverse().map((entry, index) => {
          // redoStack reversed: [last pushed (furthest future), ..., first pushed (nearest future)]
          // Wait. 
          // push(redoStack, entry) pushes to end.
          // pop(redoStack) takes from end.
          // So end of redoStack is the NEXT action.
          // So we should iterate reversed?
          // If stack is [A, B]. pop gives B. B is next.
          // So B should be top of list.
          // So we should iterate from length-1 down to 0.
          
          const realIndex = redoStack.length - 1 - index;
          const realEntry = redoStack[realIndex];
          
          return (
            <HistoryListItem
              key={realEntry.timestamp + realIndex}
              entry={realEntry}
              isActive={false}
              onClick={() => handleJumpToState(realIndex, true)}
            />
          );
      })}
    </div>
  );
};
