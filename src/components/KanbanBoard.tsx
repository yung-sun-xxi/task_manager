// src/components/KanbanBoard.tsx
import React, { useMemo, useState } from "react";
import { Task } from "./Sidebar";

type Props = {
  tasks: Task[];
  allocations: Record<string, number>;
  statuses: string[];
  onTaskDblClick?: (taskId: string) => void;
  onAddTask?: () => void;
  onDropTask?: (payload: {
    taskId: string;
    fromStatus: string;
    fromIndex: number;
    toStatus: string;
    toIndex: number;
  }) => void;
};

type DragPayload = {
  taskId: string;
  fromStatus: string;
  fromIndex: number;
};

type DragState = DragPayload & {
  startX: number;
  startY: number;
  elW: number;
  elH: number;
  started: boolean;
  stackStep: number;
};

const DRAG_THRESHOLD = 7; // px

const KanbanBoard: React.FC<Props> = ({
  tasks,
  allocations,
  statuses,
  onTaskDblClick,
  onAddTask,
  onDropTask,
}) => {
  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {};
    statuses.forEach((s) => (map[s] = []));
    for (const t of tasks) {
      const s = t.status ?? statuses[0];
      (map[s] ?? (map[s] = [])).push(t);
    }
    return map;
  }, [tasks, statuses]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverGuide, setHoverGuide] = useState<{
    status: string;
    index: number;
    position: "before" | "after";
  } | null>(null);

  function moveDragDom(e: React.PointerEvent, el: HTMLElement, w: number, h: number) {
    el.style.left = `${e.clientX - w / 2}px`;
    el.style.top = `${e.clientY - h / 2}px`;
  }

  function endDragDom(el: HTMLElement) {
    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.zIndex = "";
    el.style.width = "";
    el.style.height = "";
    el.classList.remove("dragging");
    enableAllTransitions();
  }

  function measureStackStep(taskEl: HTMLElement): number {
    const colTasks = taskEl.closest(".kanban-column")?.querySelector(".kanban-column-tasks") as HTMLElement | null;
    const next = taskEl.nextElementSibling as HTMLElement | null;

    const thisTop = taskEl.getBoundingClientRect().top;

    if (next) {
      const nextTop = next.getBoundingClientRect().top;
      const step = Math.round(nextTop - thisTop);
      return step > 0 ? step : Math.round(taskEl.getBoundingClientRect().height);
    } else {
      const h = Math.round(taskEl.getBoundingClientRect().height);
      let rowGap = 0;
      if (colTasks) {
        const cs = getComputedStyle(colTasks);
        rowGap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
      }
      return h + rowGap;
    }
  }

  function disableAllTransitions() {
    document.querySelectorAll(".tm-task-item").forEach(el => {
      if (el.id !== `task-${drag?.taskId}`) {
        el.classList.add("no-transition");
      }
    });
  }

  function enableAllTransitions() {
    document.querySelectorAll(".tm-task-item").forEach(el => {
      el.classList.remove("no-transition");
    });
  }

  const handlePointerDown = (
    e: React.PointerEvent,
    status: string,
    index: number,
    taskId: string
  ) => {
    const el = document.getElementById(`task-${taskId}`);
    if (!el) return;

    const r = el.getBoundingClientRect();
    const stackStep = measureStackStep(el);

    setDrag({
      taskId,
      fromStatus: status,
      fromIndex: index,
      startX: e.clientX,
      startY: e.clientY,
      elW: r.width,
      elH: r.height,
      started: false,
      stackStep,
    });
    
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const el = document.getElementById(`task-${drag.taskId}`);
    if (!el) return;

    if (!drag.started) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      // Применяем стили напрямую к DOM-элементу для мгновенного старта
      el.style.position = "fixed";
      el.style.width = `${drag.elW}px`;
      el.style.height = `${drag.elH}px`;
      el.style.zIndex = "1000";
      el.classList.add("dragging");
      document.body.style.userSelect = "none";
      disableAllTransitions(); 
      
      setDrag({ ...drag, started: true });
    }

    moveDragDom(e, el, drag.elW, drag.elH);

    const x = e.clientX;
    const y = e.clientY;
    const columnEls = document.querySelectorAll<HTMLElement>(".kanban-column");
    for (const columnEl of Array.from(columnEls)) {
      const columnRect = columnEl.getBoundingClientRect();
      if (x >= columnRect.left && x <= columnRect.right && y >= columnRect.top && y <= columnRect.bottom) {
        const taskEls = columnEl.querySelectorAll<HTMLElement>(".tm-task-item");
        for (let i = 0; i < taskEls.length; i++) {
          const taskRect = taskEls[i].getBoundingClientRect();
          if (y < taskRect.top + taskRect.height / 2) {
            setHoverGuide({
              status: columnEl.getAttribute("data-status")!,
              index: i,
              position: "before",
            });
            return;
          }
        }
        setHoverGuide({
          status: columnEl.getAttribute("data-status")!,
          index: taskEls.length,
          position: "after",
        });
        return;
      }
    }
    setHoverGuide(null);
  };

  const handlePointerUp = () => {
    if (!drag) return;
    const el = document.getElementById(`task-${drag.taskId}`);
    if (el && drag.started) endDragDom(el);
    document.body.style.userSelect = "";

    if (drag.started && hoverGuide) {
      const insertIndex = hoverGuide.index + (hoverGuide.position === "after" ? 1 : 0);
      onDropTask?.({
        taskId: drag.taskId,
        fromStatus: drag.fromStatus,
        fromIndex: drag.fromIndex,
        toStatus: hoverGuide.status,
        toIndex: insertIndex,
      });
    }
    setDrag(null);
    setHoverGuide(null);
  };

  const handlePointerCancel = () => {
    if (!drag) return;
    const el = document.getElementById(`task-${drag.taskId}`);
    if (el && drag.started) endDragDom(el);
    document.body.style.userSelect = "";
    setDrag(null);
    setHoverGuide(null);
  };

  const placeholderHeight = drag ? drag.stackStep : 0;
  const currentInsertIndex =
    hoverGuide ? hoverGuide.index + (hoverGuide.position === "after" ? 1 : 0) : null;
  const keepSourceSpace =
    !!(
      drag?.started &&
      (
        !hoverGuide ||
        hoverGuide.status !== drag.fromStatus ||
        (hoverGuide.status === drag.fromStatus && currentInsertIndex === drag.fromIndex)
      )
    );

  return (
    <div
      className="kanban-board-container"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {statuses.map((status) => {
        const list = tasksByStatus[status] ?? [];
        if (list.length === 0 && status !== statuses[0]) return null;

        const isHoverCol = !!(drag?.started && hoverGuide && hoverGuide.status === status);
        const enableDynamicPlaceholder =
          isHoverCol && !(drag && status === drag.fromStatus && keepSourceSpace);

        const insertIndex =
          enableDynamicPlaceholder && hoverGuide
            ? hoverGuide.index + (hoverGuide.position === "after" ? 1 : 0)
            : -1;

        return (
          <div key={status} className="kanban-column" data-status={status}>
            <div className="kanban-column-header">
              <h3>{status}</h3>
            </div>
            <div className="kanban-column-tasks">
              {list.map((t, i) => {
                const planned = allocations[t.id] || 0;
                const ratio = t.estimateHours > 0 ? planned / t.estimateHours : 0;

                let barColor = "#2FBF71";
                if (t.estimateHours > 0) {
                  if (ratio <= 1.0) barColor = "#2FBF71";
                  else if (ratio <= 1.5) barColor = "#F9A03F";
                  else if (ratio <= 2.0) barColor = "#D45113";
                  else if (ratio <= 3.0) barColor = "#EB3333";
                  else barColor = "#820D0D";
                }

                const isDragged = !!(drag?.started && drag.taskId === t.id);
                const isSourceColumn = drag?.fromStatus === status;
                const isSourceSpot = isSourceColumn && drag?.fromIndex === i;
                
                return (
                  <React.Fragment key={t.id}>
                    {isSourceSpot && drag?.started && (
                      <div
                        className="kanban-placeholder kanban-placeholder--source"
                        style={{
                          height: keepSourceSpace ? placeholderHeight : 0,
                          transition: "height 140ms ease",
                        }}
                      />
                    )}
                    {enableDynamicPlaceholder && insertIndex === i && (
                      <div
                        className="kanban-placeholder"
                        style={{
                          height: placeholderHeight,
                          transition: "height 140ms ease",
                        }}
                      />
                    )}
                    <div
                      id={`task-${t.id}`}
                      className={`tm-task-item${isDragged ? " dragging" : ""}`}
                      onPointerDown={(e) => handlePointerDown(e, status, i, t.id)}
                      onDoubleClick={() => onTaskDblClick?.(t.id)}
                      // Стиль теперь применяется напрямую к элементу, поэтому этот пропс удален
                      // style={dragStyle} 
                    >
                      <div className="task-header">
                        <div className="task-title">{t.title}</div>
                      </div>
                      {t.description && <div className="task-desc">{t.description}</div>}
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
                  </React.Fragment>
                );
              })}
              {enableDynamicPlaceholder && insertIndex === list.length && (
                <div
                  className="kanban-placeholder"
                  style={{ height: placeholderHeight, transition: "height 140ms ease" }}
                />
              )}
              {drag?.started && status === drag.fromStatus && list.length === 0 && (
                <div
                  className="kanban-placeholder kanban-placeholder--source"
                  style={{
                    height: keepSourceSpace ? placeholderHeight : 0,
                    transition: "height 140ms ease",
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;