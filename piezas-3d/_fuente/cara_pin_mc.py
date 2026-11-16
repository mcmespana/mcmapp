#!/usr/bin/env python3
"""
Dibuja la cara del pin M+C (`tex/pin-mc.png`): el logo «+M C» de Monitor
Consolación sobre el fondo azul claro con brochazos blancos del pin.

El logo está REDIBUJADO a ojo a partir de la imagen oficial (no había el
archivo): si algún día hay un PNG/SVG bueno, se pega aquí en vez de `logo()`.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 2                      # supermuestreo
N = 1280 * S               # lienzo del logo, en las coordenadas de la imagen oficial
CLARO, AZUL, MARINO = (118, 192, 236), (23, 169, 224), (28, 58, 124)


def suave(pts, n=24):
    """Catmull-Rom: una curva que pasa por todos los puntos."""
    p = np.array(pts, float)
    p = np.vstack([p[0], p, p[-1]])
    out = []
    for i in range(1, len(p) - 2):
        for t in np.linspace(0, 1, n, endpoint=False):
            a, b, c, d = p[i - 1], p[i], p[i + 1], p[i + 2]
            out.append(0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                              + (-a + 3 * b - 3 * c + d) * t ** 3))
    out.append(p[-2])
    return np.array(out)


def trazo(d, pts, color, n=24):
    """Trazo de pincel: puntos (x, y, grosor)."""
    c = suave(pts, n)
    for x, y, w in c:
        r = w / 2 * S
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=color)


def barra(d, x0, y0, x1, y1, w, color):
    trazo(d, [(x0, y0, w), (x1, y1, w)], color, n=60)


def logo():
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # +
    barra(d, 208, 535, 438, 535, 66, CLARO)
    barra(d, 323, 420, 323, 650, 66, CLARO)
    # las dos cabezas
    for cx, cy, ro, ri in ((628, 133, 74, 37), (833, 188, 52, 27)):
        d.ellipse([(cx - ro) * S, (cy - ro) * S, (cx + ro) * S, (cy + ro) * S], fill=CLARO)
        d.ellipse([(cx - ri) * S, (cy - ri) * S, (cx + ri) * S, (cy + ri) * S], fill=(0, 0, 0, 0))
    # M
    trazo(d, [(556, 545, 64), (566, 440, 58), (596, 320, 52), (636, 262, 50),
              (662, 320, 50), (682, 440, 54), (712, 546, 62), (740, 440, 50),
              (786, 320, 48), (830, 284, 50), (864, 350, 56), (888, 470, 62),
              (926, 566, 58), (990, 598, 30)], AZUL)
    # C
    cx, cy, r, w = 540, 865, 181, 80
    ang = np.deg2rad(np.linspace(52, 308, 200))
    trazo(d, [(cx + r * np.cos(a), cy + r * np.sin(a), w) for a in ang], MARINO, n=3)
    # mundo
    gx, gy, gr = 578, 866, 126
    trazo(d, [(gx + gr * np.cos(a), gy + gr * np.sin(a), 9)
              for a in np.linspace(0, 2 * np.pi, 120)], MARINO, n=3)
    for linea in (
        [(528, 800), (545, 790), (570, 800), (600, 792), (614, 770), (610, 745)],
        [(528, 800), (530, 815), (560, 820), (590, 812), (606, 835), (590, 870),
         (580, 905), (562, 930), (540, 920)],
        [(452, 905), (476, 880), (500, 890), (520, 915), (548, 922)],
        [(668, 790), (655, 830), (672, 870), (654, 900), (672, 930), (662, 955)],
        [(520, 968), (545, 975), (575, 965), (600, 968), (618, 982)],
    ):
        trazo(d, [(x, y, 8) for x, y in linea], MARINO)
    # órbita con su flecha
    t = np.deg2rad(np.linspace(-30, 215, 90))
    rot = np.deg2rad(-27)
    ex, ey = 150 * np.cos(t), 52 * np.sin(t)
    trazo(d, [(586 + x * np.cos(rot) - y * np.sin(rot),
               872 + x * np.sin(rot) + y * np.cos(rot), 8) for x, y in zip(ex, ey)],
          MARINO, n=3)
    trazo(d, [(712, 744, 8), (692, 752, 8), (700, 772, 8)], MARINO, n=6)
    # los tres destellos
    barra(d, 898, 792, 944, 772, 56, CLARO)
    barra(d, 906, 908, 958, 922, 56, CLARO)
    barra(d, 852, 1008, 894, 1056, 56, CLARO)
    return im.resize((1280, 1280), Image.LANCZOS)


def main():
    T = 1024
    fondo = Image.new('RGB', (T, T), (176, 211, 234))
    # brochazos blancos en diagonal
    rng = np.random.default_rng(7)
    capa = Image.new('L', (T, T), 0)
    d = ImageDraw.Draw(capa)
    for y0, g in ((330, 150), (720, 190)):
        pts = [(x, y0 - (x - 512) * 0.42 + rng.normal(0, 8), g + rng.normal(0, 14))
               for x in range(-80, T + 120, 60)]
        for x, y, w in suave(pts, 30):
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=255)
    capa = capa.filter(ImageFilter.GaussianBlur(5))
    fondo.paste(Image.new('RGB', (T, T), (236, 240, 247)), (0, 0), capa)
    # el logo, llenando el disco visible
    lg = logo()
    k = 0.97 * (T / 2) / 545
    tam = int(1280 * k)
    lg = lg.resize((tam, tam), Image.LANCZOS)
    fondo.paste(lg, (int(T / 2 - 590 * k), int(T / 2 - 572 * k)), lg)
    fondo.save(Path(__file__).resolve().parent / 'tex' / 'pin-mc.png', optimize=True)


if __name__ == '__main__':
    main()
