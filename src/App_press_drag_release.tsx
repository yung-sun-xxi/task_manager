/* src/App.tsx */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar, { Task } from "./components/Sidebar";
import CalendarView, { PlainEvent } from "./components/CalendarView";
import "./index.css";
import "./App.css";

/** Theme files */
import "./themes/theme-light.css";
import "./themes/theme-dark.css";
import "./themes/theme-sunny-pump.css";

const LS_TASKS = "tm_tasks_v1";
const LS_EVENTS = "tm_events_v1";
const LS_THEME = "tm_theme_v1";

/** Register available themes (id matches the suffix in html.theme-<id>) */
const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark (all black)" },
  { id: "sunny-pump", label: "Sunny Pump" },
];

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(LS_TASKS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function loadEvents(): PlainEvent[] {
  try {
    const raw = localStorage.getItem(LS_EVENTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function saveTasks(tasks: Task[]) {
  try { localStorage.setItem(LS_TASKS, JSON.stringify(tasks)); } catch {}
}
function saveEvents(events: PlainEvent[]) {
  try { localStorage.setItem(LS_EVENTS, JSON.stringify(events)); } catch {}
}
function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Теперь эта функция не нужна, так как мы используем maxLength
function truncateTitle(title: string): string {
  if (title.length > 50) {
    return title.slice(0, 47) + "...";
  }
  return title;
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [events, setEvents] = useState<PlainEvent[]>(() => loadEvents());

  // modal state
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftEstimate, setDraftEstimate] = useState(0);
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
    try { localStorage.setItem(LS_THEME, theme); } catch {}
  }, [theme]);

  // force refresh calendar after destructive ops
  const [calReset, setCalReset] = useState(0);

  // sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(288);

  // persist
  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveEvents(events), [events]);

  // keep modal draft in sync with actual task while open
  useEffect(() => {
    if (!isTaskModalOpen || !editingTaskId) return;
    const t = tasks.find(x => x.id === editingTaskId);
    if (t) {
      setDraftTitle(t.title);
      setDraftDescription(t.description || "");
      setDraftEstimate(t.estimateHours || 0);
    }
  }, [isTaskModalOpen, editingTaskId, tasks]);

  // Handle Escape key to close modal / close menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isTaskModalOpen) closeModal();
        if (menuOpen) setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [isTaskModalOpen, menuOpen]);

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

  // sidebar resize handlers
  const handleMouseDown = useCallback(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setSidebarWidth(e.clientX);
  }, []);
  const handleMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // allocations
  const allocations: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of events) {
      const tId = (ev as any).taskId as string | undefined;
      if (!tId || !ev.start || !ev.end) continue;
      const start = new Date(ev.start).getTime();
      const end = new Date(ev.end).getTime();
      const hours = Math.max(0, (end - start) / 36e5);
      acc[tId] = (acc[tId] || 0) + hours;
    }
    for (const k of Object.keys(acc)) acc[k] = Math.round(acc[k] * 4) / 4;
    return acc;
  }, [events]);

  // sidebar
  const onEstimateChange = useCallback((taskId: string, estimateHours: number) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, estimateHours } : t)));
  }, []);

  // calendar
  const handleCalendarEventsChange = useCallback((next: PlainEvent[]) => {
    setEvents(next);
  }, []);

  const handleCreateBySelect = useCallback((start: Date, end: Date) => {
    // Create a new task and event linked to it
    const taskId = genId("task");
    const est = Math.max(0.25, (end.getTime() - start.getTime()) / 36e5);
    const newTask: Task = { 
      id: taskId, 
      title: "New Task", 
      description: "", 
      estimateHours: Math.round(est * 4) / 4 
    };
    const newEvent: PlainEvent = {
      id: genId("ev"),
      title: newTask.title,
      start: start.toISOString(),
      end: end.toISOString(),
      taskId,
    };
    setTasks(prev => [newTask, ...prev]);
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const handleEventDblClick = useCallback((taskId?: string) => {
    if (!taskId) return;
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    setEditingTaskId(t.id);
    setDraftTitle(t.title);
    setDraftDescription(t.description || "");
    setDraftEstimate(t.estimateHours || 0);
    setTaskModalOpen(true);
  }, [tasks]);

  const openNewTaskModal = useCallback(() => {
    // Create a placeholder task and open the same modal for editing
    const id = genId('task');
    const newTask = { id, title: "", description: "", estimateHours: 0 } as Task;
    setTasks(prev => [newTask, ...prev]);
    setEditingTaskId(id);
    setDraftTitle("");
    setDraftDescription("");
    setDraftEstimate(0);
    setPendingNewTaskId(id);
    setTaskModalOpen(true);
  }, []);

  // modal actions
  const closeModal = useCallback(() => {
    // If we created a new empty task and the user cancelled, remove it
    if (pendingNewTaskId && editingTaskId === pendingNewTaskId) {
      setTasks(prev => prev.filter(t => t.id !== pendingNewTaskId));
      setPendingNewTaskId(null);
    }
    setTaskModalOpen(false);
    setEditingTaskId(null);
  }, [pendingNewTaskId, editingTaskId]);

  const saveModal = useCallback(() => {
    if (!editingTaskId) return;
    const title = draftTitle.trim();
    if (!title) {
        // Remove the pending task if the title is empty and the user tries to save
        if (pendingNewTaskId === editingTaskId) {
            setTasks(prev => prev.filter(t => t.id !== pendingNewTaskId));
            setPendingNewTaskId(null);
        }
        closeModal();
        return;
    }

    const estimate = Math.max(0, Math.round(Number(draftEstimate) * 4) / 4);

    // update task
    const nextTasks = tasks.map(t =>
      t.id === editingTaskId ? { ...t, title: title, description: draftDescription, estimateHours: estimate } : t
    );
    setTasks(nextTasks);
    saveTasks(nextTasks);

    // sync events titles
    const nextEvents = events.map(ev => ((ev as any).taskId === editingTaskId ? { ...ev, title: title } as PlainEvent : ev));
    setEvents(nextEvents);
    if (pendingNewTaskId === editingTaskId) setPendingNewTaskId(null);
    saveEvents(nextEvents);

    closeModal();
  }, [editingTaskId, draftTitle, draftDescription, draftEstimate, tasks, events, closeModal, pendingNewTaskId]);

  const deleteTask = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const id = editingTaskId;
    if (!id) return;

    // remove from tasks
    const nextTasks = tasks.filter(t => t.id !== id);
    setTasks(nextTasks);
    saveTasks(nextTasks);

    // remove related events
    const nextEvents = events.filter(ev => (ev as any).taskId !== id);
    setEvents(nextEvents);
    if (pendingNewTaskId === editingTaskId) setPendingNewTaskId(null);
    saveEvents(nextEvents);

    setCalReset(n => n + 1);
    closeModal();
  }, [editingTaskId, tasks, events, closeModal]);

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
    setTheme(id);
    setMenuOpen(false);
  }, []);

  return (
    <div className="app-shell">
      {/* Theme toggle button (top-right, fixed) */}
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
        {/* Simple label (you can customize per theme) */}
        {theme === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>

      {/* Theme menu */}
      {menuOpen && (
        <div className="theme-menu" role="menu" aria-label="Choose theme">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-menu-item ${theme === t.id ? "is-active" : ""}`}
              data-themeid={t.id}
              onClick={() => applyTheme(t.id)}  // keep click as fallback
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="sidebar" style={{ width: sidebarWidth }}>
        <Sidebar
          onAddTask={openNewTaskModal}
          tasks={tasks}
          allocations={allocations}
          onEstimateChange={onEstimateChange}
          onTaskDblClick={handleEventDblClick}
        />
        <div className="sidebar-resizer" onMouseDown={handleMouseDown}></div>
      </div>

      <div className="main">
        <CalendarView
          key={calReset}
          events={events}
          onEventsChange={handleCalendarEventsChange}
          tasksById={new Map(tasks.map(t => [t.id, t]))}
          onCreateBySelect={handleCreateBySelect}
          onEventDblClick={handleEventDblClick}
        />
      </div>

      {isTaskModalOpen && (
        <div
          className="tm-modal-overlay"
          onClick={(evt) => { if (evt.target === evt.currentTarget) closeModal(); }}
          onMouseDown={(evt) => evt.stopPropagation()}
        >
          <div
            className="tm-modal"
            onMouseDown={(evt) => evt.stopPropagation()}
            onClick={(evt) => evt.stopPropagation()}
          >
            <h2 id="tm-modal-title" className="tm-modal-title">Task</h2>

            <label className="tm-label" htmlFor="tm-task-title">Title</label>
            <input
              id="tm-task-title"
              className="tm-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveModal();
                }
              }}
              maxLength={70}
            />

            <label className="tm-label" htmlFor="tm-task-desc">Description</label>
            <textarea
              id="tm-task-desc"
              className="tm-textarea"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
            />

            <label className="tm-label" htmlFor="tm-task-est">Estimation, h</label>
            <input
              id="tm-task-est"
              className="tm-input-small"
              type="number"
              step={0.25}
              min={0}
              value={draftEstimate}
              onChange={(e) => setDraftEstimate(Number(e.target.value))}
            />

            <div className="tm-modal-actions">
              <button
                type="button"
                className="tm-btn tm-btn-danger tm-btn-left"
                onClick={(e) => deleteTask(e)}
                data-testid="delete-task"
              >
                Delete task
              </button>
              <div className="tm-actions-right">
                <button type="button" onClick={closeModal} className="tm-btn">Cancel</button>
                <button type="button" onClick={saveModal} className="tm-btn tm-btn-primary">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
