import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  List,
  IconButton,
  Card,
  Chip,
  Text,
  Divider,
  Snackbar,
} from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Cuenta {
  id: string;
  delegacion_id: string;
  nombre: string;
  tipo: string;
  origen: string;
  banco_nombre: string;
  iban: string;
  creado_en: string;
  color?: string;
  informacion?: string;
  personas_autorizadas?: string;
  descripcion?: string;
}

export default function CuentasScreen() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const { data: cuentas, loading } = useFirebaseData<Cuenta[]>(
    'cuentas',
    'cuentas_data',
  );

  const [snackbarVisible, setSnackbarVisible] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState('');

  const copyToClipboard = async (iban: string) => {
    try {
      await Clipboard.setStringAsync(iban);
      setSnackbarMessage('IBAN copiado al portapapeles');
      setSnackbarVisible(true);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      setSnackbarMessage('Error al copiar el IBAN');
      setSnackbarVisible(true);
    }
  };

  const getAccountIcon = (tipo: string) => {
    switch (tipo?.toLowerCase()) {
      case 'corriente':
        return 'credit-card';
      case 'ahorro':
        return 'piggy-bank';
      case 'inversion':
        return 'trending-up';
      default:
        return 'bank';
    }
  };

  const getColorForAccount = (account: Cuenta, index: number) => {
    if (account.color) {
      return account.color;
    }
    // Default colors if no color is specified
    const defaultColors = [
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.info,
    ];
    return defaultColors[index % defaultColors.length];
  };

  if (!cuentas) {
    return <ProgressWithMessage message="Cargando cuentas..." />;
  }

  if (loading) {
    return <ProgressWithMessage message="Actualizando cuentas..." />;
  }

  if (cuentas.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <List.Icon icon="bank-off" color={colors.tabIconDefault} size={48} />
        <Text style={styles.emptyText}>No hay cuentas registradas</Text>
        <Text style={styles.emptySubtext}>
          Las cuentas bancarias aparecerán aquí cuando estén disponibles
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container}>
        {(cuentas || []).map((cuenta, index) => (
          <Card key={cuenta.id} style={styles.card}>
            <Card.Content>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <List.Icon
                    icon={getAccountIcon(cuenta.tipo)}
                    color={getColorForAccount(cuenta, index)}
                  />
                  <Text style={styles.accountName}>{cuenta.nombre}</Text>
                </View>
                <View style={styles.chips}>
                  <Chip mode="outlined" style={styles.chip}>
                    {cuenta.tipo}
                  </Chip>
                  <Chip mode="outlined" style={styles.chip}>
                    {cuenta.origen}
                  </Chip>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.bankInfo}>
                <Text style={styles.bankName}>{cuenta.banco_nombre}</Text>

                <View style={styles.ibanRow}>
                  <Text style={styles.ibanLabel}>IBAN:</Text>
                  <Text style={styles.ibanText}>{cuenta.iban}</Text>
                  <IconButton
                    icon="content-copy"
                    size={20}
                    onPress={() => copyToClipboard(cuenta.iban)}
                  />
                </View>
              </View>

              {cuenta.descripcion && (
                <View style={styles.description}>
                  <Text style={styles.descriptionText}>
                    {cuenta.descripcion}
                  </Text>
                </View>
              )}

              {cuenta.informacion && (
                <View style={styles.information}>
                  <Text style={styles.informationTitle}>
                    Información adicional:
                  </Text>
                  <Text style={styles.informationText}>
                    {cuenta.informacion}
                  </Text>
                </View>
              )}

              {cuenta.personas_autorizadas && (
                <View style={styles.authorized}>
                  <Text style={styles.authorizedTitle}>
                    Personas autorizadas:
                  </Text>
                  <Text style={styles.authorizedText}>
                    {cuenta.personas_autorizadas}
                  </Text>
                </View>
              )}

              <View style={styles.footer}>
                <Text style={styles.dateText}>
                  Creado: {new Date(cuenta.creado_en).toLocaleDateString()}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
}

const createStyles = (scheme: 'light' | 'dark' | null) => {
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 16,
    },
    card: {
      marginBottom: 16,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: scheme === 'dark' ? '#444' : '#e0e0e0',
    },
    header: {
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    accountName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginLeft: 8,
    },
    chips: {
      flexDirection: 'row',
      gap: 8,
    },
    chip: {
      backgroundColor: scheme === 'dark' ? '#444' : '#f5f5f5',
    },
    divider: {
      marginVertical: 12,
    },
    bankInfo: {
      marginBottom: 12,
    },
    bankName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
    },
    ibanRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    ibanLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
      marginRight: 8,
    },
    ibanText: {
      fontSize: 14,
      color: theme.text,
      flex: 1,
      fontFamily: 'monospace',
    },
    description: {
      marginBottom: 12,
    },
    descriptionText: {
      fontSize: 14,
      color: theme.text,
      fontStyle: 'italic',
    },
    information: {
      marginBottom: 12,
    },
    informationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    informationText: {
      fontSize: 14,
      color: theme.text,
    },
    authorized: {
      marginBottom: 12,
    },
    authorizedTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    authorizedText: {
      fontSize: 14,
      color: theme.text,
    },
    footer: {
      alignItems: 'flex-end',
    },
    dateText: {
      fontSize: 12,
      color: theme.tabIconDefault,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.tabIconDefault,
      marginTop: 8,
      textAlign: 'center',
    },
  });
};
