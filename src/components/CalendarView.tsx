/* src/components/CalendarView.tsx */
import React, { useCallback, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import type {
  DateSelectArg,
  EventAddArg,
  EventApi,
  EventChangeArg,
  EventInput,
  EventRemoveArg,
  EventMountArg
} from "@fullcalendar/core";
import type { EventReceiveArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export type PlainEvent = {
  id: string;
  title: string;
  start: string | Date;
  end: string | Date;
  taskId?: string;
  backgroundColor?: string;
  borderColor?: string;
};

type Props = {
  events: PlainEvent[];
  onEventsChange: (events: PlainEvent[]) => void;
  onCreateBySelect: (start: Date, end: Date) => void;
  onEventDblClick: (taskId?: string) => void;
  tasksById: Map<string, { title: string; color?: string }>;
};

const CalendarView: React.FC<Props> = (props) => {
  const calRef = useRef<FullCalendar | null>(null);

  const pushAllEvents = useCallback(() => {
    const api = (calRef.current as any)?.getApi?.() as any;
    if (!api) return;
    const all: EventApi[] = api.getEvents();
    const data: PlainEvent[] = all.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start!,
      end: e.end!,
      taskId: (e.extendedProps as any).taskId,
      backgroundColor: (e as any).backgroundColor,
      borderColor: (e as any).borderColor,
    }));
    props.onEventsChange(data);
  }, [props]);

  const handleSelect = useCallback((arg: DateSelectArg) => {
    props.onCreateBySelect(arg.start, arg.end);
  }, [props]);

  const eventDidMount = useCallback((arg: EventMountArg) => {
    const ext = (arg.event as any).extendedProps || (arg.event as any)._def?.extendedProps || {};
    const taskId = (ext as any).taskId as string | undefined;

    // Attach a dblclick listener to open modal
    const handler = (e: MouseEvent) => {
      // Don't let FullCalendar consume this dblclick
      e.stopPropagation();
      props.onEventDblClick(taskId);
    };
    arg.el.addEventListener("dblclick", handler);
    return () => {
      arg.el.removeEventListener("dblclick", handler);
    };
  }, [props]);

  const handleEventAdd = useCallback((_arg: EventAddArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  const handleEventChange = useCallback((_arg: EventChangeArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  const handleEventRemove = useCallback((_arg: EventRemoveArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  const handleEventReceive = useCallback((arg: EventReceiveArg) => {
    // When dropping from sidebar, the element carries dataset
    const el = arg.draggedEl as HTMLElement;
    const taskId = el?.getAttribute?.("data-task-id") || (arg.event.extendedProps as any).taskId;
    const title = el?.getAttribute?.("data-title") || arg.event.title;
    const tColor = el?.getAttribute?.("data-color") || "";
    if (taskId) arg.event.setExtendedProp("taskId", taskId);
    if (title) arg.event.setProp("title", title);
    if (tColor) {
      (arg.event as any).setProp("backgroundColor", tColor);
      (arg.event as any).setProp("borderColor", tColor);
    }
    pushAllEvents();
  }, [pushAllEvents]);

  // Convert incoming PlainEvent[] to FullCalendar EventInput[]
  const fcEvents: EventInput[] = props.events.map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    extendedProps: { taskId: ev.taskId },
    backgroundColor: ev.backgroundColor,
    borderColor: ev.borderColor,
  }));

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        ref={calRef as any}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        selectable={true}
        selectMirror={true}
        nowIndicator={true}
        droppable={true}
        editable={true}
        eventResizableFromStart={true}
        allDaySlot={false}
        slotMinTime="09:00:00"
        slotMaxTime="21:15:00"
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        dayHeaderFormat={{
          weekday: 'short',
          day: '2-digit',
          month: '2-digit'
        }}
        customButtons={{
          Today: {
            text: 'Today',
            click: () => {
              (calRef.current as any)?.getApi().today();
            }
          }
        }}
        headerToolbar={{
          left: "prev,next Today",
          center: "title",
          right: "",
        }}
        events={fcEvents}
        select={handleSelect}
        eventAdd={handleEventAdd}
        eventChange={handleEventChange}
        eventRemove={handleEventRemove}
        eventReceive={handleEventReceive}
        eventDidMount={eventDidMount}
        height="auto"
      />
    </div>
  );
};

export default CalendarView;