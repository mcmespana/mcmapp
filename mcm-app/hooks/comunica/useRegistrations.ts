// Inscripciones (plan 14): las lecturas y las escrituras de un perfil.
//
//   · `['registrations', pid]` se guarda en el móvil (títulos, fechas y estados: abre al instante). La ficha `['registrations', pid, rid]` y el alta
//     `['signup', pid, eventId]` NO (teléfonos de los tutores, importes; el guard de duplicados se mira al abrir).
//   · Apuntarse, modificar y cancelar NO van por la cola: llamada directa con conexión y un `clientId` en memoria que se conserva mientras el fallo
//     sea de red o del CRM (reintentar sin duplicar) y se suelta en cuanto no. La cola guarda el cuerpo en el móvil y el IBAN no puede tocar el disco.
//   · Al aplicarse se invalidan las actividades (13), las inscripciones, los pagos (15) y el calendario (16).
//   · La URL del formulario avanzado lleva datos personales: ni se guarda ni se registra.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import { isComunicaApiError } from '@/services/comunica/client';
import { setLegacyOpen } from '@/services/comunica/legacy';
import type {
  RegistrationEdit,
  SignupResult,
  SignupWrite,
} from '@/services/comunica/contract';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, useAreaQuery } from './useAreaQuery';

const FRESH = 2 * 60_000;

export const registrationsKey = (pid: string) =>
  ['registrations', pid] as const;

export function useRegistrations(pid: string | null | undefined) {
  return useAreaQuery({
    key: [...registrationsKey(pid ?? '')],
    route: 'profileRegistrations',
    fetch: () => getComunicaApi().getProfileRegistrations(pid!),
    staleTime: FRESH,
    enabled: !!pid,
  });
}

export function useRegistration(pid: string | null | undefined, rid: string) {
  return useAreaQuery({
    key: [...registrationsKey(pid ?? ''), rid],
    route: 'profileRegistration',
    fetch: () => getComunicaApi().getProfileRegistration(pid!, rid),
    // Se vuelve a pedir al entrar (el pago cambia por fuera) y no se guarda.
    staleTime: 0,
    gcTime: 5 * 60_000,
    enabled: !!pid && !!rid,
    retry: false,
  });
}

export function useSignupForm(pid: string | null | undefined, eventId: string) {
  return useAreaQuery({
    key: ['signup', pid ?? '', eventId],
    route: 'profileSignupForm',
    fetch: () => getComunicaApi().getSignupForm(pid!, eventId),
    staleTime: 0,
    gcTime: 60_000,
    enabled: !!pid && !!eventId,
    retry: false,
  });
}

/** Lo que cambia al apuntarse, modificar o cancelar: eventos, inscripciones, pagos y calendario del perfil. */
export function invalidateAfterRegistration(qc: QueryClient, pid: string) {
  for (const head of ['activities', 'registrations', 'pagos', 'calendario']) {
    void qc.invalidateQueries({ queryKey: areaKey([head, pid]) });
  }
}

/** ¿Vale la pena reintentar con el MISMO `clientId`? Red y CRM caído sí; lo demás es otra petición. */
const retryable = (e: unknown) => isComunicaApiError(e) && e.retryable;

function useClientId() {
  const ref = useRef<string | null>(null);
  return {
    get: () => (ref.current ??= uuidV4()),
    done: () => {
      ref.current = null;
    },
    after: (e: unknown) => {
      if (!retryable(e)) ref.current = null;
    },
  };
}

/** Apuntarse: directo, con conexión. Lanza el error; quien llama decide qué decir. */
export function useSignUp(pid: string) {
  const qc = useQueryClient();
  const id = useClientId();
  const [sending, setSending] = useState(false);
  const submit = useCallback(
    async (build: (clientId: string) => SignupWrite): Promise<SignupResult> => {
      setSending(true);
      try {
        const r = await getComunicaApi().signUp(pid, build(id.get()));
        id.done();
        invalidateAfterRegistration(qc, pid);
        return r;
      } catch (e) {
        id.after(e);
        throw e;
      } finally {
        setSending(false);
      }
    },
    // `id` es estable (un ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, qc],
  );
  return { submit, sending };
}

/** Modificar y cancelar una inscripción: directos, con conexión. */
export function useRegistrationWrites(pid: string, rid: string) {
  const qc = useQueryClient();
  const editId = useClientId();
  const cancelId = useClientId();
  const [busy, setBusy] = useState<'edit' | 'cancel' | null>(null);
  const edit = useCallback(
    async (body: Omit<RegistrationEdit, 'clientId'>) => {
      setBusy('edit');
      try {
        await getComunicaApi().updateRegistration(pid, rid, {
          ...body,
          clientId: editId.get(),
        });
        editId.done();
        invalidateAfterRegistration(qc, pid);
      } catch (e) {
        editId.after(e);
        throw e;
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pid, rid, qc],
  );
  const cancel = useCallback(async () => {
    setBusy('cancel');
    try {
      await getComunicaApi().cancelRegistration(pid, rid, {
        clientId: cancelId.get(),
      });
      cancelId.done();
      invalidateAfterRegistration(qc, pid);
    } catch (e) {
      cancelId.after(e);
      throw e;
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid, rid, qc]);
  return { edit, cancel, busy };
}

/**
 * El formulario avanzado del CRM, relleno: pide la URL y abre `web.tsx` con cabecera nativa «Inscripción». NO pasa por `openLegacy`: es una página
 * pública del CRM, no del plugin, y no necesita sesión de WordPress. Devuelve el motivo si el servidor no deja (`already_registered`, `advanced_form`).
 */
export function useOpenAdvancedForm(pid: string | null | undefined) {
  const router = useRouter();
  return useCallback(
    async (eventId: string): Promise<'opened' | string> => {
      if (!pid) return 'no_profile';
      try {
        const { url } = await getComunicaApi().getAdvancedFormUrl(pid, eventId);
        setLegacyOpen({ url, title: 'Inscripción' });
        router.push('/comunica/web' as never);
        return 'opened';
      } catch (e) {
        return isComunicaApiError(e) ? (e.reason ?? e.code) : 'failed';
      }
    },
    [pid, router],
  );
}
