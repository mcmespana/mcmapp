#!/usr/bin/env python3
"""
Calca el pin de Carismochito: del dibujo vectorizado de la mascota
(`tex/carismochito-dibujo.png`, fondo transparente) saca el mapa de tintas
`tex/carismochito-tintas.png`, que es lo que lee `generar.py`.

    python3 piezas-3d/_fuente/carismochito_tintas.py

Se hace una vez (o al cambiar el calco). El pin de verdad es esmalte duro
troquelado con la silueta del muñeco: cada color es una tinta plana y las
líneas negras del dibujo son las paredes de metal dorado que las separan.
Como en el pin, el pájaro del dibujo no va, la gorra es azul marino como el
pañuelo y los vaqueros, y los huecos pequeños de la silueta (entre los
dedos, bajo el brazo) son metal.

Tintas (valor del píxel = número × 40, para que se vea al abrirlo):
    0 fuera · 1 metal · 2 verde · 3 rojo · 4 azul marino · 5 blanco · 6 negro
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TEX = Path(__file__).resolve().parent / 'tex'
LADO = 1024           # la cara es cuadrada: la caja de la forma del visor
ALTO = 0.92           # la silueta ocupa el 92 % del alto (4–96 en la caja)

FUERA, METAL, VERDE, ROJO, MARINO, BLANCO, NEGRO = range(7)

# Colores del dibujo → tinta del pin
FUENTE = [
    ((75, 174, 130), VERDE), ((61, 139, 106), VERDE), ((65, 149, 113), VERDE),
    ((26, 25, 20), NEGRO), ((19, 30, 38), NEGRO),
    ((12, 105, 181), MARINO), ((21, 77, 136), MARINO), ((60, 127, 218), MARINO),
    ((3, 109, 220), MARINO), ((102, 150, 157), MARINO), ((44, 147, 143), MARINO),
    ((121, 107, 106), MARINO), ((104, 92, 91), MARINO),       # la gorra
    ((254, 251, 249), BLANCO), ((229, 222, 216), BLANCO),
    ((208, 201, 195), BLANCO), ((241, 235, 233), BLANCO),
    ((202, 56, 48), ROJO), ((199, 197, 128), ROJO),           # pelo y mechas
    ((77, 41, 35), ROJO),                                     # la boca
]


def filtro(m: np.ndarray, f) -> np.ndarray:
    return np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(f)) > 127


def main():
    dib = np.asarray(Image.open(TEX / 'carismochito-dibujo.png')
                     .convert('RGBA')).astype(np.int32)
    h, w = dib.shape[:2]
    alfa = dib[..., 3] > 128

    # Cada píxel, a su tinta más cercana
    rgb = dib[..., :3]
    mejor = np.full((h, w), 1 << 30, np.int64)
    lab = np.zeros((h, w), np.int64)
    for c, t in FUENTE:
        d = ((rgb - np.array(c)) ** 2).sum(-1)
        cerca = d < mejor
        mejor[cerca], lab[cerca] = d[cerca], t
    lab[~alfa] = FUERA

    # Solo el muñeco: la mancha que contiene la barriga (fuera el pájaro)
    sil = Image.fromarray((alfa * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(sil, (int(w * 0.5), int(h * 0.6)), 128)
    cuerpo = np.asarray(sil) == 128
    lab[~cuerpo] = FUERA

    # Al lienzo cuadrado: la silueta centrada y al 92 % del alto
    ys, xs = np.nonzero(cuerpo)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    k = LADO * ALTO / (y1 - y0)
    tw, th = round((x1 - x0) * k), round((y1 - y0) * k)
    capas = []
    for t in range(7):            # cada tinta por separado: sin colores mezclados
        m = Image.fromarray(((lab[y0:y1, x0:x1] == t) * 255).astype(np.uint8))
        capas.append(np.asarray(m.resize((tw, th), Image.BOX), np.float32))
    peq = np.argmax(np.stack(capas), 0)
    lab = np.zeros((LADO, LADO), np.uint8)
    ox, oy = (LADO - tw) // 2, (LADO - th) // 2
    lab[oy:oy + th, ox:ox + tw] = peq

    # Las tintas, sin motas (las zapatillas del dibujo tienen textura)
    moda = np.asarray(Image.fromarray(lab).filter(ImageFilter.ModeFilter(9)))
    esmalte = (lab >= VERDE) & (lab <= BLANCO)
    cambia = esmalte & (moda >= VERDE) & (moda <= BLANCO)
    lab[cambia] = moda[cambia]

    # El azul de las zapatillas del dibujo está moteado de negro: dentro de
    # una mancha azul, el negro suelto es azul. Solo en las zapatillas (el
    # quinto de abajo): en el resto, ese negro son líneas de verdad.
    azul = filtro(filtro(lab == MARINO, ImageFilter.MaxFilter(15)),
                  ImageFilter.MinFilter(15))
    azul = filtro(azul, ImageFilter.MinFilter(5))
    azul[:int(LADO * 0.8)] = False
    lab[azul & (lab == NEGRO)] = MARINO

    dentro = lab != FUERA
    # Silueta del troquel: se cierran los huecos pequeños y se rellenan los
    # agujeros. Lo que se añade es metal.
    troquel = filtro(filtro(dentro, ImageFilter.MaxFilter(25)),
                     ImageFilter.MinFilter(25))
    troquel |= dentro
    fondo = Image.fromarray((troquel * 255).astype(np.uint8)).copy()
    ImageDraw.floodfill(fondo, (0, 0), 128)
    troquel = np.asarray(fondo) != 128
    # Suaviza el canto (el troquel no copia cada pelo del contorno)
    troquel = np.asarray(Image.fromarray((troquel * 255).astype(np.uint8))
                         .filter(ImageFilter.GaussianBlur(3))) > 127
    troquel |= filtro(dentro, ImageFilter.MinFilter(3))
    lab[troquel & ~dentro] = METAL
    lab[~troquel] = FUERA

    # Negro: lo fino es línea de metal; lo gordo (las pupilas), esmalte negro
    negro = lab == NEGRO
    gordo = filtro(filtro(negro, ImageFilter.MinFilter(9)),
                   ImageFilter.MaxFilter(9)) & negro
    linea = (negro & ~gordo) | (filtro(negro, ImageFilter.MaxFilter(3))
                                & ~gordo & troquel)
    lab[linea] = METAL
    # El filo de metal de todo el contorno
    filo = troquel & ~filtro(troquel, ImageFilter.MinFilter(11))
    lab[filo] = METAL

    Image.fromarray(lab * 40).save(TEX / 'carismochito-tintas.png',
                                   optimize=True)
    print('tex/carismochito-tintas.png', {t: int((lab == t).sum())
                                          for t in range(7)})


if __name__ == '__main__':
    main()
