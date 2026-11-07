/**
 * Guardarraíl: la plantilla HTML de la web (`app/+html.tsx`) pinta los
 * `<script>` y estilos que le da el export.
 *
 * En Expo 58 el export estático dejó de inyectar el JS en el HTML por su
 * cuenta: se lo pasa a la plantilla como `headNodes` / `bodyNodes`
 * (`useServerDocumentContext`). Una plantilla propia que no los pinte exporta
 * una web en BLANCO —sin un solo `<script>`—, con `tsc`, lint y tests en verde.
 * Pasó en la rama de Expo 58 y solo se veía al abrir la web exportada.
 */
import React from 'react';
import { ServerDocument } from 'expo-router/build/server/ServerDocument';
import Root from '@/app/+html';

// Sin `@types/react-dom` en el proyecto: basta con esta firma.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

it('pinta los nodos de cabecera y de cuerpo que le da el export', () => {
  const html = renderToStaticMarkup(
    <ServerDocument
      data={{
        headNodes: [<link key="css" rel="stylesheet" href="/estilos.css" />],
        bodyNodes: [<script key="js" src="/_expo/entry.js" defer />],
        htmlAttributes: { dir: 'ltr' },
        bodyAttributes: { className: 'cuerpo' },
      }}
    >
      <Root>
        <div id="app" />
      </Root>
    </ServerDocument>,
  );
  expect(html).toContain('<link rel="stylesheet" href="/estilos.css"/>');
  expect(html).toContain('<script src="/_expo/entry.js" defer=""></script>');
  // El JS va DESPUÉS del contenido, dentro del body, como en la plantilla por
  // defecto de expo-router.
  expect(html.indexOf('id="app"')).toBeLessThan(html.indexOf('entry.js'));
  expect(html).toMatch(/<html[^>]*dir="ltr"/);
  expect(html).toMatch(/<body[^>]*class="cuerpo"/);
});
