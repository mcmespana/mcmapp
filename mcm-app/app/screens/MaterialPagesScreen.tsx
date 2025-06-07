import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, FlatList, ScrollView, TouchableOpacity, Platform, DimensionValue, ViewStyle } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import { JubileoStackParamList } from '../(tabs)/jubileo';

interface Pagina {
  titulo?: string;
  subtitulo?: string;
  texto?: string;
}

interface Actividad {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  paginas: Pagina[];
}

type RouteProps = RouteProp<JubileoStackParamList, 'MaterialPages'>;

const generateRandomCircles = (count: number = 5) => {
  const circles = [];
  const SIZES = [50, 100, 150, 80, 120, 60, 200, 400]; // Variety of sizes

  for (let i = 0; i < count; i++) {
    const size = SIZES[i % SIZES.length];
    const opacity = Math.random() * (0.15 - 0.05) + 0.05; // Random opacity between 0.05 and 0.15
    const top = `${Math.random() * 120 - 10}%`;    // Random top between -10% and 110%
    const left = `${Math.random() * 120 - 10}%`;   // Random left between -10% and 110%
    circles.push({
      size,
      opacity,
      top,
      left,
      color: '#FFF',
    });
  }
  return circles;
};

// Component for the Introduction Page
interface IntroPageItemProps {
  actividad: Actividad;
  width: number;
}
const IntroPageItem: React.FC<IntroPageItemProps> = ({ actividad, width }) => {
  const circlesData = React.useMemo(() => generateRandomCircles(5), []);

  return (
    <View style={[styles.introPage, { width, backgroundColor: 'transparent' }]}>
      {circlesData.map((circle, idx) => (
        <View
          key={`deco-${idx}`}
          style={{
            position: 'absolute',
            width: circle.size,
            height: circle.size,
            borderRadius: circle.size / 2,
            backgroundColor: circle.color,
            opacity: circle.opacity,
            top: circle.top as DimensionValue,
            left: circle.left as DimensionValue,
            // transform: [{ translateX: -circle.size / 2 }, { translateY: -circle.size / 2 }],
          } as ViewStyle}
        />
      ))}
      <Text style={styles.introEmoji}>{actividad.emoji}</Text>
      <Text style={styles.introTitle}>{actividad.nombre}</Text>
      <Text style={styles.introHint}>Desliza para seguir leyendo</Text>
    </View>
  );
};

// Component for Content Pages
interface ContentPageItemProps {
  item: Pagina; // Assuming 'Pagina' is the type for a content page object
  actividadColor: string;
  width: number;
}
const ContentPageItem: React.FC<ContentPageItemProps> = ({ item, actividadColor, width }) => {
  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.pageHeader, { backgroundColor: actividadColor }]}>
        <Text style={styles.pageTitle}>{item.titulo}</Text>
        {item.subtitulo && <Text style={styles.pageSubtitle}>{item.subtitulo}</Text>}
      </View>
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text>{item.texto}</Text>
      </ScrollView>
    </View>
  );
};

export default function MaterialPagesScreen({ route }: { route: RouteProps }) {
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const { actividad } = route.params;
  const introBackgroundColor = actividad.color || colors.primary; // Fallback color
  const [index, setIndex] = useState(0);
  const pages = [{ intro: true }, ...actividad.paginas];
  const { width } = Dimensions.get('window');

  const renderItem = ({ item }: { item: any }) => {
    if (item.intro) {
      return <IntroPageItem actividad={actividad} width={width} />;
    }
    // Assuming 'item' for content pages is of type 'Pagina'
    // You might need to adjust the type assertion if 'item' can be something else
    return <ContentPageItem item={item as Pagina} actividadColor={actividad.color} width={width} />;
  };

  const getItemLayout = (_data: any, itemIndex: number) => ({
    length: width,
    offset: width * itemIndex,
    index: itemIndex,
  });

  const goToPage = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < pages.length && index !== newIndex) {
      setIndex(newIndex);
      flatListRef.current?.scrollToIndex({ animated: true, index: newIndex });
    }
  };

  const handleWebScroll = (event: any) => {
    if (Platform.OS !== 'web') return;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const calculatedNewIndex = Math.round(contentOffsetX / width);

      setIndex(prevIndex => {
        if (calculatedNewIndex >= 0 && calculatedNewIndex < pages.length && prevIndex !== calculatedNewIndex) {
          return calculatedNewIndex;
        }
        return prevIndex;
      });
    }, 100); // Debounce for web scroll
  };

  const onNativeMomentumScrollEnd = (e: any) => {
    if (Platform.OS === 'web') return;

    const contentOffsetX = e.nativeEvent.contentOffset.x;
    const calculatedNewIndex = Math.round(contentOffsetX / width);

    // Check if index actually changed and is valid
    if (calculatedNewIndex >= 0 && calculatedNewIndex < pages.length && index !== calculatedNewIndex) {
      setIndex(calculatedNewIndex);
    }
  };

  const containerBackgroundColor = index === 0 ? introBackgroundColor : colors.background;

  return (
    <View style={[styles.container, { backgroundColor: containerBackgroundColor }]}>
      <FlatList
        data={pages}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleWebScroll} // For web continuous scroll
        onMomentumScrollEnd={onNativeMomentumScrollEnd} // For native swipe finalization
        scrollEventThrottle={16} // Important for onScroll to fire frequently enough
        getItemLayout={getItemLayout}
        ref={flatListRef}
      />
      {Platform.OS === 'web' && (
        <>
          {index > 0 && (
            <TouchableOpacity style={[styles.arrowButton, styles.leftArrow]} onPress={() => goToPage(index - 1)}>
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          )}
          {index < pages.length - 1 && (
            <TouchableOpacity style={[styles.arrowButton, styles.rightArrow]} onPress={() => goToPage(index + 1)}>
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <View style={styles.dotsContainer}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, index === i && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 /* backgroundColor is now dynamic */ },
  introPage: {
    // backgroundColor is now set dynamically on the container for the intro page
    // and transparent here to let the container's bg show, or handled by actividad.color if needed directly
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
  arrowButton: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -25 }], // Adjust based on arrow size
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 30,
    zIndex: 1,
  },
  leftArrow: {
    left: 20,
  },
  rightArrow: {
    right: 20,
  },
  arrowText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 28,
  },
});
