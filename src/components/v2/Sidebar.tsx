/* src/components/Sidebar.tsx */
import React from "react";

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

const fmt = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} m` : `${h} h`;
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange }) => {
  return (
    <aside className="sidebar">
      <h2 className="header">Task List</h2>
      {tasks.map((t) => {
        const allocatedMin = allocations.get(t.id) || 0;
        const estMin = Math.round((t.estimateHours || 0) * 60);
        const ratio = estMin > 0 ? Math.min(allocatedMin / estMin, 1) : 0;
        const over = Math.max(0, allocatedMin - estMin);

        return (
          <div
            key={t.id}
            className="task-card task-row"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/task-id", t.id);
              e.dataTransfer.setData("text/task-title", t.title);
              // дублируем в dataset для совместимости
              (e.currentTarget as HTMLElement).dataset.taskId = t.id;
              (e.currentTarget as HTMLElement).dataset.taskTitle = t.title;
              e.dataTransfer.effectAllowed = "copyMove";
            }}
          >
            <div className="task-title">{t.title}</div>
            <div className="task-meta">
              {over > 0 ? `Over by: ${fmt(over)}` : `Remaining: ${fmt(Math.max(estMin - allocatedMin, 0))}`}
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
