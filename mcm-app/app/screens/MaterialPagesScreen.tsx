import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  type ColorSchemeName,
} from 'react-native';
import { RouteProp } from 'expo-router/react-navigation';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import spacing from '@/constants/spacing';
import {
  IntroPageItem,
  ContentPageItem,
} from '@/components/materiales/MaterialPageItems';
import { MasStackParamList } from '../(tabs)/mas';

export interface Pagina {
  titulo?: string;
  subtitulo?: string;
  texto?: string;
}

export interface Actividad {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  paginas: Pagina[];
}

type RouteProps = RouteProp<MasStackParamList, 'MaterialPages'>;
export type MaterialPagesStyles = ReturnType<typeof createStyles>;

export default function MaterialPagesScreen({ route }: { route: RouteProps }) {
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<any>>(null);
  const { actividad, fecha } = route.params;
  const introBackgroundColor = actividad.color || colors.primary; // Fallback color
  const scheme = useColorScheme();
  const fontScale = useFontScale(1.2);
  const styles = React.useMemo(
    () => createStyles(scheme, introBackgroundColor, fontScale),
    [scheme, introBackgroundColor, fontScale],
  );

  const [index, setIndex] = useState(0);
  const pages = [{ intro: true }, ...actividad.paginas];
  const { width, height } = Dimensions.get('window');

  const renderItem = ({ item }: { item: any }) => {
    if (item.intro) {
      return (
        <IntroPageItem
          actividad={actividad}
          styles={styles}
          width={width}
          fecha={fecha}
        />
      );
    }
    return (
      <ContentPageItem
        item={item as Pagina}
        styles={styles}
        fontScale={fontScale}
        width={width}
        height={height}
        color={actividad.color}
      />
    );
  };

  const getItemLayout = (_data: any, itemIndex: number) => ({
    length: width,
    offset: width * itemIndex,
    index: itemIndex,
  });

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
  const theme = Colors[scheme === 'dark' ? 'dark' : 'light'];
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
      fontSize: 20, // Remove scale multiplication
      fontWeight: 'bold',
      color: colors.white,
    },
    pageSubtitle: {
      fontSize: 16, // Remove scale multiplication
      color: colors.white,
      marginTop: 4,
    },
    pageContent: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 120 : spacing.lg,
      flexGrow: 1,
      minHeight: '100%',
    },
    pageText: {
      color: theme.text,
      fontSize: 16 * scale,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      padding: spacing.md,
      paddingBottom: Platform.OS === 'ios' ? 100 : spacing.md,
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: scheme === 'dark' ? '#555' : '#ccc',
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
