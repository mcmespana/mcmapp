import { ScrollViewStyleReset } from 'expo-router/html';

// Web-only HTML root. Configura el shell HTML emitido en el export estático.
// Mantener sincronizado con `app.json > expo.web.meta` y `public/manifest.json`.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Viewport — viewport-fit=cover habilita env(safe-area-inset-*) en iOS */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"
        />

        {/* SEO */}
        <meta
          name="description"
          content="MCM España — cantoral, eventos, calendario, materiales y mucho más."
        />
        <meta name="color-scheme" content="light dark" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        {/* PWA — generic */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="MCM España" />

        {/* iOS Safari standalone PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="MCM España" />

        {/* Prevent automatic phone-number detection */}
        <meta name="format-detection" content="telephone=no" />

        {/* Theme Colors — separate light/dark for browser chrome */}
        <meta
          name="theme-color"
          content="#253883"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#0F0D0A"
          media="(prefers-color-scheme: dark)"
        />

        {/* Open Graph / Twitter — para compartir en redes */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="MCM España" />
        <meta
          property="og:description"
          content="Aplicación de MCM España: cantoral, eventos, calendario, materiales y mucho más."
        />
        <meta property="og:image" content="/assets/images/icon-512.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="MCM España" />
        <meta
          name="twitter:description"
          content="Aplicación de MCM España: cantoral, eventos, calendario, materiales y mucho más."
        />
        <meta name="twitter:image" content="/assets/images/icon-512.png" />

        {/* Apple Touch Icons — varios tamaños para distintos dispositivos */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/assets/images/icon-180.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="167x167"
          href="/assets/images/icon-167.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="152x152"
          href="/assets/images/icon-152.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="120x120"
          href="/assets/images/icon-120.png"
        />
        {/* Default fallback */}
        <link rel="apple-touch-icon" href="/assets/images/icon-180.png" />

        {/* Favicons */}
        <link rel="icon" type="image/png" href="/assets/images/favicon.png" />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/assets/images/icon-192.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="512x512"
          href="/assets/images/icon-512.png"
        />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* Manifest PWA */}
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />

        {/* Estilos globales mínimos para PWA standalone:
            - Fondo del body para que coincida con la app cuando hay overscroll
            - Reset del color de la barra de estado en iOS standalone */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            html, body { background-color: #ffffff; }
            @media (prefers-color-scheme: dark) {
              html, body { background-color: #0F0D0A; }
            }
            /* Evita el efecto de pull-to-refresh sobre el shell en standalone */
            body {
              overscroll-behavior-y: none;
              -webkit-tap-highlight-color: transparent;
            }
          `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
