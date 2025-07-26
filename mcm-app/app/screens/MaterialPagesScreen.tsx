import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Platform,
  DimensionValue,
  ViewStyle,
  type ColorSchemeName,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import FormattedContent from '@/components/FormattedContent';
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
    const top = `${Math.random() * 120 - 10}%`; // Random top between -10% and 110%
    const left = `${Math.random() * 120 - 10}%`; // Random left between -10% and 110%
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

export default function MaterialPagesScreen({ route }: { route: RouteProps }) {
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const { actividad, fecha } = route.params;
  const introBackgroundColor = actividad.color || colors.primary; // Fallback color
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, introBackgroundColor, fontScale),
    [scheme, introBackgroundColor, fontScale],
  );

  const IntroPageItem = ({ actividad }: { actividad: Actividad }) => {
    const circlesData = React.useMemo(() => generateRandomCircles(5), []);
    return (
      <View style={[styles.introPage, { width }]}>
        {circlesData.map((circle, idx) => (
          <View
            key={`deco-${idx}`}
            style={
              {
                position: 'absolute',
                width: circle.size,
                height: circle.size,
                borderRadius: circle.size / 2,
                backgroundColor: circle.color,
                opacity: circle.opacity,
                top: circle.top as DimensionValue,
                left: circle.left as DimensionValue,
              } as ViewStyle
            }
          />
        ))}
        <Text style={styles.introEmoji}>{actividad.emoji}</Text>
        <Text style={styles.introTitle}>{actividad.nombre.toUpperCase()}</Text>
        <Text style={styles.introDate}>
          {new Date(fecha)
            .toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })
            .replace(',', '')
            .toUpperCase()}
        </Text>
        <Text style={styles.introHint}>Desliza para ver el material</Text>
      </View>
    );
  };

  const ContentPageItem = ({ item }: { item: Pagina }) => {
    return (
      <View style={[styles.page, { width }]}>
        <View style={[styles.pageHeader, { backgroundColor: actividad.color }]}>
          <Text style={styles.pageTitle}>{item.titulo}</Text>
          {item.subtitulo && (
            <Text style={styles.pageSubtitle}>{item.subtitulo}</Text>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {item.texto && <FormattedContent text={item.texto} />}
        </ScrollView>
      </View>
    );
  };
  const [index, setIndex] = useState(0);
  const pages = [{ intro: true }, ...actividad.paginas];
  const { width } = Dimensions.get('window');

  const renderItem = ({ item }: { item: any }) => {
    if (item.intro) {
      return <IntroPageItem actividad={actividad} />;
    }
    return <ContentPageItem item={item as Pagina} />;
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

      setIndex((prevIndex) => {
        if (
          calculatedNewIndex >= 0 &&
          calculatedNewIndex < pages.length &&
          prevIndex !== calculatedNewIndex
        ) {
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
    if (
      calculatedNewIndex >= 0 &&
      calculatedNewIndex < pages.length &&
      index !== calculatedNewIndex
    ) {
      setIndex(calculatedNewIndex);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[scheme ?? 'light'].background },
      ]}
    >
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
            <TouchableOpacity
              style={[styles.arrowButton, styles.leftArrow]}
              onPress={() => goToPage(index - 1)}
            >
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          )}
          {index < pages.length - 1 && (
            <TouchableOpacity
              style={[styles.arrowButton, styles.rightArrow]}
              onPress={() => goToPage(index + 1)}
            >
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

const createStyles = (
  scheme: ColorSchemeName,
  introColor: string,
  scale: number,
) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: { flex: 1 },
    introPage: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: introColor,
    },
    introEmoji: {
      fontSize: 64 * scale,
      marginBottom: spacing.lg,
    },
    introTitle: {
      fontSize: 22 * scale,
      textAlign: 'center',
      fontWeight: 'bold',
      color: colors.white,
    },
    introDate: {
      fontSize: 14 * scale,
      color: colors.white,
      marginTop: 4,
    },
    introHint: {
      marginTop: spacing.md,
      color: colors.white,
      fontSize: 10 * scale,
    },
    page: {
      flex: 1,
    },
    pageHeader: {
      padding: spacing.md,
    },
    pageTitle: {
      fontSize: 20 * scale,
      fontWeight: 'bold',
      color: colors.white,
    },
    pageSubtitle: {
      fontSize: 16 * scale,
      color: colors.white,
      marginTop: 4,
    },
    pageContent: {
      padding: spacing.lg,
    },
    pageText: {
      color: theme.text,
      fontSize: 16 * scale,
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
      fontSize: 28 * scale,
      fontWeight: 'bold',
      lineHeight: 28,
    },
  });
};
