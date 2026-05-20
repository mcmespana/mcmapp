import React, {
  createContext,
  useContext,
  ReactNode,
} from 'react';
import {
  useCalendarConfigs,
  CalendarConfig,
} from '@/hooks/useCalendarConfigs';

interface CalendarConfigContextType {
  calendarConfigs: CalendarConfig[];
  visibleCalendars: boolean[];
  toggleCalendarVisibility: (index: number) => void;
  loading: boolean;
  offline: boolean;
}

const CalendarConfigContext = createContext<
  CalendarConfigContextType | undefined
>(undefined);

export function CalendarConfigProvider({ children }: { children: ReactNode }) {
  const value = useCalendarConfigs();
  return (
    <CalendarConfigContext.Provider value={value}>
      {children}
    </CalendarConfigContext.Provider>
  );
}

export function useCalendarConfig(): CalendarConfigContextType {
  const ctx = useContext(CalendarConfigContext);
  if (!ctx) {
    throw new Error(
      'useCalendarConfig must be used within CalendarConfigProvider',
    );
  }
  return ctx;
}
