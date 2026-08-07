import React, { useState, useRef } from 'react';
import { View, Dimensions, FlatList, Platform } from 'react-native';
import { RouteProp } from 'expo-router/react-navigation';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import {
  IntroPageItem,
  ContentPageItem,
  createStyles,
  type Pagina,
} from '@/components/materiales/MaterialPageItems';
import { MasStackParamList } from '../(tabs)/mas';

type RouteProps = RouteProp<MasStackParamList, 'MaterialPages'>;

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
        headerColor={actividad.color}
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
