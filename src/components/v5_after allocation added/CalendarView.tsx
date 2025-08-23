import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import { EventApi, EventClickArg } from '@fullcalendar/core';

type Task = { id: string; title: string; estimateHours: number; description?: string; color?: string };
type ViewModal = { open: boolean; event: EventApi | null };
type CreateModal = { open: boolean; start: Date | null; end: Date | null; title: string; description: string; taskId: string };

function minutesBetween(a: Date, b: Date) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
function roundTo15(d: Date) {
  const m = d.getMinutes();
  const r = Math.round(m / 15) * 15;
  d.setMinutes(r, 0, 0);
  return d;
}
function recalcAndBroadcast(api: any) {
  const all: EventApi[] = api?.getEvents?.() || [];
  const minutesByTaskId: Record<string, number> = {};
  for (const ev of all) {
    const { start, end } = ev;
    const tId = (ev.extendedProps as any)?.taskId as string | undefined;
    if (!start || !end || !tId) continue;
    minutesByTaskId[tId] = (minutesByTaskId[tId] || 0) + minutesBetween(start, end);
  }
  window.dispatchEvent(new CustomEvent('tm:alloc', { detail: { minutesByTaskId } }));
  try { localStorage.setItem('tm_alloc', JSON.stringify(minutesByTaskId)); } catch {}
  try {
    const serial = all.map(ev => ({
      id: ev.id,
      title: ev.title,
      start: ev.start?.toISOString(),
      end: ev.end?.toISOString(),
      extendedProps: { taskId: (ev.extendedProps as any)?.taskId || null, description: (ev.extendedProps as any)?.description || '' },
    }));
    localStorage.setItem('tm_events', JSON.stringify(serial));
  } catch {}
}

