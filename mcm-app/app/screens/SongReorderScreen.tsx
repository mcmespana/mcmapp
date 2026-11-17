/**
 * Reordenar las canciones de una categoría (solo administradores). Se elige
 * la categoría, se arrastran las filas (o se usan las flechas) y «Guardar»
 * manda el orden al admin del cantoral, que renumera los `.cho`.
 *
 * Necesita el cantoral conectado: un orden a medias no se guarda en el móvil.
 */
import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, {
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useToast } from '@/contexts/AppToastContext';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { reorderCategory } from '@/services/songEditorService';
import { cantoralHeaderTint } from '@/utils/cantoralHeader';
import type { SongsData } from '@/utils/filterSongsData';
import { h } from '@/utils/haptics';
import {
  cleanSongTitle,
  extractTrailingEmoji,
  stripCategoryPrefix,
} from '@/utils/songUtils';

interface Row {
  filename: string;
  title: string;
}

const isWeb = Platform.OS === 'web';

export default function SongReorderScreen() {
  const navigation = useNavigation();
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const admin = useAdminStatus();
  const { data } = useFirebaseData<SongsData>('songs', 'songs');

  const categories = useMemo(
    () =>
      Object.keys(data ?? {})
        .sort()
        .map((key) => ({
          key,
          name: extractTrailingEmoji(
            stripCategoryPrefix(data?.[key]?.categoryTitle || key),
          ).cleanText,
        })),
    [data],
  );
  const [category, setCategory] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const pick = (key: string) => {
    h.select();
    setCategory(key);
    setDirty(false);
    setRows(
      (data?.[key]?.songs ?? [])
        .filter((s) => !!s?.filename)
        .map((s) => ({
          filename: s.filename as string,
          title: cleanSongTitle(s.title || (s.filename as string)),
        })),
    );
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = rows.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    h.select();
    setRows(next);
    setDirty(true);
  };

  const save = async () => {
    if (!category || !dirty || saving) return;
    setSaving(true);
    try {
      const res = await reorderCategory(
        category,
        rows.map((r) => r.filename),
      );
      h.formSuccess();
      toast.show({
        variant: 'success',
        label: res.pushed
          ? 'Orden enviado al cantoral. Se verá al volver a abrir la app, en un par de minutos'
          : 'Orden guardado en el cantoral. Aún no ha podido subirlo',
      });
      router.back();
    } catch (e) {
      toast.show({
        variant: 'danger',
        label: e instanceof Error ? e.message : 'No se ha podido guardar',
      });
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    const tint = cantoralHeaderTint(isDark);
    navigation.setOptions({
      title: 'Ordenar canciones',
      headerLeft: () => (
        <PressableFeedback
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <MaterialIcons name="close" size={24} color={tint} />
        </PressableFeedback>
      ),
      headerRight: () =>
        saving ? (
          <ActivityIndicator color={tint} />
        ) : (
          <PressableFeedback
            onPress={() => void save()}
            isDisabled={!dirty}
            hitSlop={10}
            style={[styles.headerBtn, !dirty && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="Guardar el orden"
          >
            <Text style={[styles.headerSave, { color: tint }]}>Guardar</Text>
          </PressableFeedback>
        ),
    });
    // `save` lee el estado de este render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, isDark, dirty, saving, rows, category]);

  if (!admin.loading && !admin.isAdmin) {
    return (
      <EmptyState
        icon="lock"
        title="Solo para quien cuida el cantoral"
        subtitle="Para ordenar canciones hace falta una cuenta de administrador."
      />
    );
  }

  const header = (
    <View style={styles.header}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cats}
      >
        {categories.map((c) => {
          const on = c.key === category;
          return (
            <PressableFeedback
              key={c.key}
              onPress={() => pick(c.key)}
              isDisabled={dirty && !on}
              style={[
                styles.cat,
                { backgroundColor: on ? theme.link : theme.backgroundSunken },
                dirty && !on && styles.disabled,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text
                style={[
                  styles.catText,
                  { color: on ? theme.background : theme.text },
                ]}
              >
                {c.name}
              </Text>
            </PressableFeedback>
          );
        })}
      </ScrollView>
      {category ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {isWeb
            ? 'Usa las flechas para mover una canción.'
            : 'Mantén pulsada una canción y arrástrala, o usa las flechas.'}{' '}
          Al guardar cambian los números de la categoría.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Elige una categoría.
        </Text>
      )}
    </View>
  );

  const renderRow = ({ item, index }: { item: Row; index: number }) => (
    <ReorderRow
      row={item}
      index={index}
      last={index === rows.length - 1}
      onMove={move}
      isDark={isDark}
    />
  );
  const listProps = {
    data: rows,
    keyExtractor: (r: Row) => r.filename,
    ListHeaderComponent: header,
    contentContainerStyle: { paddingBottom: insets.bottom + spacing.xl },
    style: { backgroundColor: theme.background },
  };

  // Sin canciones no se monta la lista arrastrable: solo el selector.
  if (rows.length === 0) {
    return (
      <ScrollView style={{ backgroundColor: theme.background }}>
        {header}
      </ScrollView>
    );
  }

  return isWeb ? (
    <FlatList {...listProps} renderItem={renderRow} />
  ) : (
    <ReorderableList
      {...listProps}
      renderItem={(info) => <DraggableRow>{renderRow(info)}</DraggableRow>}
      onReorder={({ from, to }: ReorderableListReorderEvent) => move(from, to)}
    />
  );
}

const DragContext = React.createContext<(() => void) | undefined>(undefined);

function DraggableRow({ children }: { children: React.ReactNode }) {
  const drag = useReorderableDrag();
  return <DragContext.Provider value={drag}>{children}</DragContext.Provider>;
}

function ReorderRow({
  row,
  index,
  last,
  onMove,
  isDark,
}: {
  row: Row;
  index: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
  isDark: boolean;
}) {
  const theme = themeColors(isDark);
  const drag = React.useContext(DragContext);
  return (
    <PressableFeedback
      onLongPress={
        drag
          ? () => {
              h.select();
              drag();
            }
          : undefined
      }
      delayLongPress={250}
      style={[
        styles.row,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.separator,
        },
      ]}
      accessibilityLabel={`${index + 1}. ${row.title}`}
    >
      <Text style={[styles.number, { color: theme.textSecondary }]}>
        {index + 1}
      </Text>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
        {row.title}
      </Text>
      <PressableFeedback
        onPress={() => onMove(index, index - 1)}
        isDisabled={index === 0}
        style={[styles.arrow, index === 0 && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={`Subir ${row.title}`}
      >
        <MaterialIcons name="keyboard-arrow-up" size={24} color={theme.link} />
      </PressableFeedback>
      <PressableFeedback
        onPress={() => onMove(index, index + 1)}
        isDisabled={last}
        style={[styles.arrow, last && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={`Bajar ${row.title}`}
      >
        <MaterialIcons
          name="keyboard-arrow-down"
          size={24}
          color={theme.link}
        />
      </PressableFeedback>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  headerBtn: { padding: spacing.xs },
  headerSave: { ...typography.title, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  header: { paddingVertical: spacing.md, gap: spacing.sm },
  cats: { paddingHorizontal: spacing.md, gap: spacing.sm },
  cat: {
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    justifyContent: 'center',
  },
  catText: { ...typography.caption, fontWeight: '600' },
  hint: { ...typography.caption, paddingHorizontal: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  number: {
    ...typography.subhead,
    width: 28,
    fontVariant: ['tabular-nums'],
  },
  title: { ...typography.body, flex: 1 },
  arrow: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
