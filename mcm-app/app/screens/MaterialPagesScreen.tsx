import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Text, FlatList, ScrollView } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { JubileoStackParamList } from '../(tabs)/jubileo';

interface Pagina {
  titulo: string;
  texto: string;
  subtitulo?: string;
}

interface Actividad {
  nombre: string;
  emoji?: string;
  color?: string;
  paginas: Pagina[];
}

type RouteProps = RouteProp<JubileoStackParamList, 'MaterialPages'>;

export default function MaterialPagesScreen({ route }: { route: RouteProps }) {
  const { actividad } = route.params;
  const [index, setIndex] = useState(0);
  const pages = [{ intro: true }, ...actividad.paginas];
  const width = Dimensions.get('window').width;

  const renderItem = ({ item }: { item: any }) => {
    if (item.intro) {
      return (
        <View style={[styles.introPage, { width, backgroundColor: actividad.color }]}>
          <Text style={styles.introEmoji}>{actividad.emoji}</Text>
          <Text style={styles.introTitle}>{actividad.nombre}</Text>
          <Text style={styles.introHint}>Desliza para continuar</Text>
        </View>
      );
    }
    return (
      <View style={[styles.page, { width }]}>
        <View style={[styles.pageHeader, { backgroundColor: actividad.color }]}>
          <Text style={styles.pageTitle}>{item.titulo}</Text>
          {item.subtitulo && <Text style={styles.pageSubtitle}>{item.subtitulo}</Text>}
        </View>
        <ScrollView contentContainerStyle={styles.pageContent}>
          <Text>{item.texto}</Text>
        </ScrollView>
      </View>
    );
  };

  const onMomentumScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      />
      <View style={styles.dotsContainer}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, index === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  introPage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  introEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  introTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.white,
  },
  introHint: {
    marginTop: spacing.md,
    color: colors.white,
  },
  page: {
    flex: 1,
  },
  pageHeader: {
    padding: spacing.md,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.white,
  },
  pageSubtitle: {
    fontSize: 16,
    color: colors.white,
    marginTop: 4,
  },
  pageContent: {
    padding: spacing.lg,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.md,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
});
