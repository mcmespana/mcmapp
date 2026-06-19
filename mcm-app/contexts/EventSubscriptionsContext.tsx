import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Suscripciones opt-in a eventos concretos (Jubileo, encuentros, retiros…).
 *
 * Cada evento al que el usuario se suscribe se traduce en un topic
 * `event-<eventId>` que se inyecta en `/pushTokens/{id}/topics` (ver
 * `notifications/usePushNotifications.ts`). El MCM Panel envía a ese topic
 * para que el aviso solo llegue a los suscritos, en vez de a todos.
 *
 * Modelo: opt-in + auto-sugerir. Nadie recibe avisos de un evento hasta que
 * pulsa "Avisarme". Al abrir un evento por primera vez se ofrece suscribirse
 * (una sola vez por evento; `promptedEventIds` recuerda los ya sugeridos).
 */

const SUBS_KEY = '@event_subscriptions';
const PROMPTED_KEY = '@event_subscription_prompts';

/** Topic de notificaciones para un evento dado. */
export const eventTopic = (eventId: string): string => `event-${eventId}`;

interface EventSubscriptionsContextType {
  /** IDs de eventos a los que el usuario está suscrito. */
  subscribedEventIds: string[];
  /** Topics `event-<id>` derivados, listos para mergear en /pushTokens. */
  eventTopics: string[];
  isSubscribed: (eventId: string) => boolean;
  subscribe: (eventId: string) => void;
  unsubscribe: (eventId: string) => void;
  toggle: (eventId: string) => void;
  /** True si ya se ofreció la auto-suscripción para este evento. */
  wasPrompted: (eventId: string) => boolean;
  /** Marca el evento como ya sugerido (para no volver a preguntar). */
  markPrompted: (eventId: string) => void;
  loading: boolean;
}

const EventSubscriptionsContext = createContext<
  EventSubscriptionsContextType | undefined
>(undefined);

export const EventSubscriptionsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [subscribedEventIds, setSubscribed] = useState<string[]>([]);
  const [promptedEventIds, setPrompted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [subsRaw, promptRaw] = await Promise.all([
          AsyncStorage.getItem(SUBS_KEY),
          AsyncStorage.getItem(PROMPTED_KEY),
        ]);
        if (subsRaw) {
          const parsed = JSON.parse(subsRaw);
          if (Array.isArray(parsed)) {
            setSubscribed(parsed.filter((x) => typeof x === 'string'));
          }
        }
        if (promptRaw) {
          const parsed = JSON.parse(promptRaw);
          if (Array.isArray(parsed)) {
            setPrompted(parsed.filter((x) => typeof x === 'string'));
          }
        }
      } catch (e) {
        console.error('Failed loading event subscriptions', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(SUBS_KEY, JSON.stringify(subscribedEventIds)).catch(
      (e) => console.error('Failed saving event subscriptions', e),
    );
  }, [subscribedEventIds, loading]);

  useEffect(() => {
    if (loading) return;
    AsyncStorage.setItem(PROMPTED_KEY, JSON.stringify(promptedEventIds)).catch(
      (e) => console.error('Failed saving event prompts', e),
    );
  }, [promptedEventIds, loading]);

  const isSubscribed = useCallback(
    (eventId: string) => subscribedEventIds.includes(eventId),
    [subscribedEventIds],
  );

  const subscribe = useCallback((eventId: string) => {
    setSubscribed((prev) =>
      prev.includes(eventId) ? prev : [...prev, eventId],
    );
  }, []);

  const unsubscribe = useCallback((eventId: string) => {
    setSubscribed((prev) => prev.filter((id) => id !== eventId));
  }, []);

  const toggle = useCallback((eventId: string) => {
    setSubscribed((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId],
    );
  }, []);

  const wasPrompted = useCallback(
    (eventId: string) => promptedEventIds.includes(eventId),
    [promptedEventIds],
  );

  const markPrompted = useCallback((eventId: string) => {
    setPrompted((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
  }, []);

  const eventTopics = useMemo(
    () => subscribedEventIds.map(eventTopic),
    [subscribedEventIds],
  );

  const value = useMemo<EventSubscriptionsContextType>(
    () => ({
      subscribedEventIds,
      eventTopics,
      isSubscribed,
      subscribe,
      unsubscribe,
      toggle,
      wasPrompted,
      markPrompted,
      loading,
    }),
    [
      subscribedEventIds,
      eventTopics,
      isSubscribed,
      subscribe,
      unsubscribe,
      toggle,
      wasPrompted,
      markPrompted,
      loading,
    ],
  );

  return (
    <EventSubscriptionsContext.Provider value={value}>
      {children}
    </EventSubscriptionsContext.Provider>
  );
};

export const useEventSubscriptions = (): EventSubscriptionsContextType => {
  const ctx = useContext(EventSubscriptionsContext);
  if (!ctx) {
    // SSG/SSR fallback — provider no montado durante render estático.
    return {
      subscribedEventIds: [],
      eventTopics: [],
      isSubscribed: () => false,
      subscribe: () => {},
      unsubscribe: () => {},
      toggle: () => {},
      wasPrompted: () => false,
      markPrompted: () => {},
      loading: true,
    };
  }
  return ctx;
};
