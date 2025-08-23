import React, { useEffect, useRef, useState } from 'react';
import { Draggable } from '@fullcalendar/interaction';

type Task = {
  id: string;
  title: string;
  description?: string;
  estimateHours: number; // required
  color?: string;
};

type AllocMap = Record<string, number>; // minutes per taskId

const styles = {
  task: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '10px 12px',
    background: 'var(--surface)',
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: 600 as const },
  small: { fontSize: 12, color: 'var(--muted)' },
  barWrap: { height: 6, background: '#eef1f5', borderRadius: 999, overflow: 'hidden' },
  bar: (w: number, over: boolean) => ({
    width: `${Math.min(100, Math.max(0, w))}%`,
    height: '100%',
    background: over ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  }),
  badgeOver: { fontSize: 12, color: '#ef4444', marginLeft: 6 },
  btn: {
    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', cursor: 'pointer'
  },
};

function minutesToText(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  if (h === 0) return `${m} m`;
  return `${h} h ${m} m`;
}

const Sidebar: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem('tm_tasks');
      if (raw) {
        const arr: any[] = JSON.parse(raw);
        return arr.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description || '',
          estimateHours: typeof t.estimateHours === 'number' && t.estimateHours > 0 ? t.estimateHours : 1,
          color: t.color,
        }));
      }
    } catch {}
    // seed defaults
    return [
      { id: 't1', title: 'Sample task', description: 'Try dragging me', estimateHours: 8 },
      { id: 't2', title: 'Design review', description: 'UI polish', estimateHours: 2 },
      { id: 't3', title: 'Docs update', description: 'Write guide', estimateHours: 4 },
    ];
  });

  // allocations (minutes) per taskId
  const [alloc, setAlloc] = useState<AllocMap>(() => {
    try {
      const raw = localStorage.getItem('tm_alloc');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // persist tasks
  useEffect(() => {
    localStorage.setItem('tm_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // listen allocation updates from CalendarView
  useEffect(() => {
    const onAlloc = (e: Event) => {
      const de = (e as CustomEvent).detail;
      if (de && de.minutesByTaskId) {
        setAlloc(de.minutesByTaskId as AllocMap);
        try {
          localStorage.setItem('tm_alloc', JSON.stringify(de.minutesByTaskId));
        } catch {}
      }
    };
    window.addEventListener('tm:alloc', onAlloc as EventListener);
    return () => window.removeEventListener('tm:alloc', onAlloc as EventListener);
  }, []);

  // external drag
  const listRef = useRef<HTMLDivElement>(null);
  const draggableRef = useRef<Draggable | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    draggableRef.current?.destroy();
    const inst = new Draggable(listRef.current, {itemSelector: '.fc-draggable',
      eventData: (el) => {
        const id = (el as HTMLElement).dataset.id!;
        const t = tasks.find(x => x.id === id)!;
        return {
          title: t.title,
          duration: '01:00',
          extendedProps: { taskId: t.id, description: t.description || '' },
        };
      },
dragStart: () => {
  window.dispatchEvent(new CustomEvent('tm:extdrag', { detail: { active: true } }));
},
dragStop: () => {
  window.dispatchEvent(new CustomEvent('tm:extdrag', { detail: { active: false } }));
},
});
    draggableRef.current = inst;
    return () => { inst.destroy(); draggableRef.current = null; };
  }, [tasks]);

  // edit modal (estimateHours editable)
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState({ title: '', description: '', estimateHours: '1' });
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({ title: t.title, description: t.description || '', estimateHours: String(t.estimateHours) });
  };
  const closeEdit = () => setEditing(null);
  const saveEdit = () => {
    if (!editing) return;
    const est = Math.max(0.25, parseFloat(form.estimateHours || '0'));
    setTasks(prev => prev.map(t => t.id === editing.id ? { ...t, title: form.title.trim() || t.title, description: form.description, estimateHours: est } : t));
    closeEdit();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Task List</h2>
        <button
          style={styles.btn as any}
          onClick={() => {
            const n = Date.now().toString(36);
            const newTask: Task = { id: 't' + n, title: 'New task', description: '', estimateHours: 1 };
            setTasks(prev => [newTask, ...prev]);
          }}
        >
          + New
        </button>
      </div>

      <div ref={listRef} className="space-y-3">
        {tasks.map((t) => {
          const estMin = Math.round(t.estimateHours * 60);
          const aMin = alloc[t.id] || 0;
          const over = aMin > estMin;
          const percent = estMin > 0 ? (aMin / estMin) * 100 : 0;
          const remainingMin = Math.max(0, estMin - aMin);
          return (
            <div
              key={t.id}
              className="fc-draggable tm-task cursor-move select-none"
              data-id={t.id}
              style={{ ...styles.task, borderLeft: `4px solid ${over ? '#ef4444' : '#6366f1'}` } as any}
              title="Click to edit • Drag to schedule"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(t); }}
            >
              <div style={styles.row as any}>
                <div style={styles.title as any}>{t.title}</div>
                <div style={styles.small as any}>
                  {minutesToText(aMin)} / {t.estimateHours} h
                  {over && <span style={styles.badgeOver as any}> (+{minutesToText(aMin - estMin)})</span>}
                </div>
              </div>
              <div style={{ ...styles.barWrap, marginTop: 8 } as any}>
                <div style={styles.bar(percent, over) as any} />
              </div>
              <div style={{ ...styles.small, marginTop: 6 } as any}>
                {over ? 'Over-allocated' : remainingMin === 0 ? 'Fully allocated' : `Remaining: ${minutesToText(remainingMin)}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 60 }}
          onClick={closeEdit}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 560, maxWidth: '92vw', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 24px 60px rgba(2,6,23,0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Edit task</div>
              <button onClick={closeEdit} style={{ border: '1px solid var(--border)', width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center' }}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <div className="mb-3">
                <div className="text-sm" style={{ color: 'var(--muted)' }}>Title</div>
                <input
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}
                />
              </div>
              <div className="mb-3">
                <div className="text-sm" style={{ color: 'var(--muted)' }}>Estimate (hours)</div>
                <input
                  type="number" step="0.25" min="0.25"
                  value={form.estimateHours}
                  onChange={(e) => setForm(f => ({ ...f, estimateHours: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}
                />
              </div>
              <div className="mb-3">
                <div className="text-sm" style={{ color: 'var(--muted)' }}>Description</div>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 12px', minHeight: 120 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <button onClick={closeEdit} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>Cancel</button>
              <button onClick={saveEdit} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff' }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
