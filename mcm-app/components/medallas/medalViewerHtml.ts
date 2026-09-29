/**
 * La página que pinta una medalla en 3D dentro de un WebView (o de un iframe
 * en web).
 *
 * Por qué así y no con un motor 3D nativo: `react-native-webview` ya va
 * compilado en la app, así que esto sale por OTA. `expo-gl` + `three` o
 * `react-native-filament` pedirían build de tienda y, para enseñar UNA
 * medalla en un pop-up, no aportan nada que `<model-viewer>` (el visor de
 * Google para modelos glTF) no haga ya: giro con el dedo, inercia, luz de
 * estudio y metal que brilla.
 *
 * La página avisa a la app con dos mensajes (`loaded` y `error`) para quitar
 * el indicador de carga o enseñar el error. En nativo llegan por
 * `ReactNativeWebView.postMessage`; en web, por `parent.postMessage`.
 *
 * El modelo tiene que ser un `.glb` optimizado (Draco + texturas WebP de
 * 1024 px, ~2 MB): ver `medallas-3d/README.md` en la raíz del monorepo.
 */

/** Versión fijada: una subida mayor del visor no tiene que colarse sola. */
export const MODEL_VIEWER_URL =
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js';

export type MedalViewerMessage = 'loaded' | 'error';

export type MedalViewerOptions = {
  /** URL del `.glb`. Tiene que servirse con CORS abierto (jsDelivr lo hace). */
  src: string;
  /**
   * Entrada "tipo Fitness": dos vueltas rápidas que frenan hasta quedar de
   * frente. Apagado, la medalla aparece quieta.
   */
  spinIn?: boolean;
};

/** Grados de las vueltas de entrada y lo que tardan en frenar, en ms. */
const SPIN_DEGREES = 720;
const SPIN_MS = 1600;
/** Tras soltarla, cuánto espera antes de volver sola a quedar de frente. */
const SETTLE_AFTER_MS = 1800;
/** Inclinación de la cámara: 90 es de frente; algo menos la mira desde arriba. */
const PHI_DEGREES = 85;

export function buildMedalViewerHtml({
  src,
  spinIn = true,
}: MedalViewerOptions): string {
  const srcAttr = escapeAttr(src);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script type="module" src="${MODEL_VIEWER_URL}"></script>
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
  model-viewer {
    width: 100%; height: 100%;
    background: transparent;
    --poster-color: transparent;
    --progress-bar-color: transparent;
  }
</style>
</head>
<body>
<model-viewer id="mv"
  src="${srcAttr}"
  camera-controls
  disable-zoom
  disable-pan
  touch-action="none"
  interaction-prompt="none"
  environment-image="neutral"
  tone-mapping="aces"
  exposure="1.2"
  shadow-intensity="0"
  camera-orbit="${spinIn ? SPIN_DEGREES : 0}deg ${PHI_DEGREES}deg auto"></model-viewer>
<script>
(function () {
  var mv = document.getElementById('mv');
  function send(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent !== window) window.parent.postMessage(msg, '*');
  }
  function front(thetaRad) {
    // La vuelta completa más cercana: volver a 0 desde 720° daría dos vueltas
    // hacia atrás.
    var turns = Math.round(thetaRad / (2 * Math.PI));
    return turns * 360 + 'deg ${PHI_DEGREES}deg auto';
  }
  function spin() {
    var start = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - start) / ${SPIN_MS});
      var eased = 1 - Math.pow(1 - k, 3);
      mv.cameraOrbit = (${SPIN_DEGREES} * (1 - eased)) + 'deg ${PHI_DEGREES}deg auto';
      mv.jumpCameraToGoal();
      if (k < 1) requestAnimationFrame(step);
    })(start);
  }
  var settleTimer = null;
  mv.addEventListener('camera-change', function (e) {
    if (!e.detail || e.detail.source !== 'user-interaction') return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      // Sin jumpCameraToGoal: model-viewer interpola solo y vuelve suave.
      mv.cameraOrbit = front(mv.getCameraOrbit().theta);
    }, ${SETTLE_AFTER_MS});
  });
  mv.addEventListener('load', function () {
    send('loaded');
    ${spinIn ? 'spin();' : ''}
  });
  mv.addEventListener('error', function () { send('error'); });
})();
</script>
</body>
</html>`;
}

/** Lo justo para meter una URL en un atributo HTML sin romperlo. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
