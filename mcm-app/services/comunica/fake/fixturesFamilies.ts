// services/comunica/fake/fixturesFamilies.ts
//
// Dos familias de prueba más (plan 11), aparte de `fixtures.ts` para no pasarse de su tope de líneas:
//   · `familyCouple`: la pareja de Marta (`family`). Comparte a Lucía (mismo id de hijo) y lleva uno propio, Hugo.
//   · `familyThree`: una madre con tres hijos.
// Sus hijos están en `profiles.ts`; sus pagos, en `profilePayments.ts` (el dinero es de quien paga, no del hijo).

export type FamilyExtraPersona = 'familyCouple' | 'familyThree';

/** Las personas de familia (tutores y miembros), de la delegación dada. */
export const familyPeople = (delegationId: string) =>
  [
    ['f-per-familia', 'Marta', 'Villarroya Pons'],
    ['f-per-familia-uno', 'Pablo', 'Soler Gil'],
    ['f-per-familia-ninguno', 'Carmen', 'Ibáñez Roca'],
    ['f-per-monitora-madre', 'Laura', 'Gil Mas'],
    ['f-per-miembro', 'Jaime', 'Roca Ferrer'],
    ['f-per-familia-pareja', 'Sergio', 'Messeguer Gil'],
    ['f-per-familia-tres', 'Elena', 'Pons Ferrer'],
  ].map(([id, firstName, lastName]) => ({
    id: id!,
    firstName: firstName!,
    lastName: lastName!,
    badges: { healthNote: false, noPhotos: false, notHomeAlone: false },
    delegationId,
  }));

export const FAMILY_EXTRA_EMAILS: Record<string, [FamilyExtraPersona]> = {
  'familia-pareja@ejemplo.org': ['familyCouple'],
  'familia-tres@ejemplo.org': ['familyThree'],
};

/** Sus fichas de persona de prueba, con la misma función que usa `fixtures.ts`. */
export function familyExtraPersonas<T>(
  persona: (personId: string) => T,
): Record<FamilyExtraPersona, T> {
  return {
    familyCouple: persona('f-per-familia-pareja'),
    familyThree: persona('f-per-familia-tres'),
  };
}