const CalendarView: React.FC = () => {
  const calendarRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewModal, setViewModal] = useState<ViewModal>({ open: false, event: null });
  const [createModal, setCreateModal] = useState<CreateModal>({ open: false, start: null, end: null, title: '', description: '', taskId: '' });

  // Perf: ResizeObserver + manual updateSize()
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const getApi = () => calendarRef.current?.getApi();
    let raf = 0; let timeoutId: number | null = null;
    const kick = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => getApi()?.updateSize());
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => getApi()?.updateSize(), 80);
    };
    const ro = new ResizeObserver(kick);
    ro.observe(el);
    window.addEventListener('resize', kick);
    kick();
    return () => { ro.disconnect(); window.removeEventListener('resize', kick); if (raf) cancelAnimationFrame(raf); if (timeoutId) window.clearTimeout(timeoutId); };
  }, []);

  // Load tasks (for create modal dropdown)
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('tm_tasks');
      if (raw) setTasks(JSON.parse(raw));
    } catch {}
  }, []);

  // Load initial events
  const [initialEvents] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('tm_events');
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  });

  // Recalculate allocations after first render
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    setTimeout(() => recalcAndBroadcast(api), 0);
  }, []);

  // View modal
  const handleEventClick = (arg: EventClickArg) => setViewModal({ open: true, event: arg.event });
  const closeView = () => setViewModal({ open: false, event: null });
  const deleteEvent = () => { viewModal.event?.remove(); closeView(); recalcAndBroadcast(calendarRef.current?.getApi()); };

  // Double click -> create modal (1h default, rounded to 15m)
  const lastClickRef = useRef<{ t: number; key: string } | null>(null);
  const handleDateClick = (arg: DateClickArg) => {
    const d = roundTo15(new Date(arg.date));
    const t = Date.now();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
    if (lastClickRef.current && key === lastClickRef.current.key && t - lastClickRef.current.t < 350) {
      const end = new Date(d); end.setMinutes(end.getMinutes() + 60);
      setCreateModal({ open: true, start: d, end, title: '', description: '', taskId: '' });
      lastClickRef.current = null; return;
    }
    lastClickRef.current = { t, key };
  };

  // Selection (Google-like drag to pick custom start+end)
  const handleSelect = (arg: any) => {
    const start = roundTo15(new Date(arg.start));
    const end = roundTo15(new Date(arg.end));
    setCreateModal({ open: true, start, end, title: '', description: '', taskId: '' });
  };

  const closeCreate = () => {
    setCreateModal((cm) => ({ ...cm, open: false }));
    const api = calendarRef.current?.getApi();
    api?.unselect();
  };
  const saveCreate = () => {
    const api = calendarRef.current?.getApi();
    if (!api || !createModal.start) return closeCreate();
    const start = new Date(createModal.start);
    const end = createModal.end ? new Date(createModal.end) : new Date(start.getTime() + 60*60000);
    const title = createModal.title.trim() || (tasks.find(t => t.id === createModal.taskId)?.title ?? 'Task');
    api.addEvent({
      title,
      start, end,
      extendedProps: { taskId: createModal.taskId || null, description: createModal.description || '' },
    });
    closeCreate();
    recalcAndBroadcast(api);
  };

  // Allocation hooks from FullCalendar
  const onEventAdd = () => recalcAndBroadcast(calendarRef.current?.getApi());
  const onEventChange = () => recalcAndBroadcast(calendarRef.current?.getApi());
  const onEventRemove = () => recalcAndBroadcast(calendarRef.current?.getApi());
  const onEventReceive = () => recalcAndBroadcast(calendarRef.current?.getApi()); // first drop from sidebar
  const onExternalDrop = () => setTimeout(() => recalcAndBroadcast(calendarRef.current?.getApi()), 0); // fallback

  const calendarEl = useMemo(() => (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin, interactionPlugin]}
      initialView="timeGridWeek"
      locale="en"
      buttonText={{ today: 'TODAY' }}
      height="100%"
      expandRows
      nowIndicator
      editable
      droppable
      eventDurationEditable
      handleWindowResize={false}
      allDaySlot={false}
      slotMinTime="09:00:00"
      slotMaxTime="21:01:00"
      slotDuration="00:15:00"        /* grid in 15 min */
      slotLabelInterval="01:00"
      slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
      snapDuration="00:15:00"        /* drag/resize snap to 15 min */
      selectable={true}              /* allow range selection */
      selectMirror={true}
      unselectAuto={true}
      select={handleSelect}
      initialEvents={initialEvents}
      dateClick={handleDateClick}
      eventClick={handleEventClick}
      eventAdd={onEventAdd}
      eventChange={onEventChange}
      eventRemove={onEventRemove}
      eventReceive={onEventReceive}
      drop={onExternalDrop}
    />
  ), [initialEvents]);

  const whenText = (s: Date | null, e?: Date | null) => {
    if (!s) return '';
    const end = e ? e : new Date(s.getTime() + 60*60000);
    const fmt = (x: Date) => x.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    return `${fmt(s)} – ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  };

  return (
    <div ref={containerRef} style={{ height: '100vh', padding: 16, boxSizing: 'border-box', background: 'var(--bg)', contain: 'layout paint size', willChange: 'contents' }}>
      {calendarEl}

      {/* View/Delete modal */}
      {viewModal.open && viewModal.event && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={closeView}>
          <div style={{ width: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 20px 40px rgba(2,6,23,0.2)', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{viewModal.event.title}</div>
            <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
              Task: {(viewModal.event.extendedProps as any)?.taskId || 'Unassigned'} ·
              Duration: {(() => {
                const s = viewModal.event.start!, e = viewModal.event.end!;
                const m = minutesBetween(s, e); const h = Math.floor(m / 60); const mm = m % 60;
                return mm === 0 ? `${h} h` : `${h} h ${mm} m`;
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={deleteEvent} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Delete</button>
              <button onClick={closeView} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {createModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.35)', display: 'grid', placeItems: 'center', zIndex: 60 }} onClick={closeCreate}>
          <div style={{ width: 480, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 20px 40px rgba(2,6,23,0.2)', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-xl font-bold mb-3">Create task allocation</div>
            {(createModal.start) && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                When: {whenText(createModal.start, createModal.end)}
              </div>
            )}

            <label className="block text-sm mb-1">Assign to task</label>
            <select
              value={createModal.taskId}
              onChange={(e) => setCreateModal(cm => ({ ...cm, taskId: e.target.value }))}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}
            >
              <option value="">Unassigned</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>

            <label className="block text-sm mb-1">Title</label>
            <input
              className="w-full mb-3"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}
              value={createModal.title}
              onChange={(e) => setCreateModal(cm => ({ ...cm, title: e.target.value }))}
              placeholder="Optional (defaults to selected task title)"
            />

            <label className="block text-sm mb-1">Description (optional)</label>
            <textarea
              className="w-full"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', minHeight: 90 }}
              value={createModal.description}
              onChange={(e) => setCreateModal(cm => ({ ...cm, description: e.target.value }))}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={closeCreate} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
              <button onClick={saveCreate} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;