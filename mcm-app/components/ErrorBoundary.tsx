import { logger } from '@/utils/logger';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Appearance,
  TouchableOpacity,
} from 'react-native';
import colors, { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isDark = Appearance.getColorScheme() === 'dark';
      const dynamicStyles = getDynamicStyles(isDark);
      return (
        <View style={dynamicStyles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Algo ha ido mal</Text>
          <Text style={dynamicStyles.subtitle}>
            La app ha encontrado un error inesperado.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
          {this.state.error && (
            <ScrollView style={dynamicStyles.errorBox}>
              <Text style={styles.errorText}>
                {this.state.error.toString()}
              </Text>
            </ScrollView>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const getDynamicStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      backgroundColor: themeColors(isDark).background,
    },
    subtitle: {
      ...typography.body,
      color: isDark ? '#aaa' : '#666',
      textAlign: 'center',
      marginBottom: 24,
    },
    errorBox: {
      marginTop: 24,
      maxHeight: 200,
      width: '100%',
      backgroundColor: isDark ? '#3a3a3c' : '#f5f5f5',
      borderRadius: radii.sm,
      padding: 12,
    },
  });

const styles = StyleSheet.create({
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.sm,
  },
  buttonText: {
    color: '#fff',
    ...typography.body,
    fontWeight: '600',
  },
  errorText: {
    ...typography.footnote,
    fontFamily: 'monospace',
    color: '#c00',
  },
});
