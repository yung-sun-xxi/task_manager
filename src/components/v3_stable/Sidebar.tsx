/* src/components/Sidebar.tsx */
import React, { useEffect, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";

export type Task = {
  id: string;
  title: string;
  estimateHours: number;
  description?: string;
  color?: string;
};

type Props = {
  tasks: Task[];
  allocations: Map<string, number>;
  onEstimateChange: (id: string, estimateHours: number) => void;
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange }) => {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Enable FullCalendar external drag for task cards
  useEffect(() => {
    if (!listRef.current) return;
    const draggable = new Draggable(listRef.current, {
      itemSelector: ".task-card.task-row",
      dragStart: () => { document.body.classList.add("tm-extdrag"); },
      dragStop: () => { document.body.classList.remove("tm-extdrag"); },
    });
    return () => draggable.destroy();
  }, []);

  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} m`;
  };

  return (
    <aside className="sidebar" ref={listRef}>
      <h2 className="header">Task List</h2>
      {tasks.map((t) => {
        const allocatedMin = allocations.get(t.id) || 0;
        const estMin = Math.max(0, Math.round((t.estimateHours || 0) * 60));
        const ratio = estMin > 0 ? Math.min(1, allocatedMin / estMin) : 0;
        const over = Math.max(0, allocatedMin - estMin);

        return (
          <div
            key={t.id}
            className="task-card task-row"
            data-task-id={t.id}
            data-task-title={t.title}
            title={`${fmt(allocatedMin)} / ${fmt(estMin)}${over > 0 ? ` • Over by: ${fmt(over)}` : estMin > 0 ? ` • Remaining: ${fmt(Math.max(0, estMin - allocatedMin))}` : ""}`}
          >
            <div className="task-title">{t.title}</div>
            <div className="task-meta">
              {`${(allocatedMin/60).toFixed(1)} / ${t.estimateHours} h`}
            </div>

            <div className="progress" title={`Allocated: ${fmt(allocatedMin)} / Estimate: ${fmt(estMin)}`}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, fontSize:12, color:'#6b7280' }}>
              <span>Estimate (h)</span>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={t.estimateHours}
                onChange={(e) => onEstimateChange(t.id, Math.max(0, Number(e.target.value)))}
                style={{ width:72, border:'1px solid rgba(0,0,0,.15)', borderRadius:6, padding:'2px 6px' }}
              />
              <span style={{ marginLeft:'auto' }}>
                {(allocatedMin / 60).toFixed(1)} / {t.estimateHours} h
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
};

export default Sidebar;
