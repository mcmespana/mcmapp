/**
 * El pañuelo virtual: tipos compartidos por la app, el visor 3D
 * (`panuelo-3d/`) y el contrato con el Panel
 * (`docs/contratos/PANUELO_CONTRATO.md`).
 *
 * Todo lo que hay aquí viaja por Firebase o por el puente con el WebView, así
 * que son datos planos: nada de funciones, nada de clases.
 */

/**
 * Color del pañuelo. Las mismas claves que `ComunicaColors.scarf`, para que el
 * día que el color venga del área privada no haya que traducir nada.
 */
export type PanueloColor = 'red' | 'green' | 'blue' | 'yellow';

export const PANUELO_COLORS: readonly PanueloColor[] = [
  'red',
  'green',
  'blue',
  'yellow',
];

/** Qué clase de cosa es. Decide cómo se modela en 3D. */
export type PanueloItemKind =
  'chapa' | 'pin' | 'cinta' | 'parche' | 'medalla' | 'pulsera';

export type PanueloRarity = 'comun' | 'especial' | 'unica';

export type PanueloMetal = 'oro' | 'plata' | 'cobre' | 'negro';

/** Formas dibujadas a mano en `constants/panueloGlyphs.ts`. */
export type PanueloGlyph =
  | 'heart'
  | 'star'
  | 'cross'
  | 'moon'
  | 'flame'
  | 'drop'
  | 'sun'
  | 'mountain'
  | 'tent'
  | 'shell'
  | 'note'
  | 'leaf'
  | 'bolt'
  | 'crown'
  | 'fish'
  | 'circle'
  | 'shield'
  | 'arrow'
  | 'rect';

/** Chapa de imperdible: redonda, abombada y brillante, con un dibujo impreso. */
export interface ChapaLook {
  kind: 'chapa';
  /** Color de fondo. */
  bg: string;
  /** Aro exterior de otro color (opcional). */
  ring?: string;
  /** Color del dibujo y de las letras. */
  ink?: string;
  /** Dibujo central. Con `logo: true` va el logo del COM en su lugar. */
  glyph?: PanueloGlyph;
  logo?: boolean;
  /** Texto en arco por arriba y por abajo. */
  text?: string;
  textBottom?: string;
  /** Imagen propia (URL con CORS abierto). Sustituye al dibujo entero. */
  image?: string;
}

/** Pin esmaltado: metal con la forma recortada y esmalte de color dentro. */
export interface PinLook {
  kind: 'pin';
  shape: PanueloGlyph;
  enamel: string;
  /** Segundo color: degradado de arriba abajo. */
  enamel2?: string;
  metal?: PanueloMetal;
}

/** Cinta de tela con rayas, colgando de un imperdible. */
export interface CintaLook {
  kind: 'cinta';
  /** Rayas a lo largo, de izquierda a derecha. De una a siete. */
  colors: string[];
}

/** Parche bordado. */
export interface ParcheLook {
  kind: 'parche';
  shape: 'circle' | 'shield' | 'arrow' | 'rect';
  bg: string;
  border: string;
  ink?: string;
  glyph?: PanueloGlyph;
  text?: string;
}

/** Medalla metálica colgando de su cinta. */
export interface MedallaLook {
  kind: 'medalla';
  metal?: PanueloMetal;
  ribbon: string[];
  glyph?: PanueloGlyph;
  logo?: boolean;
  /** Imagen de la cara (URL con CORS abierto). */
  image?: string;
  /**
   * Modelo `.glb` a tamaño completo (ver `medallas-3d/README.md`). Si existe,
   * la ficha ofrece «Verla de cerca» con el visor de medallas.
   */
  glb?: string;
}

/** Pulsera de hilo trenzado: la que se intercambia en los encuentros. */
export interface PulseraLook {
  kind: 'pulsera';
  /** Los hilos. De uno a seis colores. */
  colors: string[];
  /** `chevron` (espigas, por defecto), `stripes` (rayas) o `solid`. */
  pattern?: 'chevron' | 'stripes' | 'solid';
  /** Texto tejido: con él la pulsera es lisa, del primer color. */
  text?: string;
  ink?: string;
}

export type PanueloLook =
  ChapaLook | PinLook | CintaLook | ParcheLook | MedallaLook | PulseraLook;

