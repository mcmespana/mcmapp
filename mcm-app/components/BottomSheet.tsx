import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UIColors, Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Using a fixed large value avoids re-renders on dimension change while
// guaranteeing the sheet starts fully off-screen.
const OFF_SCREEN = Dimensions.get('window').height;
const DURATION = 300;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const bgColor = Colors[scheme ?? 'light'].background;
  const insets = useSafeAreaInsets();

  // Keep Modal mounted until the close animation finishes.
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(OFF_SCREEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: OFF_SCREEN,
          duration: DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, slideAnim, opacityAnim]);

  const handleColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Visual backdrop — pointerEvents none so the Pressable below handles touch */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: UIColors.modalOverlay, opacity: opacityAnim },
        ]}
        pointerEvents="none"
      />

      {/* Full-screen tap-to-close area. Rendered before the sheet so the
          sheet (later sibling = higher z-order) intercepts its own touches. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* Sheet — slides up from bottom */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: bgColor,
            paddingBottom: insets.bottom,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: handleColor }]} />
        </View>
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
});
