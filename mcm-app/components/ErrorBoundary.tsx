import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Appearance,
} from 'react-native';
import { Button } from 'heroui-native';

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
    console.error('ErrorBoundary caught:', error, errorInfo);
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
          <Button variant="primary" onPress={this.handleReset}>
            <Button.Label>Reintentar</Button.Label>
          </Button>
          {__DEV__ && this.state.error && (
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
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? '#aaa' : '#666',
      textAlign: 'center',
      marginBottom: 24,
    },
    errorBox: {
      marginTop: 24,
      maxHeight: 200,
      width: '100%',
      backgroundColor: isDark ? '#3a3a3c' : '#f5f5f5',
      borderRadius: 8,
      padding: 12,
    },
  });

const styles = StyleSheet.create({
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#253883',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#c00',
  },
});
