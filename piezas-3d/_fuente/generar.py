#!/usr/bin/env python3
"""
Genera los modelos 3D (`.glb`) de las piezas reales del pañuelo: chapas, el
pin y el troncho. Todo sale de aquí: la forma es código, y la cara de cada
chapa es una imagen de `tex/` (sacada de una foto de la pieza de verdad,
enderezada y limpiada).

    python3 piezas-3d/_fuente/generar.py            # todas
    python3 piezas-3d/_fuente/generar.py pin-mc     # solo una

Solo necesita `numpy` y `Pillow`. Escribe `piezas-3d/<id>.glb`.

Medidas en milímetros (al exportar se pasan a metros, que es lo que pide
glTF). La pieza mira a +Z y «arriba» es +Y. Los nombres, tallas y textos están
en `../piezas.json`: cambiar un nombre no pide regenerar nada.
"""

from __future__ import annotations

import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

AQUI = Path(__file__).resolve().parent
SALIDA = AQUI.parent
TEX = AQUI / 'tex'

# ───────────────────────────── geometría ──────────────────────────────────


class Malla:
    """Triángulos con posición, normal y UV. Una por material."""

    def __init__(self):
        self.P, self.N, self.UV, self.I, self.n = [], [], [], [], 0

    def add(self, P, N, UV, I):
        P = np.asarray(P, np.float32)
        N = np.asarray(N, np.float32)
        UV = np.asarray(UV, np.float32)
        I = np.asarray(I, np.uint32).reshape(-1, 3)
        # Cada triángulo mirando hacia su normal: así las piezas se pueden
        # construir sin pensar en el orden de los vértices.
        a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
        cara = np.cross(b - a, c - a)
        media = N[I[:, 0]] + N[I[:, 1]] + N[I[:, 2]]
        mal = (cara * media).sum(1) < 0
        I[mal] = I[mal][:, ::-1]
        vivo = np.linalg.norm(cara, axis=1) > 1e-12
        self.P.append(P)
        self.N.append(N)
        self.UV.append(UV)
        self.I.append(I[vivo] + self.n)
        self.n += len(P)
        return self

    def mover(self, M=None, t=(0, 0, 0)):
        """Aplica una rotación 3×3 y una traslación a TODO lo añadido."""
        M = np.eye(3) if M is None else np.asarray(M, float)
        self.P = [(p @ M.T + np.asarray(t)).astype(np.float32) for p in self.P]
        self.N = [(n @ M.T).astype(np.float32) for n in self.N]
        return self

    def datos(self):
        N = np.concatenate(self.N)
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        return (np.concatenate(self.P), N, np.concatenate(self.UV),
                np.concatenate(self.I))


def uv_plana(R, z_vuelta=None):
    """
    UV de frente: la imagen ocupa el disco de radio R. Por debajo de
    `z_vuelta` (lo que ya da la vuelta hacia atrás) se queda con el color del
    borde, para que el dibujo no se repita del revés en la trasera.
    """
    def f(x, y, z, r, th):
        k = np.minimum(1.0, R / np.maximum(r, 1e-9))
        if z_vuelta is not None:
            k = np.where(z < z_vuelta, 0.985 * R / np.maximum(r, 1e-9), k)
        return np.stack([0.5 + x * k / (2 * R), 0.5 - y * k / (2 * R)], -1)
    return f


def uv_fija(u=0.5, v=0.5):
    return lambda x, y, z, r, th: np.stack(
        [np.full_like(x, u), np.full_like(x, v)], -1)


def torno(m: Malla, perfil, uv, seg=96, th0=0.0, th1=2 * np.pi):
    """
    Revuelve un perfil (r, z) alrededor de Z. El perfil se recorre «por
    fuera»: del centro de la cara hacia el borde, bajando por el canto y
    volviendo por detrás. Tramos separados = arista viva entre ellos.
    """
    tramos = perfil if isinstance(perfil[0][0], (list, tuple, np.ndarray)) \
        else [perfil]
    cerrado = abs((th1 - th0) - 2 * np.pi) < 1e-9
    th = np.linspace(th0, th1, seg + 1)
    for tramo in tramos:
        t = np.asarray(tramo, float)
        d = np.gradient(t, axis=0)
        nrm = np.stack([-d[:, 1], d[:, 0]], 1)
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        r, z = t[:, 0][:, None], t[:, 1][:, None]
        c, s = np.cos(th)[None], np.sin(th)[None]
        x, y, zz = r * c, r * s, z + 0 * c
        P = np.stack([x, y, zz], -1).reshape(-1, 3)
        N = np.stack([nrm[:, 0:1] * c, nrm[:, 0:1] * s,
                      nrm[:, 1:2] + 0 * c], -1).reshape(-1, 3)
        UV = uv(x.ravel(), y.ravel(), zz.ravel(),
                (r + 0 * c).ravel(), (th[None] + 0 * r).ravel())
        k, w = len(t), seg + 1
        idx = []
        for i in range(k - 1):
            for j in range(seg):
                a, b = i * w + j, i * w + j + 1
                c2, d2 = (i + 1) * w + j, (i + 1) * w + j + 1
                idx += [[a, c2, b], [b, c2, d2]]
        m.add(P, N, UV, idx)
    return cerrado


