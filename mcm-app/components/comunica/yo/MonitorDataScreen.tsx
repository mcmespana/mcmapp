// «Mis datos de monitor» (plan 09): la página del plugin en nativo.
//
//   · Mismos campos, orden y textos (`single_stic_comunica_monitor.php`), en
//     tarjetas agrupadas como el resto del área. «Formación» va en tres
//     tarjetas (premonitores, cursos oficiales, otra) porque doce campos
//     seguidos no se recorren en un móvil; el orden es el del plugin.
//   · Nada es obligatorio; solo el año mal escrito no deja guardar.
//   · «Guardar» en la `BottomActionBar` (la acción principal, la única), apagado
//     sin cambios. Va por la cola: sin cobertura se queda en el móvil y sube
//     sola; si sigues aquí cuando sube, el aviso del plugin.
//   · Salir con cambios sin guardar pregunta (en la web se perdían).

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { useToast } from '@/contexts/AppToastContext';
import { isComunicaApiError } from '@/services/comunica/client';
import type { MonitorProfile } from '@/services/comunica/contract';
import { nativeHrefFor, type Destination } from '@/services/comunica/links';
import {
  useMonitorProfileWrites,
  useMyMonitorProfile,
  usePendingMonitorChanges,
} from '@/hooks/comunica/useMonitorProfile';
import { useMonitorProfileForm } from '@/hooks/comunica/useMonitorProfileForm';
import { useUploadPhase } from '@/hooks/comunica/useDocumentUpload';
import { useFlushOutboxOnMount } from '@/hooks/comunica/useOutbox';
import { useOpenLegacy } from '@/hooks/comunica/useOpenLegacy';
import { h } from '@/utils/haptics';
import {
  COURSE_LABEL,
  isCertificatePending,
  MONITOR_OF_LABEL,
  optionsOf,
  PRE_MONITOR_LABEL,
} from '@/utils/comunica/monitorProfile';
import {
  MONITOR_LONG_TEXT_MAX,
  MONITOR_SHORT_TEXT_MAX,
} from '@/services/comunica/contract';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { isNetwork, OfflineNotice } from '../comun/AreaState';
import BottomActionBar from '../comun/BottomActionBar';
import { confirmAction } from '../comun/confirm';
import NavRow from '../comun/NavRow';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import CheckListField from '../comun/form/CheckListField';
import { TextFormField } from '../comun/form/FormField';
import { FILE_HINT_EMPTY } from '../comun/form/FileField';
import FormSection, { FormNote } from '../comun/form/FormSection';
import SelectField from '../comun/form/SelectField';
import SwitchField from '../comun/form/SwitchField';
import CertificatePendingAlert from './CertificatePendingAlert';
import { MONITOR_COPY as C } from './copy';
import { CertificateSection, DocumentField } from './MonitorParts';

const MONITOR_OF_OPTIONS = optionsOf(MONITOR_OF_LABEL);
const PRE_MONITOR_OPTIONS = optionsOf(PRE_MONITOR_LABEL);
const COURSE_OPTIONS = optionsOf(COURSE_LABEL);

export default function MonitorDataScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const q = useMyMonitorProfile();
  useFlushOutboxOnMount();

  if (isComunicaApiError(q.error) && q.error.code === 'forbidden') {
    return (
      <AreaScreen>
        <EmptyState
          icon="lock"
          title={C.forbidden.title}
          subtitle={C.forbidden.subtitle}
          actionLabel={C.forbidden.action}
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
        <AreaState query={q} skeleton="cards">
          {() => null}
        </AreaState>
      </AreaScreen>
    );
  }
  return (
    <MonitorForm
      profile={q.data}
      error={q.error}
      refetch={() => q.refetch()}
      generatedAt={q.generatedAt}
    />
  );
}

/** Un destino del plugin: nativo si ya lo hay, si no al legado con sesión. */
function useGoTo() {
  const router = useRouter();
  const openLegacy = useOpenLegacy();
  return (destination: Destination, title: string) => {
    const native = nativeHrefFor(destination);
    if (native) router.push(native as never);
    else void openLegacy(destination, title);
  };
}

