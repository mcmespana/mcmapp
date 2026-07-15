import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@/components/BottomSheet';
import { useAppSettings, ThemeScheme } from '@/contexts/AppSettingsContext';
import useSectionFontScale from '@/hooks/useSectionFontScale';
import { warm } from '@/components/contigo/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Clave de sección para el tamaño de letra (p.ej. 'contigo'). */
  sectionKey: string;
  /** Texto de vista previa (una frase de la lectura actual). */
  previewText?: string;
}

const THEME_OPTIONS: { key: ThemeScheme; icon: string; label: string }[] = [
  { key: 'light', icon: 'light-mode', label: 'Claro' },
  { key: 'dark', icon: 'dark-mode', label: 'Oscuro' },
  { key: 'system', icon: 'brightness-auto', label: 'Auto' },
];

const DEFAULT_PREVIEW =
  'En aquel tiempo, dijo Jesús a sus discípulos: «Yo soy la luz del mundo».';

/**
 * Bottom sheet minimalista y bonito solo para la lectura: tamaño de letra
 * (propio de la sección, con herencia del global) y modo claro/oscuro.
 * Reutilizable en otras secciones de lectura pasando otra `sectionKey`.
 */
export default function ReaderSettingsSheet({
  visible,
  onClose,
  sectionKey,
  previewText,
}: Props) {
  const { settings, setSettings } = useAppSettings();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const W = warm(isDark);
  const { scale, hasOverride, globalScale, setScale, reset, min, max, step } =
    useSectionFontScale(sectionKey);

  const canDecrease = scale > min + 0.001;
  const canIncrease = scale < max - 0.001;

  const decrease = () => {
    if (!canDecrease) return;
    h.tap();
    setScale(scale - step);
  };
  const increase = () => {
    if (!canIncrease) return;
    h.tap();
    setScale(scale + step);
  };

  const segmentBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  // Progreso del tamaño dentro del rango, para la barra.
  const progress = Math.max(0, Math.min(1, (scale - min) / (max - min)));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajustes de lectura">
      <View style={styles.container}>
        {/* ── Vista previa en vivo ── */}
        <View
          style={[
            styles.preview,
            { backgroundColor: surfaceBg, borderColor: W.border },
          ]}
        >
          <Text
            style={{
              color: W.text,
              fontSize: 18 * scale,
              lineHeight: 28 * scale,
              fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
            }}
          >
            {previewText || DEFAULT_PREVIEW}
          </Text>
        </View>

        {/* ── Tamaño de letra ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: W.textSec }]}>
            TAMAÑO DE LETRA
          </Text>
          {hasOverride ? (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                reset();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.resetLink, { color: W.accent }]}>
                Sincronizar con la app
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sizeRow}>
          <TouchableOpacity
            onPress={decrease}
            disabled={!canDecrease}
            style={[
              styles.sizeBtn,
              { backgroundColor: segmentBg },
              !canDecrease && styles.disabled,
            ]}
            accessibilityLabel="Reducir tamaño de letra"
          >
            <Text style={[styles.sizeGlyphSmall, { color: W.text }]}>A</Text>
          </TouchableOpacity>

          <View style={styles.trackWrap}>
            <View style={[styles.track, { backgroundColor: segmentBg }]}>
              <View
                style={[
                  styles.trackFill,
                  {
                    backgroundColor: W.accent,
                    width: `${progress * 100}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.knob,
                  {
                    backgroundColor: W.accent,
                    left: `${progress * 100}%`,
                    borderColor: W.bgCard,
                  },
                ]}
              />
            </View>
            <Text style={[styles.percentLabel, { color: W.textMuted }]}>
              {Math.round(scale * 100)}%
            </Text>
          </View>

          <TouchableOpacity
            onPress={increase}
            disabled={!canIncrease}
            style={[
              styles.sizeBtn,
              { backgroundColor: segmentBg },
              !canIncrease && styles.disabled,
            ]}
            accessibilityLabel="Aumentar tamaño de letra"
          >
            <Text style={[styles.sizeGlyphBig, { color: W.text }]}>A</Text>
          </TouchableOpacity>
        </View>

        {!hasOverride ? (
          <View style={styles.syncHint}>
            <MaterialIcons name="link" size={13} color={W.textMuted} />
            <Text style={[styles.syncHintText, { color: W.textMuted }]}>
              Ligado al tamaño general de la app (
              {Math.round(globalScale * 100)}
              %). Ajústalo aquí para tener uno propio en la lectura.
            </Text>
          </View>
        ) : null}

        {/* ── Tema ── */}
        <Text
          style={[
            styles.sectionLabel,
            { color: W.textSec, marginTop: 22, marginBottom: 10 },
          ]}
        >
          APARIENCIA
        </Text>
        <View style={[styles.themeSegment, { backgroundColor: segmentBg }]}>
          {THEME_OPTIONS.map((opt) => {
            const selected = settings.theme === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  h.select();
                  setSettings({ theme: opt.key });
                }}
                style={[
                  styles.themeOption,
                  selected && {
                    backgroundColor: W.accent,
                    shadowColor: W.accent,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 3,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Tema ${opt.label}`}
              >
                <MaterialIcons
                  name={opt.icon as never}
                  size={17}
                  color={selected ? '#fff' : W.textSec}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: selected ? '#fff' : W.textSec },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 36,
  },
  preview: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 22,
    minHeight: 96,
    justifyContent: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  resetLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sizeBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.35 },
  sizeGlyphSmall: { fontSize: 15, fontWeight: '700' },
  sizeGlyphBig: { fontSize: 26, fontWeight: '700' },
  trackWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    justifyContent: 'center',
  },
  trackFill: {
    height: 6,
    borderRadius: 3,
  },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    marginLeft: -9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  percentLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  syncHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  syncHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  themeSegment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 9,
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
