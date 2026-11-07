// El formulario de «Mis datos» (plan 12): parte de lo confirmado por el servidor y se pone al día solo mientras no haya nada sin guardar en
// pantalla. La salud llega por otra ruta: su formulario nace cuando llega (y también se pone al día mientras esté limpio).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HealthInfo, PersonDetails } from '@/services/comunica/contract';
import {
  detailChanges,
  detailErrors,
  formFromDetails,
  formFromHealth,
  healthChanges,
  isEmpty,
  type DetailsForm,
  type HealthForm,
} from '@/utils/comunica/personDetails';

export function usePersonDetailsForm(
  details: PersonDetails,
  health: HealthInfo | null,
  fill: boolean,
) {
  const [form, setForm] = useState<DetailsForm>(() => formFromDetails(details));
  const [healthForm, setHealthForm] = useState<HealthForm | null>(() =>
    health ? formFromHealth(health) : null,
  );

  const detailsDirty = !isEmpty(detailChanges(details, form, { fill }));
  const healthDirty =
    health != null &&
    healthForm != null &&
    !isEmpty(healthChanges(health, healthForm));

  // Lo confirmado cambia (llega o se guarda): si no hay nada a medias, el formulario lo sigue.
  const lastDetails = useRef(details);
  useEffect(() => {
    if (lastDetails.current === details) return;
    const wasClean = isEmpty(
      detailChanges(lastDetails.current, form, { fill }),
    );
    lastDetails.current = details;
    // Con algo a medias, el formulario se queda como está: tras guardar, lo escrito ya coincide con lo releído y deja de ser un cambio.
    if (wasClean) setForm(formFromDetails(details));
  }, [details, form, fill]);

  const lastHealth = useRef(health);
  useEffect(() => {
    if (lastHealth.current === health) return;
    const prev = lastHealth.current;
    lastHealth.current = health;
    if (!health) return;
    const wasClean =
      !prev || !healthForm || isEmpty(healthChanges(prev, healthForm));
    if (wasClean) setHealthForm(formFromHealth(health));
  }, [health, healthForm]);

  const set = <K extends keyof DetailsForm>(key: K, value: DetailsForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setHealth = <K extends keyof HealthForm>(key: K, value: string) =>
    setHealthForm((f) => (f ? { ...f, [key]: value } : f));

  const errors = useMemo(
    () => detailErrors(details, form, { fill }),
    [details, form, fill],
  );
  /** Tras guardar: el formulario pasa a ser lo releído (el servidor puede haber normalizado: minúsculas, espacios). Lo de identidad ya está en el CRM. */
  const rebaseTo = (d?: PersonDetails, h?: HealthInfo) => {
    if (d) {
      lastDetails.current = d;
      setForm(formFromDetails(d));
    }
    if (h) {
      lastHealth.current = h;
      setHealthForm(formFromHealth(h));
    }
  };
  return {
    form,
    set,
    rebaseTo,
    healthForm,
    setHealth,
    dirty: detailsDirty || healthDirty,
    errors,
    changes: () => detailChanges(details, form, { fill }),
    healthChanges: () =>
      health && healthForm ? healthChanges(health, healthForm) : {},
  };
}
