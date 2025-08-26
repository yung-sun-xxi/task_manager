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

          let barColor = "#2FBF71"; // Зеленый по умолчанию
          if (t.estimateHours > 0) {
            if (ratio <= 1.0) {
              barColor = "#2FBF71"; // Зеленый
            } else if (ratio <= 1.5) {
              barColor = "#F9A03F"; // Желтый
            } else if (ratio <= 2.0) {
              barColor = "#D45113"; // Оранжевый
            } else if (ratio <= 3.0) {
              barColor = "#EB3333"; // Красный
            } else {
              barColor = "#820D0D"; // Бордовый
            }
          }

          // Ограничиваем длину заголовка
          const truncatedTitle = t.title.length > 70 ? t.title.slice(0, 67) + "..." : t.title;

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
                <div className="task-title">{truncatedTitle}</div>
                {t.description ? <div className="task-desc">{t.description}</div> : null}
              </div>

              {/* Новый контейнер для барчарта и метки */}
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