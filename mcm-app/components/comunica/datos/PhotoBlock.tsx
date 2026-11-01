// La foto de «Mis datos» (plan 12): la foto (o la inicial) y el botón con
// el texto del plugin. ⚠️ El servidor aún no tiene dónde subirla
// (`comunicaMiddleware` solo sirve `GET /v1/profiles/:pid/photo`, sin el
// `POST` del plan), así que «Cambiar foto» abre esta misma página en la web,
// con la sesión puesta, hasta que lo tenga.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { getComunicaApi, isComunicaApiAvailable } from '@/services/comunica';
import { DETAILS_COPY } from '@/utils/comunica/personDetailsSpec';
import FormSection from '../comun/form/FormSection';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const SIZE = 88;

export default function PhotoBlock({
  title,
  photoUrl,
  initial,
  onChange,
  disabled,
}: {
  title: string;
  photoUrl: string | null;
  initial: string;
  onChange: () => void;
  /** Sin conexión no se cambia. */
  disabled: boolean;
}) {
  const t = useComunicaTheme();
  const source = useMemo(
    () =>
      photoUrl && isComunicaApiAvailable()
        ? getComunicaApi().photoSource(photoUrl)
        : null,
    [photoUrl],
  );
  const label = photoUrl ? DETAILS_COPY.photo.change : DETAILS_COPY.photo.add;
  return (
    <FormSection title={title}>
      <View style={styles.row}>
        <View
          style={[styles.circle, { backgroundColor: t.backgroundSunken }]}
          accessible={!!photoUrl}
          accessibilityRole="image"
          accessibilityLabel={photoUrl ? 'Foto de perfil actual' : undefined}
        >
          <Text style={[styles.initial, { color: t.textSecondary }]}>
            {initial}
          </Text>
          {source ? (
            <Image
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              // En memoria, nunca en disco: es una foto de una persona.
              cachePolicy="memory"
              transition={120}
            />
          ) : null}
        </View>
        <View style={styles.body}>
          <PressableFeedback
            onPress={onChange}
            isDisabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            style={styles.action}
          >
            <IconSymbol
              name="camera"
              size={18}
              color={disabled ? t.textMuted : t.accentText}
            />
            <Text
              style={[
                styles.actionText,
                { color: disabled ? t.textMuted : t.accentText },
              ]}
            >
              {label}
            </Text>
          </PressableFeedback>
          <Text style={[styles.hint, { color: t.textSecondary }]}>
            {DETAILS_COPY.photo.hint}
          </Text>
        </View>
      </View>
    </FormSection>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { ...typography.h2 },
  body: { flex: 1, gap: 4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  actionText: { ...typography.body, fontWeight: '600', flexShrink: 1 },
  hint: { ...typography.caption },
});
