import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every web page during static rendering.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Essential Meta Tags */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"
        />

        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="MCM España" />

        {/* iOS Safari Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="MCM España" />

        {/* Prevent detection */}
        <meta name="format-detection" content="telephone=no" />

        {/* Theme Colors */}
        <meta name="theme-color" content="#253883" />

        {/* Apple Touch Icons */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/assets/images/icon-180.png"
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

        {/* Regular Favicon */}
        <link rel="icon" type="image/png" href="/assets/images/favicon.png" />

        {/* Manifest */}
        <link rel="manifest" href="/manifest.json" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
