import { useState, useEffect } from 'react';

export interface CalendarConfig {
  url: string;
  color: string;
  name: string;
}

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  location?: string;
  calendarIndex: number;
}

function parseICS(text: string): Omit<CalendarEvent, 'calendarIndex'>[] {
  const events: Omit<CalendarEvent, 'calendarIndex'>[] = [];
  const lines = text.split(/\r?\n/);
  let current: Partial<Omit<CalendarEvent, 'calendarIndex'>> = {};
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current.date && current.title) {
        events.push(current as Omit<CalendarEvent, 'calendarIndex'>);
      }
      current = {};
    } else if (line.startsWith('SUMMARY:')) {
      current.title = line.slice('SUMMARY:'.length).trim();
    } else if (line.startsWith('DESCRIPTION:')) {
      current.description = line
        .slice('DESCRIPTION:'.length)
        .replace(/\\n/g, ' ')
        .trim();
    } else if (line.startsWith('LOCATION:')) {
      current.location = line.slice('LOCATION:'.length).trim();
    } else if (line.startsWith('DTSTART')) {
      const parts = line.split(':');
      const value = parts[1];
      if (value) {
        const datePart = value.trim().substring(0, 8); // YYYYMMDD
        const year = datePart.substring(0, 4);
        const month = datePart.substring(4, 6);
        const day = datePart.substring(6, 8);
        current.date = `${year}-${month}-${day}`;
      }
    }
  }
  return events;
}

export default function useCalendarEvents(calendars: CalendarConfig[]) {
  const [eventsByDate, setEventsByDate] = useState<Record<string, CalendarEvent[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchCalendars() {
      setLoading(true);
      const map: Record<string, CalendarEvent[]> = {};
      for (let i = 0; i < calendars.length; i++) {
        const cfg = calendars[i];
        try {
          const res = await fetch(cfg.url);
          const text = await res.text();
          const events = parseICS(text);
          events.forEach((ev) => {
            const withCal: CalendarEvent = { ...ev, calendarIndex: i };
            if (!map[ev.date]) map[ev.date] = [];
            map[ev.date].push(withCal);
          });
        } catch (e) {
          console.error('Error fetching calendar', cfg.url, e);
        }
      }
      if (mounted) {
        setEventsByDate(map);
        setLoading(false);
      }
    }
    fetchCalendars();
    return () => {
      mounted = false;
    };
  }, [calendars]);

  return { eventsByDate, loading };
}
