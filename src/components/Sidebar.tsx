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

const palette = ["#3b82f6", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange }) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Make tasks draggable into the calendar
  useEffect(() => {
    if (!rootRef.current) return;
    const draggable = new Draggable(rootRef.current, {
      itemSelector: ".tm-task",
      eventData: (el) => {
        const id = el.getAttribute("data-task-id")!;
        const title = el.getAttribute("data-title")!;
        const color = el.getAttribute("data-color") || undefined;
        return { title, extendedProps: { taskId: id }, backgroundColor: color, borderColor: color };
      },
    });
    return () => {
      draggable.destroy();
    };
  }, [tasks]);

  const tasksWithColor = useMemo(() => {
    // assign deterministic color by index
    return tasks.map((t, i) => ({ ...t, color: t.color || palette[i % palette.length] }));
  }, [tasks]);

  return (
    <div className="tm-sidebar" ref={rootRef}>
      <h3 style={{ padding: "12px 12px 4px", margin: 0 }}>Таски</h3>
      <div style={{ padding: "0 12px 12px", fontSize: 12, opacity: 0.7 }}>
        Перетащи на календар, чтобы запланировать. 15-мин. шаг.
      </div>

      <div className="tm-task-list" style={{ display: "grid", gap: 8, padding: 12 }}>
        {tasksWithColor.map((t) => {
          const planned = allocations[t.id] || 0;
          const left = Math.max(0, Math.round((t.estimateHours - planned) * 4) / 4);
          return (
            <div
              key={t.id}
              className="tm-task"
              data-task-id={t.id}
              data-title={t.title}
              data-color={t.color}
              style={{
                border: "1px solid #e5e7eb",
                borderLeftWidth: 6,
                borderLeftColor: t.color,
                borderRadius: 8,
                padding: 10,
                background: "white",
                cursor: "grab",
                userSelect: "none",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{t.title}</div>
              {t.description && <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{t.description}</div>}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  Оценка: {t.estimateHours}ч • Запланировано: {planned}ч • Осталось: {left}ч
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, opacity: 0.7 }}>Оценка, ч:</label>
                <input
                  type="number"
                  step="0.25"
                  min={0}
                  value={t.estimateHours}
                  onChange={(e) => onEstimateChange(t.id, Math.max(0, Number(e.target.value)))}
                  style={{ width: 90 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;