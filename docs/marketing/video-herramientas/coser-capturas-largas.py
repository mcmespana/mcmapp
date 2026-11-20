import sys, glob, json
import numpy as np
from PIL import Image, ImageDraw
W = sys.argv[1]
BIG = (46, 1275, 594, 1360, 42); SMALL = (94, 1287, 546, 1350, 32)
cfg = {'inicio': (168, BIG), 'cantcat': (180, BIG), 'cantscroll': (236, BIG), 'lista': (176, BIG), 'contigo': (176, BIG), 'lecturas': (176, SMALL), 'fotos': (176, SMALL)}
out = {}
for k, (Ht, pill) in cfg.items():
    fs = sorted(glob.glob(W + '/' + k + '/f*.png'))
    frames = [np.asarray(Image.open(f).convert('RGB')) for f in fs]
    H = frames[0].shape[0]
    px0, py0, px1, py1, pr = pill
    r0, r1 = Ht + 30, py0 - 12          # rows used to register
    def feat(a):
        g = a[:, :, :].mean(axis=2)
        return g.reshape(H, 80, 8).mean(axis=2)   # 640 -> 80 columns
    F = [feat(f) for f in frames]
    offs = [0.0]
    for i in range(1, len(F)):
        A, B = F[i - 1], F[i]
        best = (1e9, 0)
        for d in range(-220, 420):
            # content moved up by d: A[y] == B[y - d]
            ya0, ya1 = max(r0, r0 + d), min(r1, r1 + d)
            if ya1 - ya0 < 150: continue
            diff = np.abs(A[ya0:ya1] - B[ya0 - d:ya1 - d]).mean()
            if diff < best[0]: best = (diff, d)
        offs.append(offs[-1] + best[1])
    offs = np.array(offs); lo, hi = offs.min(), offs.max()
    span = int(round(hi - lo))
    regH = H - Ht
    strip = np.zeros((regH + span, 640, 3), np.uint8); filled = np.zeros(regH + span, bool)
    skip = 110
    order = list(range(len(frames)))
    for i in order:
        f = frames[i]; o = int(round(offs[i] - lo))
        a = Ht if i == 0 else Ht + skip
        b = py0 - 6 if i != len(frames) - 1 else H
        strip[o + (a - Ht): o + (b - Ht)] = f[a:b]; filled[o + (a - Ht): o + (b - Ht)] = True
    # rows never filled (under the pill before the last frame): take the first frame that covers them, pill included
    holes = np.where(~filled)[0]
    for y in holes:
        for i in order:
            o = int(round(offs[i] - lo)); src = y - o + Ht
            if Ht <= src < H: strip[y] = frames[i][src]; break
    header = frames[0][:Ht]
    pillim = Image.fromarray(frames[0][py0 - 6:py1 + 6, px0 - 6:px1 + 6]).convert('RGBA')
    mask = Image.new('L', ((px1 - px0 + 12) * 4, (py1 - py0 + 12) * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([24, 24, (px1 - px0 + 6) * 4, (py1 - py0 + 6) * 4], radius=pr * 4, fill=255)
    pillim.putalpha(mask.resize(pillim.size, Image.LANCZOS))
    ph = pillim.size[1]
    sheet = Image.new('RGBA', (640, Ht + strip.shape[0] + ph), (0, 0, 0, 0))
    sheet.paste(Image.fromarray(header).convert('RGBA'), (0, 0))
    sheet.paste(Image.fromarray(strip).convert('RGBA'), (0, Ht))
    sheet.paste(pillim, (px0 - 6, Ht + strip.shape[0]))
    sheet.save(W + '/s-' + k + '.png')
    out[k] = {'ht': Ht, 'strip': int(strip.shape[0]), 'pill': [px0 - 6, py0 - 6, pillim.size[0], ph], 'off': [round(float(o - lo), 1) for o in offs], 'fps': 30, 'h': sheet.size[1]}
    print(k, 'frames', len(frames), 'scroll span', span, 'sheet', sheet.size, 'off first/last', out[k]['off'][0], out[k]['off'][-1], 'min step', int(np.diff(offs).min()), 'max step', int(np.diff(offs).max()))
json.dump(out, open(W + '/strips.json', 'w'))
