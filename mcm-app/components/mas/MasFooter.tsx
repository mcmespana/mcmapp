import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { LEGAL_LINKS } from '@/constants/legalLinks';
import { SecretMenuTrigger } from '@/components/SecretMenuTrigger';
import { VersionDisplay } from '@/components/VersionDisplay';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';

/**
 * Pie de la pantalla "Más": versión, enlace de feedback, enlaces legales y el
 * disparador del menú secreto (escondido tras el nombre del movimiento).
 *
 * Vive aparte porque `MasHomeScreen` se pasaba del límite de 400 líneas del
 * repo al añadirle los enlaces legales, y porque el pie no tiene nada que ver
 * con la rejilla de tarjetas que ocupa el resto de la pantalla.
 */
interface MasFooterProps {
  isDark: boolean;
  onFeedbackPress: () => void;
}

export default function MasFooter({ isDark, onFeedbackPress }: MasFooterProps) {
  const muted = isDark ? '#8E8E93' : '#6B7280';

  return (
    <View style={styles.footer}>
      <VersionDisplay />

      <TouchableOpacity
        onPress={onFeedbackPress}
        style={styles.feedbackLink}
        accessibilityRole="button"
        accessibilityLabel="Reportar un fallo o sugerencia"
      >
        <Text style={[styles.feedbackText, { color: muted }]}>
          ¿Algún fallo? Cuéntanoslo
        </Text>
      </TouchableOpacity>

      {/* Apple y Google exigen que la política de privacidad se pueda abrir
          DESDE DENTRO de la app, no solo desde la ficha de la tienda. */}
      <View style={styles.legalRow}>
        {LEGAL_LINKS.map((link, index) => (
          <React.Fragment key={link.id}>
            {index > 0 ? (
              <Text
                style={[
                  styles.legalSeparator,
                  { color: isDark ? '#5A5A5F' : '#B0B0B8' },
                ]}
              >
                ·
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => Linking.openURL(link.url)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              hitSlop={8}
            >
              <Text style={[styles.legalText, { color: muted }]}>
                {link.label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      <SecretMenuTrigger>
        <Text style={[styles.tagline, { color: muted }]}>
          Movimiento Consolación para el Mundo
        </Text>
      </SecretMenuTrigger>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  feedbackLink: {
    padding: spacing.sm,
    marginTop: 4,
  },
  feedbackText: {
    ...typography.caption,
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  legalText: {
    ...typography.footnote,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    ...typography.footnote,
  },
  tagline: {
    ...typography.footnote,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
});
