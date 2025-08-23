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
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
}

function saveEvents(events: PlainEvent[]) {
  localStorage.setItem(LS_EVENTS, JSON.stringify(events));
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [events, setEvents] = useState<PlainEvent[]>(() => loadEvents());

  // ---- Task modal state ----
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftEstimate, setDraftEstimate] = useState(0);

  // Persist to LS
  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveEvents(events), [events]);

  // Allocations: total scheduled hours per task
  const allocations: Record<string, number> = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const ev of events) {
      const tId = ev.taskId;
      if (!tId) continue;
      const start = new Date(ev.start).getTime();
      const end = new Date(ev.end).getTime();
      const hours = Math.max(0, end - start) / 36e5;
      acc[tId] = (acc[tId] || 0) + hours;
    }
    // Round to quarter-hours to avoid floating noise
    for (const k of Object.keys(acc)) {
      acc[k] = Math.round(acc[k] * 4) / 4;
    }
    return acc;
  }, [events]);

  // ---- Sidebar handlers ----
  const onEstimateChange = useCallback((taskId: string, estimateHours: number) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, estimateHours } : t)));
  }, []);

  // ---- Calendar handlers ----
  const handleCalendarEventsChange = useCallback((nextEvents: PlainEvent[]) => {
    setEvents(nextEvents);
  }, []);

  const handleCreateBySelect = useCallback((start: Date, end: Date) => {
    // Create a new task and event linked to it
    const taskId = genId("task");
    const newTask: Task = {
      id: taskId,
      title: "Task",
      description: "",
      estimateHours: Math.max(0.25, (end.getTime() - start.getTime()) / 36e5) // default estimate at least 0.25h
    };
    const newEvent: PlainEvent = {
      id: genId("evt"),
      title: newTask.title,
      start: start.toISOString(),
      end: end.toISOString(),
      taskId
    };
    setTasks(prev => [...prev, newTask]);
    setEvents(prev => [...prev, newEvent]);
  }, []);

  const handleEventDblClick = useCallback((taskId: string | undefined) => {
    if (!taskId) return;
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    setEditingTaskId(t.id);
    setDraftTitle(t.title);
    setDraftDescription(t.description || "");
    setDraftEstimate(t.estimateHours || 0);
    setTaskModalOpen(true);
  }, [tasks]);

  // ---- Modal handlers ----
  const closeModal = useCallback(() => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
  }, []);

  const saveModal = useCallback(() => {
    if (!editingTaskId) return;
    const title = draftTitle.trim();
    if (!title) return;
    const estimate = Math.max(0, Math.round(Number(draftEstimate) * 4) / 4);
    setTasks(prev => prev.map(t => (t.id === editingTaskId ? { ...t, title, description: draftDescription, estimateHours: estimate } : t)));
    // keep event titles in sync with task title
    setEvents(prev => prev.map(ev => (ev.taskId === editingTaskId ? { ...ev, title } : ev)));
    closeModal();
  }, [editingTaskId, draftTitle, draftDescription, draftEstimate, closeModal]);

  const deleteTask = useCallback(() => {
    if (!editingTaskId) return;
    if (!confirm("Удалить задачу и все связанные события?")) return;
    const id = editingTaskId;
    setTasks(prev => prev.filter(t => t.id !== id));
    setEvents(prev => prev.filter(ev => ev.taskId !== id));
    closeModal();
  }, [editingTaskId, closeModal]);

  return (
    <div className="app-shell">
      <div className="sidebar">
        <Sidebar tasks={tasks} allocations={allocations} onEstimateChange={onEstimateChange} />
      </div>
      <div className="main">
        <CalendarView
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
          onMouseDown={(e) => {
            // close when clicking outside the modal box
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="tm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="tm-modal-title" className="tm-modal-title">Задача</h2>

            <label className="tm-label" htmlFor="tm-task-title">Название</label>
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

            <label className="tm-label" htmlFor="tm-task-desc">Описание</label>
            <textarea
              id="tm-task-desc"
              className="tm-textarea"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  saveModal();
                }
              }}
            />

            <label className="tm-label" htmlFor="tm-task-est">Размер в часах</label>
            <input
              id="tm-task-est"
              type="number"
              step={0.25}
              min={0}
              className="tm-input"
              value={draftEstimate}
              onChange={(e) => setDraftEstimate(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveModal();
                }
              }}
            />

            <div className="tm-modal-actions">
              <button onClick={deleteTask} className="tm-btn tm-btn-danger tm-btn-left">Удалить таску</button>
              <div className="tm-actions-right">
                <button onClick={closeModal} className="tm-btn">Выйти / Cancel</button>
                <button onClick={saveModal} className="tm-btn tm-btn-primary">Сохранить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
