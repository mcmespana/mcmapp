/**
 * Candado: el layout de pestañas no puede importar lo NATIVO directamente.
 *
 * `expo-native-compact-tabs` llama a `requireNativeViewManager()` a nivel de
 * módulo y no trae shim web, así que basta con que el grafo de módulos de web
 * lo alcance —aunque sea desde una rama de `Platform.OS` que nunca se ejecuta—
 * para que reviente con «requireNativeViewManager is not available on web».
 *
 * Eso es lo que tumbaba `npx expo export --platform web`: el renderizado
 * estático evalúa `app/(tabs)/_layout.tsx` en Node, sin módulos nativos, y la
 * exportación entera moría sin generar ni `index.html` ni el bundle. Como
 * `deploy-web.yml` corre ese comando en cada push a `production`, el síntoma
 * era un deploy web roto.
 *
 * La rama por plataforma la resuelve Metro por sufijo de fichero
 * (`PlatformTabsLayout.web.tsx`). Este test comprueba que sigue siendo así: un
 * `import` directo de los layouts nativos desde el layout compartido volvería a
 * romperlo, y el fallo solo se vería al desplegar.
 */
import fs from 'fs';
import path from 'path';

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('el layout de pestañas es seguro para web', () => {
  it('`(tabs)/_layout.tsx` no importa los layouts nativos', () => {
    const layout = read('app/(tabs)/_layout.tsx');

    expect(layout).not.toMatch(/from '@\/components\/tabs\/IOSTabsLayout'/);
    expect(layout).not.toMatch(/from '@\/components\/tabs\/AndroidTabsLayout'/);
    expect(layout).toMatch(/from '@\/components\/tabs\/PlatformTabsLayout'/);
  });

  it('existe el shim web y NO arrastra la barra nativa', () => {
    const web = read('components/tabs/PlatformTabsLayout.web.tsx');

    expect(web).toMatch(/WebTabsLayout/);
    expect(web).not.toMatch(/IOSTabsLayout|AndroidTabsLayout/);
  });

  it('la versión nativa sí monta la barra flotante', () => {
    const native = read('components/tabs/PlatformTabsLayout.tsx');

    expect(native).toMatch(/IOSTabsLayout/);
    expect(native).toMatch(/AndroidTabsLayout/);
  });

  it('solo la rama nativa IMPORTA expo-native-compact-tabs', () => {
    // Quien importa el paquete es CompactTabBar, y a él solo se llega desde los
    // dos layouts nativos. Si apareciera un `import` en un fichero compartido,
    // el bundle de web volvería a incluirlo. Se busca el IMPORT, no la mención:
    // los comentarios de estos ficheros nombran el paquete a propósito.
    const IMPORT_RE =
      /^\s*(?:import|export)[^;]*from\s+'expo-native-compact-tabs'/m;

    const compartidos = [
      'app/(tabs)/_layout.tsx',
      'components/tabs/PlatformTabsLayout.web.tsx',
      'components/tabs/WebTabsLayout.tsx',
      'components/tabs/useTabScroll.ts',
      'components/tabs/tabBarController.ts',
    ];

    const conImport = compartidos.filter((rel) => IMPORT_RE.test(read(rel)));
    expect(conImport).toEqual([]);

    // Y el sitio donde SÍ vive el import sigue siendo ese, para que este test
    // no se quede verde por haberse movido el paquete a otra parte.
    expect(read('components/tabs/CompactTabBar.tsx')).toMatch(IMPORT_RE);
  });
});

/**
 * Lo mismo para el área nativa de Comunica (plan 01 §7): `expo-sqlite` y
 * `expo-secure-store` no tienen shim web útil, así que solo los carga el
 * adaptador nativo (`services/comunica/nativeStores.ts`), con su `.web.ts` al
 * lado para que Metro no los meta en el bundle de web.
 */
describe('el área nativa de Comunica es segura para web', () => {
  const ROOT = path.join(__dirname, '..');
  const walk = (dir: string): string[] =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = path.join(dir, e.name);
          if (e.isDirectory()) return walk(p);
          return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
        })
      : [];
  const NATIVE_RE =
    /(?:from\s+|require\(\s*|import\(\s*)'(expo-sqlite|expo-secure-store)'/;
  const files = [
    'app',
    'components',
    'hooks',
    'contexts',
    'utils',
    'services',
    'constants',
  ]
    .flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));

  it('solo el adaptador nativo carga expo-sqlite y expo-secure-store', () => {
    const users = files.filter((f) => NATIVE_RE.test(read(f)));
    expect(users).toEqual(['services/comunica/nativeStores.ts']);
  });

  it('el adaptador tiene su versión web, sin módulos nativos', () => {
    const web = read('services/comunica/nativeStores.web.ts');
    expect(web).not.toMatch(NATIVE_RE);
    expect(web).toMatch(/export function defaultKvBackend/);
    expect(web).toMatch(/export function secureSecretStore/);
  });
});
