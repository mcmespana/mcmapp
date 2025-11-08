import { useState, useEffect } from 'react';
import { getUnreadNotificationsCount } from '@/services/pushNotificationService';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook para obtener el contador de notificaciones sin leer
 * Se actualiza automáticamente cuando la app vuelve al foreground
 */
export default function useUnreadNotificationsCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const updateCount = async () => {
    try {
      setLoading(true);
      const count = await getUnreadNotificationsCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error obteniendo contador de notificaciones:', error);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Cargar contador inicial
    updateCount();

    // Actualizar cuando la app vuelve al foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Función para refrescar manualmente
  const refresh = () => {
    updateCount();
  };

  return { unreadCount, loading, refresh };
}

