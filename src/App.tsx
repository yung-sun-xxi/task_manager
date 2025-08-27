/* src/App.tsx */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar, { Task } from "./components/Sidebar";
import CalendarView, { PlainEvent } from "./components/CalendarView";
import "./index.css";
import "./App.css";

const LS_TASKS = "tm_tasks_v1";
const LS_EVENTS = "tm_events_v1";

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

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isTaskModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTaskModalOpen]);


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

  return (
    <div className="app-shell">
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