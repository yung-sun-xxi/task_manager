/* src/components/CalendarView.tsx */
import React, { useCallback, useRef } from "react";
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
import type { EventReceiveArg } from "@fullcalendar/interaction"; // ← вот отсюда!
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export type PlainEvent = {
  id?: string;
  title: string;
  start: string | Date;
  end: string | Date;
  taskId?: string;
};

type Props = {
  events: PlainEvent[];
  onEventsChange: (events: PlainEvent[]) => void;
  tasksById: Map<string, any>;
  onCreateBySelect: (start: Date, end: Date) => void;
  onEventDblClick: (taskId?: string) => void;
};

const CalendarView: React.FC<Props> = (props) => {
  const calRef = useRef<FullCalendar | null>(null);

  const pushAllEvents = useCallback(() => {
    const api = (calRef.current as any)?.getApi?.();
    if (!api) return;
    const data: PlainEvent[] = api.getEvents().map((e: EventApi) => ({
      id: e.id,
      title: e.title,
      start: e.start!,
      end: e.end!,
      taskId: (e.extendedProps as any).taskId
    }));
    props.onEventsChange(data);
  }, [props]);

  const handleSelect = useCallback((arg: DateSelectArg) => {
    props.onCreateBySelect(arg.start, arg.end);
  }, [props]);

  const eventDidMount = useCallback((arg: EventMountArg) => {
    const taskId = (arg.event.extendedProps as any).taskId as string | undefined;
    arg.el.addEventListener("dblclick", () => {
      props.onEventDblClick(taskId);
    });
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
    if (taskId) arg.event.setExtendedProp("taskId", taskId);
    if (title) arg.event.setProp("title", title);
    pushAllEvents();
  }, [pushAllEvents]);

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        ref={calRef as any}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        selectable={true}
        selectMirror={true}
        nowIndicator={true}
        droppable={true}
        editable={true}
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        allDaySlot={false}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek"
        }}
        events={props.events as EventInput[]}
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
