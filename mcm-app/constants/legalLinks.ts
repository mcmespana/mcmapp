// Enlaces legales de MCM, publicados en el portal Comunica.
//
// Están aquí y no incrustados en la pantalla porque los piden varios sitios:
// el pie de "Más" hoy, y las fichas de las tiendas y el onboarding el día que
// haga falta. Si cambian las URLs, se cambian en un único sitio.
//
// Apple y Google exigen que la política de privacidad sea accesible desde
// DENTRO de la app, no solo desde la ficha de la tienda.

export interface LegalLink {
  id: string;
  label: string;
  url: string;
}

export const LEGAL_LINKS: LegalLink[] = [
  {
    id: 'privacidad',
    label: 'Política de privacidad',
    url: 'https://comunica.movimientoconsolacion.com/politicadeprivacidad/',
  },
  {
    id: 'condiciones',
    label: 'Términos y condiciones',
    url: 'https://comunica.movimientoconsolacion.com/terminoscondiciones/',
  },
  {
    id: 'aviso',
    label: 'Aviso legal',
    url: 'https://comunica.movimientoconsolacion.com/avisolegal/',
  },
];

/** URL de la política de privacidad, que es la que piden las tiendas. */
export const PRIVACY_POLICY_URL = LEGAL_LINKS[0].url;
