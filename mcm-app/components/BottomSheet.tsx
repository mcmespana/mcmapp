import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  PanResponder,
  Pressable,
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';

const nativeDriver = Platform.OS !== 'web';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UIColors, Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const OFF_SCREEN = Dimensions.get('window').height;
const DURATION = 300;
// Swipe down threshold to trigger close
const CLOSE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 400;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
  title?: string;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  height,
  title,
}: BottomSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const bgColor = Colors[scheme ?? 'light'].background;
  // useSafeAreaInsets inside Modal returns the real screen safe area (home
  // indicator only, ~34px on iPhone X+), NOT the tab bar height.
  const insets = useSafeAreaInsets();

  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(OFF_SCREEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dragAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragAnim.setValue(0);
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: OFF_SCREEN,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: nativeDriver,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, slideAnim, opacityAnim, dragAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > Math.abs(dx) && dy > 0,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) dragAnim.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > CLOSE_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          onClose();
        } else {
          Animated.spring(dragAnim, {
            toValue: 0,
            useNativeDriver: nativeDriver,
            tension: 180,
            friction: 20,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragAnim, {
          toValue: 0,
          useNativeDriver: nativeDriver,
          tension: 180,
          friction: 20,
        }).start();
      },
    }),
  ).current;

  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';
  const translateY = Animated.add(slideAnim, dragAnim);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: UIColors.modalOverlay, opacity: opacityAnim },
        ]}
        pointerEvents="none"
      />

      {/* Tap-to-close area behind the sheet */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Sheet — slides up from bottom, sized to content or fixed height */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: bgColor,
            paddingBottom: insets.bottom,
            transform: [{ translateY }],
            ...(height !== undefined && { height }),
          },
        ]}
      >
        {/* Handle + optional title — both serve as drag targets */}
        <View style={styles.handleWrap} {...panResponder.panHandlers}>
          <View style={[styles.handle, { backgroundColor: handleColor }]} />
        </View>
        {title && (
          <View style={styles.titleBar} {...panResponder.panHandlers}>
            <Text
              style={[
                styles.titleText,
                { color: Colors[scheme ?? 'light'].text },
              ]}
            >
              {title}
            </Text>
          </View>
        )}

        <View style={{ backgroundColor: bgColor }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  titleBar: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
