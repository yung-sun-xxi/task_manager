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
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange, onTaskDblClick }) => {
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
        return {
          title,
          extendedProps: { taskId: id },
        };
      },
    });
    return () => {
      draggable.destroy();
    };
  }, [items]);

  return (
    <div className="tm-sidebar">
      <h3 className="sidebar-title">Tasks</h3>
      <div className="task-list" ref={listRef}>
        {items.map((t) => {
          const planned = allocations[t.id] || 0;
          const ratio = planned / t.estimateHours;
          
          let barColor = "#22c55e"; // Зеленый по умолчанию
          if (t.estimateHours > 0) {
            if (ratio > 1) {
              const ratioClamped = Math.min(2, ratio); // Ограничиваем до 200%
              const hue = 60 - (ratioClamped - 1) * 60; // От 60 (желтый) до 0 (красный)
              barColor = `hsl(${hue}, 80%, 60%)`;
            } else {
              barColor = "#22c55e"; // Зеленый
            }
          }

          return (
            <div
              key={t.id}
              className="tm-task-item"
              onDoubleClick={() => onTaskDblClick && onTaskDblClick(t.id)}
              data-task-id={t.id}
              data-title={t.title}
              draggable
            >
              <div className="task-header">
                <div className="task-title">{t.title}</div>
                {t.description ? <div className="task-desc">{t.description}</div> : null}
              </div>

              {/* Обновленный барчарт с динамическим цветом */}
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
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;