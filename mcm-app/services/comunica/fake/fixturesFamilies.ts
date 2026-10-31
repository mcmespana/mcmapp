// services/comunica/fake/fixturesFamilies.ts
//
// Familias y miembros del servidor falso (plan 11 «Datos»). Sin azar y
// añadido al FINAL de `generateFakeData`, para no mover ni un dato de los
// planes de antes. Todo inventado; los ids con el prefijo `f-`.
//
// Las personas de prueba nuevas (con quién se entra):
//   · `guardianTwo` — solo familiar, con dos hijos vigentes: Lucía y uno cuyo
//     nombre no llega del CRM («Participante»). Tiene además una relación ya
//     terminada (no cuenta) y otra con fin `0000-00-00` (sí cuenta: es Lucía).
//   · `guardianOne` — solo familiar con un hijo (entra directo en su ficha).
//   · `guardianNone` — solo familiar sin hijos vinculados.
//   · `monitorParent` — monitora y miembro, con una hija.
//   · `member` — miembro del MCM sin hijos.
// «Uno del equipo sin hijos» es el `monitor` de siempre.

import type { FakePerson } from './fixtures';

/** Una relación familiar → participante, con sus fechas tal cual del CRM. */
export interface FakeFamilyLink {
  childId: string;
  /** `YYYY-MM-DD`, vacío o `null` (= sin inicio). */
  startDate: string | null;
  /** `YYYY-MM-DD`, vacío, `0000-00-00` o `null` (= sin fin). */
  endDate: string | null;
}

export interface FakeFamilyData {
  /** Personas nuevas (adultos y sus hijos). */
  people: FakePerson[];
  /** Hijos de cada familiar, por id del familiar. */
  families: Record<string, FakeFamilyLink[]>;
  /** Género de la ficha (`null` = vacío: se adivina por el nombre). */
  genders: Record<string, 'female' | 'male' | null>;
  /** Miembros del MCM sin papel de equipo (una marca que no es `familiar_menor`). */
  members: string[];
  /** Ids de las personas de prueba nuevas. */
  personaIds: {
    guardianTwo: string;
    guardianOne: string;
    guardianNone: string;
    monitorParent: string;
    member: string;
  };
}

const BADGES = { healthNote: false, noPhotos: false, notHomeAlone: false };

export function generateFamilies(delegationId: string): FakeFamilyData {
  const person = (
    id: string,
    firstName: string,
    lastName: string,
    schoolLevel?: string,
  ): FakePerson => ({
    id,
    firstName,
    lastName,
    schoolLevel,
    badges: { ...BADGES },
    delegationId,
  });

  const rosa = person('f-fam-rosa', 'Rosa', 'Martín Pozo');
  const lucia = person('f-fam-lucia', 'Lucía', 'Messeguer Martín', '1º ESO');
  // El CRM no devuelve su nombre: sale igual, como «Participante».
  const unnamed = person('f-fam-sin-nombre', '', '', '4º Primaria');
  const old = person('f-fam-antiguo', 'Hugo', 'Messeguer Martín');
  const andres = person('f-fam-andres', 'Andrés', 'Gil Navarro');
  const pablo = person('f-fam-pablo', 'Pablo', 'Gil Soler', '5º Primaria');
  const teresa = person('f-fam-teresa', 'Teresa', 'Ruiz Campos');
  const carmen = person('f-fam-carmen', 'Carmen', 'Ortega Lis');
  const ines = person('f-fam-ines', 'Inés', 'Ortega Sanz', '3º Primaria');
  const elena = person('f-fam-elena', 'Elena', 'Prieto Sáez');

  return {
    people: [
      rosa,
      lucia,
      unnamed,
      old,
      andres,
      pablo,
      teresa,
      carmen,
      ines,
      elena,
    ],
    families: {
      [rosa.id]: [
        // Fin «0000-00-00»: vigente (la lista de hijos del plugin la cuenta).
        { childId: lucia.id, startDate: '2019-09-01', endDate: '0000-00-00' },
        // Sin inicio: vigente (el plugin la contaba en la lista, no al decidir
        // si eras familiar; el servidor usa una sola regla).
        { childId: unnamed.id, startDate: null, endDate: '' },
        // Terminada: no cuenta.
        { childId: old.id, startDate: '2014-09-01', endDate: '2024-08-31' },
      ],
      [andres.id]: [
        { childId: pablo.id, startDate: '2022-09-01', endDate: null },
      ],
      [teresa.id]: [],
      [carmen.id]: [
        { childId: ines.id, startDate: '2023-09-01', endDate: null },
      ],
    },
    genders: {
      [rosa.id]: 'female',
      [lucia.id]: 'female',
      [unnamed.id]: null,
      [andres.id]: 'male',
      [pablo.id]: 'male',
      // Sin género en la ficha: «Yo misma» por el nombre (Teresa, Carmen).
      [teresa.id]: null,
      [carmen.id]: null,
      [ines.id]: 'female',
      [elena.id]: 'female',
    },
    members: [carmen.id, elena.id],
    personaIds: {
      guardianTwo: rosa.id,
      guardianOne: andres.id,
      guardianNone: teresa.id,
      monitorParent: carmen.id,
      member: elena.id,
    },
  };
}

/** El hijo que trae el mando «un hijo nuevo» (al siguiente `fresh=1`). */
export const NEW_CHILD: FakePerson = {
  id: 'f-fam-nuevo',
  firstName: 'Martín',
  lastName: 'Messeguer Martín',
  schoolLevel: '1º Primaria',
  badges: { ...BADGES },
  delegationId: 'f-del-villaclara',
};
