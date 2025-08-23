/* src/components/Sidebar.tsx */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Draggable } from "@fullcalendar/interaction";

export type Task = {
  id: string;
  title: string;
  description?: string;
  estimateHours: number;
  color?: string;
};

type AllocMap = Record<string, number>; // minutes

type Props = {
  tasks: Task[];
  allocations: AllocMap;
  onEstimateChange: (id: string, hours: number) => void;
  onDeleteTask?: (id: string) => void;
};

const fmtHm = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} m` : `${h} h`;
};

const Sidebar: React.FC<Props> = ({ tasks, allocations, onEstimateChange, onDeleteTask }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEstimate, setDraftEstimate] = useState<string>("");
  const [draftDesc, setDraftDesc] = useState<string>("");
  const [editorPos, setEditorPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Enable external dragging (ignore cards while editing)
  useEffect(() => {
    if (!listRef.current) return;
    const draggable = new Draggable(listRef.current, {
      itemSelector: ".task-card:not(.tm-editing)",
      dragStart: () => document.body.classList.add("tm-extdrag"),
      dragStop: () => document.body.classList.remove("tm-extdrag"),
    });
    return () => draggable.destroy();
  }, []);

  // Header clear button dispatch
  const clearAll = () => {
    const g: any = window as any;
    if (g.__tmClearEvents) g.__tmClearEvents();
    else window.dispatchEvent(new Event("tm:clear-events"));
  };

  const openEditor = (t: Task, ev?: React.MouseEvent) => {
    setEditingId(t.id);
    setDraftEstimate(String(t.estimateHours ?? ""));
    setDraftDesc(localStorage.getItem(`task-desc:${t.id}`) || t.description || "");
    const card = document.querySelector(`[data-task-id="${t.id}"]`) as HTMLElement | null;
    card?.classList.add("tm-editing");
    const rect = (ev?.currentTarget as HTMLElement | null)?.getBoundingClientRect() || card?.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const pad = 12, popW = 320, popH = 240;
    let left = rect ? rect.right + pad : pad;
    if (left + popW > vw - pad) left = Math.max(pad, (rect ? rect.left : pad) - popW - pad);
    let top = rect ? rect.top : pad;
    if (top + popH > vh - pad) top = Math.max(pad, vh - popH - pad);
    setEditorPos({ left, top, width: popW });
  };

  const closeEditor = () => {
    if (editingId) {
      const card = document.querySelector(`[data-task-id="${editingId}"]`) as HTMLElement | null;
      card?.classList.remove("tm-editing");
    }
    setEditingId(null);
    setDraftEstimate("");
    setDraftDesc("");
    setEditorPos(null);
  };

  const saveEditor = () => {
    if (!editingId) return;
    const est = Number(draftEstimate);
    if (!est || est <= 0 || Number.isNaN(est)) return;
    onEstimateChange(editingId, est);
    localStorage.setItem(`task-desc:${editingId}`, draftDesc || "");
    window.dispatchEvent(new CustomEvent("tm:update-task", { detail: { id: editingId, estimateHours: est, description: draftDesc } }));
    closeEditor();
  };

  const deleteTask = () => {
    if (!editingId) return;
    onDeleteTask?.(editingId);
    window.dispatchEvent(new CustomEvent("tm:delete-task", { detail: { id: editingId } }));
    window.dispatchEvent(new CustomEvent("tm:clear-task-events", { detail: { id: editingId } }));
    localStorage.removeItem(`task-desc:${editingId}`);
    closeEditor();
  };

  return (
    <aside className="sidebar" ref={listRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Task List</h2>
        <button onClick={clearAll} style={{ padding: "4px 8px", fontSize: 12, border: "1px solid rgba(0,0,0,.15)", borderRadius: 8, background: "#fff", cursor: "pointer" }}>Clear events</button>
      </div>

      {[...tasks].map((t) => {
        const alloc = allocations[t.id] || 0;
        const estMin = Math.max(0, Math.round((t.estimateHours || 0) * 60));
        const ratio = estMin > 0 ? Math.min(1, alloc / estMin) : 0;
        const over = Math.max(0, alloc - estMin);

        return (
          <div
            key={t.id}
            className="task-card"
            data-task-id={t.id}
            data-task-title={t.title}
            onClick={(e) => openEditor(t, e)}
            style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", background: "var(--surface)", marginBottom: 12, cursor: "grab" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {(alloc / 60).toFixed(1)} / {t.estimateHours} h
                {over > 0 && <span style={{ color: "#b91c1c" }}> (+{(over / 60).toFixed(1)})</span>}
                {estMin > 0 && alloc >= estMin && over === 0 && <span style={{ color: "#065f46", marginLeft: 6 }}>✓</span>}
              </div>
            </div>
            <div style={{ height: 6, background: "#eef1f5", borderRadius: 999, overflow: "hidden", marginTop: 8 }} title={`Allocated: ${fmtHm(alloc)} • ${over > 0 ? `Over by: ${fmtHm(over)}` : `Remaining: ${fmtHm(Math.max(estMin - alloc, 0))}`}`}>
              <span style={{ display: "block", width: `${ratio * 100}%`, height: "100%", background: over > 0 ? "#ef4444" : "#6366f1" }} />
            </div>
          </div>
        );
      })}

      {editingId && editorPos &&
        createPortal(
          <div
            className="task-popover"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", top: editorPos.top, left: editorPos.left, width: editorPos.width, background: "#fff", border: "1px solid rgba(0,0,0,.1)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.18)", zIndex: 2000 }}
          >
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,.08)", fontWeight: 600 }}>
              {(tasks.find(x => x.id === editingId) || { title: "" }).title}
              <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>• Allocated: {fmtHm(allocations[editingId] || 0)}</span>
            </div>
            <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
              <label style={{ fontSize: 12 }}>Estimate (hours)*</label>
              <input type="number" min={0.25} step={0.25} value={draftEstimate} onChange={(e) => setDraftEstimate(e.target.value)} draggable={false}
                     style={{ width: "100%", border: (!draftEstimate || Number(draftEstimate) <= 0) ? "1px solid #ef4444" : "1px solid rgba(0,0,0,.15)", borderRadius: 8, padding: "8px 10px" }} />
              <label style={{ fontSize: 12, marginTop: 6 }}>Description</label>
              <textarea rows={3} value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} draggable={false}
                        style={{ width: "100%", border: "1px solid rgba(0,0,0,.15)", borderRadius: 8, padding: "8px 10px", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "12px 14px", borderTop: "1px solid rgba(0,0,0,.08)" }}>
              <button onClick={deleteTask} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.15)", background: "#fee2e2", color: "#991b1b" }}>Delete</button>
              <button onClick={closeEditor} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,.15)", background: "var(--surface)" }}>Close</button>
              <button onClick={saveEditor} disabled={!draftEstimate || Number(draftEstimate) <= 0} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", opacity: (!draftEstimate || Number(draftEstimate) <= 0) ? .6 : 1 }}>Save</button>
            </div>
          </div>,
          document.body
        )
      }
    </aside>
  );
};

export default Sidebar;
