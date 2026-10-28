// La cola de escrituras de la persona que ha entrado (plan 01 §4), para las
// pantallas: lo que hay, el estado de una entrada y las acciones.

import { useEffect, useSyncExternalStore } from 'react';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { unsent, type OutboxEntry } from '@/services/comunica/outbox';

const EMPTY: readonly OutboxEntry[] = [];
const noop = () => () => {};

export function useOutbox() {
  const { outbox } = useArea();
  const entries = useSyncExternalStore(
    outbox ? outbox.subscribe : noop,
    () => outbox?.entries() ?? EMPTY,
  );
  return {
    outbox,
    entries,
    pending: unsent(entries),
    get: (key: string) => entries.find((e) => e.key === key),
  };
}

/** Abrir una pantalla del área también sube lo pendiente (ya, sin esperar). */
export function useFlushOutboxOnMount() {
  const { outbox } = useArea();
  useEffect(() => {
    void outbox?.wake();
  }, [outbox]);
}
