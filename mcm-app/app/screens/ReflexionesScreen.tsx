import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Text,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  Switch,
  Chip,
  Spinner,
  BottomSheet,
  PressableFeedback,
  TextField,
  Input,
  TextArea,
  Dialog,
} from 'heroui-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { h } from '@/utils/haptics';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import GlassFAB from '@/components/ui/GlassFAB';
import PageContainer from '@/components/ui/PageContainer';

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

export default function ReflexionesScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const theme = Colors[scheme ?? 'light'];
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
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
  const [grupal, setGrupal] = useState(false);
  const [grupo, setGrupo] = useState<string | undefined>(undefined);
  const [autor, setAutor] = useState(getDefaultAuthor());
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [saving, setSaving] = useState(false);

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
      fecha: fecha.toISOString().slice(0, 10),
      grupal,
      ...(grupal ? (grupo ? { grupo } : {}) : { autor }),
    };
    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, `${compartiendoPath}/data`));
      await set(newRef, nuevo);
      await set(
        ref(db, `${compartiendoPath}/updatedAt`),
        Date.now().toString(),
      );
      setList([nuevo, ...list]);
      h.formSuccess();
    } catch (e) {
      console.error('Error adding post', e);
    }
    setShowForm(false);
    setTitulo('');
    setContenido('');
    setFecha(new Date());
    setGrupal(false);
    setGrupo(undefined);
    setAutor(getDefaultAuthor());
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

  return (
    <View style={styles.container}>
      <PageContainer>
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 20 },
          ]}
        >
          {sortedList.map((r) => (
            <Card
              key={r.id}
              style={[styles.card, r.grupal && styles.cardGroup]}
            >
              <Card.Body style={{ paddingTop: 8 }}>
                {r.titulo ? (
                  <Text
                    style={[
                      { fontWeight: '600', fontSize: 16, marginBottom: 4 },
                      r.grupal
                        ? { color: scheme === 'dark' ? '#d4e8c0' : '#1a3000' }
                        : { color: theme.text },
                    ]}
                  >
                    {r.titulo}
                  </Text>
                ) : null}
                <Text
                  style={
                    r.grupal
                      ? { color: scheme === 'dark' ? '#c0d8a8' : '#333' }
                      : { color: theme.text }
                  }
                >
                  {r.contenido}
                </Text>
                <Text
                  style={[
                    { marginTop: 4, fontSize: 12 },
                    r.grupal
                      ? { color: scheme === 'dark' ? '#a0b888' : '#555' }
                      : { color: theme.icon },
                  ]}
                >
                  {formatFecha(r.fecha)}
                  {r.grupal
                    ? ` - ${getGrupoLabel(r.grupo)}`
                    : r.autor
                      ? ` - ${r.autor}`
                      : ''}
                </Text>
              </Card.Body>
            </Card>
          ))}
        </ScrollView>
      </PageContainer>

      <GlassFAB
        icon="add"
        onPress={() => setShowForm(true)}
        tintColor="#A3BD31"
        iconColor="#fff"
      />

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
                  Tu experiencia puede iluminar a otros
                </Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Título (opcional)</Text>
                <TextField>
                  <Input
                    value={titulo}
                    onChangeText={setTitulo}
                    placeholder="Un título breve"
                    style={styles.input}
                  />
                </TextField>
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Compartiendo...</Text>
                <TextField>
                  <TextArea
                    value={contenido}
                    onChangeText={setContenido}
                    numberOfLines={5}
                    placeholder="Escribe aquí tu reflexión"
                    style={[
                      styles.input,
                      { minHeight: 120, textAlignVertical: 'top' },
                    ]}
                  />
                </TextField>
              </View>
              <PressableFeedback
                onPress={showDatePicker}
                style={styles.dateField}
              >
                <PressableFeedback.Highlight />
                <MaterialIcons name="event" size={20} color={colors.success} />
                <Text style={styles.dateFieldLabel}>Fecha</Text>
                <Text style={styles.dateValue}>{formatFecha(fecha)}</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={theme.icon}
                />
              </PressableFeedback>
              <View style={styles.row}>
                <MaterialIcons
                  name="groups"
                  size={20}
                  color={grupal ? colors.success : theme.icon}
                />
                <Text style={styles.switchLabel}>Compartir en grupo</Text>
                <Switch
                  isSelected={grupal}
                  onSelectedChange={(v) => setGrupal(v)}
                />
              </View>
              {grupal ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: spacing.md }}
                >
                  <View
                    style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}
                  >
                    {grupos.map((g) => (
                      <Chip
                        key={g.nombre}
                        variant={grupo === g.nombre ? 'primary' : 'soft'}
                        color="success"
                        onPress={() => setGrupo(g.nombre)}
                      >
                        <Chip.Label>{getGrupoLabel(g.nombre)}</Chip.Label>
                      </Chip>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Tu nombre (opcional)</Text>
                  <TextField>
                    <Input
                      value={autor}
                      onChangeText={setAutor}
                      style={styles.input}
                    />
                  </TextField>
                </View>
              )}
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

      {/* Date selector modal */}
      <Dialog
        isOpen={showDateSelector}
        onOpenChange={(open) => {
          if (!open) setShowDateSelector(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Close />
            <DateTimePicker
              value={fecha}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              locale="es-ES"
              onChange={(_, selected) => {
                setShowDateSelector(false);
                if (selected) setFecha(selected);
              }}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Saving overlay */}
      {saving && (
        <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
          <View style={styles.savingModal}>
            <Spinner size="lg" color={colors.success} />
            <Text style={styles.savingText}>Enviando...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: spacing.md },
    card: { marginBottom: spacing.md },
    cardGroup: {
      backgroundColor: scheme === 'dark' ? '#2D3B20' : '#E6F4D7',
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
    inputWrapper: { marginBottom: spacing.md },
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
    },
    dateFieldLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    dateValue: { fontSize: 15, fontWeight: '600', color: colors.success },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
      paddingVertical: 4,
    },
    switchLabel: { flex: 1, fontSize: 15, color: theme.text },
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
