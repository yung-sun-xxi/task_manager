/* src/App.tsx */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar, { Task } from "./components/Sidebar";
import CalendarView, { PlainEvent } from "./components/CalendarView";
import "./index.css";
import "./App.css";

const LS_TASKS = "tm_tasks_v1";
const LS_EVENTS = "tm_events_v1";

function loadTasks(): Task[] {
  try { const raw = localStorage.getItem(LS_TASKS); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function loadEvents(): PlainEvent[] {
  try { const raw = localStorage.getItem(LS_EVENTS); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function saveTasks(tasks: Task[]) { localStorage.setItem(LS_TASKS, JSON.stringify(tasks)); }
function saveEvents(events: PlainEvent[]) { localStorage.setItem(LS_EVENTS, JSON.stringify(events)); }
function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [events, setEvents] = useState<PlainEvent[]>(() => loadEvents());

  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftEstimate, setDraftEstimate] = useState(0);

  // ресет только для перерендера FullCalendar после удаления
  const [calReset, setCalReset] = useState(0);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveEvents(events), [events]);

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

  const onEstimateChange = useCallback((taskId: string, estimateHours: number) => {
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, estimateHours } : t)));
  }, []);

  const handleCalendarEventsChange = useCallback((next: PlainEvent[]) => {
    setEvents(next);
  }, []);

  const handleCreateBySelect = useCallback((start: Date, end: Date) => {
    const taskId = genId("task");
    const durH = Math.max(0.25, (end.getTime() - start.getTime()) / 36e5);
    const newTask: Task = { id: taskId, title: "Task", description: "", estimateHours: Math.round(durH * 4) / 4 };
    const newEvent: PlainEvent = { id: genId("ev"), title: newTask.title, start: start.toISOString(), end: end.toISOString(), taskId };
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

  const closeModal = useCallback(() => {
    setTaskModalOpen(false);
    setEditingTaskId(null);
  }, []);

  const saveModal = useCallback(() => {
    if (!editingTaskId) return;
    const title = draftTitle.trim();
    if (!title) return;
    const estimate = Math.max(0, Math.round(Number(draftEstimate) * 4) / 4);

    // обновляем таску
    const nextTasks = tasks.map(t => (t.id === editingTaskId ? { ...t, title, description: draftDescription, estimateHours: estimate } : t));
    setTasks(nextTasks);
    saveTasks(nextTasks);

    // синхронизация заголовков событий
    const nextEvents = events.map(ev => ((ev as any).taskId === editingTaskId ? { ...ev, title } as PlainEvent : ev));
    setEvents(nextEvents);
    saveEvents(nextEvents);

    closeModal();
  }, [editingTaskId, draftTitle, draftDescription, draftEstimate, tasks, events, closeModal]);

  // ВАЖНО: «жёсткое» удаление, без confirm, с синхронной записью в LS
  const deleteTask = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const id = editingTaskId;
    if (!id) return;

    // 1) удаляем из списка тасок
    const nextTasks = tasks.filter(t => t.id !== id);
    setTasks(nextTasks);
    saveTasks(nextTasks);

    // 2) удаляем все события этой таски
    const nextEvents = events.filter(ev => (ev as any).taskId !== id);
    setEvents(nextEvents);
    saveEvents(nextEvents);

    // 3) перерисовываем календарь, чтобы точно ушли «призраки»
    setCalReset(n => n + 1);

    closeModal();
  }, [editingTaskId, tasks, events, closeModal]);

  return (
    <div className="app-shell">
      <div className="sidebar">
        <Sidebar tasks={tasks} allocations={allocations} onEstimateChange={onEstimateChange} />
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
          <div className="tm-modal" onMouseDown={(evt) => evt.stopPropagation()} onClick={(evt) => evt.stopPropagation()}>
            <h2 id="tm-modal-title" className="tm-modal-title">Задача</h2>

            <label className="tm-label" htmlFor="tm-task-title">Название</label>
            <input
              id="tm-task-title"
              className="tm-input"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveModal(); } }}
            />

            <label className="tm-label" htmlFor="tm-task-desc">Описание</label>
            <textarea
              id="tm-task-desc"
              className="tm-textarea"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={4}
            />

            <div className="tm-row" style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label className="tm-label" htmlFor="tm-task-est">Оценка, ч</label>
              <input
                id="tm-task-est"
                className="tm-input"
                type="number"
                step="0.25"
                min={0}
                value={draftEstimate}
                onChange={(e) => setDraftEstimate(Number(e.target.value))}
              />
              <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                Запланировано: {allocations[editingTaskId || ""] || 0} ч
              </span>
            </div>

            <div className="tm-modal-actions">
              <button
                type="button"
                className="tm-btn tm-btn-danger tm-btn-left"
                onClick={(e) => deleteTask(e)}
                data-testid="delete-task"
              >
                Удалить таску
              </button>
              <div className="tm-actions-right">
                <button type="button" onClick={closeModal} className="tm-btn">
                  Выйти / Cancel
                </button>
                <button type="button" onClick={saveModal} className="tm-btn tm-btn-primary">
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;