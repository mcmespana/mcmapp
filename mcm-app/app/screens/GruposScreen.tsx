import React, { useState, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Linking,
  Platform,
  Text,
  TextInput,
  Pressable,
  SectionList,
  FlatList,
  ScrollView,
} from 'react-native';
import { Button, PressableFeedback, Skeleton } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import ScreenHero from '@/components/ui/ScreenHero';
import PageContainer from '@/components/ui/PageContainer';
import ComingSoon from '@/components/ui/ComingSoon';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useCurrentEvent } from '@/hooks/useCurrentEvent';
import { getEventCacheKey, getEventFirebasePath } from '@/constants/events';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { h } from '@/utils/haptics';

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const CATEGORY_CONFIG: Record<
  string,
  { icon: MaterialIconName; color: string }
> = {
  Movilidad: { icon: 'directions-walk', color: colors.info },
  'Conso+': { icon: 'shopping-cart', color: colors.success },
  Autobuses: { icon: 'directions-bus', color: colors.warning },
  Alojamiento: { icon: 'home', color: colors.accent },
};

interface Grupo {
  nombre: string;
  responsable?: string;
  miembros?: string[];
  subtitulo?: string;
  mapa?: string;
}

type Data = Record<string, Grupo[]>;

interface SearchHit {
  categoria: string;
  grupo: Grupo;
  /** member string (or responsable). Empty when the match is the group name. */
  miembro?: string;
  /** true if the match was on the responsable. */
  isResponsable?: boolean;
  /** true if the match was on the group name itself. */
  isGroupName?: boolean;
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function highlightText(
  text: string,
  query: string,
  styles: ReturnType<typeof createStyles>,
) {
  if (!query) return <Text style={styles.hitText}>{text}</Text>;
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return <Text style={styles.hitText}>{text}</Text>;
  return (
    <Text style={styles.hitText}>
      {text.substring(0, idx)}
      <Text style={styles.hitTextMatch}>
        {text.substring(idx, idx + query.length)}
      </Text>
      {text.substring(idx + query.length)}
    </Text>
  );
}

export default function GruposScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const event = useCurrentEvent();
  const { profile } = useUserProfile();
  const myName = (profile?.name || '').trim();
  const { data: gruposData, loading } = useFirebaseData<Data>(
    getEventFirebasePath(event, 'grupos'),
    getEventCacheKey(event, 'grupos'),
  );
  const data = gruposData as Data | undefined;
  const hasGroups =
    !!data &&
    Object.values(data).some((arr) => Array.isArray(arr) && arr.length > 0);

  // Categorías ocultas para este evento (ej. Visita Papa esconde "Alojamiento").
  const hiddenCats = useMemo(
    () => new Set((event.hiddenGroupCategories ?? []).map(normalize)),
    [event],
  );
  const isHiddenCat = useCallback(
    (cat: string) => hiddenCats.has(normalize(cat)),
    [hiddenCats],
  );

  const categorias = useMemo(() => {
    const base = Object.keys(CATEGORY_CONFIG)
      .filter((name) => !hiddenCats.has(normalize(name)))
      .map((name) => ({
        name,
        icon: CATEGORY_CONFIG[name].icon,
        color: CATEGORY_CONFIG[name].color,
        count: data?.[name]?.length ?? 0,
      }));
    if (data) {
      Object.keys(data).forEach((cat) => {
        if (!CATEGORY_CONFIG[cat] && !hiddenCats.has(normalize(cat))) {
          base.push({
            name: cat,
            icon: 'group' as MaterialIconName,
            color: colors.primary,
            count: data[cat]?.length ?? 0,
          });
        }
      });
    }
    return base;
  }, [data, hiddenCats]);

  const [categoria, setCategoria] = useState<string | null>(null);
  const [grupo, setGrupo] = useState<Grupo | null>(null);
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('');

  const isSearching = search.trim().length >= 2;

