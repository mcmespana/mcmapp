import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from 'heroui-native';

import StarRating from '@/components/StarRating';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { EvaluationConfig } from '@/constants/evaluation';

export type EvaluationAnswers = Record<string, number | string | boolean>;

interface EvaluationFormProps {
  config: EvaluationConfig;
  /** Color de acento (botones, estrellas, chips). */
  accentColor: string;
  /** Clave de AsyncStorage para recordar que ya se evaluó (anti-duplicado). */
  doneKey: string;
  /** Escribe las respuestas (en Firebase). Lanza si falla. */
  onSubmit: (answers: EvaluationAnswers) => Promise<void>;
  /** Texto del botón de envío. */
  submitLabel?: string;
}

/**
 * Formulario genérico de evaluación. Renderiza las preguntas de un
 * `EvaluationConfig` (estrellas / texto / sí-no), valida las obligatorias,
 * envía las respuestas y recuerda en AsyncStorage que ya se evaluó para no
 * pedirlo de nuevo (con opción a reenviar).
 */
export default function EvaluationForm({
  config,
  accentColor,
  doneKey,
  onSubmit,
  submitLabel = 'Enviar evaluación',
}: EvaluationFormProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { toast } = useToast();
  const styles = useMemo(() => createStyles(isDark), [isDark]);

  const [answers, setAnswers] = useState<EvaluationAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [alreadyDone, setAlreadyDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(doneKey)
      .then((v) => setAlreadyDone(v === '1'))
      .catch(() => setAlreadyDone(false));
  }, [doneKey]);

  const setAnswer = (id: string, value: number | string | boolean) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrorMsg('');
  };

  const missingRequired = () =>
    config.questions.some((q) => {
      if (q.optional) return false;
      const v = answers[q.id];
      if (q.type === 'stars') return !v || v === 0;
      if (q.type === 'text') return !String(v ?? '').trim();
      if (q.type === 'yesno') return v === undefined;
      return false;
    });

  const handleSubmit = async () => {
    if (missingRequired()) {
      setErrorMsg('Responde las preguntas marcadas antes de enviar.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      // Limpia textos en blanco para no guardar campos vacíos.
      const cleaned: EvaluationAnswers = {};
      for (const q of config.questions) {
        const v = answers[q.id];
        if (q.type === 'text') {
          const t = String(v ?? '').trim();
          if (t) cleaned[q.id] = t;
        } else if (v !== undefined) {
          cleaned[q.id] = v;
        }
      }
      await onSubmit(cleaned);
      await AsyncStorage.setItem(doneKey, '1');
      h.formSuccess();
      setAlreadyDone(true);
      toast.show({
        variant: 'success',
        label: '¡Gracias! Hemos recibido tu evaluación 🙌',
        actionLabel: 'Cerrar',
        onActionPress: ({ hide }) => hide(),
      });
    } catch (e) {
      console.error('Error enviando evaluación', e);
      setErrorMsg('No se pudo enviar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Estado "ya evaluado": agradece y deja reenviar.
  if (alreadyDone) {
    return (
      <ScrollView contentContainerStyle={styles.doneWrap}>
        <View
          style={[
            styles.doneIcon,
            { backgroundColor: hexAlpha(accentColor, '18') },
          ]}
        >
          <MaterialIcons name="check-circle" size={44} color={accentColor} />
        </View>
        <Text style={[styles.doneTitle, { color: theme.text }]}>
          ¡Ya nos lo has contado!
        </Text>
        <Text style={[styles.doneText, { color: theme.icon }]}>
          Gracias por tu evaluación. Si quieres, puedes volver a enviarla.
        </Text>
        <TouchableOpacity
          style={[
            styles.resendBtn,
            { borderColor: hexAlpha(accentColor, '50') },
          ]}
          onPress={() => {
            h.tap();
            setAnswers({});
            setAlreadyDone(false);
          }}
          accessibilityRole="button"
        >
          <MaterialIcons name="edit" size={18} color={accentColor} />
          <Text style={[styles.resendBtnText, { color: accentColor }]}>
            Volver a evaluar
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {config.intro ? (
        <Text style={[styles.intro, { color: theme.icon }]}>
          {config.intro}
        </Text>
      ) : null}

      {config.questions.map((q) => {
        const v = answers[q.id];
        return (
          <View key={q.id} style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>
              {q.label}
              {!q.optional ? (
                <Text style={{ color: accentColor }}> *</Text>
              ) : null}
            </Text>

            {q.type === 'stars' && (
              <StarRating
                value={typeof v === 'number' ? v : 0}
                onChange={(n) => setAnswer(q.id, n)}
                color={accentColor}
                style={{ marginTop: 6 }}
              />
            )}

            {q.type === 'text' && (
              <TextInput
                value={typeof v === 'string' ? v : ''}
                onChangeText={(t) => setAnswer(q.id, t)}
                placeholder={q.placeholder}
                placeholderTextColor={theme.icon}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                editable={!submitting}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: String(v ?? '').trim()
                      ? hexAlpha(accentColor, '90')
                      : hexAlpha(theme.icon, '40'),
                  },
                ]}
              />
            )}

            {q.type === 'yesno' && (
              <View style={styles.yesnoRow}>
                {[
                  { key: true, label: 'Sí', icon: 'thumb-up' as const },
                  { key: false, label: 'No', icon: 'thumb-down' as const },
                ].map((opt) => {
                  const selected = v === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[
                        styles.yesnoBtn,
                        {
                          borderColor: selected
                            ? accentColor
                            : hexAlpha(theme.icon, '35'),
                          backgroundColor: selected
                            ? hexAlpha(accentColor, '15')
                            : 'transparent',
                        },
                      ]}
                      onPress={() => setAnswer(q.id, opt.key)}
                      accessibilityRole="button"
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={opt.icon}
                        size={18}
                        color={selected ? accentColor : theme.icon}
                      />
                      <Text
                        style={[
                          styles.yesnoText,
                          { color: selected ? accentColor : theme.icon },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {errorMsg ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={15} color="#FF3B30" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: accentColor }]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialIcons name="send" size={18} color="#fff" />
        )}
        <Text style={styles.submitBtnText}>
          {submitting ? 'Enviando…' : submitLabel}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (isDark: boolean) => {
  const theme = Colors[isDark ? 'dark' : 'light'];
  return StyleSheet.create({
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl * 2,
    },
    intro: {
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    field: { marginBottom: spacing.lg },
    label: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 21,
    },
    input: {
      marginTop: 8,
      borderWidth: 1.5,
      borderRadius: radii.md,
      padding: 14,
      fontSize: 15,
      minHeight: 90,
      lineHeight: 21,
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
    },
    yesnoRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    yesnoBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: radii.md,
      borderWidth: 1.5,
    },
    yesnoText: { fontSize: 15, fontWeight: '700' },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    errorText: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      borderRadius: radii.md,
      marginTop: spacing.sm,
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    // ── Estado "ya evaluado" ──
    doneWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl * 2,
      gap: 10,
    },
    doneIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    doneTitle: { fontSize: 19, fontWeight: '800', color: theme.text },
    doneText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      maxWidth: 320,
    },
    resendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.md,
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: radii.pill ?? 999,
      borderWidth: 1.5,
    },
    resendBtnText: { fontSize: 15, fontWeight: '700' },
  });
};