def arco(c, r, a0, a1, n=8):
    """Puntos de un arco en el plano (r, z), en grados."""
    a = np.deg2rad(np.linspace(a0, a1, n))
    return [(c[0] + r * np.cos(x), c[1] + r * np.sin(x)) for x in a]


def tubo(m: Malla, pts, radio, lados=10, punta=False, uv=(0.5, 0.5)):
    """Un alambre: tubo a lo largo de una polilínea. `punta` lo afila al final."""
    p = np.asarray(pts, float)
    n = len(p)
    tan = np.gradient(p, axis=0)
    tan /= np.linalg.norm(tan, axis=1, keepdims=True)
    # Marcos sin torsión (transporte paralelo).
    ref = np.array([0, 0, 1.0]) if abs(tan[0][2]) < 0.9 else np.array([1.0, 0, 0])
    u = np.cross(tan[0], ref)
    u /= np.linalg.norm(u)
    U = [u]
    for i in range(1, n):
        u = U[-1] - tan[i] * np.dot(U[-1], tan[i])
        U.append(u / np.linalg.norm(u))
    U = np.array(U)
    V = np.cross(tan, U)
    radios = np.full(n, float(radio))
    if punta:
        k = max(2, n // 4)
        radios[-k:] = np.linspace(radio, radio * 0.08, k)
    a = np.linspace(0, 2 * np.pi, lados, endpoint=False)
    ca, sa = np.cos(a)[None, :, None], np.sin(a)[None, :, None]
    dirs = U[:, None, :] * ca + V[:, None, :] * sa
    P = (p[:, None, :] + dirs * radios[:, None, None]).reshape(-1, 3)
    N = dirs.reshape(-1, 3)
    idx = []
    for i in range(n - 1):
        for j in range(lados):
            a0, b0 = i * lados + j, i * lados + (j + 1) % lados
            c0, d0 = a0 + lados, b0 + lados
            idx += [[a0, c0, b0], [b0, c0, d0]]
    UV = np.tile(np.array(uv, np.float32), (len(P), 1))
    m.add(P, N, UV, idx)
    # Tapas
    for fin, sgn in ((0, -1), (n - 1, 1)):
        centro = p[fin]
        aro = P.reshape(n, lados, 3)[fin]
        Pc = np.vstack([centro, aro])
        Nc = np.tile(tan[fin] * sgn, (lados + 1, 1))
        ic = [[0, 1 + j, 1 + (j + 1) % lados] for j in range(lados)]
        m.add(Pc, Nc, np.tile(np.array(uv, np.float32), (lados + 1, 1)), ic)


def caja(m: Malla, centro, tam, M=None, uv=(0.5, 0.5)):
    M = np.eye(3) if M is None else np.asarray(M, float)
    h = np.asarray(tam, float) / 2
    for eje in range(3):
        for sg in (-1, 1):
            n = np.zeros(3)
            n[eje] = sg
            a, b = [e for e in range(3) if e != eje]
            q = []
            for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                v = np.zeros(3)
                v[eje], v[a], v[b] = sg * h[eje], sa * h[a], sb * h[b]
                q.append(v)
            P = np.array(q) @ M.T + np.asarray(centro)
            N = np.tile(n @ M.T, (4, 1))
            m.add(P, N, np.tile(np.array(uv, np.float32), (4, 1)),
                  [[0, 1, 2], [0, 2, 3]])


def cinta(m: Malla, camino, normales, ancho_dir, ancho, grosor, uv=(0.5, 0.5)):
    """Una tira plana (cuero, chapa doblada) a lo largo de un camino."""
    p = np.asarray(camino, float)
    nn = np.asarray(normales, float)
    nn /= np.linalg.norm(nn, axis=1, keepdims=True)
    w = np.asarray(ancho_dir, float)
    w = w / np.linalg.norm(w)
    n = len(p)
    esquinas = []
    for sw, sn in ((-1, 1), (1, 1), (1, -1), (-1, -1)):
        esquinas.append(p + w * sw * ancho / 2 + nn * sn * grosor / 2)
    caras = [(0, 1, nn), (1, 2, np.tile(w, (n, 1))),
             (2, 3, -nn), (3, 0, np.tile(-w, (n, 1)))]
    for a, b, nor in caras:
        P = np.vstack([esquinas[a], esquinas[b]])
        N = np.vstack([nor, nor])
        idx = []
        for i in range(n - 1):
            idx += [[i, i + 1, n + i], [n + i, i + 1, n + i + 1]]
        m.add(P, N, np.tile(np.array(uv, np.float32), (2 * n, 1)), idx)
    for fin, sg in ((0, -1), (n - 1, 1)):
        t = (p[min(fin + 1, n - 1)] - p[max(fin - 1, 0)]) * sg
        t /= np.linalg.norm(t)
        P = np.array([e[fin] for e in esquinas])
        m.add(P, np.tile(t, (4, 1)), np.tile(np.array(uv, np.float32), (4, 1)),
              [[0, 1, 2], [0, 2, 3]])


ROT_X180 = np.diag([1.0, -1.0, -1.0])   # mirar hacia atrás sin espejar


# ───────────────────────────── texturas ───────────────────────────────────


def png(img: Image.Image) -> tuple[bytes, str]:
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return b.getvalue(), 'image/png'


def jpg(img: Image.Image, q=90) -> tuple[bytes, str]:
    b = io.BytesIO()
    img.convert('RGB').save(b, 'JPEG', quality=q, subsampling=0, optimize=True)
    return b.getvalue(), 'image/jpeg'


def cara(nombre, gamma=1.0, color=1.0) -> Image.Image:
    """La cara de una pieza. `gamma` > 1 la oscurece y `color` > 1 la aviva:
    el visor (ACES + exposición) deja pálidas las caras muy claras."""
    img = Image.open(TEX / f'{nombre}.png').convert('RGB')
    if gamma == 1.0 and color == 1.0:
        return img
    a = (np.asarray(img, np.float32) / 255) ** gamma
    gris = a.mean(2, keepdims=True)
    a = np.clip(gris + (a - gris) * color, 0, 1)
    return Image.fromarray((a * 255).astype(np.uint8), 'RGB')


def normal_de_altura(h: np.ndarray, fuerza: float) -> Image.Image:
    """Mapa de normales (convención glTF: verde hacia arriba) de una altura."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    nx, ny, nz = -dx * fuerza, dy * fuerza, np.ones_like(h)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / L, ny / L, nz / L], -1) * 0.5 + 0.5
    return Image.fromarray((rgb * 255).astype(np.uint8), 'RGB')


def ruido(shape, escala, semilla, envolver_x=True):
    """Ruido suave (valores 0–1), que casa por los lados si `envolver_x`."""
    rng = np.random.default_rng(semilla)
    h, w = shape
    gh, gw = max(2, h // escala), max(2, w // escala)
    g = rng.random((gh, gw)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8), 'L')
    if envolver_x:
        im = Image.fromarray(np.hstack([np.asarray(im)] * 3), 'L')
        im = im.resize((w * 3, h), Image.BICUBIC).crop((w, 0, 2 * w, h))
    else:
        im = im.resize((w, h), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255


# ───────────────────────────── materiales ─────────────────────────────────


def hexa(c, a=1.0):
    c = c.lstrip('#')
    v = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [round(x ** 2.2, 4) for x in v] + [a]   # sRGB → lineal


def metal(nombre, color, rugosidad=0.32):
    return {'name': nombre, 'pbrMetallicRoughness': {
        'baseColorFactor': hexa(color), 'metallicFactor': 1.0,
        'roughnessFactor': rugosidad}}


ACERO = ('#C9CCD1', 0.30)
HOJALATA = ('#B9BBBE', 0.42)
LATON = ('#D2A94C', 0.30)


# ───────────────────────────── escritor glTF ──────────────────────────────


class Glb:
    def __init__(self, nombre):
        self.nombre = nombre
        self.bin = bytearray()
        self.j = {'asset': {'version': '2.0', 'generator': 'mcmapp piezas-3d'},
                  'scene': 0, 'scenes': [{'name': nombre, 'nodes': []}],
                  'nodes': [], 'meshes': [], 'materials': [], 'accessors': [],
                  'bufferViews': [], 'buffers': [{}], 'images': [],
                  'textures': [], 'samplers': [
                      {'magFilter': 9729, 'minFilter': 9987,
                       'wrapS': 33071, 'wrapT': 33071},
                      {'magFilter': 9729, 'minFilter': 9987,
                       'wrapS': 10497, 'wrapT': 33071}],
                  'extensionsUsed': []}

    def _vista(self, datos: bytes, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(datos)}
        if target:
            v['target'] = target
        self.bin += datos
        self.j['bufferViews'].append(v)
        return len(self.j['bufferViews']) - 1

    def _acc(self, arr, tipo, comp, target, minmax=False):
        a = {'bufferView': self._vista(arr.tobytes(), target),
             'componentType': comp, 'count': len(arr), 'type': tipo}
        if minmax:
            a['min'] = [float(x) for x in arr.min(0)]
            a['max'] = [float(x) for x in arr.max(0)]
        self.j['accessors'].append(a)
        return len(self.j['accessors']) - 1

    def textura(self, datos_mime, envolver=False):
        datos, mime = datos_mime
        self.j['images'].append({'bufferView': self._vista(datos),
                                 'mimeType': mime})
        self.j['textures'].append({'source': len(self.j['images']) - 1,
                                   'sampler': 1 if envolver else 0})
        return len(self.j['textures']) - 1

    def material(self, mat):
        for ext in mat.get('extensions', {}):
            if ext not in self.j['extensionsUsed']:
                self.j['extensionsUsed'].append(ext)
        self.j['materials'].append(mat)
        return len(self.j['materials']) - 1

    def nodo(self, nombre, partes):
        """`partes`: lista de (Malla, índice de material)."""
        prims = []
        for malla, mat in partes:
            P, N, UV, I = malla.datos()
            P = (P * 0.001).astype(np.float32)   # mm → m
            comp, I2 = (5123, I.astype(np.uint16)) if len(P) < 65535 \
                else (5125, I.astype(np.uint32))
            prims.append({'attributes': {
                'POSITION': self._acc(P, 'VEC3', 5126, 34962, True),
                'NORMAL': self._acc(N.astype(np.float32), 'VEC3', 5126, 34962),
                'TEXCOORD_0': self._acc(UV.astype(np.float32), 'VEC2', 5126,
                                        34962)},
                'indices': self._acc(I2.reshape(-1), 'SCALAR', comp, 34963),
                'material': mat})
        self.j['meshes'].append({'name': nombre, 'primitives': prims})
        self.j['nodes'].append({'name': nombre,
                                'mesh': len(self.j['meshes']) - 1})
        self.j['scenes'][0]['nodes'].append(len(self.j['nodes']) - 1)

    def guardar(self, ruta: Path):
        j = self.j
        if not j['extensionsUsed']:
            del j['extensionsUsed']
        if not j['images']:
            for k in ('images', 'textures', 'samplers'):
                del j[k]
        while len(self.bin) % 4:
            self.bin.append(0)
        j['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(j, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(ruta, 'wb') as f:
            f.write(struct.pack('<4sII', b'glTF', 2, total))
            f.write(struct.pack('<I4s', len(js), b'JSON') + js)
            f.write(struct.pack('<I4s', len(self.bin), b'BIN\0') + self.bin)
        return total


# ───────────────────────────── las piezas ─────────────────────────────────


def imperdible(m: Malla, largo, z, radio=0.45):
    """
    El alambre de una chapa de imperdible, tumbado sobre la trasera (que mira
    a −Z, a la altura `z`): muelle a un lado, pincho recto y gancho al otro.
    """
    L = largo / 2
    zb = z - radio            # apoyado en la chapa
    zp = z - 2.1              # el pincho va levantado
    # Base: el tramo que queda sujeto a la chapa
    tubo(m, [(-L, 0, zb), (L * 0.95, 0, zb)], radio)
    # Muelle: vuelta y media
    R = (zb - zp) / 2 + 0.25
    t = np.linspace(-np.pi / 2, -np.pi / 2 + 2 * np.pi * 1.5, 40)
    muelle = [(-L - R * np.cos(a) * 0.0 - R * np.sin(a + np.pi / 2) * 0.0
               + (-R * np.cos(a + np.pi / 2)), 0.5 * (i / 39 - 0.5) * 2.2,
               (zb + zp) / 2 - R * np.sin(a + np.pi) * -1 * 0 + R * np.sin(a))
              for i, a in enumerate(t)]
    # empalme: del final de la base al muelle y del muelle al pincho
    ini = [(-L, 0, zb)] + muelle
    fin = muelle[-1]
    pincho = [fin, (-L * 0.8, fin[1], zp), (L * 1.02, 0.0, zp)]
    tubo(m, ini, radio)
    tubo(m, np.array([pincho[0], pincho[1]]), radio)
    tubo(m, np.linspace(pincho[1], pincho[2], 12), radio, punta=True)
    # Gancho: sube desde la base y se cierra sobre el pincho
    a = np.linspace(np.pi / 2, -np.pi * 0.75, 14)
    rg = (zb - zp) / 2 + 0.5
    gancho = [(L * 0.95, 0, zb)] + [
        (L * 0.95 + 0.2, rg * np.cos(x) * 0.9, (zb + zp) / 2 - 0.25
         + rg * np.sin(x)) for x in a]
    tubo(m, gancho, radio)


def chapa_imperdible(pid, diametro, textura, rugosidad=0.22, mate=False):
    """Chapa redonda abombada, con su trasera de hojalata y el imperdible."""
    R = diametro / 2
    g = max(3.4, diametro * 0.105)        # grosor total
    f = min(1.9, g * 0.45)                # radio del canto
    flecha = diametro * 0.035             # cuánto se abomba la cara
    glb = Glb(pid)
    cara_m = Malla()
    # Cara: casquete suave + canto redondeado + vuelta por detrás
    rs = np.linspace(0, R - f, 28)
    domo = [(r, flecha * (1 - (r / (R - f)) ** 2)) for r in rs]
    canto = arco((R - f, -f), f, 90, -90, 14)[1:]
    vuelta = [(R - f - 0.9, -2 * f)]
    perfil = domo + canto + vuelta
    torno(cara_m, perfil, uv_plana(R * 1.012, z_vuelta=-f * 1.15))
    z_tras = -2 * f
    tras = Malla()
    # Trasera: labio, escalón hacia dentro y fondo plano
    r_lab = R - f - 0.9
    hondo = z_tras + 0.9
    torno(tras, [
        [(r_lab, z_tras), (r_lab - 0.5, z_tras)],
        [(r_lab - 0.5, z_tras), (r_lab - 1.1, hondo)],
        [(r_lab - 1.1, hondo), (0.0, hondo)],
    ], uv_fija())
    alambre = Malla()
    imperdible(alambre, diametro * 0.62, hondo)
    alambre.mover(t=(0, diametro * 0.12, 0))

    t_cara = glb.textura(jpg(textura, 92))
    mat_cara = glb.material({
        'name': 'cara', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': t_cara}, 'metallicFactor': 0.0,
            'roughnessFactor': rugosidad},
        'extensions': {'KHR_materials_clearcoat': {
            'clearcoatFactor': 0.25 if mate else 1.0,
            'clearcoatRoughnessFactor': 0.45 if mate else 0.06}}})
    mat_tras = glb.material(metal('trasera', *HOJALATA))
    mat_al = glb.material(metal('imperdible', *ACERO))
    glb.nodo('chapa', [(cara_m, mat_cara), (tras, mat_tras)])
    glb.nodo('imperdible', [(alambre, mat_al)])
    return glb


def chapa_og():
    """La chapa antigua: disco plano de plástico amarillo, estampado en negro."""
    pid, D, g, bisel = 'chapa-og', 38.0, 3.0, 0.5
    R = D / 2
    glb = Glb(pid)
    disco = Malla()
    torno(disco, [
        [(0, 0), (R - bisel, 0)],
        [(R - bisel, 0), (R, -bisel)],
        [(R, -bisel), (R, -g + bisel)],
        [(R, -g + bisel), (R - bisel, -g)],
    ], uv_plana(R))
    lisa = Malla()
    torno(lisa, [[(R - bisel, -g), (0, -g)]], uv_fija(0.5, 0.02))
    # Por detrás: taco de plástico pegado y el alfiler de latón
    taco = Malla()
    caja(taco, (0, 2.5, -g - 1.2), (14, 9, 2.4), uv=(0.5, 0.02))
    alfiler = Malla()
    zp = -g - 2.4 - 0.5
    lazo = [(6.2 + 1.1 * np.cos(a), 2.5 + 0.0, zp + 1.1 * np.sin(a) + 0.6)
            for a in np.linspace(0, 2 * np.pi * 1.25, 22)]
    tubo(alfiler, lazo, 0.42)
    tubo(alfiler, np.linspace((6.2, 2.5, zp), (-15.5, 2.5, zp), 14), 0.42,
         punta=True)
    tubo(alfiler, [(-6.4, 2.5, -g - 2.4), (-6.4, 2.5, zp - 0.9),
                   (-6.4, 3.3, zp - 0.9), (-6.4, 3.3, zp + 0.2)], 0.42)

    img = cara(pid)
    a = np.asarray(img, np.float32)
    tinta = (a.sum(2) < 200).astype(np.float32)
    tinta = np.asarray(Image.fromarray((tinta * 255).astype(np.uint8))
                       .filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    # La tinta es estampación brillante: más lisa que el plástico.
    orm = np.zeros(a.shape, np.float32)
    orm[..., 1] = 0.42 - 0.24 * tinta      # G = rugosidad
    orm[..., 0] = 1.0
    # Se recompone con dos tintas planas: el amarillo, más intenso que en la
    # foto para que el visor (ACES) no lo deje pálido.
    am, ne = np.array([240, 200, 0], np.float32), np.array([20, 19, 16], np.float32)
    plano = am[None, None] * (1 - tinta[..., None]) + ne[None, None] * tinta[..., None]
    img = Image.fromarray(plano.astype(np.uint8), 'RGB')
    t_cara = glb.textura(png(img.quantize(48).convert('RGB')))
    t_orm = glb.textura(png(Image.fromarray((orm * 255).astype(np.uint8))
                            .quantize(32).convert('RGB')))
    h = np.asarray(Image.fromarray((tinta * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255
    t_nor = glb.textura(png(normal_de_altura(h, 3.0)))
    mat = glb.material({'name': 'plastico', 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': t_cara},
        'metallicRoughnessTexture': {'index': t_orm},
        'metallicFactor': 0.0, 'roughnessFactor': 1.0},
        'normalTexture': {'index': t_nor, 'scale': 0.3}})
    mat_liso = glb.material({'name': 'plastico-liso', 'pbrMetallicRoughness': {
        'baseColorFactor': hexa('#F0C800'), 'metallicFactor': 0.0,
        'roughnessFactor': 0.4}})
    mat_taco = glb.material({'name': 'taco', 'pbrMetallicRoughness': {
        'baseColorFactor': hexa('#E9CF4A'), 'metallicFactor': 0.0,
        'roughnessFactor': 0.18}})
    mat_al = glb.material(metal('alfiler', *LATON))
    glb.nodo('chapa', [(disco, mat), (lisa, mat_liso)])
    glb.nodo('imperdible', [(taco, mat_taco), (alfiler, mat_al)])
    return glb


def mariposa(cierre: Malla, zc):
    """Cierre de mariposa de un pin. `zc`: la cara que toca la tela."""
    Rc = 5.6
    torno(cierre, [
        [(0.55, zc), (Rc - 0.4, zc)] + arco((Rc - 0.4, zc - 0.4), 0.4, 90, 0,
                                            5)[1:],
        [(Rc, zc - 0.4), (Rc, zc - 1.0)],
        [(Rc, zc - 1.0), (2.6, zc - 1.0)],
        [(2.6, zc - 1.0), (2.2, zc - 3.0)] + arco((1.6, zc - 3.0), 0.6, 0,
                                                  -90, 5)[1:],
        [(1.6, zc - 3.6), (0.55, zc - 3.6)],
    ], uv_fija(), seg=48)
    for sg in (-1, 1):               # las dos alas
        a = np.linspace(0, np.pi, 14)
        cam = np.stack([sg * (2.6 + (Rc - 2.9) * (1 - np.cos(a)) / 2),
                        0 * a, zc - 1.0 - 1.9 * np.sin(a)], 1)
        nor = np.stack([-sg * np.cos(a), 0 * a, -np.sin(a) - 0.2], 1)
        cinta(cierre, cam, nor, (0, 1, 0), 4.2, 0.35)


def pin_jmj():
    """Pin esmaltado rectangular: metal con las letras en esmalte hundido."""
    pid, W, H, g = 'jmj-lisboa-2023', 30.0, 38.0, 1.8
    glb = Glb(pid)
    lab = np.asarray(Image.open(TEX / f'{pid}-tintas.png').convert('L')) // 100
    hh, ww = lab.shape
    # Líneas de metal: el contorno de cada tinta y el marco
    def suave(m, r):
        return np.asarray(Image.fromarray((m * 255).astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    tinta = (lab > 0).astype(np.float32)
    b = suave(tinta, 2.2)
    linea = np.clip(1 - np.abs(b - 0.5) / 0.32, 0, 1)
    marco = np.zeros_like(tinta)
    mm = 20
    marco[:mm] = marco[-mm:] = 1
    marco[:, :mm] = marco[:, -mm:] = 1
    linea = np.clip(np.maximum(linea, suave(marco, 1.5)), 0, 1)
    col = np.zeros((hh, ww, 3), np.float32)
    col[:] = (244, 244, 240)
    col[lab == 1] = (26, 146, 52)
    col[lab == 2] = (208, 30, 38)
    col = np.asarray(Image.fromarray(col.astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(0.8)), np.float32)
    plata = np.array((150, 150, 146), np.float32)
    col = col * (1 - linea[..., None]) + plata * linea[..., None]
    orm = np.zeros((hh, ww, 3), np.float32)
    orm[..., 1] = 0.16 + 0.14 * linea       # rugosidad
    orm[..., 2] = linea                     # metal
    orm[..., 0] = 1
    # El esmalte hace panza entre las líneas
    altura = suave(1 - linea, 5) * 0.8 + linea
    t_col = glb.textura(jpg(Image.fromarray(col.astype(np.uint8)), 92))
    t_orm = glb.textura(jpg(Image.fromarray((orm * 255).astype(np.uint8)), 88))
    t_nor = glb.textura(jpg(normal_de_altura(suave(altura, 1.5), 4.0), 92))
    cara_m = Malla()
    P = np.array([[-W / 2, -H / 2, 0], [W / 2, -H / 2, 0],
                  [W / 2, H / 2, 0], [-W / 2, H / 2, 0]])
    cara_m.add(P, np.tile([0, 0, 1.0], (4, 1)),
               [[0, 1], [1, 1], [1, 0], [0, 0]], [[0, 1, 2], [0, 2, 3]])
    cuerpo = Malla()
    caja(cuerpo, (0, 0, -g / 2 - 0.01), (W, H, g))
    pincho = Malla()
    cierre = Malla()
    for dy in (H * 0.22,):
        tubo(pincho, np.linspace((0, dy, -g), (0, dy, -g - 8.2), 10), 0.5,
             punta=True)
        mariposa(cierre, -g - 2.6)
        cierre.mover(t=(0, dy, 0))
    mat_cara = glb.material({'name': 'esmalte', 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': t_col},
        'metallicRoughnessTexture': {'index': t_orm},
        'metallicFactor': 1.0, 'roughnessFactor': 1.0},
        'normalTexture': {'index': t_nor, 'scale': 1.0}})
    mat_metal = glb.material(metal('metal', '#CDCBC4', 0.28))
    mat_cierre = glb.material(metal('cierre', *LATON))
    glb.nodo('pin', [(cara_m, mat_cara), (cuerpo, mat_metal),
                     (pincho, mat_metal)])
    glb.nodo('cierre', [(cierre, mat_cierre)])
    return glb


def pin_mc():
    """Pin pequeño: cazoleta de metal, dibujo bajo resina y cierre de mariposa."""
    pid, D, g = 'mc-congreso-3', 18.0, 2.2
    R = D / 2
    aro = 1.15                      # ancho del reborde
    glb = Glb(pid)
    ri = R - aro
    # Dibujo, abombado como la gota de resina
    arte = Malla()
    rs = np.linspace(0, ri, 20)
    torno(arte, [(r, 0.15 + 0.55 * (1 - (r / ri) ** 2) - 0.25) for r in rs],
          uv_plana(ri / 0.97), seg=72)
    # Cazoleta: reborde redondeado, canto y base
    cuerpo = Malla()
    borde = [(ri, -0.1)] + arco((R - aro / 2, 0.12), aro / 2, 180, 0, 12)
    torno(cuerpo, [
        borde,
        [(R, 0.12), (R, -g + 0.35)] + arco((R - 0.35, -g + 0.35), 0.35,
                                           0, -90, 6)[1:],
        [(R - 0.35, -g), (0, -g)],
    ], uv_fija(), seg=72)
    # Pincho
    pincho = Malla()
    tubo(pincho, np.linspace((0, 0, -g), (0, 0, -g - 8.2), 10), 0.5, punta=True)
    cierre = Malla()
    mariposa(cierre, -g - 2.6)

    # El visor aclara: se oscurece y se aviva para que el azul no se lave.
    arte_img = cara(pid, 1.8, 1.35).resize((768, 768), Image.LANCZOS)
    a = np.asarray(arte_img, np.float32) / 255
    t_arte = glb.textura(jpg(Image.fromarray((a * 255).astype(np.uint8)), 90))
    mat_arte = glb.material({
        'name': 'resina', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': t_arte}, 'metallicFactor': 0.0,
            'roughnessFactor': 0.35},
        'extensions': {'KHR_materials_clearcoat': {
            'clearcoatFactor': 1.0, 'clearcoatRoughnessFactor': 0.03}}})
    mat_metal = glb.material(metal('metal', '#CDCBC4', 0.24))
    mat_cierre = glb.material(metal('cierre', *LATON))
    glb.nodo('pin', [(arte, mat_arte), (cuerpo, mat_metal),
                     (pincho, mat_metal)])
    glb.nodo('cierre', [(cierre, mat_cierre)])
    return glb


def troncho():
    """
    El troncho: tubo de cuero con el logo del COM grabado delante y cosido
    por detrás con una tira del mismo cuero. Eje vertical (Y).
    """
    pid = 'troncho'
    H, Re, gro = 31.0, 11.0, 2.4       # alto, radio exterior, grosor del cuero
    Ri = Re - gro
    hueco = np.deg2rad(4.0)            # la raja de detrás
    fil = 0.55
    glb = Glb(pid)

    # El tubo se tornea alrededor de Z y luego se pone de pie.
    # θ = 0 es el frente; la raja queda en θ = ±180°.
    th0, th1 = -np.pi + hueco / 2, np.pi - hueco / 2

    def uv_fuera(x, y, z, r, th):
        return np.stack([0.5 + th / (2 * np.pi), 0.5 - z / H], -1)

    fuera = Malla()
    torno(fuera, [(Re, H / 2 - fil), (Re, -H / 2 + fil)], uv_fuera,
          seg=120, th0=th0, th1=th1)
    crudo = Malla()
    uvc = uv_fija(0.5, 0.5)
    arriba = arco((Re - fil, H / 2 - fil), fil, 0, 90, 6) + \
        arco((Ri + fil, H / 2 - fil), fil, 90, 180, 6)
    abajo = arco((Ri + fil, -H / 2 + fil), fil, 180, 270, 6) + \
        arco((Re - fil, -H / 2 + fil), fil, 270, 360, 6)
    torno(crudo, [arriba[::-1]], uvc, seg=120, th0=th0, th1=th1)
    torno(crudo, [abajo[::-1]], uvc, seg=120, th0=th0, th1=th1)
    dentro = Malla()
    torno(dentro, [[(Ri, -H / 2 + fil), (Ri, H / 2 - fil)]], uvc, seg=120,
          th0=th0, th1=th1)
    # Los dos cantos de la raja
    for th, sg in ((th0, -1), (th1, 1)):
        c, s = np.cos(th), np.sin(th)
        q = np.array([[Ri * c, Ri * s, -H / 2 + fil], [Re * c, Re * s, -H / 2 + fil],
                      [Re * c, Re * s, H / 2 - fil], [Ri * c, Ri * s, H / 2 - fil]])
        n = np.array([-s, c, 0]) * sg
        crudo.add(q, np.tile(n, (4, 1)), np.tile([0.5, 0.5], (4, 1)),
                  [[0, 1, 2], [0, 2, 3]])

    # Cosido: cuatro tiras que cruzan la raja y se meten por sus ojales
    tiras = Malla()
    medio = np.deg2rad(21)
    ys = np.linspace(H / 2 - 5.2, -H / 2 + 5.2, 4)
    for k, yk in enumerate(ys):
        a = np.linspace(-medio, medio, 16)
        hund = np.clip((np.abs(a) / medio - 0.72) / 0.28, 0, 1) ** 2
        rad = Re + 0.55 - 1.3 * hund
        th = np.pi + a
        incl = 0.45 * a / medio
        cam = np.stack([rad * np.cos(th), rad * np.sin(th), yk + incl], 1)
        nor = np.stack([np.cos(th), np.sin(th), 0 * th], 1)
        cinta(tiras, cam, nor, (0, 0, 1), 3.0, 0.9)

    # De «eje Z, frente en +X» a «eje Y, frente en +Z»
    M = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)
    for m in (fuera, crudo, dentro, tiras):
        m.mover(M)

    # ── Textura del cuero (desenrollado: 2048 × 1024, el frente en el centro)
    W, Hh = 2048, 1024
    verde = Image.open(TEX / 'troncho-logo-verde.png').convert('L')
    lineas = Image.open(TEX / 'troncho-logo-lineas.png').convert('L')
    # El logo ocupa ~140° de la vuelta, como en el de verdad: la C y el
    # mundo de frente y la M yéndose hacia el lado.
    ancho_px = int(W * 138 / 360)
    mm_px_x = (2 * np.pi * Re) / W
    mm_px_y = H / Hh
    alto_px = int(ancho_px * mm_px_x / mm_px_y)
    # Recorte del dibujo dentro de la chapa de la que sale
    caja_logo = (20, 150, 960, 870)
    esc_y = alto_px * (caja_logo[3] - caja_logo[1]) / (caja_logo[2] - caja_logo[0])
    tam = (ancho_px, int(esc_y))
    v = np.asarray(verde.crop(caja_logo).resize(tam, Image.LANCZOS),
                   np.float32) / 255
    li = np.asarray(lineas.crop(caja_logo).resize(tam, Image.LANCZOS),
                    np.float32) / 255
    lienzo_v = np.zeros((Hh, W), np.float32)
    lienzo_l = np.zeros((Hh, W), np.float32)
    x0, y0 = (W - tam[0]) // 2 + int(W * 8 / 360), int(Hh * 0.46 - tam[1] / 2)
    lienzo_v[y0:y0 + tam[1], x0:x0 + tam[0]] = v
    lienzo_l[y0:y0 + tam[1], x0:x0 + tam[0]] = li

    def desenfocar(arr, r):
        return np.asarray(Image.fromarray((np.clip(arr, 0, 1) * 255)
                                          .astype(np.uint8))
                          .filter(ImageFilter.GaussianBlur(r)),
                          np.float32) / 255

    # Grabado: la C y la M hundidas con su borde marcado, y las líneas del mundo
    borde = np.clip(desenfocar(lienzo_v, 2.0) * 4 * (1 - desenfocar(lienzo_v, 2.0)),
                    0, 1)
    prensa = np.clip(0.55 * desenfocar(lienzo_v, 2.5) + 0.75 * borde
                     + 1.0 * desenfocar(np.clip(lienzo_l * 1.6, 0, 1), 1.6), 0, 1)
    # Ojales de la tira (a cada lado de la raja)
    yy, xx = np.mgrid[0:Hh, 0:W].astype(np.float32)
    ojales = np.zeros((Hh, W), np.float32)
    for yk in ys:
        vy = (0.5 - yk / H) * Hh
        for sg in (-1, 1):
            ang = np.pi - medio * 0.86
            ux = (0.5 + sg * ang / (2 * np.pi)) * W
            ojales = np.maximum(ojales, np.exp(-(((xx - ux) / 9) ** 2
                                                 + ((yy - vy) / 56) ** 2) ** 2))

    grano = ruido((Hh, W), 3, 1) * 0.5 + ruido((Hh, W), 9, 2) * 0.5
    manchas = ruido((Hh, W), 180, 3) * 0.6 + ruido((Hh, W), 60, 4) * 0.4
    base = np.array([0.60, 0.29, 0.13], np.float32)          # cuero avellana
    oscuro = np.array([0.27, 0.11, 0.045], np.float32)
    tono = 0.86 + 0.26 * manchas + 0.05 * (grano - 0.5)
    # Los bordes de arriba y abajo, más tostados por el roce
    canto = np.clip(1 - np.minimum(yy, Hh - 1 - yy) / 46, 0, 1) ** 2
    tono *= 1 - 0.22 * canto
    col = base[None, None] * tono[..., None]
    k = np.clip(prensa * 0.8 + ojales * 0.95, 0, 1)[..., None]
    col = col * (1 - k) + oscuro[None, None] * k
    img_col = Image.fromarray((np.clip(col, 0, 1) ** (1 / 1.0) * 255)
                              .astype(np.uint8), 'RGB')
    altura = -1.0 * desenfocar(prensa, 1.2) - 1.6 * ojales \
        + 0.10 * (grano - 0.5) + 0.25 * (ruido((Hh, W), 24, 5) - 0.5)
    img_nor = normal_de_altura(altura, 5.0)
    orm = np.zeros((Hh, W, 3), np.float32)
    orm[..., 0] = 1
    orm[..., 1] = np.clip(0.56 - 0.2 * prensa + 0.12 * (grano - 0.5), 0.2, 0.9)

    t_col = glb.textura(jpg(img_col, 90), envolver=True)
    t_nor = glb.textura(jpg(img_nor, 92), envolver=True)
    t_orm = glb.textura(jpg(Image.fromarray((orm * 255).astype(np.uint8)), 85),
                        envolver=True)
    mat_cuero = glb.material({'name': 'cuero', 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': t_col},
        'metallicRoughnessTexture': {'index': t_orm},
        'metallicFactor': 0.0, 'roughnessFactor': 1.0},
        'normalTexture': {'index': t_nor, 'scale': 1.0}})
    mat_crudo = glb.material({'name': 'canto', 'pbrMetallicRoughness': {
        'baseColorFactor': hexa('#9A5A30'), 'metallicFactor': 0.0,
        'roughnessFactor': 0.85}})
    mat_dentro = glb.material({'name': 'reves', 'pbrMetallicRoughness': {
        'baseColorFactor': hexa('#A87248'), 'metallicFactor': 0.0,
        'roughnessFactor': 0.95}})
    mat_tira = glb.material({'name': 'tira', 'pbrMetallicRoughness': {
        'baseColorFactor': hexa('#7A3F1B'), 'metallicFactor': 0.0,
        'roughnessFactor': 0.6}})
    glb.nodo('troncho', [(fuera, mat_cuero), (crudo, mat_crudo),
                         (dentro, mat_dentro)])
    glb.nodo('cosido', [(tiras, mat_tira)])
    return glb


PIEZAS = {
    'estoy-contigo-samuel': lambda: chapa_imperdible(
        'estoy-contigo-samuel', 38.0, cara('estoy-contigo-samuel')),
    'com-sonriente': lambda: chapa_imperdible(
        'com-sonriente', 38.0, cara('com-sonriente')),
    'jubileo-2025': lambda: chapa_imperdible(
        'jubileo-2025', 25.0, cara('jubileo-2025')),
    'chapa-og': chapa_og,
    'mc-congreso-3': pin_mc,
    'mc-congreso-1': lambda: chapa_imperdible(
        'mc-congreso-1', 58.0, cara('mc-congreso-1', 1.8, 1.35), rugosidad=0.6,
        mate=True),
    'monitor-og': lambda: chapa_imperdible(
        'monitor-og', 58.0, cara('monitor-og', 1.3, 1.1)),
    'jmj-lisboa-2023': pin_jmj,
    'troncho': troncho,
}


def main():
    cuales = sys.argv[1:] or list(PIEZAS)
    for pid in cuales:
        n = PIEZAS[pid]().guardar(SALIDA / f'{pid}.glb')
        print(f'{pid}.glb  {n / 1024:.0f} KB')


if __name__ == '__main__':
    main()