  const openMap = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  // ⚡ Bolt Optimization: Precompute normalized strings for all groups and members
  // to avoid running expensive normalize() operations on every keystroke during live search.
  const normalizedData = useMemo(() => {
    if (!data) return {};
    const result: Record<
      string,
      (Grupo & {
        _nNombre: string;
        _nResponsable: string;
        _nMiembros: string[];
      })[]
    > = {};

    Object.entries(data).forEach(([cat, grupos]) => {
      if (!Array.isArray(grupos)) return;
      if (isHiddenCat(cat)) return;
      result[cat] = grupos.map((g) => ({
        ...g,
        _nNombre: g?.nombre ? normalize(g.nombre) : '',
        _nResponsable: g?.responsable ? normalize(g.responsable) : '',
        _nMiembros: Array.isArray(g?.miembros)
          ? g.miembros.map((m) =>
              m && typeof m === 'string' ? normalize(m) : '',
            )
          : [],
      }));
    });
    return result;
  }, [data, isHiddenCat]);

  // Build search sections (FlatList-friendly SectionList sections grouped by category)
  const searchSections = useMemo(() => {
    if (!normalizedData || !isSearching) return [];
    const q = normalize(search.trim());
    const byCat: Record<string, SearchHit[]> = {};
    Object.entries(normalizedData).forEach(([cat, grupos]) => {
      grupos.forEach((g) => {
        if (!g) return;
        const hits: SearchHit[] = [];
        if (g._nNombre.includes(q)) {
          hits.push({ categoria: cat, grupo: g, isGroupName: true });
        }
        if (g._nResponsable.includes(q)) {
          hits.push({
            categoria: cat,
            grupo: g,
            miembro: g.responsable,
            isResponsable: true,
          });
        }
        if (Array.isArray(g._nMiembros)) {
          g._nMiembros.forEach((nm, idx) => {
            if (nm.includes(q)) {
              hits.push({
                categoria: cat,
                grupo: g,
                miembro: g.miembros?.[idx],
              });
            }
          });
        }
        if (hits.length > 0) {
          if (!byCat[cat]) byCat[cat] = [];
          byCat[cat].push(...hits);
        }
      });
    });
    return Object.entries(byCat).map(([title, items]) => ({
      title,
      data: items,
    }));
  }, [search, normalizedData, isSearching]);

  const totalSearchHits = useMemo(
    () => searchSections.reduce((acc, s) => acc + s.data.length, 0),
    [searchSections],
  );

  // ─── Filtered members for group detail view ───
  const normalizedGroupMembers = useMemo(() => {
    if (!grupo?.miembros) return [];
    return grupo.miembros
      .filter((m): m is string => typeof m === 'string' && m.length > 0)
      .map((m) => ({ original: m, normalized: normalize(m) }));
  }, [grupo]);

  const filteredMiembros = useMemo(() => {
    if (!normalizedGroupMembers.length) return [];
    const q = memberFilter.trim();
    if (q.length === 0) return normalizedGroupMembers.map((m) => m.original);
    const nq = normalize(q);
    return normalizedGroupMembers
      .filter((m) => m.normalized.includes(nq))
      .map((m) => m.original);
  }, [normalizedGroupMembers, memberFilter]);

  const goBackFromGroup = useCallback(() => {
    setGrupo(null);
    setMemberFilter('');
  }, []);

