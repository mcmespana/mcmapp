import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Linking,
  Platform,
  Text,
  Pressable,
  SectionList,
  FlatList,
  ScrollView,
} from 'react-native';
import { Button, PressableFeedback, Skeleton } from 'heroui-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import colors from '@/constants/colors';
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
import {
  normalize,
  isMe,
  type MaterialIconName,
  type Grupo,
  type Data,
  type SearchHit,
} from '@/components/grupos/gruposHelpers';
import { createStyles } from '@/components/grupos/gruposStyles';
import SearchBar from '@/components/grupos/SearchBar';
import MemberRow from '@/components/grupos/MemberRow';
import GrupoCard from '@/components/grupos/GrupoCard';
import SearchHitRow from '@/components/grupos/SearchHitRow';

const CATEGORY_CONFIG: Record<
  string,
  { icon: MaterialIconName; color: string }
> = {
  Movilidad: { icon: 'directions-walk', color: colors.info },
  'Conso+': { icon: 'shopping-cart', color: colors.success },
  Autobuses: { icon: 'directions-bus', color: colors.warning },
  Alojamiento: { icon: 'home', color: colors.accent },
};

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

  const openMap = useCallback((url?: string) => {
    if (url) Linking.openURL(url);
  }, []);

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

  const ListHeader = useMemo(() => {
    if (!grupo) return null;
    return (
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
  }, [
    grupo,
    isDark,
    memberFilter,
    filteredMiembros.length,
    myName,
    styles,
    openMap,
  ]);

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
