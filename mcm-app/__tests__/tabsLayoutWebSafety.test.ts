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
