import React, { createContext, useContext, ReactNode } from 'react';
import { useFirebaseJson } from '@/hooks/useFirebaseJson';
import horarioLocal from '@/assets/jubileo-horario.json';
import materialesLocal from '@/assets/jubileo-materiales.json';
import visitasLocal from '@/assets/jubileo-visitas.json';
import profundizaLocal from '@/assets/jubileo-profundiza.json';
import gruposLocal from '@/assets/jubileo-grupos.json';
import contactosLocal from '@/assets/jubileo-contactos.json';

interface JubileoData {
  horario: any;
  materiales: any;
  visitas: any;
  profundiza: any;
  grupos: any;
  contactos: any;
  loading: boolean;
}

const JubileoDataContext = createContext<JubileoData | undefined>(undefined);

export function JubileoDataProvider({ children }: { children: ReactNode }) {
  const horario = useFirebaseJson('jubileo/horario', { storageKey: 'horario', defaultData: horarioLocal });
  const materiales = useFirebaseJson('jubileo/materiales', { storageKey: 'materiales', defaultData: materialesLocal });
  const visitas = useFirebaseJson('jubileo/visitas', { storageKey: 'visitas', defaultData: visitasLocal });
  const profundiza = useFirebaseJson('jubileo/profundiza', { storageKey: 'profundiza', defaultData: profundizaLocal });
  const grupos = useFirebaseJson('jubileo/grupos', { storageKey: 'grupos', defaultData: gruposLocal });
  const contactos = useFirebaseJson('jubileo/contactos', { storageKey: 'contactos', defaultData: contactosLocal });

  const loading = horario.loading || materiales.loading || visitas.loading || profundiza.loading || grupos.loading || contactos.loading;

  return (
    <JubileoDataContext.Provider
      value={{
        horario: horario.data,
        materiales: materiales.data,
        visitas: visitas.data,
        profundiza: profundiza.data,
        grupos: grupos.data,
        contactos: contactos.data,
        loading,
      }}
    >
      {children}
    </JubileoDataContext.Provider>
  );
}

export function useJubileoData() {
  const ctx = useContext(JubileoDataContext);
  if (!ctx) throw new Error('useJubileoData must be used within JubileoDataProvider');
  return ctx;
}
