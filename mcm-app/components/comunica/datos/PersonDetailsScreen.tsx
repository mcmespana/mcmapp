// «Mis datos» y «Datos de Lucía» (plan 12): la página del plugin
// (`single_stic_comunica_perfil.php`) en nativo, para las tres audiencias.
//
//   · Las secciones las decide el servidor; el orden y los textos, el spec
//     (`personDetailsSpec.ts`), que pinta el motor (`DeclarativeForm`).
//   · Nada se guarda en el móvil: ni los datos, ni la salud, ni un borrador.
//     Lo editado vive en el estado de esta pantalla y se va con ella.
//   · Un «Guardar» para todo, directo y con conexión (sin cola): `PATCH` de
//     los datos y `PUT` de la salud, solo lo que cambia.
//   · Las autorizaciones sin contestar se pintan apagadas con «Sin
//     contestar» y no viajan si no se tocan (el plugin las convertía en «no»).
//   · `completar=pago`: lo vacío de la identidad se puede escribir.
//   · Pantalla PERSONAL: cambiar de persona arriba lleva a la portada.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  usePreventRemove,
  useRouter,
} from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { isComunicaApiError } from '@/services/comunica/client';
import type { PersonDetails } from '@/services/comunica/contract';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import {
  useIsOnline,
  usePersonDetails,
  useProfileHealth,
  useSaveDetails,
} from '@/hooks/comunica/usePersonDetails';
import { h } from '@/utils/haptics';
import {
  type FormValue,
  formChanges,
  validateForm,
} from '@/utils/comunica/forms';
import {
  detailsTitle,
  detailsValues,
  fieldOfReason,
  fillableIdentity,
  healthValues,
  writesFrom,
} from '@/utils/comunica/personDetails';
import {
  DETAILS_COPY as C,
  personDetailsSpec,
  SCARF_OPTIONS,
} from '@/utils/comunica/personDetailsSpec';
import { firstNameOf, initialOf } from '@/utils/comunica/profiles';
import ActiveProfileBar from '../perfiles/ActiveProfileBar';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { AreaSkeleton, isNetwork } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import DeclarativeForm from '../comun/form/DeclarativeForm';
import FormSection, { FormNote } from '../comun/form/FormSection';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import PhotoBlock from './PhotoBlock';

/**
 * El `pid` de la ruta: uno concreto, o `actual` (el perfil que se ve) y `yo`
 * (quien ha entrado), que usan los enlaces del plugin (`links.ts`).
 */
export function resolveDetailsPid(
  param: string | undefined,
  active: { pid: string | null; self: { id: string } | null },
): string | null {
  if (!param || param === 'actual') return active.pid;
  if (param === 'yo') return active.self?.id ?? null;
  return param;
}

export default function PersonDetailsScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ pid?: string; completar?: string }>();
  const active = useActiveProfile();
  useProfileScope('personal', 'profile');
  const pid = resolveDetailsPid(params.pid, active);
  const q = usePersonDetails(pid);
  const payMode = params.completar === 'pago';
  const viewingSelf = !active.self || pid === active.self.id;

  const header = <ActiveProfileBar />;
  if (isComunicaApiError(q.error) && q.error.code === 'forbidden') {
    return (
      <AreaScreen>
        {header}
        <EmptyState
          icon="lock"
          title={C.forbidden}
          actionLabel="Volver"
          onAction={() => router.back()}
          accentColor={t.accentText}
          titleColor={t.text}
          subtitleColor={t.textSecondary}
        />
      </AreaScreen>
    );
  }
  if (!q.data) {
    return (
      <AreaScreen onRefresh={() => q.refetch()}>
        <Stack.Screen
          options={{ title: detailsTitle(viewingSelf, active.childFirstName) }}
        />
        {header}
        {isNetwork(q.error) ? (
          // Lo normal sin conexión: estos datos nunca se guardan.
          <EmptyState
            icon="wifi-off"
            title={C.needConnection}
            actionLabel="Reintentar"
            onAction={() => void q.refetch()}
            accentColor={t.accentText}
            titleColor={t.text}
            subtitleColor={t.textSecondary}
          />
        ) : (
          <AreaState query={q} skeleton="cards">
            {() => null}
          </AreaState>
        )}
      </AreaScreen>
    );
  }
  return (
    <DetailsForm
      // Otra persona, otro formulario: nada de lo editado pasa de uno a otro.
      key={pid!}
      pid={pid!}
      details={q.data}
      viewingSelf={viewingSelf}
      payMode={payMode}
      refetch={() => q.refetch()}
      header={header}
    />
  );
}

