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
          const remaining = Math.max(0, (t.estimateHours || 0) - planned);
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

              <div className="task-info">
                Estimate: {t.estimateHours}h • Planned: {planned}h • Remaining: {remaining}h
              </div>

              <div className="task-controls">
                <label>
                  Estimate, h:&nbsp;
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
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;