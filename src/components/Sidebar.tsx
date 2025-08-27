/* src/components/Sidebar.tsx */
import React, { useEffect, useMemo, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";

export type Task = {
  id: string;
  title: string;
  description?: string;
  estimateHours: number;
  color?: string;
};

type Props = {
  tasks: Task[];
  allocations: Record<string, number>;
  onEstimateChange: (taskId: string, estimate: number) => void;
  onTaskDblClick?: (taskId: string) => void;
  onAddTask?: () => void;
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange, onTaskDblClick, onAddTask }) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Provide items (could sort later)
  const items = useMemo(() => tasks, [tasks]);

  // Enable dragging from sidebar into calendar
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: ".tm-task-item",
      eventData: (taskEl) => {
        const id = taskEl.getAttribute("data-task-id") || "";
        const title = taskEl.getAttribute("data-title") || "";
        const color = taskEl.getAttribute("data-color") || "";
        return {
          title,
          extendedProps: { taskId: id },
          backgroundColor: color,
        };
      },
    });
    return () => {
      draggable.destroy();
    };
  }, [items]);

  return (
    <div className="tm-sidebar">
      <div className="sidebar-title-row">
        <h3 className="sidebar-title">Tasks</h3>
        <button type="button" className="tm-btn tm-btn-primary tm-btn-icon" onClick={onAddTask} title="Add task">
          +
        </button>
      </div>
      <div className="task-list" ref={listRef}>
        {items.map((t) => {
          const planned = allocations[t.id] || 0;
          const ratio = planned / t.estimateHours;

          let barColor = "var(--color-status-green)";
          if (t.estimateHours > 0) {
            if (ratio <= 1.0) {
              barColor = "var(--color-status-green)";
            } else if (ratio <= 1.5) {
              barColor = "var(--color-status-yellow)";
            } else if (ratio <= 2.0) {
              barColor = "var(--color-status-orange)";
            } else if (ratio <= 3.0) {
              barColor = "var(--color-status-red)";
            } else {
              barColor = "var(--color-status-maroon)";
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
              draggable
            >
              <div className="task-header">
                <div className="task-title" style={{ color: "var(--color-task-title)" }}>{truncatedTitle}</div>
                {t.description ? <div className="task-desc">{t.description}</div> : null}
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
  );
};

export default Sidebar;