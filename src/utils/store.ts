export type Task = { id: string; title: string; description?: string; estimateHours: number; color?: string };
export type CalEvent = { id: string; taskId: string; title: string; start: string; end: string };

const TASKS_KEY = 'tm.tasks.v1';
const EVENTS_KEY = 'tm.events.v1';

export function loadTasks(): Task[] {
  try { return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch { return []; }
}
export function saveTasks(tasks: Task[]) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}
export function seedDefaultTasks(): Task[] {
  return [
    { id: 't1', title: 'Sample task', estimateHours: 1 },
    { id: 't2', title: 'Task 2', estimateHours: 1 },
    { id: 't3', title: 'Task 3', estimateHours: 1 },
  ];
}

export function loadEvents(): CalEvent[] {
  try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); } catch { return []; }
}
export function saveEvents(evts: CalEvent[]) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(evts));
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
