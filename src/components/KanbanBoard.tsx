// src/components/KanbanBoard.tsx
import React, { useMemo, useState } from "react";
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
      const s = t.status ?? statuses[0];
      (map[s] ?? (map[s] = [])).push(t);
    }
    return map;
  }, [tasks, statuses]);

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [hoverGuide, setHoverGuide] = useState<{
    status: string;
    index: number;
    position: "before" | "after";
  } | null>(null);

  const handlePointerDown = (
    e: React.PointerEvent,
    status: string,
    index: number,
    taskId: string
  ) => {
    const payload: DragPayload = { taskId, fromStatus: status, fromIndex: index };
    setDragging(payload);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const taskEl = document.getElementById(`task-${taskId}`);
    if (taskEl) taskEl.classList.add('dragging');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;

    const taskEl = document.getElementById(`task-${dragging.taskId}`);
    if (!taskEl) return;

    const rect = taskEl.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    taskEl.style.position = "fixed";
    taskEl.style.left = `${x - rect.width / 2}px`;
    taskEl.style.top = `${y - rect.height / 2}px`;
    taskEl.style.zIndex = "1000";

    const columnEls = document.querySelectorAll(".kanban-column");
    for (const columnEl of columnEls) {
      const columnRect = columnEl.getBoundingClientRect();
      if (x >= columnRect.left && x <= columnRect.right && y >= columnRect.top && y <= columnRect.bottom) {
        const taskEls = columnEl.querySelectorAll(".tm-task-item");
        for (let i = 0; i < taskEls.length; i++) {
          const taskRect = taskEls[i].getBoundingClientRect();
          if (y < taskRect.top + (taskRect.height / 2)) {
            setHoverGuide({ status: columnEl.getAttribute("data-status")!, index: i, position: "before" });
            return;
          }
        }
        setHoverGuide({ status: columnEl.getAttribute("data-status")!, index: taskEls.length, position: "after" });
        return;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;

    const taskEl = document.getElementById(`task-${dragging.taskId}`);
    if (taskEl) {
      taskEl.style.position = "";
      taskEl.style.left = "";
      taskEl.style.top = "";
      taskEl.style.zIndex = "";
      taskEl.classList.remove('dragging');
    }

    if (hoverGuide) {
      onDropTask?.({
        taskId: dragging.taskId,
        fromStatus: dragging.fromStatus,
        fromIndex: dragging.fromIndex,
        toStatus: hoverGuide.status,
        toIndex: hoverGuide.index + (hoverGuide.position === "after" ? 1 : 0),
      });
    }

    setDragging(null);
    setHoverGuide(null);
  };

  return (
    <div
      className="kanban-board-container"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {statuses.map((status) => {
        const list = tasksByStatus[status] ?? [];

        // Only render the column if there are tasks or it's the first status (for new tasks without status)
        if (list.length === 0 && status !== statuses[0]) return null;

        return (
          <div
            key={status}
            className="kanban-column"
            data-status={status}
          >
            <div className="kanban-column-header">
              <h3>{status}</h3>
            </div>

            <div className="kanban-column-tasks">
              {list.map((t, i) => {
                const planned = allocations[t.id] || 0;
                const ratio = t.estimateHours > 0 ? planned / t.estimateHours : 0;

                let barColor = "#2FBF71"; 
                if (t.estimateHours > 0) {
                  if (ratio <= 1.0) {
                    barColor = "#2FBF71"; 
                  } else if (ratio <= 1.5) {
                    barColor = "#F9A03F"; 
                  } else if (ratio <= 2.0) {
                    barColor = "#D45113"; 
                  } else if (ratio <= 3.0) {
                    barColor = "#EB3333"; 
                  } else {
                    barColor = "#820D0D"; 
                  }
                }

                return (
                  <div
                    key={t.id}
                    id={`task-${t.id}`}
                    className="tm-task-item"
                    onPointerDown={(e) => handlePointerDown(e, status, i, t.id)}
                    onDoubleClick={() => onTaskDblClick?.(t.id)}
                  >
                    <div className="task-header">
                      <div className="task-title">{t.title}</div>
                    </div>
                    {t.description && <div className="task-desc">{t.description}</div>}
                    <div className="task-bar-row">
                      <div className="task-bar-container">
                        <div
                          className="task-bar-fill"
                          style={{
                            width: `${Math.min(100, ratio * 100)}%`,
                            backgroundColor: barColor,
                          }}
                        ></div>
                      </div>
                      <div className="task-bar-label">
                        {planned} / {t.estimateHours} hr
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;