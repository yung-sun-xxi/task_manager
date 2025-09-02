/* src/App.tsx */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar, { Task } from "./components/Sidebar";
import CalendarView, { PlainEvent } from "./components/CalendarView";
import KanbanBoard from "./components/KanbanBoard";
import "./index.css";
import "./App.css";
import { loadStatuses } from "./utils/store";
import ExplosionIcon from "./assets/explosion.png";

/** Theme files */
import "./themes/theme-light.css";
import "./themes/theme-dark.css";
import "./themes/theme-sunny-pump.css";

const LS_TASKS = "tm_tasks_v1";
const LS_EVENTS = "tm_events_v1";
const LS_THEME = "tm_theme_v1";

/** THEMES for quick toggle / long-press menu */
const THEMES = [
  { id: "light", title: "Light" },
  { id: "dark", title: "Dark" },
  { id: "sunny-pump", title: "Sunny Pump" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** reorder tasks by list of ids (used by Sidebar internal reorder) */
function reorderByIds(tasks: Task[], newOrderIds: string[]): Task[] {
  const map = new Map(tasks.map((t) => [t.id, t]));
  const next: Task[] = [];
  for (const id of newOrderIds) {
    const t = map.get(id);
    if (t) next.push(t);
  }
  // add leftovers (if any)
  for (const t of tasks) {
    if (!next.find((x) => x.id === t.id)) next.push(t);
  }
  return next;
}

/** convert minutes to hours with quarter precision (0.25h = 15 min) */
function minutesToHoursQuarter(mins: number): number {
  return Math.round((mins / 60) * 4) / 4;
}

const App: React.FC = () => {
  // tasks + events
  const [tasks, setTasks] = useState<Task[]>(() => load<Task[]>(LS_TASKS, []));
  const [events, setEvents] = useState<PlainEvent[]>(() =>
    load<PlainEvent[]>(LS_EVENTS, [])
  );

  // statuses from utils store (persisted)
  const [statuses, setStatuses] = useState<string[]>(() => loadStatuses());

  // UI state
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftEstimate, setDraftEstimate] = useState(0);
  const [draftStatus, setDraftStatus] = useState("");
  const [pendingNewTaskId, setPendingNewTaskId] = useState<string | null>(null);

  // theme state
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem(LS_THEME) || "light"; } catch { return "light"; }
  });

  // theme menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const pressedRef = useRef(false);
  const dragSelectActiveRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  // apply theme on mount & on change
  useEffect(() => {
    const html = document.documentElement;
    // remove all theme-* classes first
    [...html.classList].forEach(c => { if (c.startsWith("theme-")) html.classList.remove(c); });
    html.classList.add(`theme-${theme}`);
    try { localStorage.setItem(LS_THEME, theme); } catch { }
  }, [theme]);

  // force refresh calendar after destructive ops
  const [calReset, setCalReset] = useState(0);

  // sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(288);

  // слот, который юзер выделил на календаре (или двойной клик)
  const [pendingSlot, setPendingSlot] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });

  // delete-all confirm modal
  const [isConfirmModalOpen, setConfirmModalOpen] = useState(false);

  // new state to manage which view is active
  const [currentPage, setCurrentPage] = useState<"calendar" | "kanban">("calendar");

  // allocations map (taskId => total scheduled minutes)
  const allocations: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of events) {
      const tId = (ev as any).taskId as string | undefined;
      if (!tId || !ev.start || !ev.end) continue;
      const start = new Date(ev.start).getTime();
      const end = new Date(ev.end).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const mins = Math.max(0, Math.round((end - start) / (60 * 1000)));
        acc[tId] = (acc[tId] || 0) + mins;
      }
    }
    return acc;
  }, [events]);

  // persist tasks/events on change
  useEffect(() => save(LS_TASKS, tasks), [tasks]);
  useEffect(() => save(LS_EVENTS, events), [events]);

  // === THEME TOGGLE / MENU HANDLERS ===
  /** Quick toggle on short click (cycles through THEMES) */
  const handleThemeClick = useCallback(() => {
    if (pressedRef.current) return; // long-press already handled
    if (Date.now() < suppressClickUntilRef.current) return;
    const ids = THEMES.map(t => t.id);
    const idx = ids.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length]?.id || "light";
    setTheme(next);
  }, [theme]);

  /** Long press to open menu (500ms) */
  const handlePressStart = useCallback(() => {
    pressedRef.current = false;
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      pressedRef.current = true;
      setMenuOpen(true);
      dragSelectActiveRef.current = true;
      suppressClickUntilRef.current = Date.now() + 100;
    }, 500);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    // selection happens on global mouseup/touchend
  }, []);

  const applyTheme = useCallback((id: string) => {
    if (!id) return;
    setTheme(id);
    setMenuOpen(false);
  }, []);

  // close theme menu on ESC / modal close handled in a single keydown listener:
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTaskModalOpen) closeModal();
        if (menuOpen) setMenuOpen(false);
        if (isConfirmModalOpen) setConfirmModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [isTaskModalOpen, menuOpen, isConfirmModalOpen]);

  // close theme menu on outside mousedown (robust)
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      const path = (e.composedPath?.() || []) as EventTarget[];
      const inside = path.some((n: any) => n?.classList?.contains?.("theme-menu") || n?.classList?.contains?.("theme-toggle-btn"));
      if (!inside) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [menuOpen]);

  // press–drag–release: pick item on mouseup/touchend
  useEffect(() => {
    if (!menuOpen || !dragSelectActiveRef.current) return;

    const pickFromEvent = (e: Event) => {
      const path = (e as any).composedPath?.() || [];
      const itemEl = path.find((n: any) => n?.classList?.contains?.("theme-menu-item")) as HTMLElement | undefined;

      if (itemEl?.dataset?.themeid) {
        applyTheme(itemEl.dataset.themeid);
      } else {
        const inside = path.some((n: any) =>
          n?.classList?.contains?.("theme-menu") || n?.classList?.contains?.("theme-toggle-btn")
        );
        if (!inside) setMenuOpen(false);
      }
      dragSelectActiveRef.current = false;
      pressedRef.current = false;
    };

    window.addEventListener("mouseup", pickFromEvent, true);
    window.addEventListener("touchend", pickFromEvent, true);
    return () => {
      window.removeEventListener("mouseup", pickFromEvent, true);
      window.removeEventListener("touchend", pickFromEvent, true);
    };
  }, [menuOpen]);

  // === SIDEBAR RESIZE ===
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (move: MouseEvent) => {
      const delta = move.clientX - startX;
      setSidebarWidth((w) => clamp(startW + delta, 220, 500));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  // === TASK MODAL ===
  const openNewTaskModal = useCallback(() => {
    setDraftTitle("");
    setDraftDescription("");
    setDraftEstimate(0);
    setDraftStatus(statuses[0] || "");
    setEditingTaskId(null);
    setTaskModalOpen(true);
    setPendingNewTaskId("new");
  }, [statuses]);

  const openEditTaskModal = useCallback((taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    setEditingTaskId(t.id);
    setDraftTitle(t.title);
    setDraftDescription(t.description || "");
    setDraftEstimate(t.estimate || 0);
    setDraftStatus(t.status || "");
    setTaskModalOpen(true);
  }, [tasks]);

  const closeModal = useCallback(() => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setPendingNewTaskId(null);
    setPendingSlot({ start: null, end: null });
  }, []);

  const saveModal = useCallback(() => {
    const title = draftTitle.trim();
    const description = draftDescription.trim();
    const estimate = Math.max(0, Math.round(Number(draftEstimate) * 4) / 4);
    const status = (draftStatus || "").trim();

    // Title обязателен — без него просто закрываем без создания/сохранения
    if (!title) {
      // для обратной совместимости, просто закрываем
      setTaskModalOpen(false);
      setEditingTaskId(null);
      setPendingNewTaskId(null);
      setPendingSlot({ start: null, end: null });
      return;
    }

    if (editingTaskId) {
      // edit existing
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId ? { ...t, title, description, estimate, status } : t
        )
      );
    } else {
      // create new
      const id = String(Date.now());
      const newTask: Task = {
        id,
        title,
        description,
        estimate,
        status: status || (statuses[0] || ""),
      };
      setTasks((prev) => [newTask, ...prev]);

      // если был выбран слот в календаре — создаём и событие
      if (pendingSlot.start && pendingSlot.end) {
        const ev: PlainEvent = {
          id: String(Date.now() + 1),
          title,
          start: pendingSlot.start.toISOString(),
          end: pendingSlot.end.toISOString(),
          taskId: id,
        };
        setEvents((prev) => [ev, ...prev]);
      }
    }

    // close
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setPendingNewTaskId(null);
    setPendingSlot({ start: null, end: null });
  }, [draftTitle, draftDescription, draftEstimate, draftStatus, editingTaskId, pendingSlot, statuses]);

  const deleteTask = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingTaskId) return;
    const tId = editingTaskId;
    setTasks((prev) => prev.filter((t) => t.id !== tId));
    setEvents((prev) => prev.filter((ev) => (ev as any).taskId !== tId));
    setTaskModalOpen(false);
    setEditingTaskId(null);
    setPendingNewTaskId(null);
    setPendingSlot({ start: null, end: null });
  }, [editingTaskId]);

  // Kanban drop handler
  const handleKanbanDrop = useCallback((payload: {
    taskId: string;
    fromStatus: string;
    fromIndex: number;
    toStatus: string;
    toIndex: number;
  }) => {
    setTasks((prev) => {
      // Group tasks by status preserving order
      const byStatus: Record<string, Task[]> = {};
      statuses.forEach((s) => (byStatus[s] = []));
      for (const t of prev) {
        const s = (t as any).status ?? (statuses[0] || "");
        (byStatus[s] ?? (byStatus[s] = [])).push(t);
      }

      const { taskId, fromStatus, fromIndex, toStatus } = payload;
      let { toIndex } = payload;

      const srcList = byStatus[fromStatus] ?? [];
      const dstList = byStatus[toStatus] ?? [];

      // find task
      const moving = srcList[fromIndex];
      if (!moving || moving.id !== taskId) {
        // fallback: find by id
        const idx = srcList.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          srcList.splice(idx, 1);
        }
      } else {
        srcList.splice(fromIndex, 1);
      }

      // clamp toIndex
      if (toStatus === fromStatus) {
        if (toIndex > srcList.length) toIndex = srcList.length;
      } else {
        if (toIndex > dstList.length) toIndex = dstList.length;
      }

      const updated: Task = { ...moving, status: toStatus };
      dstList.splice(toIndex, 0, updated);

      // Stitch back into a single array following statuses order
      const next: Task[] = [];
      for (const s of statuses) {
        const list = byStatus[s] ?? [];
        for (const t of list) next.push(t);
      }

      return next;
    });
  }, [statuses]);

  // recalc statuses list whenever tasks change (unique list, preserve order as encountered)
  useEffect(() => {
    const next = Array.from(
      new Set(
        tasks
          .map(t => (t.status || "").trim())
          .filter(s => s.length > 0)
      )
    );

    setStatuses(prev => {
      const same = prev.length === next.length && prev.every((v, i) => v === next[i]);
      if (!same) {
        saveStatuses(next);   // <-- сюда летит уже пересчитанный массив
        return next;
      }
      return prev;
    });
  }, [tasks]);

  // keep modal draft in sync with actual task while open
  useEffect(() => {
    if (!isTaskModalOpen || !editingTaskId) return;
    const t = tasks.find(x => x.id === editingTaskId);
    if (!t) return;
    setDraftTitle(t.title);
    setDraftDescription(t.description || "");
    setDraftEstimate(t.estimate || 0);
    setDraftStatus(t.status || "");
  }, [isTaskModalOpen, editingTaskId, tasks]);

  // === DELETE ALL ===
  const handleDeleteAllTasks = useCallback(() => {
    setTasks([]);
    setEvents([]);
    setStatuses([]);
    setConfirmModalOpen(false);
    try {
      localStorage.removeItem(LS_TASKS);
      localStorage.removeItem(LS_EVENTS);
    } catch {}
    setCalReset(n => n + 1);
  }, []);

  // === ESTIMATE CHANGE (from sidebar) ===
  const onEstimateChange = useCallback((taskId: string, hours: number) => {
    const h = Math.max(0, Math.round(hours * 4) / 4);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, estimate: h } : t));
  }, []);

  // === CALENDAR EVENTS CHANGE CALLBACK ===
  const onEventsChange = useCallback((evs: PlainEvent[]) => {
    setEvents(evs);
  }, []);

  // === EVENT DBLCLICK -> OPEN TASK MODAL ===
  const handleEventDblClick = useCallback((taskId: string) => {
    openEditTaskModal(taskId);
  }, [openEditTaskModal]);

  // === CALENDAR SELECT SLOT ===
  const handleSelectSlot = useCallback((range: { start: Date; end: Date }) => {
    setPendingSlot(range);
    setEditingTaskId(null);
    setDraftTitle("");
    setDraftDescription("");
    setDraftEstimate(minutesToHoursQuarter((range.end.getTime() - range.start.getTime()) / 60000));
    setDraftStatus(statuses[0] || "");
    setTaskModalOpen(true);
    setPendingNewTaskId("new");
  }, [statuses]);

  // === RENDER ===
  return (
    <div className="app-shell">
      {/* Верхняя панель настроек */}
      <div className="settings-bar">
        <div className="settings-left">
          <button
            className="theme-toggle-btn"
            onClick={handleThemeClick}
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            aria-label="Toggle theme / open theme menu"
            title="Click: switch theme • Hold: choose theme"
            data-testid="theme-toggle"
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
        </div>
          <div className="settings-right">
            <button
              className="icon-btn delete-btn"
              onClick={() => setConfirmModalOpen(true)}
              aria-label="Delete all tasks"
              title="Delete all tasks"
              type="button"
            >
              <img src={ExplosionIcon} alt="" />
            </button>
          </div>
                </div>

      {/* Вкладки (Safari-style) */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${currentPage === "calendar" ? "is-active" : ""}`}
          onClick={() => setCurrentPage("calendar")}
        >
          Calendar
        </button>
        <button
          className={`tab-btn ${currentPage === "kanban" ? "is-active" : ""}`}
          onClick={() => setCurrentPage("kanban")}
        >
          Kanban Board
        </button>
      </div>

      {/* Main content area below the view/tabs */}
      <div className="main-content-row">
        {currentPage === "calendar" && (
          <>
            <div className="sidebar" style={{ width: sidebarWidth }}>
              <Sidebar
                tasks={tasks}
                allocations={allocations}
                onEstimateChange={onEstimateChange}
                onAddTask={openNewTaskModal}
                onEditTask={openEditTaskModal}
                onReorder={ids => setTasks(prev => reorderByIds(prev, ids))}
              />
              {/* Sidebar resizer */}
              <div
                className="sidebar-resizer"
                onMouseDown={handleSidebarMouseDown}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
              />
            </div>

            <div className="main">
              <div className="calendar-wrapper">
                <CalendarView
                  key={calReset}
                  events={events}
                  onEventsChange={onEventsChange}
                  onEventDblClick={handleEventDblClick}
                  onSelectSlot={handleSelectSlot}
                />
              </div>
            </div>
          </>
        )}

        {currentPage === "kanban" && (
          <div className="main kanban-main">
            <KanbanBoard
              tasks={tasks}
              allocations={allocations}
              onTaskDblClick={handleEventDblClick}
              statuses={statuses}
              onAddTask={openNewTaskModal}
              onDropTask={handleKanbanDrop}
            />
          </div>
        )}
      </div>

      {/* THEME MENU (floating, long-press). Rendered as a simple block; styles in CSS */}
      {menuOpen && (
        <div className="theme-menu" role="menu">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-menu-item${theme === t.id ? " is-active" : ""}`}
              data-themeid={t.id}
              type="button"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* TASK MODAL */}
      {isTaskModalOpen && (
        <div className="tm-modal-overlay" role="dialog" aria-modal="true">
          <div className="tm-modal">
            <h3 className="tm-modal-title">
              {editingTaskId ? "Edit Task" : "New Task"}
            </h3>

            <label className="tm-label">Title</label>
            <input
              className="tm-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Enter title"
              autoFocus
            />

            <label className="tm-label">Description</label>
            <textarea
              className="tm-textarea"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              placeholder="Optional"
              rows={4}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: "0 0 auto" }}>
                <label className="tm-label">Estimate (hours)</label>
                <input
                  type="number"
                  step={0.25}
                  min={0}
                  className="tm-input-small"
                  value={draftEstimate}
                  onChange={(e) => setDraftEstimate(Number(e.target.value))}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label className="tm-label">Status</label>
                <input
                  list="status-options"
                  className="tm-input"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  placeholder="Type or choose…"
                />
                <datalist id="status-options">
                  {statuses.map((status) => (
                    <option key={status} value={status} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="tm-modal-actions">
              {editingTaskId && (
                <button
                  type="button"
                  className="tm-btn tm-btn-danger tm-btn-left"
                  onClick={(e) => deleteTask(e)}
                  data-testid="delete-task"
                >
                  Delete task
                </button>
              )}

              <div className="tm-actions-right">
                <button className="tm-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="tm-btn tm-btn-primary"
                  onClick={saveModal}
                  data-testid="save-task"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE-ALL CONFIRM */}
      {isConfirmModalOpen && (
        <div className="tm-modal-overlay" role="dialog" aria-modal="true">
          <div className="tm-modal">
            <h3 className="tm-modal-title">Delete all tasks?</h3>
            <p className="task-desc">This will remove all tasks and all calendar events.</p>
            <div className="tm-modal-actions">
              <button
                className="tm-btn tm-btn-danger"
                onClick={handleDeleteAllTasks}
                data-testid="confirm-delete-all"
              >
                Delete all
              </button>
              <button
                className="tm-btn"
                onClick={() => setConfirmModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;