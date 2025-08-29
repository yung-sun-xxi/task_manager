// src/components/KanbanBoard.tsx
import React from "react";
import { Task } from "./Sidebar";
import { Draggable } from "@fullcalendar/interaction";

type Props = {
  tasks: Task[];
  allocations: Record<string, number>;
  onEstimateChange: (taskId: string, estimate: number) => void;
  onTaskDblClick?: (taskId: string) => void;
  onAddTask?: () => void;
  statuses: string[];
};

const KanbanBoard: React.FC<Props> = ({ tasks, allocations, onTaskDblClick, statuses }) => {
  return (
    <div className="kanban-board-container">
      {statuses.map(status => (
        <div key={status} className="kanban-column">
          <div className="kanban-column-header">
            <h3>{status}</h3>
          </div>
          <div className="kanban-column-tasks">
            {tasks
              .filter(task => task.status === status)
              .map(t => {
                const planned = allocations[t.id] || 0;
                const ratio = t.estimateHours > 0 ? planned / t.estimateHours : 0;
                let barColor = "#2FBF71"; // Default Green
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
                const eventColor = `var(--color-task-card-bg)`;
                const truncatedTitle = t.title.length > 70 ? t.title.slice(0, 67) + "..." : t.title;

                return (
                  <div
                    key={t.id}
                    className="tm-task-item"
                    onDoubleClick={() => onTaskDblClick && onTaskDblClick(t.id)}
                    data-task-id={t.id}
                    data-title={t.title}
                    data-color={eventColor}
                  >
                    <div className="task-header">
                      <div className="task-title" style={{ color: "var(--color-task-title)" }}>{truncatedTitle}</div>
                      {t.description ? <div className="task-desc">{t.description}</div> : null}
                      {t.status && (
                        <div className="task-status" style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>
                          Status: {t.status}
                        </div>
                      )}
                    </div>
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
      ))}
    </div>
  );
};

export default KanbanBoard;