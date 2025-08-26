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

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [events, setEvents] = useState<PlainEvent[]>(() => loadEvents());

  // modal state
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftEstimate, setDraftEstimate] = useState(0);

  // force refresh calendar after destructive ops
  const [calReset, setCalReset] = useState(0);

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
    const newTask: Task = { id: taskId, title: "New Task", description: "", estimateHours: Math.round(est * 4) / 4 };
    const newEvent: PlainEvent = {
      id: genId("ev"),
      title: newTask.title,
      start: start.toISOString(),
      end: end.toISOString(),
      taskId
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

  // modal actions
  const closeModal = useCallback(() => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
  }, []);

  const saveModal = useCallback(() => {
    if (!editingTaskId) return;
    const title = draftTitle.trim();
    if (!title) return;
    const estimate = Math.max(0, Math.round(Number(draftEstimate) * 4) / 4);

    // update task
    const nextTasks = tasks.map(t =>
      t.id === editingTaskId ? { ...t, title, description: draftDescription, estimateHours: estimate } : t
    );
    setTasks(nextTasks);
    saveTasks(nextTasks);

    // sync events titles
    const nextEvents = events.map(ev => ((ev as any).taskId === editingTaskId ? { ...ev, title } as PlainEvent : ev));
    setEvents(nextEvents);
    saveEvents(nextEvents);

    closeModal();
  }, [editingTaskId, draftTitle, draftDescription, draftEstimate, tasks, events, closeModal]);

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
    saveEvents(nextEvents);

    setCalReset(n => n + 1);
    closeModal();
  }, [editingTaskId, tasks, events, closeModal]);

  return (
    <div className="app-shell">
      <div className="sidebar">
        <Sidebar
          tasks={tasks}
          allocations={allocations}
          onEstimateChange={onEstimateChange}
          onTaskDblClick={handleEventDblClick}
        />
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