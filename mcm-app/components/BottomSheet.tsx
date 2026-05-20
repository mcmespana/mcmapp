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
  Keyboard,
} from 'react-native';

const nativeDriver = Platform.OS !== 'web';
import { UIColors, Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
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
  /** Called after the close animation finishes and the Modal is unmounted.
   *  Use this to present a second Modal or call Share.share() — iOS cannot
   *  show two Modals simultaneously, so actions must wait for full dismissal. */
  onCloseComplete?: () => void;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  height,
  title,
  onCloseComplete,
}: BottomSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const bgColor = Colors[scheme ?? 'light'].background;

  // Ref so the animation callback always calls the latest version of the prop
  // without needing it in the useEffect dependency array.
  const onCloseCompleteRef = useRef(onCloseComplete);
  onCloseCompleteRef.current = onCloseComplete;

  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(OFF_SCREEN)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dragAnim = useRef(new Animated.Value(0)).current;
  // Keyboard offset: negative value moves the sheet up. Kept separate from
  // translateY so both can use useNativeDriver without a driver conflict.
  const keyboardOffsetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      dragAnim.setValue(0);
      keyboardOffsetAnim.setValue(0);
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
      ]).start(() => {
        setModalVisible(false);
        // Android / Web: call directly — no native sequencing concern.
        // iOS: onDismiss on the Modal fires instead, after UIKit confirms the
        // view controller is gone. Calling here on iOS would batch this with
        // setModalVisible(false), making the new Modal appear in the same
        // render cycle — which iOS rejects silently.
        if (Platform.OS !== 'ios') {
          onCloseCompleteRef.current?.();
        }
      });
    }
  }, [visible, slideAnim, opacityAnim, dragAnim, keyboardOffsetAnim]);

  // Shift the sheet up when the keyboard appears (iOS only).
  // Uses a separate Animated.Value so it can share the native driver with
  // translateY — mixing useNativeDriver: false and true on one Animated.View
  // crashes React Native.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener(
      'keyboardWillShow',
      (e: { endCoordinates: { height: number }; duration: number }) => {
        Animated.timing(keyboardOffsetAnim, {
          toValue: -e.endCoordinates.height,
          duration: e.duration ?? 250,
          useNativeDriver: nativeDriver,
        }).start();
      },
    );
    const hideSub = Keyboard.addListener(
      'keyboardWillHide',
      (e: { duration: number }) => {
        Animated.timing(keyboardOffsetAnim, {
          toValue: 0,
          duration: e.duration ?? 250,
          useNativeDriver: nativeDriver,
        }).start();
      },
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffsetAnim]);

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
      onDismiss={() => onCloseCompleteRef.current?.()}
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

      {/* Outer: keyboard avoidance — moves the whole sheet up via transform */}
      <Animated.View
        style={[
          styles.sheetPositioner,
          { transform: [{ translateY: keyboardOffsetAnim }] },
        ]}
      >
        {/* Inner: slide-in / drag animation */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: bgColor,
              paddingBottom: 8,
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

          {/* onStartShouldSetResponder absorbs touches on empty areas so they
              don't fall through to the backdrop Pressable behind the sheet. */}
          <View
            style={[
              { backgroundColor: bgColor, paddingHorizontal: 16 },
              height !== undefined && { flex: 1 },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetPositioner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
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
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