function MonitorForm({
  profile,
  error,
  refetch,
  generatedAt,
}: {
  profile: MonitorProfile;
  error: unknown;
  refetch: () => Promise<unknown>;
  generatedAt: string | null;
}) {
  const t = useComunicaTheme();
  const navigation = useNavigation();
  const { toast } = useToast();
  const goTo = useGoTo();
  const pending = usePendingMonitorChanges();
  const { save, retry } = useMonitorProfileWrites();
  const f = useMonitorProfileForm(profile, pending.changes);
  const { form, set } = f;
  const blocked = Object.keys(f.errors).length > 0;
  const certPhase = useUploadPhase('sex_offence_certificate');
  // El aviso sigue a lo que hay en pantalla: elegir «Manual» lo enseña.
  const certificatePending = isCertificatePending({
    mode: form.sexOffenceCertificateMode,
    hasFile: profile.files.sexOffenceCertificate || certPhase === 'applied',
    uploading: certPhase === 'sending',
  });
  const toDocuments = () =>
    goTo({ internalpage: 'list_stic_documents' }, 'Documentos');

  // El aviso del plugin cuando el servidor lo aplica (o lo rechaza) con la
  // pantalla abierta. Solo en el cambio de estado, no al entrar.
  const status = pending.entry?.status;
  const lastStatus = useRef(status);
  useEffect(() => {
    const prev = lastStatus.current;
    lastStatus.current = status;
    if (!prev || prev === status) return;
    if (status === 'applied') {
      h.formSuccess();
      toast.show({ variant: 'success', label: C.saved });
    } else if (
      status === 'stuck' ||
      // Lo que se reintenta solo (CRM caído) no alarma: lo dice la barra.
      (status === 'failed' && pending.entry?.error?.auto === false)
    ) {
      toast.show({ variant: 'danger', label: C.saveError });
    }
  }, [status, pending.entry?.error?.auto, toast]);

  // Salir con cambios sin guardar pregunta (también en web).
  const dirty = f.dirty;
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirty) return;
      e.preventDefault();
      void confirmAction(
        C.leave.title,
        C.leave.message,
        C.leave.action,
        true,
      ).then((leave) => {
        if (leave) navigation.dispatch(e.data.action);
      });
    });
    return unsub;
  }, [navigation, dirty]);

  const onSave = async () => {
    if (blocked) {
      h.error();
      return;
    }
    await save(f.changes());
  };

  const showStatus =
    !f.dirty && pending.entry && pending.entry.status !== 'applied';

  return (
    <AreaScreen
      onRefresh={refetch}
      footer={
        <BottomActionBar>
          {showStatus ? (
            <View style={styles.status}>
              <UploadStatus
                state={pending.entry!.status}
                onRetry={() => void retry()}
              />
            </View>
          ) : null}
          <AreaPrimaryButton
            label={C.save}
            onPress={() => void onSave()}
            disabled={!f.dirty}
            haptic
          />
        </BottomActionBar>
      }
    >
      <Stack.Screen options={{ title: C.title }} />
      {isNetwork(error) ? <OfflineNotice /> : null}
      {certificatePending ? <CertificatePendingAlert /> : null}
      <Text style={[styles.intro, { color: t.textSecondary }]}>{C.intro}</Text>

      <FormSection title={C.sections.path}>
        <TextFormField
          label={C.monitorSince.label}
          help={C.monitorSince.help}
          placeholder={C.monitorSince.placeholder}
          value={form.monitorSince}
          onChangeText={(v) => set('monitorSince', v)}
          error={f.errors.monitorSince}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          inline
        />
        <SelectField
          label={C.monitorOf.label}
          help={C.monitorOf.help}
          value={form.monitorOf}
          options={MONITOR_OF_OPTIONS}
          onChange={(v) => set('monitorOf', v)}
        />
      </FormSection>

      <FormSection title={`${C.sections.training} · ${C.sections.preMonitors}`}>
        <SelectField
          label={C.preMonitors1.label}
          help={C.preMonitors1.help}
          value={form.preMonitors1}
          options={PRE_MONITOR_OPTIONS}
          onChange={(v) => set('preMonitors1', v)}
        />
        <SelectField
          label={C.preMonitors2.label}
          help={C.preMonitors2.help}
          value={form.preMonitors2}
          options={PRE_MONITOR_OPTIONS}
          onChange={(v) => set('preMonitors2', v)}
        />
        <TextFormField
          label={C.preMonitorsYear.label}
          placeholder={C.preMonitorsYear.placeholder}
          value={form.preMonitorsYear}
          onChangeText={(v) => set('preMonitorsYear', v)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={4}
          inline
        />
      </FormSection>

      <FormSection title={`${C.sections.training} · ${C.sections.courses}`}>
        <SelectField
          label={C.mat.label}
          help={C.mat.help}
          value={form.mat}
          options={COURSE_OPTIONS}
          onChange={(v) => set('mat', v)}
        />
        <SelectField
          label={C.matCourse.label}
          value={form.matCourse}
          options={profile.options.matCourses}
          onChange={(v) => set('matCourse', v)}
        />
        <SelectField
          label={C.dat.label}
          help={C.dat.help}
          value={form.dat}
          options={COURSE_OPTIONS}
          onChange={(v) => set('dat', v)}
        />
        <TextFormField
          label={C.datYearAndSchool.label}
          value={form.datYearAndSchool}
          onChangeText={(v) => set('datYearAndSchool', v)}
          maxLength={MONITOR_SHORT_TEXT_MAX}
        />
        <SelectField
          label={C.fa.label}
          help={C.fa.help}
          value={form.fa}
          options={COURSE_OPTIONS}
          onChange={(v) => set('fa', v)}
        />
        <TextFormField
          label={C.faYearAndSchool.label}
          value={form.faYearAndSchool}
          onChangeText={(v) => set('faYearAndSchool', v)}
          maxLength={MONITOR_SHORT_TEXT_MAX}
        />
      </FormSection>

      <FormSection
        title={`${C.sections.training} · ${C.sections.moreTraining}`}
      >
        <SwitchField
          label={C.foodHandling.label}
          value={form.foodHandling}
          onChange={(v) => set('foodHandling', v)}
        />
        <CheckListField
          label={C.congresses.label}
          help={C.congresses.help}
          options={profile.options.congresses}
          value={form.congresses}
          onChange={(v) => set('congresses', v)}
        />
        <TextFormField
          label={C.academicBackground.label}
          value={form.academicBackground}
          onChangeText={(v) => set('academicBackground', v)}
          multiline
          maxLength={MONITOR_LONG_TEXT_MAX}
        />
      </FormSection>

      <FormSection title={C.sections.volunteering}>
        <FormNote icon="clock">
          <Text style={styles.strong}>{C.volunteeringNote.strong}</Text>
          {C.volunteeringNote.rest}
        </FormNote>
        <TextFormField
          label={C.volunteeringDescription.label}
          value={form.volunteeringDescription}
          onChangeText={(v) => set('volunteeringDescription', v)}
          multiline
          maxLength={MONITOR_LONG_TEXT_MAX}
        />
        <TextFormField
          label={C.volunteeringPrograms.label}
          value={form.volunteeringPrograms}
          onChangeText={(v) => set('volunteeringPrograms', v)}
          multiline
          maxLength={MONITOR_LONG_TEXT_MAX}
        />
      </FormSection>

      <CertificateSection
        mode={form.sexOffenceCertificateMode}
        onMode={(m) => set('sexOffenceCertificateMode', m)}
        hasFile={profile.files.sexOffenceCertificate}
        onReview={toDocuments}
      />

      <FormSection title={C.sections.files} footer={FILE_HINT_EMPTY}>
        <FormNote>{C.files.note}</FormNote>
        <DocumentField
          kind="mat"
          label={C.files.mat}
          hasFile={profile.files.mat}
          onReview={toDocuments}
        />
        <DocumentField
          kind="dat"
          label={C.files.dat}
          hasFile={profile.files.dat}
          onReview={toDocuments}
        />
        <DocumentField
          kind="other_training"
          label={C.files.other}
          hasFile={profile.files.otherTraining}
          onReview={toDocuments}
        >
          <Text style={[styles.note, { color: t.textSecondary }]}>
            {C.files.otherNote}
          </Text>
        </DocumentField>
      </FormSection>

      <Section>
        <NavRow
          icon="person.crop.circle"
          title={C.personal.title}
          subtitle={C.personal.subtitle}
          onPress={() =>
            goTo(
              { internalpage: 'single_stic_comunica_perfil' },
              C.personal.title,
            )
          }
        />
      </Section>

      <View style={styles.footer}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.subhead, paddingHorizontal: 4 },
  strong: { fontWeight: '600' },
  note: { ...typography.caption },
  status: { alignItems: 'center' },
  footer: { alignItems: 'center' },
});
