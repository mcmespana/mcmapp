import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ToastColors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';

interface ToastProps {
  visible: boolean;
  message: string;
  duration?: number;
  type?: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
}

export default function Toast({
  visible,
  message,
  duration = 4000,
  type = 'success',
  onDismiss,
}: ToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const getToastConfig = () => {
    const icons = {
      success: 'check-circle' as const,
      error: 'error' as const,
      warning: 'warning' as const,
      info: 'info' as const,
    };
    return {
      backgroundColor: ToastColors[type],
      icon: icons[type],
      iconColor: '#fff',
      textColor: '#fff',
    };
  };

  const config = getToastConfig();

  useEffect(() => {
    if (visible) {
      // Mostrar toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Ocultar toast
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity, duration, onDismiss]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: config.backgroundColor,
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <View style={styles.content}>
          <MaterialIcons
            name={config.icon}
            size={20}
            color={config.iconColor}
            style={styles.icon}
          />
          <Text
            style={[styles.message, { color: config.textColor }]}
            numberOfLines={3}
          >
            {message}
          </Text>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="close" size={18} color={config.iconColor} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 20 : 60,
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    borderRadius: radii.md,
    marginHorizontal: 8,
    ...shadows.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});
