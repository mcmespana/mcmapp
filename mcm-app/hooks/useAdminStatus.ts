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
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getDatabase(getFirebaseApp());
    const adminRef = ref(db, `users/${user.uid}/isAdmin`);
    const unsub = onValue(
      adminRef,
      (snap) => {
        setIsAdmin(snap.val() === true);
        setLoading(false);
      },
      () => {
        setIsAdmin(false);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user, authLoading]);

  return { isAdmin, loading };
}
