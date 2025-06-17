import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Text, FAB, Portal, Modal, TextInput, Switch, Button, Chip } from 'react-native-paper';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import DateSelector, { DateOption } from '@/components/DateSelector';

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

export default function ReflexionesScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const { data: dataRef, loading } = useFirebaseData<Reflexion[]>('jubileo/reflexiones', 'jubileo_reflexiones');
  const { data: gruposData } = useFirebaseData<Record<string, Grupo[]>>('jubileo/grupos', 'jubileo_grupos');

  const grupos = gruposData?.['Conso+'] ?? [];

  const [list, setList] = useState<Reflexion[]>([]);

  useEffect(() => { if (dataRef) setList(dataRef); }, [dataRef]);

  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0,10));
  const [grupal, setGrupal] = useState(false);
  const [grupo, setGrupo] = useState<string | undefined>(undefined);
  const [autor, setAutor] = useState('');

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const dates: DateOption[] = Array.from(new Set(list.map(r => r.fecha)))
    .sort((a,b) => new Date(a).getTime() - new Date(b).getTime())
    .map(f => ({ fecha: f }));

  let filtered = [...list];
  if (selectedDate) filtered = filtered.filter(r => r.fecha === selectedDate);
  if (selectedGroups.length) filtered = filtered.filter(r => r.grupal && r.grupo && selectedGroups.includes(r.grupo));
  filtered.sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const toggleGroupFilter = (name: string) => {
    setSelectedGroups(g => g.includes(name) ? g.filter(n => n !== name) : [...g, name]);
  };

  const addReflexion = () => {
    const nuevo: Reflexion = {
      id: Date.now().toString(),
      titulo,
      contenido,
      fecha,
      grupal,
      grupo: grupal ? grupo : undefined,
      autor: grupal ? undefined : autor,
    };
    setList([nuevo, ...list]);
    setShowForm(false);
    setTitulo('');
    setContenido('');
    setFecha(new Date().toISOString().slice(0,10));
    setGrupal(false);
    setGrupo(undefined);
    setAutor('');
  };

  const getGrupoLabel = (nombre?: string) => {
    if (!nombre) return '';
    const g = grupos.find(gr => gr.nombre === nombre);
    return g ? (g.subtitulo ? `${g.nombre} - ${g.subtitulo}` : g.nombre) : nombre;
  };

  return (
    <View style={styles.container}>
      {dates.length > 0 && (
        <DateSelector dates={dates} selectedDate={selectedDate ?? ''} onSelectDate={(d) => setSelectedDate(d)} />
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {grupos.map(g => (
          <Chip
            key={g.nombre}
            selected={selectedGroups.includes(g.nombre)}
            onPress={() => toggleGroupFilter(g.nombre)}
            style={styles.chip}
          >
            {getGrupoLabel(g.nombre)}
          </Chip>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.list}>
        {filtered.map(r => (
          <Card key={r.id} style={[styles.card, r.grupal && styles.cardGroup]}>
            <Card.Title
              title={r.titulo}
              subtitle={`${r.fecha} - ${r.grupal ? getGrupoLabel(r.grupo) : r.autor}`}
            />
            <Card.Content>
              <Text>{r.contenido}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
      <FAB icon="plus" style={styles.fab} onPress={() => setShowForm(true)} />
      <Portal>
        <Modal visible={showForm} onDismiss={() => setShowForm(false)} contentContainerStyle={styles.modal}>
          <ScrollView>
            <TextInput label="Título" value={titulo} onChangeText={setTitulo} style={styles.input} />
            <TextInput label="Reflexión" value={contenido} onChangeText={setContenido} multiline style={styles.input} />
            <TextInput label="Fecha" value={fecha} onChangeText={setFecha} style={styles.input} />
            <View style={styles.row}>
              <Switch value={grupal} onValueChange={setGrupal} />
              <Text style={styles.switchLabel}>Reflexión grupal</Text>
            </View>
            {grupal ? (
              <ScrollView horizontal>
                {grupos.map(g => (
                  <Chip
                    key={g.nombre}
                    selected={grupo === g.nombre}
                    onPress={() => setGrupo(g.nombre)}
                    style={styles.chip}
                  >
                    {getGrupoLabel(g.nombre)}
                  </Chip>
                ))}
              </ScrollView>
            ) : (
              <TextInput label="Tu nombre" value={autor} onChangeText={setAutor} style={styles.input} />
            )}
            <Button mode="contained" onPress={addReflexion} style={styles.saveBtn}>Guardar</Button>
          </ScrollView>
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
    cardGroup: { backgroundColor: '#E8F5E9' },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 16,
      backgroundColor: colors.accent,
    },
    modal: {
      backgroundColor: theme.background,
      margin: 20,
      padding: 20,
      borderRadius: 8,
    },
    input: { marginBottom: spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    switchLabel: { marginLeft: spacing.sm, color: theme.text },
    chips: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    chip: { marginRight: spacing.sm },
    saveBtn: { marginTop: spacing.md },
  });
};
