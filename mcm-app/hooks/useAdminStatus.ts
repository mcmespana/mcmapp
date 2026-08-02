import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lee el flag `isAdmin` del nodo `users/{uid}/isAdmin` en Firebase RTDB.
 * Solo devuelve `true` si el usuario está autenticado Y tiene ese campo a `true`
 * en la base de datos. Nunca se basa en estado local ni en la contraseña del
 * panel secreto.
 */
export function useAdminStatus(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid ?? null;

  // El resultado se guarda JUNTO al uid al que pertenece. Así no hace falta
  // ningún reset a mano al cambiar de usuario o cerrar sesión: una lectura de
  // otro uid simplemente deja de contar, y de paso se cierra la rendija por la
  // que un `isAdmin: true` del usuario anterior seguía en pie hasta que llegaba
  // la primera respuesta del nuevo.
  const [result, setResult] = useState<{
    uid: string;
    isAdmin: boolean;
  } | null>(null);

  useEffect(() => {
    if (authLoading || !uid) return;

    const db = getDatabase(getFirebaseApp());
    const adminRef = ref(db, `users/${uid}/isAdmin`);
    const unsub = onValue(
      adminRef,
      (snap) => setResult({ uid, isAdmin: snap.val() === true }),
      () => setResult({ uid, isAdmin: false }),
    );
    return () => unsub();
  }, [uid, authLoading]);

  const current = result?.uid === uid ? result : null;

  return {
    isAdmin: current?.isAdmin ?? false,
    // Sin sesión no hay nada que esperar: no es admin y ya está.
    loading: authLoading || (uid !== null && current === null),
  };
}
