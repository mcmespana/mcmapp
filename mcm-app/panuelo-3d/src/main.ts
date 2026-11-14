/**
 * El visor 3D del pañuelo virtual. Corre dentro de un WebView (o de un iframe
 * en web); la app le habla con `PanueloCommand` y él contesta con
 * `PanueloEvent` (`types/panuelo.ts`).
 *
 * Reglas de la casa:
 *
 * - **La app manda.** El visor no decide qué piezas hay ni dónde están: pinta
 *   el estado que le llega y avisa de lo que hace el dedo (tocar, soltar).
 * - **Se gira el pañuelo, no la cámara.** La luz y los reflejos se quedan
 *   quietos, como al darle vueltas a algo en la mano: el metal brilla al
 *   pasar.
 * - **Solo se pinta cuando algo cambia.** Quieto no gasta batería.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import type {
  PanueloColor,
  PanueloCommand,
  PanueloEvent,
  PanueloViewerItem,
  PanueloViewerState,
} from '@/types/panuelo';

import logoUrl from '../assets/logo-com.png';
import {
  BOUNDS,
  createPanuelo,
  flapPoint,
  uvToFlap,
  type Panuelo,
} from './cloth';
import { buildItem, disposeItem, type BuildContext } from './items';
import { loadImage } from './art';
import { clampToFlap } from '@/utils/panueloPlacement';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    __PANUELO_INIT__?: {
      state: PanueloViewerState;
      mode?: 'view' | 'edit';
      /** Sin la entrada con giro (tests y capturas). */
      still?: boolean;
    };
    __panuelo?: (cmd: PanueloCommand) => void;
  }
}

// ── Utilidades ─────────────────────────────────────────────────────────────

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
/** Llega pasándose un poco y vuelve: para lo que «cae» en su sitio. */
const easeBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

function post(event: PanueloEvent) {
  const msg = JSON.stringify(event);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
  else if (window.parent !== window) {
    window.parent.postMessage({ panuelo: msg }, '*');
  }
}

interface Tween {
  start: number;
  duration: number;
  ease: (k: number) => number;
  update: (k: number) => void;
  done?: () => void;
  key?: string;
}

interface Entry {
  id: string;
  data: PanueloViewerItem;
  /** Lo que se mueve y se orienta. */
  group: THREE.Group;
  radius: number;
  hit: THREE.Mesh;
  /** Escala de la pieza cosida (tamaño del catálogo). */
  scale: number;
  signature: string;
  /** La parte que cuelga, si la tiene, y su vaivén. */
  swing: THREE.Object3D | null;
  swingGain: number;
  swingAngle: number;
  swingVelocity: number;
}

/** La cámara mira al pañuelo un poco desde arriba (rad). */
const CAMERA_TILT = 0.11;
/** Altura del suelo imaginario, justo bajo el pico. */
const FLOOR_Y = -2.02;
/** Péndulo de las piezas que cuelgan: rigidez y freno (ζ ≈ 0,3: se mecen). */
const SWING_STIFFNESS = 70;
const SWING_DAMPING = 5;
/** Vaivén en reposo: amplitud (rad) y velocidad. */
const IDLE_SWAY = 0.07;
const IDLE_SPEED = 0.7;

// ── Visor ──────────────────────────────────────────────────────────────────

class Viewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  /** Lo que gira con el dedo: el pañuelo y todo lo que lleva cosido. */
  private root = new THREE.Group();
  private itemsGroup = new THREE.Group();
  private panuelo: Panuelo;
  private dimmer: THREE.Mesh;
  private ring: THREE.Mesh;
  private sparks: THREE.Points;
  private raycaster = new THREE.Raycaster();

  private entries = new Map<string, Entry>();
  private color: PanueloColor;
  private mode: 'view' | 'edit' = 'view';
  private focused: Entry | null = null;
  private selected: Entry | null = null;
  private logo: HTMLImageElement | null = null;
  private still = false;

  private yaw = 0;
  private pitch = 0;
  private yawVelocity = 0;
  private tiltX = 0;
  private tiltY = 0;
  private zoom = 1;
  private distance = 8;
  /** Giro de la pieza que se está mirando de cerca. */
  private spin = { yaw: 0, pitch: 0, velocity: 0 };

  /** Giro real del pañuelo en el último fotograma, para saber cuánto corre. */
  private lastYaw = 0;
  /** Vaivén en reposo: el pañuelo no está clavado, cuelga. */
  private idleSince = 0;
  private reducedMotion = false;
  private floor: THREE.Mesh;

  private tweens: Tween[] = [];
  private dirty = true;
  private frame = 0;
  private lastTime = 0;

  private pointers = new Map<number, { x: number; y: number }>();
  private gesture: null | {
    kind: 'orbit' | 'spin' | 'drag' | 'pinch' | 'pending-item';
    startX: number;
    startY: number;
    startTime: number;
    moved: boolean;
    entry?: Entry;
    pinchDistance?: number;
    pinchZoom?: number;
    /** Desfase entre el dedo y el centro de la pieza al cogerla. */
    offsetU?: number;
    offsetV?: number;
  } = null;

  constructor(
    private canvas: HTMLCanvasElement,
    init: NonNullable<Window['__PANUELO_INIT__']>,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    // «Neutral» y no ACES: ACES lava los colores, y aquí el verde del pañuelo
    // tiene que ser EL verde del pañuelo.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Luz de estudio: un entorno neutro para los reflejos y un foco que da
    // volumen a los pliegues y sombra a las piezas.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.03,
    ).texture;
    this.scene.environmentIntensity = 0.6;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(-3.6, 4.4, 4.8);
    key.target.position.copy(BOUNDS.center);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2.2;
    key.shadow.camera.right = 2.2;
    key.shadow.camera.top = 2.2;
    key.shadow.camera.bottom = -2.2;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 16;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 5;
    this.scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(3, 0.5, 4);
    this.scene.add(fill);

    this.color = init.state.color;
    this.panuelo = createPanuelo(
      this.color,
      this.renderer.capabilities.getMaxAnisotropy(),
    );
    this.root.add(this.panuelo.group, this.itemsGroup);
    // El pañuelo gira sobre su centro, no sobre la nuca.
    this.root.position.copy(BOUNDS.center);
    this.panuelo.group.position.copy(BOUNDS.center).multiplyScalar(-1);
    this.itemsGroup.position.copy(this.panuelo.group.position);
    this.scene.add(this.root);

    // El velo que apaga el pañuelo mientras se mira una pieza de cerca.
    this.dimmer = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.dimmer.visible = false;
    this.scene.add(this.dimmer);

    // Aro de selección del modo decorar.
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      }),
    );
    this.ring.renderOrder = 5;
    this.ring.visible = false;

    this.sparks = this.createSparks();
    this.scene.add(this.sparks);

    this.floor = this.createFloorShadow();
    this.scene.add(this.floor);
    this.reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.mode = init.mode ?? 'view';
    this.still = Boolean(init.still);
    this.syncItems(init.state.items, false);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();

    loadImage(logoUrl).then((img) => {
      if (!img) return;
      this.logo = img;
      this.panuelo.setLogo(img);
      // Las piezas que llevan el logo se rehacen con él.
      for (const entry of [...this.entries.values()]) {
        const look = entry.data.look;
        if ('logo' in look && look.logo) this.rebuild(entry);
      }
      this.invalidate();
    });

    if (!init.still) this.intro();
    this.frame = requestAnimationFrame(this.loop);
  }

  // ── Órdenes de la app ────────────────────────────────────────────────────

  handle(cmd: PanueloCommand) {
    switch (cmd.type) {
      case 'state':
        if (cmd.state.color !== this.color) this.changeColor(cmd.state.color);
        this.syncItems(cmd.state.items, true);
        break;
      case 'mode':
        this.setMode(cmd.mode);
        break;
      case 'focus': {
        const entry = this.entries.get(cmd.id);
        if (entry) this.focus(entry, false);
        break;
      }
      case 'blur':
        this.blur(false);
        break;
      case 'reveal': {
        const entry = this.entries.get(cmd.id);
        if (entry) this.focus(entry, false, true);
        break;
      }
      case 'select':
        this.select(cmd.id ? (this.entries.get(cmd.id) ?? null) : null, false);
        break;
      case 'tilt':
        this.tiltX = clamp(cmd.x, -1, 1);
        this.tiltY = clamp(cmd.y, -1, 1);
        this.invalidate();
        break;
      case 'recenter':
        this.turnTo(0, 0);
        break;
      case 'snapshot':
        this.snapshot(cmd.background);
        break;
    }
  }

  // ── Estado ───────────────────────────────────────────────────────────────

  private buildContext(): BuildContext {
    return { logo: this.logo, invalidate: () => this.invalidate() };
  }

  private syncItems(items: PanueloViewerItem[], animate: boolean) {
    const seen = new Set<string>();
    items.forEach((data, index) => {
      seen.add(data.id);
      const signature = JSON.stringify([data.kind, data.look, data.size]);
      let entry = this.entries.get(data.id);
      if (!entry) {
        entry = this.createEntry(data, signature);
        this.place(entry);
        if (animate) this.pop(entry, 0);
        else if (!this.still) this.pop(entry, 500 + index * 45);
        return;
      }
      const moved =
        entry.data.u !== data.u ||
        entry.data.v !== data.v ||
        entry.data.rot !== data.rot;
      entry.data = data;
      if (entry.signature !== signature) {
        this.rebuild(entry);
        entry.signature = signature;
      }
      if (moved && entry !== this.focused && this.gesture?.entry !== entry) {
        if (animate) this.glide(entry);
        else this.place(entry);
      }
    });
    for (const [id, entry] of this.entries) {
      if (seen.has(id)) continue;
      this.entries.delete(id);
      if (this.focused === entry) this.blur(true, true);
      if (this.selected === entry) this.select(null, true);
      this.remove(entry, animate);
    }
    this.invalidate();
  }

  private createEntry(data: PanueloViewerItem, signature: string): Entry {
    const built = buildItem(data.look, this.buildContext());
    const scale = clamp(data.size ?? 1, 0.7, 1.5);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(built.radius * 1.25, 10, 8),
      new THREE.MeshBasicMaterial(),
    );
    hit.visible = false;
    hit.scale.z = 0.5;
    built.group.add(hit);
    const entry: Entry = {
      id: data.id,
      data,
      group: built.group,
      radius: built.radius,
      hit,
      scale,
      signature,
      swing: built.swing ?? null,
      swingGain: built.swingGain ?? 1,
      swingAngle: 0,
      swingVelocity: 0,
    };
    hit.userData.entry = entry;
    this.itemsGroup.add(built.group);
    this.entries.set(data.id, entry);
    return entry;
  }

  /** Rehace el modelo de una pieza (cambió su aspecto) sin moverla. */
  private rebuild(entry: Entry) {
    const built = buildItem(entry.data.look, this.buildContext());
    const old = entry.group;
    built.group.position.copy(old.position);
    built.group.quaternion.copy(old.quaternion);
    built.group.scale.copy(old.scale);
    built.group.add(entry.hit);
    if (this.ring.parent === old) built.group.add(this.ring);
    old.parent?.add(built.group);
    old.parent?.remove(old);
    disposeItem(old);
    entry.group = built.group;
    entry.radius = built.radius;
    entry.swing = built.swing ?? null;
    entry.swingGain = built.swingGain ?? 1;
    entry.scale = clamp(entry.data.size ?? 1, 0.7, 1.5);
  }

  /** Dónde y cómo va cosida una pieza (en el espacio del pañuelo). */
  private seat(entry: Entry, lift = 0) {
    const { position, normal, up } = flapPoint(entry.data.u, entry.data.v);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, normal);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        (-entry.data.rot * Math.PI) / 180,
      ),
    );
    position.addScaledVector(normal, 0.004 + lift);
    return { position, quaternion };
  }

  private place(entry: Entry, lift = 0) {
    const { position, quaternion } = this.seat(entry, lift);
    entry.group.position.copy(position);
    entry.group.quaternion.copy(quaternion);
    entry.group.scale.setScalar(entry.scale * (lift > 0 ? 1.08 : 1));
  }

  /** Aparece creciendo desde nada, con un rebote. */
  private pop(entry: Entry, delay: number) {
    entry.group.scale.setScalar(0.0001);
    this.tween({
      delay,
      duration: 420,
      ease: easeBack,
      update: (k) =>
        entry.group.scale.setScalar(entry.scale * Math.max(0.0001, k)),
    });
  }

  /** Se desliza a su sitio nuevo (la app la ha movido o girado). */
  private glide(entry: Entry) {
    const from = {
      position: entry.group.position.clone(),
      quaternion: entry.group.quaternion.clone(),
    };
    const to = this.seat(entry);
    this.tween({
      key: `seat:${entry.id}`,
      duration: 260,
      ease: easeOut,
      update: (k) => {
        entry.group.position.lerpVectors(from.position, to.position, k);
        entry.group.quaternion.slerpQuaternions(
          from.quaternion,
          to.quaternion,
          k,
        );
      },
    });
  }

  private remove(entry: Entry, animate: boolean) {
    const finish = () => {
      entry.group.parent?.remove(entry.group);
      disposeItem(entry.group);
      this.invalidate();
    };
    if (!animate) return finish();
    const from = entry.group.scale.x;
    this.tween({
      duration: 200,
      ease: easeOut,
      update: (k) =>
        entry.group.scale.setScalar(Math.max(0.0001, from * (1 - k))),
      done: finish,
    });
  }

  private changeColor(color: PanueloColor) {
    this.color = color;
    const from = this.yaw;
    let swapped = false;
    // Una vuelta entera, y a mitad de vuelta (de espaldas) cambia la tela.
    this.tween({
      key: 'turn',
      duration: 900,
      ease: easeInOut,
      update: (k) => {
        this.yaw = from + k * Math.PI * 2;
        if (!swapped && k >= 0.5) {
          swapped = true;
          this.panuelo.setColor(color);
        }
      },
      done: () => {
        this.yaw = from;
      },
    });
  }

  private setMode(mode: 'view' | 'edit') {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'edit') {
      this.blur(false);
      this.turnTo(0, 0);
    } else {
      this.select(null, false);
    }
  }

  /** Gira el pañuelo hasta dejarlo de frente por el camino más corto. */
  private turnTo(yaw: number, pitch: number) {
    const fromYaw = this.yaw;
    const fromPitch = this.pitch;
    const turns = Math.round((fromYaw - yaw) / (Math.PI * 2));
    const toYaw = yaw + turns * Math.PI * 2;
    this.yawVelocity = 0;
    if (
      Math.abs(toYaw - fromYaw) < 0.001 &&
      Math.abs(pitch - fromPitch) < 0.001
    ) {
      return;
    }
    this.tween({
      key: 'turn',
      duration: 450,
      ease: easeInOut,
      update: (k) => {
        this.yaw = fromYaw + (toYaw - fromYaw) * k;
        this.pitch = fromPitch + (pitch - fromPitch) * k;
      },
    });
  }

  private intro() {
    this.yaw = -2.4;
    this.tween({
      key: 'turn',
      duration: 1500,
      ease: easeOut,
      update: (k) => {
        this.yaw = -2.4 * (1 - k);
      },
    });
  }

  // ── Mirar una pieza de cerca ─────────────────────────────────────────────

  /** Dónde flota la pieza enfocada y cuánto crece. */
  private focusPose(entry: Entry) {
    const z = this.distance * 0.42;
    const visible =
      2 * (this.distance - z) * Math.tan((this.camera.fov * Math.PI) / 360);
    const span = Math.min(visible, visible * this.camera.aspect);
    return {
      position: new THREE.Vector3(BOUNDS.center.x, BOUNDS.center.y, z),
      scale: (span * 0.29) / entry.radius,
    };
  }

  private focus(entry: Entry, notify: boolean, reveal = false) {
    if (this.focused === entry && !reveal) return;
    if (this.focused) this.blur(false, true);
    this.select(null, true);
    this.cancel('turn');
    this.yawVelocity = 0;
    this.focused = entry;
    this.spin = { yaw: 0, pitch: 0, velocity: 0 };
    // La pieza flota a una distancia fija de la cámara: sin zoom.
    this.zoom = 1;
    this.frameCamera();
    // Sale del pañuelo conservando su sitio en pantalla, y vuela al frente.
    this.scene.attach(entry.group);
    entry.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = false;
    });
    const pose = this.focusPose(entry);
    const from = {
      position: entry.group.position.clone(),
      quaternion: entry.group.quaternion.clone(),
      scale: reveal ? 0.0001 : entry.group.scale.x,
    };
    if (reveal) {
      from.position.copy(pose.position);
      this.burst(pose.position);
    }
    this.dimmer.visible = true;
    const axis = this.camera.position.clone().sub(BOUNDS.center).normalize();
    this.dimmer.position.copy(pose.position).addScaledVector(axis, -0.9);
    this.dimmer.quaternion.copy(this.camera.quaternion);
    const dim = this.dimmer.material as THREE.MeshBasicMaterial;
    const dimFrom = dim.opacity;
    // De frente a la cámara.
    const identity = this.camera.quaternion.clone();
    // Al presentarla, entra dando dos vueltas que frenan (como una medalla).
    const turns = reveal ? Math.PI * 4 : 0;
    this.tween({
      key: 'focus',
      duration: reveal ? 1300 : 420,
      ease: easeOut,
      update: (k) => {
        entry.group.position.lerpVectors(from.position, pose.position, k);
        entry.group.quaternion.slerpQuaternions(from.quaternion, identity, k);
        const grow = reveal ? Math.min(1, k * 2.2) : k;
        entry.group.scale.setScalar(
          from.scale + (pose.scale - from.scale) * grow,
        );
        this.spin.yaw = turns * (1 - k);
        dim.opacity = dimFrom + (0.55 - dimFrom) * k;
      },
    });
    if (notify) post({ type: 'focus', id: entry.id });
  }

  private blur(notify: boolean, instant = false) {
    const entry = this.focused;
    if (!entry) return;
    this.focused = null;
    this.cancel('focus');
    // Antes de volver, la pieza suelta el giro que le haya dado el dedo.
    this.applySpin(entry);
    this.itemsGroup.attach(entry.group);
    entry.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== entry.hit) o.castShadow = true;
    });
    const dim = this.dimmer.material as THREE.MeshBasicMaterial;
    const dimFrom = dim.opacity;
    const stillThere = this.entries.has(entry.id);
    if (instant || !stillThere) {
      if (stillThere) this.place(entry);
      dim.opacity = 0;
      this.dimmer.visible = false;
    } else {
      const from = {
        position: entry.group.position.clone(),
        quaternion: entry.group.quaternion.clone(),
        scale: entry.group.scale.x,
      };
      const to = this.seat(entry);
      this.tween({
        key: 'focus',
        duration: 380,
        ease: easeInOut,
        update: (k) => {
          entry.group.position.lerpVectors(from.position, to.position, k);
          entry.group.quaternion.slerpQuaternions(
            from.quaternion,
            to.quaternion,
            k,
          );
          entry.group.scale.setScalar(
            from.scale + (entry.scale - from.scale) * k,
          );
          dim.opacity = dimFrom * (1 - k);
        },
        done: () => {
          this.dimmer.visible = false;
        },
      });
    }
    if (notify) post({ type: 'blur' });
    this.invalidate();
  }

  private applySpin(entry: Entry) {
    entry.group.quaternion
      .copy(this.camera.quaternion)
      .multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            this.spin.pitch + this.tiltY * 0.25,
            this.spin.yaw + this.tiltX * 0.35,
            0,
            'YXZ',
          ),
        ),
      );
  }

  // ── Decorar ──────────────────────────────────────────────────────────────

  private select(entry: Entry | null, silent: boolean) {
    if (this.selected === entry) return;
    this.selected = entry;
    this.ring.parent?.remove(this.ring);
    if (entry) {
      this.ring.scale.setScalar(entry.radius * 1.18);
      this.ring.position.set(0, 0, 0.004);
      entry.group.add(this.ring);
      this.ring.visible = true;
    } else {
      this.ring.visible = false;
    }
    if (!silent) post({ type: 'select', id: entry?.id ?? null });
    this.invalidate();
  }

  // ── Chispas ──────────────────────────────────────────────────────────────

  private createSparks(): THREE.Points {
    const count = 36;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,190,0.9)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.22,
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }

  private burst(center: THREE.Vector3) {
    const attr = this.sparks.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    const dirs: THREE.Vector3[] = [];
    for (let i = 0; i < attr.count; i++) {
      const a = (i / attr.count) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.7 + Math.random() * 0.9;
      dirs.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -0.1));
    }
    const material = this.sparks.material as THREE.PointsMaterial;
    this.sparks.visible = true;
    this.tween({
      delay: 250,
      duration: 1100,
      ease: easeOut,
      update: (k) => {
        for (let i = 0; i < attr.count; i++) {
          attr.setXYZ(
            i,
            center.x + dirs[i].x * k,
            center.y + dirs[i].y * k - 0.25 * k * k,
            center.z + dirs[i].z,
          );
        }
        attr.needsUpdate = true;
        material.opacity = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      },
      done: () => {
        this.sparks.visible = false;
      },
    });
  }

  // ── Suelo, vaivén y foto ─────────────────────────────────────────────────

  /** Una sombra blanda bajo el pañuelo: sin ella parece pegado a la pantalla. */
  private createFloorShadow(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.9),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, FLOOR_Y, 0);
    mesh.renderOrder = -1;
    return mesh;
  }

  /**
   * Las piezas que cuelgan (medallas, cintas) se balancean cuando el pañuelo
   * gira o el móvil se inclina: un péndulo amortiguado por pieza. Devuelve si
   * alguna sigue moviéndose.
   */
  private stepSwing(dt: number, yawRate: number): boolean {
    const seconds = dt / 1000;
    let moving = false;
    for (const entry of this.entries.values()) {
      if (!entry.swing) continue;
      // Enfocada, la pieza se queda quieta para poder mirarla.
      const target =
        entry === this.focused
          ? 0
          : clamp(-yawRate * 0.22 - this.tiltX * 0.3, -0.75, 0.75) *
            entry.swingGain;
      const accel =
        SWING_STIFFNESS * (target - entry.swingAngle) -
        SWING_DAMPING * entry.swingVelocity;
      entry.swingVelocity += accel * seconds;
      entry.swingAngle += entry.swingVelocity * seconds;
      entry.swing.rotation.z = entry.swingAngle;
      if (
        Math.abs(entry.swingVelocity) > 0.004 ||
        Math.abs(target - entry.swingAngle) > 0.002
      ) {
        moving = true;
      }
    }
    return moving;
  }

  /** Una foto de lo que se ve, sobre un fondo liso, para compartirla. */
  private snapshot(background: string) {
    this.renderer.render(this.scene, this.camera);
    const source = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    post({ type: 'snapshot', dataUrl: out.toDataURL('image/jpeg', 0.92) });
  }

  // ── El dedo ──────────────────────────────────────────────────────────────

  private bindPointer() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e, true));
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * (1 - e.deltaY * 0.001));
      },
      { passive: false },
    );
  }

  private ndc(x: number, y: number): THREE.Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    );
  }

  private pickItem(x: number, y: number): Entry | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    this.scene.updateMatrixWorld();
    const hits = this.raycaster.intersectObjects(
      [...this.entries.values()].map((e) => e.hit),
      false,
    );
    const toCamera = new THREE.Vector3();
    const facing = new THREE.Vector3();
    for (const hit of hits) {
      const entry = hit.object.userData.entry as Entry;
      // Una pieza que da la espalda (el pañuelo está girado) no se toca a
      // través de la tela.
      entry.group.getWorldPosition(toCamera);
      toCamera.subVectors(this.camera.position, toCamera);
      entry.group.getWorldDirection(facing);
      if (facing.dot(toCamera) > 0) return entry;
    }
    return null;
  }

  /** El punto del triángulo que hay bajo el dedo, si lo hay. */
  private pickFlap(x: number, y: number): [number, number] | null {
    this.raycaster.setFromCamera(this.ndc(x, y), this.camera);
    const hit = this.raycaster.intersectObject(this.panuelo.flap, false)[0];
    if (!hit?.uv) return null;
    return uvToFlap(hit.uv.x, hit.uv.y);
  }

  private onDown(e: PointerEvent) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.yawVelocity = 0;
    if (this.pointers.size === 2 && !this.focused) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = {
        kind: 'pinch',
        startX: 0,
        startY: 0,
        startTime: performance.now(),
        moved: true,
        pinchDistance: Math.hypot(a.x - b.x, a.y - b.y),
        pinchZoom: this.zoom,
      };
      return;
    }
    if (this.pointers.size > 1) return;
    const base = {
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      moved: false,
    };
    if (this.focused) {
      this.cancel('focus-settle');
      this.gesture = { ...base, kind: 'spin' };
      return;
    }
    this.cancel('turn');
    const entry = this.pickItem(e.clientX, e.clientY);
    if (entry && this.mode === 'edit') {
      this.gesture = { ...base, kind: 'pending-item', entry };
    } else {
      this.gesture = { ...base, kind: 'orbit', entry: entry ?? undefined };
    }
  }

  private onMove(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev || !this.gesture) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;

    if (g.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.setZoom((g.pinchZoom ?? 1) * (d / (g.pinchDistance || d)));
      return;
    }

    if (!g.moved) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 6) return;
      g.moved = true;
      if (g.kind === 'pending-item' && g.entry) {
        // Coger la pieza: se levanta de la tela y sigue al dedo.
        g.kind = 'drag';
        const under = this.pickFlap(g.startX, g.startY);
        g.offsetU = under ? g.entry.data.u - under[0] : 0;
        g.offsetV = under ? g.entry.data.v - under[1] : 0;
        this.cancel(`seat:${g.entry.id}`);
        this.select(g.entry, false);
        this.place(g.entry, 0.05);
        post({ type: 'pickup', id: g.entry.id });
      }
    }

    const width = this.canvas.clientWidth || 1;
    if (g.kind === 'orbit') {
      const step = (dx / width) * Math.PI * 1.6;
      this.yaw += step;
      this.yawVelocity = step;
      this.pitch = clamp(this.pitch + (dy / width) * 1.2, -0.42, 0.42);
      if (this.mode === 'edit') this.yaw = clamp(this.yaw, -0.75, 0.75);
    } else if (g.kind === 'spin') {
      const step = (dx / width) * Math.PI * 2.2;
      this.spin.yaw += step;
      this.spin.velocity = step;
      this.spin.pitch = clamp(this.spin.pitch + (dy / width) * 2, -1, 1);
    } else if (g.kind === 'drag' && g.entry) {
      const under = this.pickFlap(e.clientX, e.clientY);
      if (under) {
        const [u, v] = clampToFlap(
          under[0] + (g.offsetU ?? 0),
          under[1] + (g.offsetV ?? 0),
        );
        g.entry.data = { ...g.entry.data, u, v };
        this.place(g.entry, 0.05);
      }
    }
    this.invalidate();
  }

  private onUp(e: PointerEvent, cancelled = false) {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (this.pointers.size < 2) this.gesture = null;
      return;
    }
    this.gesture = null;
    const tap = !cancelled && !g.moved && performance.now() - g.startTime < 450;

    if (g.kind === 'drag' && g.entry) {
      const entry = g.entry;
      // Cae en su sitio con un pequeño rebote.
      this.tween({
        key: `seat:${entry.id}`,
        duration: 240,
        ease: easeBack,
        update: (k) => this.place(entry, 0.05 * (1 - k)),
        done: () => this.place(entry),
      });
      post({ type: 'drop', id: entry.id, u: entry.data.u, v: entry.data.v });
      return;
    }
    if (g.kind === 'spin') {
      if (tap) {
        // Tocar fuera de la pieza la devuelve al pañuelo.
        const hit = this.pickItem(e.clientX, e.clientY);
        if (hit !== this.focused) this.blur(true);
        return;
      }
      // Al soltarla deja de cabecear, pero conserva la vuelta que le diste.
      const from = this.spin.pitch;
      this.tween({
        key: 'focus-settle',
        duration: 500,
        ease: easeOut,
        update: (k) => {
          this.spin.pitch = from * (1 - k);
        },
      });
      return;
    }
    if (!tap) return;
    const entry = g.entry ?? null;
    if (this.mode === 'edit') {
      this.select(entry, false);
      if (entry) post({ type: 'haptic', kind: 'select' });
    } else if (entry) {
      post({ type: 'haptic', kind: 'tap' });
      this.focus(entry, true);
    }
  }

  /**
   * Las piezas son rígidas y la tela no: vistas por detrás, los bordes
   * asomarían a través del pañuelo. Si una pieza da la espalda, no se pinta
   * (la tapa la tela de todos modos).
   */
  private cullHidden() {
    this.root.updateMatrixWorld();
    const toCamera = new THREE.Vector3();
    const facing = new THREE.Vector3();
    for (const entry of this.entries.values()) {
      if (entry === this.focused) {
        entry.group.visible = true;
        continue;
      }
      entry.group.getWorldPosition(toCamera);
      toCamera.subVectors(this.camera.position, toCamera).normalize();
      entry.group.getWorldDirection(facing);
      entry.group.visible = facing.dot(toCamera) > -0.05;
    }
  }

  private setZoom(zoom: number) {
    this.zoom = clamp(zoom, 0.8, 2.4);
    this.frameCamera();
    this.invalidate();
  }

  // ── Bucle ────────────────────────────────────────────────────────────────

  private tween(opts: {
    duration: number;
    ease: (k: number) => number;
    update: (k: number) => void;
    done?: () => void;
    key?: string;
    delay?: number;
  }) {
    if (opts.key) this.cancel(opts.key);
    this.tweens.push({
      start: performance.now() + (opts.delay ?? 0),
      duration: opts.duration,
      ease: opts.ease,
      update: opts.update,
      done: opts.done,
      key: opts.key,
    });
    this.invalidate();
  }

  private cancel(key: string) {
    this.tweens = this.tweens.filter((t) => t.key !== key);
  }

  invalidate() {
    this.dirty = true;
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frameCamera();
    if (this.focused) {
      const pose = this.focusPose(this.focused);
      this.focused.group.position.copy(pose.position);
      this.focused.group.scale.setScalar(pose.scale);
    }
    this.invalidate();
  }

  /** Aleja la cámara lo justo para que el pañuelo entero quepa. */
  private frameCamera() {
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    const fitH = BOUNDS.height / (2 * half);
    const fitW = BOUNDS.width / (2 * half * this.camera.aspect);
    this.distance = Math.max(fitH, fitW);
    const d = this.distance / this.zoom;
    // Un poco desde arriba: se ve el volumen del rollo y la sombra del suelo.
    this.camera.position.set(
      BOUNDS.center.x,
      BOUNDS.center.y + d * Math.sin(CAMERA_TILT),
      d * Math.cos(CAMERA_TILT),
    );
    this.camera.lookAt(BOUNDS.center);
    this.camera.updateProjectionMatrix();
  }

  private loop = (now: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(50, now - (this.lastTime || now));
    this.lastTime = now;

    // Inercia: al soltar, sigue girando y se va frenando.
    if (!this.gesture) {
      const friction = Math.pow(0.94, dt / 16.7);
      if (Math.abs(this.yawVelocity) > 0.0004) {
        this.yaw += this.yawVelocity * (dt / 16.7);
        this.yawVelocity *= friction;
        this.dirty = true;
      }
      if (this.focused && Math.abs(this.spin.velocity) > 0.0004) {
        this.spin.yaw += this.spin.velocity * (dt / 16.7);
        this.spin.velocity *= friction;
        this.dirty = true;
      }
    }

    if (this.tweens.length > 0) {
      this.dirty = true;
      const finished: Tween[] = [];
      for (const t of this.tweens) {
        if (now < t.start) continue;
        const k = clamp((now - t.start) / t.duration, 0, 1);
        t.update(t.ease(k));
        if (k >= 1) finished.push(t);
      }
      if (finished.length > 0) {
        this.tweens = this.tweens.filter((t) => !finished.includes(t));
        finished.forEach((t) => t.done?.());
      }
    }

    // En reposo el pañuelo se mece un poco, como colgado de una percha.
    const resting =
      !this.gesture &&
      !this.focused &&
      this.mode === 'view' &&
      !this.reducedMotion &&
      !this.still &&
      !document.hidden &&
      Math.abs(this.yawVelocity) <= 0.0004 &&
      !this.tweens.some((t) => t.key === 'turn');
    if (!resting) this.idleSince = now;
    const idle = resting
      ? IDLE_SWAY *
        Math.sin(((now - this.idleSince) / 1000) * IDLE_SPEED) *
        Math.min(1, (now - this.idleSince) / 1500)
      : 0;
    if (resting) this.dirty = true;

    const yawNow = this.yaw + idle + (this.focused ? 0 : this.tiltX * 0.16);
    const yawRate = dt > 0 ? ((yawNow - this.lastYaw) / dt) * 1000 : 0;
    this.lastYaw = yawNow;
    if (this.stepSwing(dt, yawRate)) this.dirty = true;

    if (!this.dirty) return;
    this.dirty = false;
    // El móvil inclinado mueve un poco el pañuelo: así brilla el metal.
    this.root.rotation.set(
      this.pitch + (this.focused ? 0 : this.tiltY * 0.1),
      yawNow,
      0,
    );
    this.cullHidden();
    if (this.focused && !this.tweens.some((t) => t.key === 'focus')) {
      this.applySpin(this.focused);
    } else if (this.focused) {
      // Durante el vuelo de entrada, el giro se suma a la orientación.
      this.focused.group.rotateY(this.spin.yaw);
    }
    this.renderer.render(this.scene, this.camera);
  };
}

// ── Arranque ───────────────────────────────────────────────────────────────

function boot() {
  const canvas = document.getElementById('panuelo') as HTMLCanvasElement | null;
  if (!canvas) return;
  const init = window.__PANUELO_INIT__ ?? {
    state: { color: 'green' as PanueloColor, items: [] },
  };
  try {
    const viewer = new Viewer(canvas, init);
    window.__panuelo = (cmd) => viewer.handle(cmd);
    // En web el visor vive en un iframe y las órdenes llegan por mensaje.
    window.addEventListener('message', (e) => {
      const cmd = (e.data as { panueloCommand?: PanueloCommand } | null)
        ?.panueloCommand;
      if (cmd) viewer.handle(cmd);
    });
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'error', message: String((err as Error)?.message ?? err) });
  }
}

window.addEventListener('error', (e) => {
  post({ type: 'error', message: String(e.message) });
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
