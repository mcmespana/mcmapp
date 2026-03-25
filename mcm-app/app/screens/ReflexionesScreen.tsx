import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Text,
  TextInput,
  Switch,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Card } from 'heroui-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import { useUserProfile } from '@/contexts/UserProfileContext';
import GlassFAB from '@/components/ui/GlassFAB.ios';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { profile } = useUserProfile();

  const getDefaultAuthor = useCallback(() => {
    const parts = [];
    if (profile.name.trim()) {
      parts.push(profile.name.trim());
    }
    if (profile.location.trim()) {
      parts.push(profile.location.trim());
    }
    return parts.join(' · ');
  }, [profile.name, profile.location]);

  const { data: dataRef } = useFirebaseData<Reflexion[]>(
    'jubileo/compartiendo',
    'jubileo_compartiendo',
  );
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>(
    'jubileo/grupos',
    'jubileo_grupos',
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
      const newRef = push(ref(db, 'jubileo/compartiendo/data'));
      await set(newRef, nuevo);
      await set(
        ref(db, 'jubileo/compartiendo/updatedAt'),
        Date.now().toString(),
      );
      setList([nuevo, ...list]);
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.list,
          Platform.OS === 'ios' && { paddingBottom: 100 },
        ]}
      >
        {list
          .sort(
            (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
          )
          .map((r) => (
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
                        : { color: scheme === 'dark' ? '#fff' : '#222' },
                    ]}
                  >
                    {r.titulo}
                  </Text>
                ) : null}
                <Text
                  style={
                    r.grupal
                      ? { color: scheme === 'dark' ? '#c0d8a8' : '#333' }
                      : { color: scheme === 'dark' ? '#fff' : '#222' }
                  }
                >
                  {r.contenido}
                </Text>
                <Text
                  style={[
                    { marginTop: 4, fontSize: 12 },
                    r.grupal
                      ? { color: scheme === 'dark' ? '#a0b888' : '#555' }
                      : { color: scheme === 'dark' ? '#aaa' : '#888' },
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

      {Platform.OS === 'ios' ? (
        <GlassFAB
          icon="add"
          onPress={() => setShowForm(true)}
          tintColor="#A3BD31"
          iconColor="#fff"
        />
      ) : (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowForm(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Form modal */}
      <Modal
        visible={showForm}
        onRequestClose={() => setShowForm(false)}
        transparent
        animationType="slide"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowForm(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modal}
            onPress={() => {}}
          >
            <ScrollView>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={addReflexion}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Título (opcional)</Text>
                <TextInput
                  value={titulo}
                  onChangeText={setTitulo}
                  style={styles.input}
                  placeholderTextColor={
                    scheme === 'dark' ? '#888' : '#AAAAAA'
                  }
                />
              </View>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Compartiendo...</Text>
                <TextInput
                  value={contenido}
                  onChangeText={setContenido}
                  multiline
                  numberOfLines={4}
                  style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                  placeholderTextColor={
                    scheme === 'dark' ? '#888' : '#AAAAAA'
                  }
                />
              </View>
              <TouchableOpacity
                onPress={showDatePicker}
                style={styles.dateField}
              >
                <Text style={styles.inputLabel}>Fecha</Text>
                <Text style={styles.dateValue}>{formatFecha(fecha)}</Text>
              </TouchableOpacity>
              <View style={styles.row}>
                <Switch
                  value={grupal}
                  onValueChange={(v) => {
                    setGrupal(v);
                    setTimeout(() => setGrupal(v), 300);
                  }}
                  trackColor={{ true: colors.success }}
                  thumbColor={grupal ? colors.white : undefined}
                />
                <Text style={styles.switchLabel}>Compartiendo en grupo</Text>
              </View>
              {grupal ? (
                <ScrollView horizontal>
                  {grupos.map((g) => (
                    <TouchableOpacity
                      key={g.nombre}
                      onPress={() => setGrupo(g.nombre)}
                      style={[
                        styles.chip,
                        grupo === g.nombre && {
                          backgroundColor: colors.success,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          grupo === g.nombre && { color: colors.white },
                        ]}
                      >
                        {getGrupoLabel(g.nombre)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Tu nombre (opcional)</Text>
                  <TextInput
                    value={autor}
                    onChangeText={setAutor}
                    style={styles.input}
                    placeholderTextColor={
                      scheme === 'dark' ? '#888' : '#AAAAAA'
                    }
                  />
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date selector modal */}
      <Modal
        visible={showDateSelector}
        onRequestClose={() => setShowDateSelector(false)}
        transparent
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateSelector(false)}
        >
          <View style={styles.dateModal}>
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
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Saving modal */}
      <Modal visible={saving} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.savingModal}>
            <ActivityIndicator size="large" color={colors.success} />
            <Text style={styles.savingText}>Enviando...</Text>
          </View>
        </View>
      </Modal>
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
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.success,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-start',
      paddingTop: 60,
    },
    modal: {
      backgroundColor: theme.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
      maxHeight: '80%',
    },
    inputWrapper: { marginBottom: spacing.md },
    inputLabel: {
      fontSize: 12,
      color: colors.success,
      fontWeight: '600',
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#555' : '#ccc',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: theme.text,
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#fff',
    },
    dateField: {
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#555' : '#ccc',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    dateValue: { fontSize: 16, color: theme.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    switchLabel: { marginLeft: spacing.sm, color: theme.text },
    chip: {
      marginRight: spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.success,
      backgroundColor: scheme === 'dark' ? '#2C2C2E' : '#f5f5f5',
    },
    chipText: { color: scheme === 'dark' ? '#ccc' : '#444', fontSize: 13 },
    saveBtn: {
      backgroundColor: colors.success,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    dateModal: {
      backgroundColor: theme.background,
      padding: spacing.md,
      margin: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
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
