import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

export interface CalendarConfig {
  url: string;
  color: string;
  name: string;
}

export interface CalendarEvent {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  title: string;
  description?: string;
  location?: string;
  url?: string;
  calendarIndex: number;
}

function parseICS(text: string): Omit<CalendarEvent, 'calendarIndex'>[] {
  // Unfold lines that start with a space as specified in RFC 5545
  const unfolded: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.startsWith(' ')) {
      if (unfolded.length) {
        unfolded[unfolded.length - 1] += rawLine.slice(1);
      }
    } else {
      unfolded.push(rawLine);
    }
  }

  const events: Omit<CalendarEvent, 'calendarIndex'>[] = [];
  let current: Partial<Omit<CalendarEvent, 'calendarIndex'>> = {};

  for (const line of unfolded) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current.startDate && current.title) {
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
    } else if (line.startsWith('URL:')) {
      current.url = line.slice('URL:'.length).trim();
    } else if (line.startsWith('DTSTART')) {
      // Soporta DTSTART:YYYYMMDD y DTSTART;VALUE=DATE:YYYYMMDD y variantes
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const value = line.slice(idx + 1).trim();
        // Solo nos quedamos con la parte de fecha (sin hora)
        const datePart = value.replace(/T.*$/, '');
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          current.startDate = `${year}-${month}-${day}`;
        }
      }
    } else if (line.startsWith('DTEND')) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const value = line.slice(idx + 1).trim();
        const datePart = value.replace(/T.*$/, '');
        if (/^\d{8}$/.test(datePart)) {
          const year = datePart.substring(0, 4);
          const month = datePart.substring(4, 6);
          const day = datePart.substring(6, 8);
          current.endDate = `${year}-${month}-${day}`;
        }
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
      const state = await Network.getNetworkStateAsync();
      const connected = state.isConnected && state.isInternetReachable !== false;
      const cachedStr = await AsyncStorage.getItem('calendar_events');
      if (!connected && cachedStr) {
        setEventsByDate(JSON.parse(cachedStr));
        setLoading(false);
        return;
      }
      const map: Record<string, CalendarEvent[]> = {};
      for (let i = 0; i < calendars.length; i++) {
        const cfg = calendars[i];
        try {

          const proxyBase = process.env.EXPO_PUBLIC_CORS_PROXY_URL;
          const proxyUrl = proxyBase ? proxyBase + encodeURIComponent(cfg.url) : null;
          let res: Response | null = null;
          if (proxyUrl) {
            try {
              res = await fetch(proxyUrl);
              if (!res.ok) throw new Error('Proxy request failed');
            } catch (err) {
              // Fallback to direct fetch if proxy fails
              res = await fetch(cfg.url);
            }
          } else {
            res = await fetch(cfg.url);
          }
          const text = await res.text();
          const events = parseICS(text);

          events.forEach((ev) => {
            const withCal: CalendarEvent = { ...ev, calendarIndex: i };
            const start = new Date(ev.startDate);
            const end = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              const dateStr = d.toISOString().split('T')[0];
              if (!map[dateStr]) map[dateStr] = [];
              map[dateStr].push(withCal);
            }
          });
        } catch (e) {

        }
      }
      if (mounted) {
        setEventsByDate(map);
        AsyncStorage.setItem('calendar_events', JSON.stringify(map)).catch(() => {});
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
