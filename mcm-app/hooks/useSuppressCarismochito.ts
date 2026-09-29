import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCarismochitoHunt } from '@/contexts/CarismochitoHuntContext';

/**
 * Pantallas donde Carismochito NO se asoma: lectura y presentación, donde una
 * mascota saltando por el borde estorba (el evangelio, la oración, una canción
 * proyectada en pantalla completa, los materiales de un evento).
 *
 * Va por FOCO y no por montaje: las pantallas de un tab siguen montadas al
 * cambiar de tab, y con un `useEffect` el evangelio seguiría silenciando la
 * app entera desde la pestaña de al lado.
 */
export function useSuppressCarismochito(): void {
  const { suppress } = useCarismochitoHunt();
  useFocusEffect(useCallback(() => suppress(), [suppress]));
}
