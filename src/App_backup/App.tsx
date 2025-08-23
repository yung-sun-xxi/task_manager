/* src/App.tsx */
import React, { useEffect, useMemo, useState } from "react";
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
  return [
    { id: "t1", title: "Sample task", estimateHours: 8, description: "This is a sample task description." },
    { id: "t2", title: "Task 2", estimateHours: 2, description: "Second task details." },
    { id: "t3", title: "Task 3", estimateHours: 1, description: "Third task notes." },
  ];
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

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [events, setEvents] = useState<PlainEvent[]>(loadEvents);

  const allocations = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (!ev.taskId || !ev.start || !ev.end) continue;
      const ms = new Date(ev.end).getTime() - new Date(ev.start).getTime();
      const min = Math.max(0, Math.round(ms / 60000));
      map.set(ev.taskId, (map.get(ev.taskId) || 0) + min);
    }
    return map;
  }, [events]);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveEvents(events), [events]);

  const onEstimateChange = (id: string, estimateHours: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, estimateHours } : t));
  };

  const handleCalendarEventsChange = (newEvents: PlainEvent[]) => {
    setEvents(newEvents);
  };

  return (
    <div className="app-shell">
      <Sidebar tasks={tasks} allocations={allocations} onEstimateChange={onEstimateChange} />
      <div className="main">
        <CalendarView
          events={events}
          onEventsChange={handleCalendarEventsChange}
          tasksById={new Map(tasks.map(t => [t.id, t]))}
        />
      </div>
    </div>
  );
};

export default App;