function DetailsForm({
  pid,
  details,
  viewingSelf,
  payMode,
  refetch,
  header,
}: {
  pid: string;
  details: PersonDetails;
  viewingSelf: boolean;
  payMode: boolean;
  refetch: () => Promise<unknown>;
  header: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { toast } = useToast();
  const online = useIsOnline();
  const openLegacy = useOpenLegacy();
  const save = useSaveDetails(pid);
  const hasHealth = details.sections.includes('health');
  const health = useProfileHealth(pid, hasHealth);

  const firstName = firstNameOf(details.identity.firstName);
  const title = detailsTitle(viewingSelf, details.identity.firstName);
  const fill = useMemo(
    () => (payMode ? fillableIdentity(details) : {}),
    [payMode, details],
  );
  const spec = useMemo(
    () =>
      personDetailsSpec({
        sections: details.sections,
        viewingChild: !viewingSelf,
        firstName,
        emailNote: details.emailNote,
        fill,
        options: details.options,
      }),
    [details, viewingSelf, firstName, fill],
  );
  const options = useMemo(
    () => ({ ...details.options, scarf: SCARF_OPTIONS }),
    [details.options],
  );

  // Lo confirmado (servidor) y, encima, lo que se ha tocado aquí.
  const confirmed = useMemo(
    () => ({
      ...detailsValues(details),
      ...healthValues(health.data?.health),
    }),
    [details, health.data],
  );
  const [edits, setEdits] = useState<Record<string, FormValue>>({});
  const values = useMemo(
    () => ({ ...confirmed, ...edits }),
    [confirmed, edits],
  );
  const changes = formChanges(spec, confirmed, values);
  const dirty = Object.keys(changes).length > 0;
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const errors = { ...validateForm(spec, values, confirmed), ...serverErrors };
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState(false);

  const onChange = (key: string, v: FormValue) => {
    setEdits((e) => ({ ...e, [key]: v }));
    if (serverErrors[key]) {
      setServerErrors(({ [key]: _gone, ...rest }) => rest);
    }
  };

  // Salir con cambios sin guardar pregunta (en la web se perdían sin avisar).
  usePreventRemove(dirty, ({ repeat }) => {
    void confirmAction(
      C.leave.title,
      C.leave.message,
      C.leave.action,
      true,
    ).then((leave) => {
      if (leave) repeat();
    });
  });

  const onSave = async () => {
    if (!dirty || saving) return;
    if (Object.keys(validateForm(spec, values, confirmed)).length > 0) {
      h.error();
      return;
    }
    setSaving(true);
    try {
      await save(writesFrom(changes));
      setEdits({});
      setServerErrors({});
      if (payMode) setPaid(true);
      h.formSuccess();
      toast.show({ variant: 'success', label: C.saved });
    } catch (e) {
      h.error();
      if (isComunicaApiError(e) && e.code === 'forbidden') {
        toast.show({ variant: 'danger', label: C.forbidden });
      } else if (isComunicaApiError(e) && e.code === 'network') {
        toast.show({ variant: 'danger', label: C.offlineSave });
      } else {
        const field =
          isComunicaApiError(e) && e.code === 'validation'
            ? fieldOfReason(e.reason)
            : null;
        if (field && isComunicaApiError(e)) {
          setServerErrors({ [field]: e.message });
        }
        toast.show({ variant: 'danger', label: C.saveError });
      }
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (s: { id: string; title: string }) => {
    if (s.id === 'photo') {
      return (
        <PhotoBlock
          title={s.title}
          photoUrl={details.photoUrl}
          initial={initialOf(details.identity)}
          disabled={!online}
          onChange={() =>
            void openLegacy(
              { internalpage: 'single_stic_comunica_perfil' },
              title,
              viewingSelf ? undefined : pid,
            )
          }
        />
      );
    }
    if (s.id === 'health' && !health.data) {
      return (
        <FormSection title={s.title}>
          {health.error ? (
            <FormNote icon="exclamationmark.triangle.fill">
              {isNetwork(health.error)
                ? 'Sin conexión: la información sanitaria solo se ve con cobertura.'
                : 'No se ha podido cargar la información sanitaria.'}{' '}
              <Text
                accessibilityRole="button"
                onPress={() => void health.refetch()}
                style={[styles.retry, { color: t.accentText }]}
              >
                Reintentar
              </Text>
            </FormNote>
          ) : (
            <AreaSkeleton kind="list" />
          )}
        </FormSection>
      );
    }
    return undefined;
  };

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          {!online ? (
            <Text
              style={[styles.offline, { color: t.textSecondary }]}
              accessibilityRole="alert"
            >
              {C.offlineSave}
            </Text>
          ) : null}
          <AreaPrimaryButton
            label={saving ? C.saving : C.save}
            onPress={() => void onSave()}
            disabled={!dirty || !online}
            loading={saving}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title }} />
      {header}
      {payMode ? (
        <View
          style={[styles.pay, { backgroundColor: t.card }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.payTitle, { color: t.text }]}>
            {C.pay.title}
          </Text>
          <Text style={[styles.payBody, { color: t.textSecondary }]}>
            {C.pay.body}
          </Text>
          {paid && !dirty ? (
            // Secundario: la acción principal de la pantalla es «Guardar».
            <PressableFeedback
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={C.pay.back}
              style={styles.payBack}
            >
              <Text style={[styles.payBackText, { color: t.accentText }]}>
                {C.pay.back}
              </Text>
              <IconSymbol name="chevron.right" size={14} color={t.accentText} />
            </PressableFeedback>
          ) : null}
        </View>
      ) : null}
      <DeclarativeForm
        spec={spec}
        values={values}
        confirmed={confirmed}
        errors={errors}
        options={options}
        onChange={onChange}
        renderSection={renderSection}
        unansweredLabel={C.unanswered}
        conditionsLabel={C.seeConditions}
      />
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  offline: { ...typography.caption, textAlign: 'center' },
  retry: { fontWeight: '600' },
  pay: { borderRadius: radii.lg, padding: 16, gap: 8 },
  payTitle: { ...typography.title },
  payBody: { ...typography.subhead, lineHeight: 20 },
  payBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  payBackText: { ...typography.body, fontWeight: '600' },
});