/**
 * Cómo se consigue una pieza.
 *
 * - `all`: se la lleva todo el mundo al abrir el pañuelo dentro de las fechas.
 * - `code`: con un código (o QR) que se enseña en la actividad. El catálogo
 *   guarda el hash, nunca el código.
 * - `manual`: la reparte el Panel escribiendo en el nodo del usuario (por
 *   ejemplo, a todos los inscritos en un evento).
 */
export type PanueloGrant =
  | { type: 'all'; from?: number; to?: number }
  | { type: 'code'; hash: string; from?: number; to?: number }
  | { type: 'manual' };

/** Una pieza del catálogo. */
export interface PanueloItemDef {
  /** Contrato: no se renombra ni se reutiliza. */
  id: string;
  kind: PanueloItemKind;
  name: string;
  /** De dónde viene: «Pascua Joven · Abril 2027». */
  origin?: string;
  description?: string;
  rarity?: PanueloRarity;
  /** Multiplicador de tamaño, de 0,7 a 1,5. */
  size?: number;
  look: PanueloLook;
  grant?: PanueloGrant;
  /** Orden en la colección; a igualdad, por nombre. */
  order?: number;
  /** No se enseña (ni como silueta) hasta que se consigue. */
  secret?: boolean;
  /**
   * Se puede intercambiar con otra persona (`utils/panueloTrade.ts`). Las
   * pulseras lo son salvo que se diga lo contrario; lo demás, no: una medalla
   * se gana por haber estado.
   */
  tradeable?: boolean;
}

export type PanueloCatalog = Record<string, PanueloItemDef>;

/** Por dónde llegó una pieza. */
export type PanueloVia = 'all' | 'code' | 'manual' | 'demo' | 'trade';

export interface PanueloOwned {
  /** Cuándo se consiguió (ms). */
  at: number;
  via: PanueloVia;
}

/** Dónde está cosida una pieza. */
export interface PanueloPlacement {
  /** De −1 (borde izquierdo) a 1 (borde derecho) del triángulo a esa altura. */
  u: number;
  /** De 0 (cuello) a 1 (pico). */
  v: number;
  /** Giro en grados, en sentido horario. */
  rot: number;
}

/** Lo que guarda cada persona (`users/{uid}/panuelo`). */
export interface PanueloUserState {
  color: PanueloColor | null;
  items: Record<string, PanueloOwned>;
  layout: Record<string, PanueloPlacement>;
  /** Última vez que cambió el color o la colocación (ms). Gana el más nuevo. */
  layoutAt: number;
  /**
   * Piezas que se han dado en un intercambio: id → cuándo. Sin esto, al
   * juntar el móvil con la nube (que SUMAN piezas) lo regalado volvería a
   * aparecer. Una pieza se tiene si se consiguió DESPUÉS de darla.
   */
  gone?: Record<string, number>;
}

// ── Puente con el visor 3D ─────────────────────────────────────────────────

/** Una pieza ya colocada, tal como la recibe el visor. */
export interface PanueloViewerItem extends PanueloPlacement {
  id: string;
  kind: PanueloItemKind;
  look: PanueloLook;
  size?: number;
}

export interface PanueloViewerState {
  color: PanueloColor;
  items: PanueloViewerItem[];
}

/** App → visor. */
export type PanueloCommand =
  | { type: 'state'; state: PanueloViewerState }
  | { type: 'mode'; mode: 'view' | 'edit' }
  | { type: 'focus'; id: string }
  | { type: 'blur' }
  /** Presentación de una pieza recién conseguida. */
  | { type: 'reveal'; id: string }
  | { type: 'select'; id: string | null }
  /** Inclinación del móvil, de −1 a 1 en cada eje. */
  | { type: 'tilt'; x: number; y: number }
  | { type: 'recenter' }
  /** Pide una foto del pañuelo tal como se ve, sobre un fondo de ese color. */
  | { type: 'snapshot'; background: string };

/** Visor → app. */
export type PanueloEvent =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'focus'; id: string }
  | { type: 'blur' }
  | { type: 'select'; id: string | null }
  | { type: 'pickup'; id: string }
  | { type: 'drop'; id: string; u: number; v: number }
  /** La foto pedida con `snapshot`, como `data:image/jpeg;base64,…`. */
  | { type: 'snapshot'; dataUrl: string }
  /** Háptica: el visor no puede vibrar; la app sí. */
  | { type: 'haptic'; kind: 'tap' | 'select' };
