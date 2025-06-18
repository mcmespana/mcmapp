import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Card, Text, FAB, Portal, Modal, TextInput, Switch, Button, Chip } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { getDatabase, ref, push, set } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';

interface Grupo { nombre: string; subtitulo?: string; }
interface Reflexion {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
  grupal: boolean;
  grupo?: string;
  autor?: string;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export default function ReflexionesScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const { data: dataRef, loading } = useFirebaseData<Reflexion[]>('jubileo/compartiendo', 'jubileo_compartiendo');
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>('jubileo/grupos', 'jubileo_grupos');

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

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(new Date());
  const [grupal, setGrupal] = useState(false);
  const [grupo, setGrupo] = useState<string | undefined>(undefined);
  const [autor, setAutor] = useState('');
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [saving, setSaving] = useState(false);

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      const { DateTimePickerAndroid } = require('@react-native-community/datetimepicker');
      DateTimePickerAndroid.open({
        value: fecha,
        mode: 'date',
        onChange: (_, selected) => selected && setFecha(selected),
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
    if (!titulo.trim() || !fecha) return;
    setSaving(true);
    const nuevo: Reflexion = {
      id: Date.now().toString(),
      titulo,
      contenido,
      fecha: fecha.toISOString().slice(0, 10),
      grupal,
      ...(grupal ? (grupo ? { grupo } : {}) : { autor }),
    };
    try {
      const db = getDatabase(getFirebaseApp());
      const newRef = push(ref(db, 'jubileo/compartiendo/data'));
      await set(newRef, nuevo);
      await set(ref(db, 'jubileo/compartiendo/updatedAt'), Date.now().toString());
      setList([nuevo, ...list]);
    } catch (e) {
      console.error('Error adding reflection', e);
    }
    setShowForm(false);
    setTitulo('');
    setContenido('');
    setFecha(new Date());
    setGrupal(false);
    setGrupo(undefined);
    setAutor('');
    setSaving(false);
  };

  const getGrupoLabel = (nombre?: string) => {
    if (!nombre) return '';
    const g = grupos.find(gr => gr.nombre === nombre);
    return g ? (g.subtitulo ? `${g.nombre} - ${g.subtitulo}` : g.nombre) : nombre;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        {list.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).map(r => (
          <Card key={r.id} style={[styles.card, r.grupal && styles.cardGroup]}>
            <Card.Title
              title={r.titulo}
              subtitle={`${formatFecha(r.fecha)} - ${r.grupal ? getGrupoLabel(r.grupo) : r.autor || 'Anónimo'}`}
            />
            <Card.Content>
              <Text>{r.contenido}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
      <FAB icon="plus" style={styles.fab} onPress={() => setShowForm(true)} />
      <Portal>
        <Modal
          visible={showForm}
          onDismiss={() => setShowForm(false)}
          contentContainerStyle={styles.modal}
          style={styles.modalWrapper}
        >
          <ScrollView>
            <Button mode="contained" onPress={addReflexion} style={styles.saveBtn}>Guardar</Button>
            <TextInput
              label="Título"
              value={titulo}
              onChangeText={setTitulo}
              style={styles.input}
              theme={{ colors: { primary: colors.success } }}
            />
            <TextInput
              label="Compartiendo..."
              value={contenido}
              onChangeText={setContenido}
              multiline
              numberOfLines={4}
              style={[styles.input, { minHeight: 100 }]}
              theme={{ colors: { primary: colors.success } }}
            />
            <TextInput
              label="Fecha"
              value={formatFecha(fecha)}
              onPressIn={showDatePicker}
              editable={false}
              style={styles.input}
              theme={{ colors: { primary: colors.success } }}
            />
            <View style={styles.row}>
              <Switch
                value={grupal}
                onValueChange={(v) => {
                  setGrupal(v);
                  setTimeout(() => setGrupal(v), 300);
                }}
                color={colors.success}
              />
              <Text style={styles.switchLabel}>Compartiendo en grupo</Text>
            </View>
            {grupal ? (
              <ScrollView horizontal>
                {grupos.map(g => (
                  <Chip
                    key={g.nombre}
                    selected={grupo === g.nombre}
                    onPress={() => setGrupo(g.nombre)}
                    style={[
                      styles.chip,
                      grupo === g.nombre && { backgroundColor: colors.success },
                    ]}
                    selectedColor={grupo === g.nombre ? colors.white : colors.text}
                    theme={{ colors: { secondaryContainer: colors.success } }}
                  >
                    {getGrupoLabel(g.nombre)}
                  </Chip>
                ))}
              </ScrollView>
            ) : (
              <TextInput
                label="Tu nombre (opcional)"
                value={autor}
                onChangeText={setAutor}
                style={styles.input}
                theme={{ colors: { primary: colors.success } }}
              />
            )}
          </ScrollView>
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={showDateSelector}
          onDismiss={() => setShowDateSelector(false)}
          contentContainerStyle={styles.dateModal}
        >
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
        </Modal>
      </Portal>
      <Portal>
        <Modal visible={saving} dismissable={false} contentContainerStyle={styles.savingModal}>
          <ActivityIndicator size="large" color={colors.success} />
          <Text style={styles.savingText}>Enviando...</Text>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    list: { padding: spacing.md },
    card: { marginBottom: spacing.md },
    cardGroup: { backgroundColor: '#E6F4D7' },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: colors.success,
    },
    modal: {
      backgroundColor: theme.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
    },
    modalWrapper: {
      justifyContent: 'flex-start',
    },
    input: { marginBottom: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    switchLabel: { marginLeft: spacing.sm, color: theme.text },
    chip: { marginRight: spacing.sm },
    saveBtn: { marginTop: spacing.md, marginBottom: spacing.md },
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