  // "Encuéntrame": búsqueda amplia = nombre + la 1ª letra del apellido.
  // Así "Izan Rivera" → "Izan R", que casa con "Izan Riv.", "Izan Ri.", etc.
  const findMeQuery = useMemo(() => {
    if (!myName) return '';
    const parts = myName.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0];
    const surnameStart = parts[1] ? parts[1].slice(0, 1) : '';
    return surnameStart ? `${first} ${surnameStart}` : first;
  }, [myName]);

  const findMe = useCallback(() => {
    if (!findMeQuery) return;
    h.tap();
    setSearch(findMeQuery);
  }, [findMeQuery]);

  // ──────────────────────────────────────────────────────────
  // 0) EMPTY STATE — sin grupos en Firebase (y ya no estamos cargando)
  // ──────────────────────────────────────────────────────────
  if (!hasGroups && !loading) {
    return (
      <PageContainer>
        <View style={styles.container}>
          <ScreenHero title="Grupos" hideOnWeb floatingHeaderInset />
          <ComingSoon accentColor={event.tintColor} />
        </View>
      </PageContainer>
    );
  }

  // ──────────────────────────────────────────────────────────
  // 1) GROUP DETAIL VIEW (highest priority)
  // ──────────────────────────────────────────────────────────
  if (grupo) {
    const ListHeader = (
      <View style={styles.groupContainer}>
        {grupo.subtitulo ? (
          <View style={styles.quoteContainer}>
            <View style={styles.quoteBorder} />
            <Text style={styles.quoteText}>{grupo.subtitulo}</Text>
          </View>
        ) : null}

        {grupo.mapa ? (
          <Button
            variant="secondary"
            onPress={() => openMap(grupo.mapa)}
            className="my-3"
          >
            <Button.Label>📍 Ubicación</Button.Label>
          </Button>
        ) : null}

        {grupo.responsable ? (
          <>
            <Text style={styles.sectionHeader}>Acompaña…</Text>
            <View
              style={[
                styles.memberRow,
                isMe(grupo.responsable, myName) && styles.memberRowMe,
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text
                style={[
                  styles.memberText,
                  isMe(grupo.responsable, myName) && styles.memberTextMe,
                ]}
              >
                {grupo.responsable}
              </Text>
              {isMe(grupo.responsable, myName) ? (
                <Text style={styles.youBadge}>tú</Text>
              ) : null}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionHeader}>
          Forman parte… ({grupo.miembros?.length || 0})
        </Text>

        {grupo.miembros && grupo.miembros.length > 8 ? (
          <View style={styles.inlineSearch}>
            <SearchBar
              value={memberFilter}
              onChangeText={setMemberFilter}
              placeholder="Filtrar en este grupo"
              styles={styles}
              isDark={isDark}
            />
            {memberFilter.length > 0 ? (
              <Text style={styles.filterCount}>
                {filteredMiembros.length} de {grupo.miembros.length}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );

    return (
      <PageContainer>
        <View style={styles.container}>
          <ScreenHero
            title={grupo.nombre}
            kicker={categoria ?? undefined}
            left={
              <Pressable
                onPress={goBackFromGroup}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Volver"
              >
                <MaterialIcons name="arrow-back" size={24} color="#888" />
              </Pressable>
            }
          />
          <FlatList
            data={filteredMiembros}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => (
              <MemberRow name={item} myName={myName} styles={styles} />
            )}
            ListHeaderComponent={ListHeader}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              Platform.OS === 'ios'
                ? { paddingBottom: 100 }
                : { paddingBottom: 24 }
            }
            ListEmptyComponent={
              memberFilter.length > 0 ? (
                <Text style={styles.emptyInline}>
                  Nadie coincide con &quot;{memberFilter}&quot; en este grupo.
                </Text>
              ) : null
            }
            initialNumToRender={20}
            windowSize={11}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
        </View>
      </PageContainer>
    );
  }

  // ──────────────────────────────────────────────────────────
  // 2) CATEGORY DETAIL VIEW (list of groups inside a category)
  // ──────────────────────────────────────────────────────────
  if (categoria && !isSearching) {
    const groupsInCat = data?.[categoria] || [];
    return (
      <PageContainer>
        <View style={styles.container}>
          <ScreenHero
            title={categoria}
            left={
              <Pressable
                onPress={() => setCategoria(null)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Volver a categorías"
              >
                <MaterialIcons name="arrow-back" size={24} color="#888" />
              </Pressable>
            }
          />
          {!data ? (
            <View style={{ paddingHorizontal: 16, gap: spacing.md }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  style={{ height: 56, borderRadius: radii.lg }}
                />
              ))}
            </View>
          ) : (
            <FlatList
              data={groupsInCat}
              keyExtractor={(g, idx) => `${g.nombre}-${idx}`}
              renderItem={({ item }) => (
                <GrupoCard
                  grupo={item}
                  myName={myName}
                  styles={styles}
                  onPress={() => setGrupo(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              initialNumToRender={12}
              windowSize={9}
              removeClippedSubviews={Platform.OS !== 'web'}
            />
          )}
        </View>
      </PageContainer>
    );
  }

  // ──────────────────────────────────────────────────────────
  // 3) MAIN VIEW: categories + search (with optional results)
  // ──────────────────────────────────────────────────────────

  // Persistent top bar — stays mounted whether or not we're searching, so the
  // search input never unmounts (which previously dropped focus / dismissed the
  // keyboard when crossing the 2-char search threshold). Only the content area
  // below swaps between the categories grid and the results list.
  const topBar = (
    <View>
      <ScreenHero title="Grupos" hideOnWeb floatingHeaderInset />
      <View style={styles.searchContainer}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar grupo o persona"
          styles={styles}
          isDark={isDark}
          autoCapitalize="words"
        />
        {myName ? (
          <Pressable
            onPress={findMe}
            style={styles.findMeBtn}
            accessibilityRole="button"
            accessibilityLabel={`Encontrarme: ${myName}`}
          >
            <MaterialIcons
              name="person-search"
              size={20}
              color={colors.white}
            />
            <Text style={styles.findMeText}>Encuéntrame</Text>
          </Pressable>
        ) : null}
      </View>
      {isSearching ? (
        <Text style={styles.resultsMeta}>
          {totalSearchHits === 0
            ? 'Sin resultados'
            : `${totalSearchHits} resultado${totalSearchHits === 1 ? '' : 's'}`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <PageContainer>
      <View style={styles.container}>
        {topBar}
        {isSearching ? (
          <SectionList<SearchHit>
            style={styles.flexList}
            sections={searchSections}
            keyExtractor={(item, idx) =>
              `${item.categoria}-${item.grupo.nombre}-${item.miembro ?? '__name__'}-${idx}`
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            renderSectionHeader={({ section }) => (
              <View style={styles.searchSectionHeader}>
                <Text style={styles.searchSectionHeaderText}>
                  {section.title}
                </Text>
                <Text style={styles.searchSectionCount}>
                  {section.data.length}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <SearchHitRow
                hit={item}
                query={search.trim()}
                myName={myName}
                styles={styles}
                onPress={() => {
                  setCategoria(item.categoria);
                  setGrupo(item.grupo);
                }}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons name="search-off" size={48} color="#999" />
                <Text style={styles.emptyText}>
                  No he encontrado nada, ya lo siento 😔
                </Text>
                <Text style={styles.emptyHint}>
                  Prueba con otro nombre o apellido.
                </Text>
              </View>
            }
            stickySectionHeadersEnabled
            contentContainerStyle={
              Platform.OS === 'ios'
                ? { paddingBottom: 100 }
                : { paddingBottom: 24 }
            }
            initialNumToRender={20}
            windowSize={11}
            removeClippedSubviews={Platform.OS !== 'web'}
          />
        ) : !data ? (
          <View style={{ paddingHorizontal: 16, gap: spacing.md }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                style={{ height: 120, borderRadius: radii.lg }}
              />
            ))}
          </View>
        ) : (
          <ScrollView
            style={styles.flexList}
            contentContainerStyle={styles.catScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.catList}>
              {categorias.map((c) => (
                <PressableFeedback
                  key={c.name}
                  style={[styles.catCard, { backgroundColor: c.color }]}
                  onPress={() => setCategoria(c.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir categoría ${c.name}`}
                >
                  <PressableFeedback.Highlight />
                  <MaterialIcons
                    name={c.icon}
                    size={40}
                    color={colors.white}
                    style={styles.catIcon}
                  />
                  <Text style={styles.catLabel}>{c.name}</Text>
                  {c.count > 0 ? (
                    <Text style={styles.catCount}>
                      {c.count} grupo{c.count === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </PressableFeedback>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </PageContainer>
  );
}

// ──────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────

function isMe(name: string | undefined | null, myName: string) {
  if (!name || !myName) return false;
  return normalize(name).includes(normalize(myName));
}

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
  isDark: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}

// Barra de búsqueda propia (TextInput) en vez del SearchField de heroui:
// garantiza texto blanco legible en modo oscuro y un alto cómodo idéntico en
// iOS y Android.
function SearchBar({
  value,
  onChangeText,
  placeholder,
  styles,
  isDark,
  autoCapitalize = 'none',
}: SearchBarProps) {
  const iconColor = isDark ? '#C5C5C7' : '#8E8E93';
  return (
    <View style={styles.searchBar}>
      <MaterialIcons name="search" size={22} color={iconColor} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#8E8E93' : '#A0A0A8'}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        underlineColorAndroid="transparent"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
        >
          <MaterialIcons name="cancel" size={20} color={iconColor} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface MemberRowProps {
  name: string;
  myName: string;
  styles: ReturnType<typeof createStyles>;
}

const MemberRow = React.memo(function MemberRow({
  name,
  myName,
  styles,
}: MemberRowProps) {
  const me = isMe(name, myName);
  return (
    <View style={[styles.memberRow, me && styles.memberRowMe]}>
      <View
        style={[
          styles.dot,
          { backgroundColor: me ? colors.accent : '#C0C0C8' },
        ]}
      />
      <Text
        style={[styles.memberText, me && styles.memberTextMe]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {me ? <Text style={styles.youBadge}>tú</Text> : null}
    </View>
  );
});

interface GrupoCardProps {
  grupo: Grupo;
  myName: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

const GrupoCard = React.memo(function GrupoCard({
  grupo,
  myName,
  styles,
  onPress,
}: GrupoCardProps) {
  // Quick check: is "me" in this group? (only matters if a name is set)
  const meIn = useMemo(() => {
    if (!myName) return false;
    if (isMe(grupo.responsable, myName)) return true;
    return (grupo.miembros || []).some((m) => isMe(m, myName));
  }, [grupo, myName]);
  const count = grupo.miembros?.length || 0;
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.grupoCard, meIn && styles.grupoCardMe]}
      accessibilityRole="button"
      accessibilityLabel={`Abrir grupo ${grupo.nombre}`}
    >
      <PressableFeedback.Highlight />
      <View style={styles.grupoCardMain}>
        <Text style={styles.grupoCardTitle} numberOfLines={1}>
          {grupo.nombre}
        </Text>
        {grupo.subtitulo ? (
          <Text style={styles.grupoCardSubtitle} numberOfLines={1}>
            {grupo.subtitulo}
          </Text>
        ) : null}
        <View style={styles.grupoCardMetaRow}>
          {grupo.responsable ? (
            <Text style={styles.grupoCardMeta} numberOfLines={1}>
              <MaterialIcons name="person" size={12} /> {grupo.responsable}
            </Text>
          ) : null}
          <Text style={styles.grupoCardMeta}>
            <MaterialIcons name="group" size={12} /> {count}
          </Text>
        </View>
      </View>
      {meIn ? <Text style={styles.youBadge}>tú</Text> : null}
      <MaterialIcons name="chevron-right" size={22} color="#999" />
    </PressableFeedback>
  );
});

interface SearchHitRowProps {
  hit: SearchHit;
  query: string;
  myName: string;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
}

const SearchHitRow = React.memo(function SearchHitRow({
  hit,
  query,
  myName,
  styles,
  onPress,
}: SearchHitRowProps) {
  const me = !!hit.miembro && isMe(hit.miembro, myName);
  return (
    <PressableFeedback
      onPress={onPress}
      style={[styles.hitRow, me && styles.hitRowMe]}
      accessibilityRole="button"
    >
      <PressableFeedback.Highlight />
      <View style={styles.hitLeft}>
        <MaterialIcons
          name={
            hit.isGroupName ? 'group' : hit.isResponsable ? 'badge' : 'person'
          }
          size={18}
          color={me ? colors.accent : '#888'}
        />
      </View>
      <View style={styles.hitBody}>
        {hit.isGroupName ? (
          <>
            {highlightText(hit.grupo.nombre, query, styles)}
            {hit.grupo.subtitulo ? (
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.grupo.subtitulo}
              </Text>
            ) : null}
          </>
        ) : (
          <>
            {highlightText(hit.miembro || '', query, styles)}
            <Text style={styles.hitMeta} numberOfLines={1}>
              {hit.isResponsable ? 'Acompaña a ' : 'En '}
              {hit.grupo.nombre}
            </Text>
          </>
        )}
      </View>
      {me ? <Text style={styles.youBadge}>tú</Text> : null}
      <MaterialIcons name="chevron-right" size={20} color="#bbb" />
    </PressableFeedback>
  );
});

// ──────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    catScrollContent: {
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },
    listContent: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
      gap: 10,
    },
    catList: {
      padding: 16,
      gap: 14,
    },
    catCard: {
      height: 120,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    catIcon: { marginBottom: 4 },
    catLabel: { fontSize: 18, fontWeight: 'bold', color: colors.white },
    catCount: {
      marginTop: 2,
      fontSize: 12,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600',
    },
    sectionHeader: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text,
      paddingHorizontal: 4,
      paddingTop: 16,
      paddingBottom: 8,
    },
    groupContainer: { paddingHorizontal: 16 },
    iconBtn: {
      padding: 8,
      borderRadius: 20,
    },
    searchContainer: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      gap: 10,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 52,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark ? '#48484A' : '#E0E0E5',
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    flexList: {
      flex: 1,
    },
    findMeBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: radii.pill,
      ...Platform.select({
        web: { boxShadow: '0 2px 8px rgba(37,56,131,0.35)' },
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 5,
          elevation: 3,
        },
      }),
    },
    findMeText: {
      color: colors.white,
      fontSize: 15,
      fontWeight: '700',
    },
    resultsMeta: {
      paddingHorizontal: 18,
      paddingBottom: 6,
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      fontWeight: '500',
    },
    searchSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 6,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    searchSectionHeaderText: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F5F5F7' : '#1C1C1E',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    searchSectionCount: {
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      fontWeight: '600',
    },
    hitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#3A3A3C' : '#E5E5EA',
      gap: 12,
    },
    hitRowMe: {
      backgroundColor: isDark ? 'rgba(225,92,98,0.12)' : 'rgba(225,92,98,0.07)',
    },
    hitLeft: {
      width: 28,
      alignItems: 'center',
    },
    hitBody: { flex: 1, minWidth: 0 },
    hitText: {
      fontSize: 15,
      color: theme.text,
      fontWeight: '500',
    },
    hitTextMatch: {
      backgroundColor: isDark
        ? 'rgba(244,193,30,0.30)'
        : 'rgba(244,193,30,0.45)',
      fontWeight: '700',
    },
    hitMeta: {
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginTop: 2,
    },
    grupoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: radii.lg,
      backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
      gap: 10,
      ...Platform.select({
        web: {
          boxShadow: isDark
            ? '0 2px 6px rgba(0,0,0,0.3)'
            : '0 2px 6px rgba(0,0,0,0.05)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDark ? 0.25 : 0.05,
          shadowRadius: 4,
          elevation: 1,
        },
      }),
    },
    grupoCardMe: {
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    grupoCardMain: { flex: 1, minWidth: 0 },
    grupoCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
    },
    grupoCardSubtitle: {
      fontSize: 13,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      marginTop: 2,
    },
    grupoCardMetaRow: {
      flexDirection: 'row',
      gap: 14,
      marginTop: 6,
      flexWrap: 'wrap',
    },
    grupoCardMeta: {
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDark ? '#3A3A3C' : '#E5E5EA',
      gap: 12,
    },
    memberRowMe: {
      backgroundColor: isDark ? 'rgba(225,92,98,0.12)' : 'rgba(225,92,98,0.07)',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    memberText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
    },
    memberTextMe: {
      fontWeight: '700',
    },
    youBadge: {
      backgroundColor: colors.accent,
      color: colors.white,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.pill,
      overflow: 'hidden',
      textTransform: 'lowercase',
    },
    quoteContainer: {
      flexDirection: 'row',
      marginVertical: 12,
      marginHorizontal: 4,
    },
    quoteBorder: {
      width: 4,
      backgroundColor: colors.info,
      borderRadius: 2,
      marginRight: 12,
    },
    quoteText: {
      flex: 1,
      fontSize: 16,
      fontStyle: 'italic',
      color: isDark ? '#CCCCCC' : '#666',
      lineHeight: 22,
      paddingVertical: 8,
    },
    inlineSearch: {
      marginTop: 4,
      marginBottom: 4,
      gap: 4,
    },
    filterCount: {
      fontSize: 12,
      color: isDark ? '#A0A0A8' : '#6B6B70',
      paddingHorizontal: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      gap: 8,
    },
    emptyText: {
      fontSize: 16,
      color: isDark ? '#CCCCCC' : '#666',
      textAlign: 'center',
      fontWeight: '500',
    },
    emptyHint: {
      fontSize: 13,
      color: isDark ? '#A0A0A8' : '#888',
      fontStyle: 'italic',
      textAlign: 'center',
    },
    emptyInline: {
      paddingHorizontal: 16,
      paddingVertical: 24,
      textAlign: 'center',
      color: isDark ? '#A0A0A8' : '#6B6B70',
      fontStyle: 'italic',
    },
  });
};
