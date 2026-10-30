/**
 * Guardarraíl: el perfil `production` de EAS no enciende el servidor falso.
 *
 * Una build de tienda con `EXPO_PUBLIC_COMUNICA_API=fake` enseñaría el área
 * nativa de Comunica con datos inventados a todo el mundo. Las builds de
 * prueba con el servidor falso tienen su propio perfil
 * (`production-comunica-falso`).
 */
import fs from 'fs';
import path from 'path';

type Profile = { extends?: string; env?: Record<string, string> };

const eas = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'eas.json'), 'utf8'),
) as { build: Record<string, Profile> };

describe('perfiles de EAS y el servidor falso de Comunica', () => {
  it('production no lleva EXPO_PUBLIC_COMUNICA_API=fake', () => {
    expect(eas.build.production.env?.EXPO_PUBLIC_COMUNICA_API).not.toBe('fake');
  });

  it('la build de prueba con el área nativa tiene su perfil propio', () => {
    const p = eas.build['production-comunica-falso'];
    expect(p?.extends).toBe('production');
    expect(p?.env?.EXPO_PUBLIC_COMUNICA_API).toBe('fake');
  });
});
