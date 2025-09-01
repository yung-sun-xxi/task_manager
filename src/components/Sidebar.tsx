// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  onTaskDblClick?: (taskId?: string) => void;
  onOpenCreate?: () => void;
  onAddTask?: () => void;
  onReorder?: (ids: string[]) => void;
  statuses: string[];
};

type DragState = {
  taskId: string;
  fromIndex: number;
  startX: number;
  startY: number;
  elW: number;
  elH: number;
  started: boolean;       // true => мы в режиме REORDER (pointer-DnD с ghost)
  stackStep: number;
  grabOffsetX: number;
  grabOffsetY: number;
};

const DRAG_THRESHOLD_Y = 7;    // вертикальный порог для реордера
const INTENT_X_TO_CAL = 24;    // горизонтальный порог "в календарь"
const EXIT_SIDEBAR_MARGIN = 8; // дополнительный буфер у правого края

const Sidebar: React.FC<Props> = ({
  tasks,
  allocations,
  onTaskDblClick,
  onOpenCreate,
  onAddTask,
  onReorder,
  statuses,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<"before" | "after">("before");

  // режимы намерений
  const delegatedToCalendarRef = useRef(false); // если true — отдали управление FullCalendar'у
  const originElRef = useRef<HTMLElement | null>(null);
  const ghostElRef = useRef<HTMLElement | null>(null);

  // ========= FullCalendar external draggable =========
  // ДАЁМ FC слушать как тело карточки, так и ручку.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const draggable = new Draggable(el, {
      itemSelector: ".to-calendar, .to-calendar-handle",
      eventData: (eventEl) => {
        const node = (eventEl as HTMLElement).closest(".tm-task-item") as HTMLElement | null;
        const id = node?.dataset.taskId || "";
        const title = node?.dataset.title || "";
        const color = node?.dataset.color || undefined;
        return {
          id,
          title,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { taskId: id },
        };
      },
    });
    return () => draggable.destroy();
  }, [tasks]);

  const items = useMemo(() => tasks, [tasks]);
  const makeIds = useCallback(() => items.map(t => t.id), [items]);

  // ===== helpers =====
  function measureStackStep(taskEl: HTMLElement): number {
    const next = taskEl.nextElementSibling as HTMLElement | null;
    const thisTop = taskEl.getBoundingClientRect().top;
    if (next) {
      const nextTop = next.getBoundingClientRect().top;
      const step = Math.round(nextTop - thisTop);
      return step > 0 ? step : Math.round(taskEl.getBoundingClientRect().height);
    } else {
      const h = Math.round(taskEl.getBoundingClientRect().height);
      const list = taskEl.closest(".task-list") as HTMLElement | null;
      let gap = 0;
      if (list) {
        const cs = getComputedStyle(list);
        gap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
      }
      return h + gap;
    }
  }

  function createGhostFrom(el: HTMLElement): HTMLElement {
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.classList.add("tm-task-ghost");
    ghost.style.position = "fixed";
    ghost.style.width = `${Math.round(r.width)}px`;
    ghost.style.height = `${Math.round(r.height)}px`;
    ghost.style.left = `${r.left}px`;
    ghost.style.top = `${r.top}px`;
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "1000";
    ghost.style.boxShadow = "0 8px 28px rgba(0,0,0,.2)";
    ghost.style.opacity = "0.98";
    document.body.appendChild(ghost);
    return ghost;
  }

  function moveGhost(ghost: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
    ghost.style.left = `${Math.round(x - offsetX)}px`;
    ghost.style.top = `${Math.round(y - offsetY)}px`;
  }

  function destroyGhost() {
    ghostElRef.current?.remove();
    ghostElRef.current = null;
  }

  // ===== Intent detection: решаем, куда хочет пользователь =====
  function wantsCalendar(e: React.PointerEvent) {
    const sidebar = listRef.current?.getBoundingClientRect();
    if (!sidebar) return false;
    const dx = e.clientX - (drag?.startX ?? e.clientX);
    const leftBound = sidebar.right - EXIT_SIDEBAR_MARGIN; // почти у правого края
    const exitedRight = e.clientX > leftBound;
    return Math.abs(dx) > INTENT_X_TO_CAL || exitedRight;
  }

  // ===== Pointer DnD только на ручке =====
  const handlePointerDown = (e: React.PointerEvent, index: number, taskId: string) => {
    // ВАЖНО: НЕ делаем preventDefault/stopPropagation и НЕ ставим setPointerCapture.
    // Даём FullCalendar возможность тоже слушать события (на случай "в календарь").
    const el = document.getElementById(`task-${taskId}`) as HTMLElement | null;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const grabOffsetX = e.clientX - r.left;
    const grabOffsetY = e.clientY - r.top;

    originElRef.current = el;
    delegatedToCalendarRef.current = false;

    setDrag({
      taskId,
      fromIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      elW: Math.round(r.width),
      elH: Math.round(r.height),
      started: false, // пока никуда не поехали
      stackStep: measureStackStep(el),
      grabOffsetX,
      grabOffsetY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const origin = originElRef.current;
    if (!origin) return;

    // Если мы уже делегировали в календарь — выходим (FC дальше рулит)
    if (delegatedToCalendarRef.current) return;

    // Пока не стартовали наш REORDER — определяем намерение
    if (!drag.started) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      // Намерение: в календарь
      if (wantsCalendar(e)) {
        // НИЧЕГО не делаем: не скрываем origin, не создаём ghost, не захватываем pointer.
        // Просто помечаем, что мы больше не вмешиваемся — дальше FullCalendar Draggable возьмёт управление.
        delegatedToCalendarRef.current = true;

        // Добавим классы, чтобы визуально дать фидбек (опционально):
        // origin.classList.add("delegated-to-calendar");
        return;
      }

      // Намерение: реордер (существенное вертикальное движение)
      if (Math.abs(dy) >= DRAG_THRESHOLD_Y && Math.abs(dy) >= Math.abs(dx)) {
        // Стартуем наш pointer-DnD
        const ghost = createGhostFrom(origin);
        ghostElRef.current = ghost;
        origin.style.visibility = "hidden"; // оставляем в потоке
        document.body.style.userSelect = "none";

        moveGhost(ghost, e.clientX, e.clientY, drag.grabOffsetX, drag.grabOffsetY);

        // Теперь захватываем pointer (чтобы наш реордер был стабильным)
        (e.target as Element).setPointerCapture?.(e.pointerId);

        setDrag({ ...drag, started: true });
        return;
      }

      // иначе — ещё «ждём» намерение
      return;
    }

    // === Уже в режиме REORDER (ghost) ===
    if (ghostElRef.current) {
      moveGhost(ghostElRef.current, e.clientX, e.clientY, drag.grabOffsetX, drag.grabOffsetY);
    }

    // считаем целевую позицию среди карточек
    const listEl = listRef.current;
    if (!listEl) return;
    const cards = Array.from(listEl.querySelectorAll<HTMLElement>(".tm-task-item"));

    if (cards.length === 0) {
      setHoverIndex(null);
      return;
    }

    let idx = cards.length - 1;
    let pos: "before" | "after" = "after";
    for (let i = 0; i < cards.length; i++) {
      if (cards[i] === origin) continue; // он скрыт, но пусть будет
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        idx = i;
        pos = "before";
        break;
      }
    }
    setHoverIndex(idx);
    setHoverPos(pos);
  };

  const handlePointerUp = () => {
    const origin = originElRef.current;

    // Если делегировали в календарь — FullCalendar сам завершит перетаскивание.
    if (delegatedToCalendarRef.current) {
      delegatedToCalendarRef.current = false;
      setDrag(null);
      setHoverIndex(null);
      originElRef.current = null;
      destroyGhost();
      document.body.style.userSelect = "";
      return;
    }

    // Если шёл REORDER
    if (origin) origin.style.visibility = "";
    destroyGhost();
    document.body.style.userSelect = "";

    if (drag?.started && hoverIndex !== null) {
      const toVisual = hoverPos === "after" ? hoverIndex + 1 : hoverIndex;
      let to = toVisual;
      if (drag.fromIndex < to) to -= 1;

      const ids = makeIds();
      const from = drag.fromIndex;
      if (from !== -1) {
        const [moved] = ids.splice(from, 1);
        const insertAt = Math.max(0, Math.min(ids.length, to));
        ids.splice(insertAt, 0, moved);
        onReorder?.(ids);
      }
    }

    setDrag(null);
    setHoverIndex(null);
    originElRef.current = null;
  };

  const handlePointerCancel = () => {
    const origin = originElRef.current;
    if (origin) origin.style.visibility = "";
    destroyGhost();
    document.body.style.userSelect = "";
    delegatedToCalendarRef.current = false;
    setDrag(null);
    setHoverIndex(null);
    originElRef.current = null;
  };

  // ====== анимация разъезда соседей ======
  const getTranslateY = (i: number): number => {
    if (!drag || !drag.started || hoverIndex === null) return 0;

    const toVisual = hoverPos === "after" ? hoverIndex + 1 : hoverIndex;
    let toFull = toVisual;
    if (drag.fromIndex < toFull) toFull -= 1;

    const from = drag.fromIndex;
    const step = drag.stackStep;

    if (toFull > from) {
      if (i > from && i <= toFull) return -step;
    } else if (toFull < from) {
      if (i >= toFull && i < from) return +step;
    }
    return 0;
  };

  const handleAddClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onOpenCreate) return onOpenCreate();
    if (onAddTask) return onAddTask();
    console.warn("[Sidebar] No onOpenCreate/onAddTask handler provided");
  };

  return (
    <div className="tm-sidebar">
      <div className="sidebar-title-row">
        <h3 className="sidebar-title">Tasks</h3>
        <button
          type="button"
          className="tm-btn tm-btn-primary tm-btn-icon"
          onClick={handleAddClick}
          title="Create Task"
        >
          +
        </button>
      </div>

      <div className="task-list" ref={listRef}>
        {items.map((t, i) => {
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

          const isDragging = drag?.taskId === t.id;

          return (
            <div
              key={t.id}
              id={`task-${t.id}`}
              className={`tm-task-item${isDragging ? " dragging-origin" : ""}`}
              data-task-id={t.id}
              data-title={t.title}
              data-color={eventColor}
              onDoubleClick={() => onTaskDblClick?.(t.id)}
              style={{
                transform: `translateY(${getTranslateY(i)}px)`,
                transition: drag?.started ? "transform 140ms ease" : undefined,
              }}
            >
              {/* Ручка: теперь и reorder, и источник для календаря */}
              <div
                className="reorder-handle to-calendar-handle"
                // ВАЖНО: не вызываем preventDefault/stopPropagation в onPointerDown
                onPointerDown={(e) => handlePointerDown(e, i, t.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                title="Drag to reorder or drop onto calendar"
              >
                ≡
              </div>

              {/* Контент: по-прежнему источник для календаря */}
              <div className="task-content to-calendar">
                <div className="task-header">
                  <div className="task-title" style={{ color: "var(--color-task-title)" }}>
                    {truncatedTitle || "(untitled)"}
                  </div>
                  {t.description ? <div className="task-desc">{t.description}</div> : null}
                </div>

                <div className="task-bar">
                  <div className="task-bar-track">
                    <div
                      className="task-bar-fill"
                      style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <div className="task-bar-label">
                    {planned} / {t.estimateHours} hr
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {statuses?.length ? <div className="sidebar-statuses">{/* optional */}</div> : null}
    </div>
  );
};

export default Sidebar;