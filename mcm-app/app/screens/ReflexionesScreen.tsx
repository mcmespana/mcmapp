import { logger } from '@/utils/logger';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Share,
  Text,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Spinner, BottomSheet } from 'heroui-native';
// Toast de la app (mismo API que el de heroui) — el resto del repo usa este.
import { useToast } from '@/contexts/AppToastContext';
import ContextMenuSheet from '@/components/ContextMenuSheet';
import CelebrationBurst from '@/components/ui/CelebrationBurst';
import { useContextMenu } from '@/hooks/useContextMenu';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { getBrightness } from '@/components/ui/glass';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import { getDatabase, ref, push, update } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { h } from '@/utils/haptics';
import { localISO } from '@/utils/localDate';
import { buildReflexionUpdate } from '@/utils/reflexiones';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import PageContainer from '@/components/ui/PageContainer';
import ScreenHero from '@/components/ui/ScreenHero';
import type { EventStackParamList } from './eventStackScreens';

interface Grupo {
  nombre: string;
  subtitulo?: string;
}
interface Reflexion {
  id: string;
  titulo?: string;
  contenido: string;
  fecha: string;
  grupal: boolean;
  grupo?: string;
  autor?: string;
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Paleta para las tarjetas de Compartiendo. Colores de media saturación (el
// blanco se lee encima y combinan bien como tinte de fondo). Se elige uno de
// forma DETERMINISTA según el id de cada reflexión, así cada tarjeta tiene
// "su" color estable entre renders.
const CARD_PALETTE = [
  '#E15C62', // rojo MIC
  '#3478C7', // azul
  '#7B9A1E', // verde oliva
  '#9D1E74', // morado
  '#E0702F', // naranja
  '#2F8FB3', // azul petróleo
  '#9C4FB0', // violeta
  '#D24B7E', // rosa
  '#4E9A51', // verde
  '#5C6BC0', // índigo
  '#3A9188', // turquesa
  '#C2872B', // ámbar
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0; // a int32
  }
  return Math.abs(hash);
}

function pickCardColor(seed: string): string {
  return CARD_PALETTE[hashString(seed || 'x') % CARD_PALETTE.length];
}

function getInitials(name?: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Wraps children so a long-press (or right-click on web) fires `onLongPress`. */
function LongPressable({
  onLongPress,
  children,
}: {
  onLongPress: () => void;
  children: React.ReactNode;
}) {
  const ctx = useContextMenu(onLongPress);
  return <Pressable {...ctx}>{children}</Pressable>;
}

export default function ReflexionesScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const theme = Colors[scheme ?? 'light'];
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const route = useRoute<RouteProp<EventStackParamList, 'Reflexiones'>>();
  const { profile } = useUserProfile();
  const resolved = useResolvedProfileConfig();

  const getDefaultAuthor = useCallback(() => {
    const parts = [];
    if (profile.name.trim()) {
      parts.push(profile.name.trim());
    }
    if (resolved.delegationLabel.trim()) {
      parts.push(resolved.delegationLabel.trim());
    }
    return parts.join(' · ');
  }, [profile.name, resolved.delegationLabel]);

  const event = useCurrentEvent();
  const compartiendoPath = getEventFirebasePath(event, 'compartiendo');
  const { data: dataRef } = useFirebaseData<Reflexion[]>(
    compartiendoPath,
    getEventCacheKey(event, 'compartiendo'),
  );
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>(
    getEventFirebasePath(event, 'grupos'),
    getEventCacheKey(event, 'grupos'),
  );

  const grupos = gruposData?.['Conso+'] ?? [];

  const [list, setList] = useState<Reflexion[]>([]);

  useEffect(() => {
    if (dataRef) {
      const arrayData = Array.isArray(dataRef)
        ? dataRef
        : Object.values(dataRef as Record<string, Reflexion>);
      setList(arrayData);
    }
  }, [dataRef]);

  useEffect(() => {
    setAutor(getDefaultAuthor());
  }, [getDefaultAuthor]);

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [autor, setAutor] = useState(getDefaultAuthor());
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // El burst se auto-apaga para poder relanzarse en la siguiente publicación.
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(false), 1600);
    return () => clearTimeout(t);
  }, [celebrate]);

  // El botón "+" vive ahora en la barra superior (EventActionButtons). Al
  // pulsarlo, el tab renavega a esta pantalla con un `openFormNonce` nuevo;
  // ese cambio abre el formulario aquí.
  const openFormNonce = route.params?.openFormNonce;
  useEffect(() => {
    if (openFormNonce) setShowForm(true);
  }, [openFormNonce]);

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fecha,
        mode: 'date',
        onChange: (_: any, selected: any) => selected && setFecha(selected),
      });
    } else {
      setShowDateSelector(true);
    }
  };

  const formatFecha = (f: string | Date) => {
    const d = typeof f === 'string' ? new Date(f) : f;
    const weekday = WEEKDAYS_ES[d.getDay()];
    const day = d.getDate();
    const month = MONTHS_ES[d.getMonth()];
    return `${weekday} ${day}-${month}`;
  };

  async function addReflexion() {
    if (!fecha) return;
    h.tap();
    setSaving(true);
    const nuevo: Reflexion = {
      id: Date.now().toString(),
      titulo: titulo.trim(),
      contenido,
      fecha: localISO(fecha),
      grupal: false,
      autor,
    };
    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, `${compartiendoPath}/data`));
      if (!newRef.key) throw new Error('push() sin key');
      // Un único update() multi-path: data/<key> + updatedAt a la vez. Antes
      // eran dos set() separados — si el segundo fallaba (o la app moría
      // entre medias) la reflexión quedaba escrita pero invisible para el
      // resto de dispositivos, porque useFirebaseData solo redescarga
      // `data` cuando `updatedAt` cambia.
      await update(
        ref(db, compartiendoPath),
        buildReflexionUpdate(newRef.key, nuevo, Date.now()),
      );
      setList([nuevo, ...list]);
      h.formSuccess();
      setCelebrate(true);
      setShowForm(false);
      setTitulo('');
      setContenido('');
      setFecha(new Date());
      setAutor(getDefaultAuthor());
    } catch (e) {
      logger.error('Error adding post', e);
      // No limpiar el formulario: si falla el guardado (offline es habitual
      // en los eventos donde se usa esta pantalla) el usuario no debe
      // perder lo que escribió ni creer que se compartió.
      toast.show({
        variant: 'danger',
        label: 'No se pudo compartir. Revisa tu conexión e inténtalo de nuevo.',
      });
    }
    setSaving(false);
  }

  const getGrupoLabel = (nombre?: string) => {
    if (!nombre) return '';
    const g = grupos.find((gr) => gr.nombre === nombre);
    return g
      ? g.subtitulo
        ? `${g.nombre} - ${g.subtitulo}`
        : g.nombre
      : nombre;
  };

  const sortedList = useMemo(
    () =>
      [...list].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [list],
  );

  const { toast } = useToast();
  const [menuReflexion, setMenuReflexion] = useState<Reflexion | null>(null);

  const reflexionText = (r: Reflexion) => {
    const lines: string[] = [];
    if (r.titulo) lines.push(r.titulo);
    lines.push(r.contenido);
    const meta = r.grupal ? getGrupoLabel(r.grupo) : r.autor;
    lines.push(`${formatFecha(r.fecha)}${meta ? ` · ${meta}` : ''}`);
    return lines.join('\n\n');
  };

  const copyReflexion = async (r: Reflexion) => {
    await Clipboard.setStringAsync(reflexionText(r));
    toast.show({ variant: 'success', label: 'Reflexión copiada' });
  };
  const shareReflexion = (r: Reflexion) => {
    Share.share({ message: reflexionText(r) });
  };

  return (
    <View style={styles.container}>
      <ScreenHero
        title="Compartiendo"
        subtitle="Comparte aquí una frase, pensamiento o algo que te llevas de estos días"
        floatingHeaderInset
      />
      <PageContainer>
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 20 },
          ]}
        >
          {sortedList.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="auto-stories"
                size={40}
                color={colors.success}
              />
              <Text style={styles.emptyTitle}>Aún no hay reflexiones</Text>
              <Text style={styles.emptyText}>
                Pulsa el botón + de arriba para compartir la primera.
              </Text>
            </View>
          ) : (
            sortedList.map((r, i) => {
              const color = pickCardColor(r.id);
              // Alterna dos diseños para que el muro "fluya": tarjeta con
              // fondo tintado (par) y tarjeta limpia con barra de color a la
              // izquierda (impar). Cada una con su color generado del id.
              const filled = i % 2 === 0;
              const name = r.grupal ? getGrupoLabel(r.grupo) : r.autor;
              const initials = getInitials(name);
              const onColor = getBrightness(color) > 150 ? '#1a1a1a' : '#fff';
              return (
                <LongPressable
                  key={r.id}
                  onLongPress={() => setMenuReflexion(r)}
                >
                  <View
                    style={[
                      styles.card,
                      filled
                        ? {
                            backgroundColor:
                              color + (scheme === 'dark' ? '26' : '1A'),
                          }
                        : styles.cardSurface,
                    ]}
                  >
                    {!filled && (
                      <View
                        style={[styles.accentBar, { backgroundColor: color }]}
                      />
                    )}
                    <MaterialIcons
                      name="format-quote"
                      size={66}
                      color={color + (scheme === 'dark' ? '26' : '1F')}
                      style={styles.quoteMark}
                    />
                    <View
                      style={[
                        styles.cardInner,
                        !filled && { paddingLeft: spacing.md + 8 },
                      ]}
                    >
                      <View style={styles.cardHead}>
                        <View
                          style={[styles.avatar, { backgroundColor: color }]}
                        >
                          {initials ? (
                            <Text
                              style={[styles.avatarText, { color: onColor }]}
                            >
                              {initials}
                            </Text>
                          ) : (
                            <MaterialIcons
                              name="auto-stories"
                              size={16}
                              color={onColor}
                            />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardAuthor} numberOfLines={1}>
                            {name || 'Anónimo'}
                          </Text>
                          <Text style={styles.cardDate}>
                            {formatFecha(r.fecha)}
                          </Text>
                        </View>
                      </View>
                      {r.titulo ? (
                        <Text style={styles.cardTitle}>{r.titulo}</Text>
                      ) : null}
                      <Text style={styles.cardContent}>{r.contenido}</Text>
                    </View>
                  </View>
                </LongPressable>
              );
            })
          )}
        </ScrollView>
      </PageContainer>

      {/* Form bottom sheet */}
      <BottomSheet
        isOpen={showForm}
        onOpenChange={(open) => {
          if (!open) setShowForm(false);
        }}
      >
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            {/* Todo el contenido vive dentro de un único ScrollView con
                padding en contentContainerStyle — patrón que sí funciona con
                el BottomSheet de heroui (ver app/notifications.tsx). El
                BottomSheet.Content no aplica padding propio. */}
            <ScrollView
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIcon}>
                  <MaterialIcons
                    name="auto-stories"
                    size={20}
                    color={colors.success}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <BottomSheet.Title>Compartir reflexión</BottomSheet.Title>
                  <Text style={styles.sheetSubtitle}>
                    La tuya o la de tu grupo
                  </Text>
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.inputLabel}>Título (opcional)</Text>
                <TextInput
                  value={titulo}
                  onChangeText={setTitulo}
                  placeholder="Un título breve"
                  placeholderTextColor={theme.icon}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.inputLabel}>Compartiendo…</Text>
                <TextInput
                  value={contenido}
                  onChangeText={setContenido}
                  placeholder="Escribe aquí lo que quieras"
                  placeholderTextColor={theme.icon}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textArea]}
                />
              </View>

              <Pressable
                onPress={showDatePicker}
                style={({ pressed }) => [
                  styles.dateField,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Elegir fecha"
              >
                <MaterialIcons name="event" size={20} color={colors.success} />
                <Text style={styles.dateFieldLabel}>Fecha</Text>
                <Text style={styles.dateValue}>{formatFecha(fecha)}</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.icon}
                />
              </Pressable>

              <View style={styles.field}>
                <Text style={styles.inputLabel}>
                  ¿Quién la envía? (opcional)
                </Text>
                <TextInput
                  value={autor}
                  onChangeText={setAutor}
                  placeholder="Cómo quieres firmar"
                  placeholderTextColor={theme.icon}
                  style={styles.input}
                />
              </View>

              <Pressable
                onPress={addReflexion}
                accessibilityRole="button"
                accessibilityLabel="Guardar reflexión"
                style={({ pressed }) => [
                  styles.saveBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.saveBtnLabel}>Compartir</Text>
              </Pressable>
            </ScrollView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Date selector — modal centrado que aparece por encima de todo
          (incluido el bottom sheet). Antes se usaba el Dialog de heroui, que
          al anidarse con el portal del BottomSheet dejaba escapar el spinner
          nativo a la esquina superior. Un Modal nativo de RN se presenta de
          forma fiable centrado sobre el resto de la UI. */}
      <Modal
        visible={showDateSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateSelector(false)}
      >
        <Pressable
          style={styles.dateModalOverlay}
          onPress={() => setShowDateSelector(false)}
        >
          {/* Pressable interior que “traga” el toque para no cerrar al
              interactuar con el selector. */}
          <Pressable style={styles.dateModalCard} onPress={() => {}}>
            <Text style={styles.dateModalTitle}>Elige la fecha</Text>
            <DateTimePicker
              value={fecha}
              mode="date"
              display="spinner"
              locale="es-ES"
              themeVariant={scheme === 'dark' ? 'dark' : 'light'}
              onChange={(_, selected) => {
                if (selected) setFecha(selected);
              }}
              style={styles.datePicker}
            />
            <Pressable
              onPress={() => setShowDateSelector(false)}
              accessibilityRole="button"
              accessibilityLabel="Confirmar fecha"
              style={({ pressed }) => [
                styles.dateDoneBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.dateDoneLabel}>Listo</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Saving overlay */}
      {saving && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
          <View style={styles.savingModal}>
            <Spinner size="lg" color={colors.success} />
            <Text style={styles.savingText}>Enviando...</Text>
          </View>
        </View>
      )}

      <ContextMenuSheet
        visible={menuReflexion !== null}
        onClose={() => setMenuReflexion(null)}
        title={menuReflexion?.titulo || 'Reflexión'}
        actions={
          menuReflexion
            ? [
                {
                  key: 'copy',
                  label: 'Copiar',
                  icon: 'content-copy',
                  onPress: () => copyReflexion(menuReflexion),
                },
                {
                  key: 'share',
                  label: 'Compartir',
                  icon: 'share',
                  onPress: () => shareReflexion(menuReflexion),
                },
              ]
            : []
        }
      />
      <CelebrationBurst visible={celebrate} emoji="💬" />
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    // El padding del contenido del bottom sheet va aquí (en el ScrollView),
    // no en BottomSheet.Content — que no aplica padding propio. Sin esto las
    // etiquetas se recortaban por la izquierda.
    sheetScroll: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    list: { padding: spacing.md, paddingTop: spacing.sm },
    card: {
      marginBottom: spacing.md,
      borderRadius: radii.xl,
      overflow: 'hidden',
      ...(shadows.sm as object),
    },
    cardSurface: {
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#FFFFFF',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 6,
    },
    quoteMark: {
      position: 'absolute',
      top: -10,
      right: 6,
      transform: [{ scaleX: -1 }],
    },
    cardInner: { padding: spacing.md },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 10,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
    cardAuthor: { fontSize: 15, fontWeight: '700', color: theme.text },
    cardDate: { fontSize: 12, color: theme.icon, marginTop: 1 },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    cardContent: { fontSize: 15, lineHeight: 21, color: theme.text },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl * 2,
      paddingHorizontal: spacing.lg,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginTop: 4,
    },
    emptyText: {
      fontSize: 14,
      color: theme.icon,
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sheetIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        scheme === 'dark' ? 'rgba(163,189,49,0.18)' : 'rgba(163,189,49,0.12)',
    },
    sheetSubtitle: {
      fontSize: 13,
      color: theme.icon,
      marginTop: 2,
    },
    field: { marginBottom: spacing.md },
    inputLabel: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '700',
      letterSpacing: 0.2,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#48484A' : '#D8DCC8',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.text,
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#fff',
    },
    textArea: { minHeight: 120, paddingTop: 12 },
    dateField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#48484A' : '#D8DCC8',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#fff',
    },
    pressed: { opacity: 0.7 },
    dateFieldLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    dateValue: { fontSize: 15, fontWeight: '600', color: colors.success },
    dateModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    dateModalCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.background,
      borderRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 8,
    },
    dateModalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.sm,
    },
    datePicker: { alignSelf: 'stretch' },
    dateDoneBtn: {
      alignSelf: 'stretch',
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    dateDoneLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.success,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    saveBtnLabel: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    savingModal: {
      backgroundColor: theme.background,
      padding: spacing.lg,
      margin: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
    },
    savingText: {
      marginTop: spacing.md,
      color: theme.text,
    },
  });
};
