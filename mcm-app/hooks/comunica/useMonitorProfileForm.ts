// El formulario de «Mis datos de monitor» (plan 09): parte de lo confirmado
// por el servidor CON lo que aún espera en la cola encima (así se ven los
// cambios guardados sin cobertura), y se pone al día solo mientras no haya
// nada sin guardar en pantalla.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MonitorProfile } from '@/services/comunica/contract';
import {
  changesFrom,
  editableFrom,
  editableOf,
  formErrors,
  formFrom,
  isFormDirty,
  withPending,
  type MonitorChanges,
  type MonitorForm,
} from '@/utils/comunica/monitorProfile';

export function useMonitorProfileForm(
  profile: MonitorProfile,
  pending: MonitorChanges | null,
) {
  const confirmed = useMemo(() => editableOf(profile), [profile]);
  const base = useMemo(
    () => withPending(confirmed, pending),
    [confirmed, pending],
  );
  const [form, setForm] = useState<MonitorForm>(() => formFrom(base));
  const dirty = isFormDirty(base, form);
  // Lo de base cambia (llega del servidor o se sube): si no hay nada a medias,
  // el formulario lo sigue.
  const lastBase = useRef(base);
  useEffect(() => {
    if (lastBase.current === base) return;
    const wasClean = !isFormDirty(lastBase.current, form);
    lastBase.current = base;
    if (wasClean) setForm(formFrom(base));
  }, [base, form]);

  const set = <K extends keyof MonitorForm>(key: K, value: MonitorForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return {
    form,
    set,
    dirty,
    errors: formErrors(form),
    /** Lo que hay que encolar al guardar: contra lo CONFIRMADO. */
    changes: (): MonitorChanges => changesFrom(confirmed, editableFrom(form)),
    reset: () => setForm(formFrom(base)),
  };
}
