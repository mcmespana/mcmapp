// Este archivo asegura que Expo incluya los iconos en el build
// Solo necesita estar importado una vez para que funcione

// Requerir todos los iconos para que Expo los incluya en el bundle
const icon120 = require('../assets/images/icon-120.png');
const icon152 = require('../assets/images/icon-152.png');
const icon167 = require('../assets/images/icon-167.png');
const icon180 = require('../assets/images/icon-180.png');
const icon192 = require('../assets/images/icon-192.png');
const icon512 = require('../assets/images/icon-512.png');
const favicon = require('../assets/images/favicon.png');

// Exportar las rutas para uso en el código
export const iconAssets = {
  icon120,
  icon152,
  icon167,
  icon180,
  icon192,
  icon512,
  favicon,
};

// También las exportamos individualmente por si acaso
export { icon120, icon152, icon167, icon180, icon192, icon512, favicon };
