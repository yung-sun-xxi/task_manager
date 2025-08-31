// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";

export type Task = {
  id: string;
  title: string;
  description?: string;
  estimateHours: number;
  color?: string;
  status?: string;
};

type Props = {
  tasks: Task[];
  allocations: Record<string, number>;
  onEstimateChange: (taskId: string, estimate: number) => void; // для совместимости
  onTaskDblClick?: (taskId: string) => void;
  /**
   * Запрос на создание НОВОЙ задачи (должен ТОЛЬКО открыть модалку в App).
   * ВАЖНО: Не создавайте задачу сразу в обработчике — создавайте её только после Save.
   */
  onOpenCreate?: () => void;
  /**
   * @deprecated Использовалось ранее. Оставлено ради обратной совместимости.
   * Если передан и onOpenCreate отсутствует — будет вызван.
   */
  onAddTask?: () => void;
  statuses: string[];
};

const Sidebar: React.FC<Props> = ({
  tasks,
  allocations,
  onEstimateChange, // eslint-disable-line @typescript-eslint/no-unused-vars
  onTaskDblClick,
  onOpenCreate,
  onAddTask, // deprecated fallback
  statuses, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Источники для внешнего DnD в календарь
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const draggable = new Draggable(el, {
      itemSelector: ".tm-task-item",
      eventData: (eventEl) => {
        const node = (eventEl as HTMLElement).closest(".tm-task-item") as HTMLElement | null;
        const id = node?.getAttribute("data-task-id") || "";
        const title = node?.getAttribute("data-title") || "";
        const color = node?.getAttribute("data-color") || undefined;

        return {
          id,
          title,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { taskId: id },
        };
      },
    });

    return () => {
      draggable.destroy();
    };
  }, [tasks]); // пересоздаём, если список поменялся

  const items = useMemo(() => tasks, [tasks]);

  const handleAddClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    // гарантированно не триггерим submit/бабблинг куда-то вверх
    e.preventDefault();
    e.stopPropagation();

    if (onOpenCreate) {
      onOpenCreate();
      return;
    }
    // fallback для старых вызовов
    if (onAddTask) {
      onAddTask();
      return;
    }
    // если ни один обработчик не передан — хотя бы залогируем, чтобы было понятно
    // eslint-disable-next-line no-console
    console.warn("[Sidebar] No onOpenCreate/onAddTask handler provided for + button");
  };

  return (
    <div className="tm-sidebar">
      <div className="sidebar-title-row">
        <h3 className="sidebar-title">Tasks</h3>
        <button
          type="button"
          className="tm-btn tm-btn-primary tm-btn-icon"
          onClick={handleAddClick}
          title="Add task"
          aria-label="Add task"
        >
          +
        </button>
      </div>

      <div className="task-list" ref={listRef}>
        {items.map((t) => {
          const planned = allocations[t.id] ?? 0;
          const ratio = t.estimateHours > 0 ? planned / t.estimateHours : 0;

          let barColor = "#2FBF71";
          if (t.estimateHours > 0) {
            if (ratio <= 1.0) barColor = "#2FBF71";
            else if (ratio <= 1.5) barColor = "#F9A03F";
            else if (ratio <= 2.0) barColor = "#D45113";
            else if (ratio <= 3.0) barColor = "#EB3333";
            else barColor = "#820D0D";
          }

          const eventColor = `var(--color-task-card-bg)`;
          const truncatedTitle = t.title.length > 70 ? t.title.slice(0, 67) + "..." : t.title;

          return (
            <div
              key={t.id}
              className="tm-task-item"
              onDoubleClick={() => onTaskDblClick?.(t.id)}
              data-task-id={t.id}
              data-title={t.title}
              data-color={eventColor}
              draggable
            >
              <div className="task-header">
                <div className="task-title" style={{ color: "var(--color-task-title)" }}>
                  {truncatedTitle}
                </div>
                {t.description ? <div className="task-desc">{t.description}</div> : null}
                {t.status && (
                  <div
                    className="task-status"
                    style={{ color: "var(--color-text-muted)", fontSize: "12px" }}
                  >
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
                  />
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
