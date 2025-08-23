/* src/components/CalendarView.tsx */
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import FullCalendar, { DateSelectArg, EventApi } from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export type PlainEvent = {
  id?: string;
  title: string;
  start: string;
  end: string;
  taskId?: string;
};

type Props = {
  events: PlainEvent[];
  onEventsChange: (events: PlainEvent[]) => void;
  tasksById: Map<string, { id: string; title: string; color?: string }>;
};

const toPlain = (e: EventApi): PlainEvent => ({
  id: e.id,
  title: e.title,
  start: e.start ? e.start.toISOString() : new Date().toISOString(),
  end: e.end ? e.end.toISOString() : new Date().toISOString(),
  taskId: (e.extendedProps as any)?.taskId,
});

const CalendarView: React.FC<Props> = ({ events, onEventsChange, tasksById }) => {
  const ref = useRef<FullCalendar | null>(null);

  const [extDragging, setExtDragging] = useState(false);
  useEffect(() => {
    const onFlag = (e: Event) => {
      const active = (e as CustomEvent).detail?.active === true;
      setExtDragging(active);
    };
    window.addEventListener('tm:extdrag', onFlag as EventListener);
    return () => window.removeEventListener('tm:extdrag', onFlag as EventListener);
  }, []);

  const broadcast = useCallback(() => {
    const api = ref.current?.getApi();
    if (!api) return;
    onEventsChange(api.getEvents().map(toPlain));
  }, [onEventsChange]);

  const handleExternalDrop = useCallback((info: any) => {
    const api = ref.current?.getApi();
    if (!api) return;

    const taskId =
      info.draggedEl?.dataset?.taskId ||
      info.jsEvent?.dataTransfer?.getData("text/task-id") ||
      info.jsEvent?.dataTransfer?.getData("taskId");

    const title =
      info.draggedEl?.dataset?.taskTitle ||
      info.jsEvent?.dataTransfer?.getData("text/task-title") ||
      (taskId ? (tasksById.get(taskId)?.title ?? "Task") : "Task");

    const start: Date = info.date;
    const end = new Date(start.getTime() + 60 * 60000);

    api.addEvent({ title, start, end, extendedProps: { taskId } });
    setTimeout(broadcast, 0);
  }, [broadcast, tasksById]);

  const handleSelect = (arg: DateSelectArg) => {
    const api = ref.current?.getApi();
    if (!api) return;
    api.addEvent({ title: "Block", start: arg.start, end: arg.end });
    setTimeout(broadcast, 0);
  };

  const handleEventChange = () => broadcast();
  const handleEventAdd = () => broadcast();
  const handleEventRemove = () => broadcast();
  const handleEventReceive = () => broadcast();

  const initialEvents = useMemo(() => events, [events]);

  return (
    <div style={{ height:'100%' }}>
      <FullCalendar
        ref={ref}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={false}
        height="100%"
        nowIndicator
        editable
        droppable
        selectable
        selectMirror
        eventDurationEditable
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        slotMinTime="09:00:00"
        slotMaxTime="21:01:00"
        allDaySlot={false}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        initialEvents={initialEvents}
        drop={handleExternalDrop}
        selectAllow={() => !extDragging}
        eventReceive={handleEventReceive}
        select={handleSelect}
        eventChange={handleEventChange}
        eventAdd={handleEventAdd}
        eventRemove={handleEventRemove}
      />
    </div>
  );
};

export default CalendarView;
