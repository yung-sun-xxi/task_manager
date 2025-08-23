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
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const draggable = new Draggable(containerRef.current, {
      itemSelector: ".tm-task-item",
      eventData: (el: HTMLElement) => {
        const title = el.getAttribute("data-title") || "Task";
        const taskId = el.getAttribute("data-task-id") || "";
        return {
          title,
          extendedProps: { taskId }
        };
      }
    });
    return () => draggable.destroy();
  }, [tasks]);

  const items = useMemo(() => {
    return tasks.map(t => {
      const planned = allocations[t.id] || 0;
      const remain = Math.max(0, Math.round((t.estimateHours - planned) * 4) / 4);
      return { ...t, planned, remain };
    });
  }, [tasks, allocations]);

  return (
    <div className="sidebar-inner" ref={containerRef}>
      <h3 className="sidebar-title">Задачи</h3>
      <div className="task-list">
        {items.map(t => (
          <div
            key={t.id}
            className="tm-task-item"
            data-task-id={t.id}
            data-title={t.title}
            draggable
          >
            <div className="task-header">
              <div className="task-title">{t.title}</div>
              <div className="task-hours">
                {t.planned} / {t.estimateHours}
              </div>
            </div>
            <div className="task-desc">{t.description}</div>
            <div className="task-controls">
              <label>
                Размер в часах:&nbsp;
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  value={t.estimateHours}
                  onChange={(e) => onEstimateChange(t.id, Math.max(0, Number(e.target.value)))}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
