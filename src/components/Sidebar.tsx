// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useRef, useCallback } from "react";
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
   * ВАЖНО: не создавайте задачу мгновенно — создавайте её только после Save.
   */
  onOpenCreate?: () => void;
  /**
   * @deprecated Использовалось ранее. Оставлено ради обратной совместимости.
   * Если передан и onOpenCreate отсутствует — будет вызван.
   */
  onAddTask?: () => void;
  /**
   * Коллбек для перестановки задач в новом порядке (по массиву id).
   * App должен применить новый порядок к tasks и сохранить.
   */
  onReorder?: (ids: string[]) => void;
  statuses: string[];
};

const Sidebar: React.FC<Props> = ({
  tasks,
  allocations,
  onEstimateChange, // eslint-disable-line @typescript-eslint/no-unused-vars
  onTaskDblClick,
  onOpenCreate,
  onAddTask, // deprecated fallback
  onReorder,
  statuses, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // ========= ВНЕШНИЙ DnD → FullCalendar =========
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const draggable = new Draggable(el, {
      // ВАЖНО: itemSelector — карточка задачи, но наш внутренний reorder стартует с .reorder-handle,
      // поэтому FullCalendar не перехватит его (handle не .tm-task-item).
      itemSelector: ".tm-task-item",
      // маппим DOM → FullCalendar EventInput
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
  }, [tasks]);

  // Мемоизируем список карточек
  const items = useMemo(() => tasks, [tasks]);

  // ========= Добавление задачи ("+") =========
  const handleAddClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenCreate) { onOpenCreate(); return; }
    if (onAddTask) { onAddTask(); return; }
    // eslint-disable-next-line no-console
    console.warn("[Sidebar] No onOpenCreate/onAddTask handler provided for + button");
  };

  // ========= ВНУТРЕННИЙ REORDER (HTML5 DnD на ручке) =========
  const REORDER_MIME = "text/x-reorder-task-id";

  const makeIds = useCallback(() => items.map(t => t.id), [items]);

  const handleReorderDragStart = (e: React.DragEvent, taskId: string) => {
    e.stopPropagation(); // не даём FullCalendar Draggable вмешаться
    e.dataTransfer.setData(REORDER_MIME, taskId);
    e.dataTransfer.effectAllowed = "move";
    // для Firefox нужен хоть какой-то текст
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleCardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    e.preventDefault(); // разрешить drop
    const el = e.currentTarget;
    el.classList.add("is-drag-over");

    // добавим позицию вставки: перед/после — в зависимости от Y
    const rect = el.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    el.dataset.dropPos = before ? "before" : "after";
  };

  const clearCardDragState = (el: HTMLElement | null) => {
    if (!el) return;
    el.classList.remove("is-drag-over");
    delete (el as any).dataset.dropPos;
  };

  const handleCardDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    clearCardDragState(e.currentTarget);
  };

  const handleCardDrop = (e: React.DragEvent<HTMLDivElement>, targetTaskId: string) => {
    if (!e.dataTransfer.types.includes(REORDER_MIME)) return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget;
    const dropPos = targetEl.dataset.dropPos as ("before" | "after" | undefined);
    clearCardDragState(targetEl);

    const draggedId = e.dataTransfer.getData(REORDER_MIME);
    if (!draggedId || !onReorder) return;
    if (draggedId === targetTaskId) return;

    // построим новый порядок
    const ids = makeIds().filter(id => id !== draggedId);
    const idx = ids.indexOf(targetTaskId);
    const insertAt = idx < 0 ? ids.length : (dropPos === "after" ? idx + 1 : idx);
    ids.splice(insertAt, 0, draggedId);

    onReorder(ids);
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
              onDragOver={handleCardDragOver}
              onDragLeave={handleCardDragLeave}
              onDrop={(e) => handleCardDrop(e, t.id)}
              data-task-id={t.id}
              data-title={t.title}
              data-color={eventColor}
            >
              {/* Ручка для перестановки списка (не конфликтует с FullCalendar drag) */}
                <div
                  className="reorder-handle"
                  draggable
                  onMouseDown={(e) => { e.stopPropagation(); }}  // ВАЖНО: чтобы FC не схватил mousedown
                  onDragStart={(e) => handleReorderDragStart(e, t.id)}
                >
                  ≡
                </div>

              <div className="task-header">
                <div className="task-title" style={{ color: "var(--color-task-title)" }}>
                  {truncatedTitle || "(untitled)"}
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