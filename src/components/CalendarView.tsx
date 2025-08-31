// src/components/CalendarView.tsx
import React, { useCallback, useRef, useEffect } from "react";

import type {
  DateSelectArg,
  EventAddArg,
  EventApi,
  EventChangeArg,
  EventInput,
  EventRemoveArg,
  EventMountArg,
} from "@fullcalendar/core";
import type { EventReceiveArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";

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

const genId = (prefix: string) => {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

// throttle для ресайза
const throttle = (func: Function, delay: number) => {
  let inThrottle = false;
  return (...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, delay);
    }
  };
};

const CalendarView: React.FC<Props> = (props) => {
  const calRef = useRef<FullCalendar | null>(null);

  // Поддерживаем корректную верстку при ресайзе
  useEffect(() => {
    const handleResize = () => {
      const api = (calRef.current as any)?.getApi?.();
      if (api) api.updateSize();
    };
    const throttled = throttle(handleResize, 50);
    window.addEventListener("resize", throttled);
    return () => window.removeEventListener("resize", throttled);
  }, []);

  // Снять все события из календаря и протолкнуть наверх
  const pushAllEvents = useCallback(() => {
    const api = (calRef.current as any)?.getApi?.();
    if (!api) return;
    const all: EventApi[] = api.getEvents();
    const data: PlainEvent[] = all.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start!,
      end: e.end!,
      taskId: (e.extendedProps as any)?.taskId,
      backgroundColor: (e as any).backgroundColor,
      borderColor: (e as any).borderColor,
    }));
    props.onEventsChange(data);
  }, [props]);

  // Создание событий выделением на гриде — теперь только дергаем модалку и снимаем выделение
  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      props.onCreateBySelect(arg.start, arg.end);
      // снять синюю выделенную область, чтобы не оставалась после открытия модалки
      (calRef.current as any)?.getApi?.().unselect?.();
    },
    [props]
  );

  // Двойной клик по ПУСТОЙ ячейке календаря — открываем модалку создания
  const handleDateClick = useCallback(
    (info: any) => {
      if (info?.jsEvent?.detail === 2) {
        const start: Date = info.date;
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 15);
        props.onCreateBySelect(start, end);
        (calRef.current as any)?.getApi?.().unselect?.();
      }
    },
    [props]
  );

  // Двойной клик по СОБЫТИЮ — открыть карточку задачи
  const eventDidMount = useCallback(
    (arg: EventMountArg) => {
      const ext = (arg.event as any).extendedProps || (arg.event as any)._def?.extendedProps || {};
      const taskId = (ext as any).taskId as string | undefined;

      const handler = (e: MouseEvent) => {
        e.stopPropagation();
        props.onEventDblClick(taskId);
      };
      arg.el.addEventListener("dblclick", handler);
      return () => {
        arg.el.removeEventListener("dblclick", handler);
      };
    },
    [props]
  );

  // Любые изменения — синхронизируем стейт вверх
  const handleEventAdd = useCallback((_arg: EventAddArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  const handleEventChange = useCallback((_arg: EventChangeArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  const handleEventRemove = useCallback((_arg: EventRemoveArg) => {
    pushAllEvents();
  }, [pushAllEvents]);

  // Внешний дроп из Sidebar через FullCalendar.Draggable — событие уже создано
  const handleEventReceive = useCallback(
    (arg: EventReceiveArg) => {
      const e = arg.event;

      // Если duration не задан — зададим 15 минут
      if (e.start && !e.end) {
        const end = new Date(e.start);
        end.setMinutes(end.getMinutes() + 15);
        e.setEnd(end);
      }

      // Если нет id — проставим свой
      if (!e.id) {
        e.setProp("id", genId("ev"));
      }

      pushAllEvents();
    },
    [pushAllEvents]
  );

  // Преобразование входящих PlainEvent → EventInput
  const fcEvents: EventInput[] = props.events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    start: ev.start,
    end: ev.end,
    extendedProps: { taskId: ev.taskId },
    backgroundColor: ev.backgroundColor,
    borderColor: ev.borderColor,
  }));

  // Форматер для второй строки заголовка (ММ ДД)
  const fmtMD = new Intl.DateTimeFormat(undefined, { month: "2-digit", day: "2-digit" });

  return (
    <div className="calendar-wrapper">
      <FullCalendar
        firstDay={1} /* неделя с понедельника */
        ref={calRef as any}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        defaultTimedEventDuration="00:15:00"
        selectable={true}
        selectMirror={true}
        nowIndicator={false}
        droppable={true}
        editable={true}
        eventResizableFromStart={true}
        allDaySlot={false}
        slotMinTime="09:00:00"
        slotMaxTime="21:15:00"
        slotLabelInterval="01:00"
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        /* двухстрочный хедер: день недели + перенос + ММ ДД */
        dayHeaderContent={(arg) => {
          // arg.text обычно содержит локализованный «день месяца» и/или «день недели».
          // Для стабильности берём короткий weekday из API и отдельно форматим ММ ДД.
          const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(arg.date); // Mon/Tue/…
          const mdRaw = fmtMD.format(arg.date); // зависит от локали (напр. 09/01)
          const md = mdRaw.replace(/[^\d]/g, " ").trim().replace(/\s+/, " "); // "09 01"
          return { html: `<div class="fc-day-two-line"><span>${weekday}</span><br/><span>${md}</span></div>` };
        }}
        /* Кастомные кнопки навигации, чтобы иметь отдельные CSS-классы */
        customButtons={{
          NavPrev: {
            text: "‹",
            click: () => (calRef.current as any)?.getApi?.().prev?.(),
          },
          NavNext: {
            text: "›",
            click: () => (calRef.current as any)?.getApi?.().next?.(),
          },
          Today: {
            text: "Today",
            click: () => (calRef.current as any)?.getApi?.().today?.(),
          },
        }}
        headerToolbar={{
          left: "NavPrev,NavNext Today",
          center: "title",
          right: "",
        }}
        events={fcEvents}
        select={handleSelect}
        dateClick={handleDateClick}    /* двойной клик по пустому месту */
        eventAdd={handleEventAdd}
        eventChange={handleEventChange}
        eventRemove={handleEventRemove}
        eventReceive={handleEventReceive}   /* внешний DnD из Sidebar */
        eventDidMount={eventDidMount}
        height="100%"
        themeSystem="bootstrap5"
        eventClassNames="my-event"
      />
    </div>
  );
};

export default CalendarView;