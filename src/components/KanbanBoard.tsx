// src/components/KanbanBoard.tsx
import React, { useMemo, useState, useRef } from "react";
import { Task } from "./Sidebar";

type Props = {
  tasks: Task[];
  allocations: Record<string, number>;
  statuses: string[];
  onTaskDblClick?: (taskId: string) => void;
  onAddTask?: () => void;
  onDropTask?: (payload: {
    taskId: string;
    fromStatus: string;
    fromIndex: number;
    toStatus: string;
    toIndex: number;
  }) => void;
};

type DragPayload = {
  taskId: string;
  fromStatus: string;
  fromIndex: number;
};

const MIME1 = "application/x-task";
const MIME2 = "text/plain";

const KanbanBoard: React.FC<Props> = ({
  tasks,
  allocations,
  statuses,
  onTaskDblClick,
  onAddTask,
  onDropTask,
}) => {
  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach((s) => (map[s] = []));
    for (const t of tasks) {
      const s = (t as any).status ?? statuses[0];
      (map[s] ?? (map[s] = [])).push(t);
    }
    return map;
  }, [tasks, statuses]);

  const [hoverGuide, setHoverGuide] = useState<{
    status: string;
    index: number;
    position: "before" | "after";
  } | null>(null);

  const clearHover = () => setHoverGuide(null);

  // Payload data is now stored only in dataTransfer. No refs needed.
  // This simplifies the logic and makes it more reliable.

  const handleCardDragStart = (
    e: React.DragEvent,
    status: string,
    index: number,
    taskId: string
  ) => {
    console.debug("dragstart triggered", { taskId, status, index });
    try {
      e.dataTransfer.setData(MIME1, JSON.stringify({ taskId, fromStatus: status, fromIndex: index }));
      e.dataTransfer.setData(MIME2, JSON.stringify({ taskId, fromStatus: status, fromIndex: index }));
    } catch (err) {
      console.error("Failed to set drag data", err);
    }
    e.dataTransfer.effectAllowed = "move";
  };

  const getDragData = (e: React.DragEvent): DragPayload | null => {
    try {
      const a = e.dataTransfer.getData(MIME1);
      if (a) return JSON.parse(a);
      const b = e.dataTransfer.getData(MIME2);
      if (b) return JSON.parse(b);
    } catch (err) {
      console.error("Failed to get drag data", err);
    }
    return null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = "move"; } catch {}
  };

  // NEW: The core drop logic is here, but it also gets triggered by handleDrop events.
  const handleDrop = (e: React.DragEvent, toStatus: string, toIndex: number) => {
    console.debug("Drop event triggered", { toStatus, toIndex });
    e.preventDefault();
    const data = getDragData(e);
    if (!data || !onDropTask) {
      console.debug("No valid data or onDropTask missing.");
      return;
    }
    
    // Check if we are dropping on the same card, which is an invalid operation
    if (data.taskId === tasksByStatus[toStatus]?.[toIndex]?.id) {
        console.debug("Dropping on the same card, skipping.");
        return;
    }

    onDropTask({
      taskId: data.taskId,
      fromStatus: data.fromStatus,
      fromIndex: data.fromIndex,
      toStatus,
      toIndex,
    });

    clearHover();
  };

  const handleCardDragOver = (e: React.DragEvent, status: string, index: number) => {
    handleDragOver(e);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position: "before" | "after" = y < rect.height / 2 ? "before" : "after";
    setHoverGuide((prev) =>
      prev &&
      prev.status === status &&
      prev.index === index &&
      prev.position === position
        ? prev
        : { status, index, position }
    );
  };
  
  // This is the only onDrop handler. The other drop targets call this with calculated indices.
  const handleCardDrop = (e: React.DragEvent, status: string, index: number) => {
      const pos = hoverGuide?.position ?? "after";
      const toIndex = index + (pos === "after" ? 1 : 0);
      handleDrop(e, status, toIndex);
  }

  // Column drop handler: drop at the end of the column
  const handleColumnDrop = (e: React.DragEvent, status: string) => {
      const toIndex = tasksByStatus[status]?.length ?? 0;
      handleDrop(e, status, toIndex);
  }

  return (
    <div className="kanban-board-container" onDragOver={handleDragOver}>
      {statuses.map((status) => {
        const list = tasksByStatus[status] ?? [];

        return (
          <div
            key={status}
            className="kanban-column"
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleColumnDrop(e, status)}
          >
            <div className="kanban-column-header">
              <h3>{status}</h3>
            </div>

            <div
              className="kanban-column-tasks"
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleColumnDrop(e, status)}
            >
              {list.length === 0 && (
                <div className="kanban-empty">
                  {onAddTask ? (
                    <button className="tm-btn tm-btn-ghost" onClick={onAddTask}>
                      + Add task
                    </button>
                  ) : (
                    <div className="kanban-empty-hint">Drop here</div>
                  )}
                </div>
              )}

              {list.map((t, i) => {
                const planned = allocations[t.id] ?? 0;
                let pct = 0;
                let barColor = "var(--color-border)";
                if (t.estimateHours && t.estimateHours > 0) {
                  pct = Math.min(100, Math.round((planned / t.estimateHours) * 100));
                  if (pct <= 33) barColor = "var(--mulberry-40)";
                  else if (pct <= 66) barColor = "var(--mulberry-60)";
                  else barColor = "var(--mulberry-80)";
                }

                const showBefore =
                  hoverGuide &&
                  hoverGuide.status === status &&
                  hoverGuide.index === i &&
                  hoverGuide.position === "before";
                const showAfter =
                  hoverGuide &&
                  hoverGuide.status === status &&
                  hoverGuide.index === i &&
                  hoverGuide.position === "after";

                return (
                  <div
                    key={t.id}
                    className="tm-task-item"
                    draggable
                    onDragStart={(e) => handleCardDragStart(e, status, i, t.id)}
                    onDragOver={(e) => handleCardDragOver(e, status, i)}
                    onDrop={(e) => handleCardDrop(e, status, i)}
                    onDragEnd={clearHover} // On drag end, just clear the hover guide
                    onDoubleClick={() => onTaskDblClick?.(t.id)}
                  >
                    {showBefore && <div className="kanban-drop-indicator" />}

                    <div className="task-header">
                      <div className="task-title">{t.title}</div>
                      {typeof t.estimateHours === "number" && (
                        <div className="task-hours">{t.estimateHours}h</div>
                      )}
                    </div>

                    {t.description && <div className="task-desc">{t.description}</div>}

                    <div className="task-bar-row">
                      <div className="task-bar-container">
                        <div
                          className="task-bar-fill"
                          style={{ width: `${pct}%`, background: barColor }}
                        />
                      </div>
                      <div className="task-bar-label">
                        {planned} / {t.estimateHours ?? 0} hr
                      </div>
                    </div>

                    {showAfter && <div className="kanban-drop-indicator" />}
                  </div>
                );
              })}

              {/* якорь внизу — гарантированный дроп «в конец» */}
              <div
                className="kanban-bottom-dropzone"
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleColumnDrop(e, status)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;