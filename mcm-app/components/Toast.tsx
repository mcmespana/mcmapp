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
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#4CAF50',
          icon: 'check-circle' as const,
          iconColor: '#fff',
          textColor: '#fff',
        };
      case 'error':
        return {
          backgroundColor: '#F44336',
          icon: 'error' as const,
          iconColor: '#fff',
          textColor: '#fff',
        };
      case 'warning':
        return {
          backgroundColor: '#FF9800',
          icon: 'warning' as const,
          iconColor: '#fff',
          textColor: '#fff',
        };
      case 'info':
        return {
          backgroundColor: '#2196F3',
          icon: 'info' as const,
          iconColor: '#fff',
          textColor: '#fff',
        };
      default:
        return {
          backgroundColor: '#4CAF50',
          icon: 'check-circle' as const,
          iconColor: '#fff',
          textColor: '#fff',
        };
    }
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
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
