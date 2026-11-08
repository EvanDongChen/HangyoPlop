"""Recover the native pixel grid from the upscaled reference image and print it as a pxl grid.

usage: python scripts/extract-reference.py art/ref/reference.png [pitch]
"""
import sys
import numpy as np
from PIL import Image

path = sys.argv[1]
im = Image.open(path).convert("RGB")
a = np.asarray(im).astype(float)


def pitch_and_phase(axis):
    prof = np.abs(np.diff(a, axis=axis)).sum(axis=2).sum(axis=0 if axis == 1 else 1)
    prof = prof - prof.mean()
    idx = np.arange(len(prof))
    best = max(((abs((prof * np.exp(2j * np.pi * idx / p)).sum()), p) for p in np.arange(8, 14, 0.01)))
    p = best[1]
    phase = np.angle((prof * np.exp(2j * np.pi * idx / p)).sum())
    # edges sit at idx = -phase/(2pi)*p (mod p); diff index i is boundary between i and i+1
    edge = (-phase / (2 * np.pi) * p) % p + 0.5
    return p, edge


px_, ex = pitch_and_phase(1)
py_, ey = pitch_and_phase(0)
p = float(sys.argv[2]) if len(sys.argv) > 2 else (px_ + py_) / 2
print(f"pitch x={px_:.3f} y={py_:.3f} using {p:.3f}; edge offsets x={ex:.2f} y={ey:.2f}", file=sys.stderr)

H, W = a.shape[:2]
cols = int((W - ex) // p)
rows = int((H - ey) // p)
cells = np.zeros((rows, cols, 3))
for r in range(rows):
    for c in range(cols):
        x0 = ex + c * p
        y0 = ey + r * p
        # middle 40% of the cell, median to dodge blur
        xa, xb = int(x0 + p * 0.3), int(x0 + p * 0.7) + 1
        ya, yb = int(y0 + p * 0.3), int(y0 + p * 0.7) + 1
        cells[r, c] = np.median(a[ya:yb, xa:xb].reshape(-1, 3), axis=0)
np.save(path + ".cells.npy", cells)
print(f"{cols}x{rows}", file=sys.stderr)
Image.fromarray(cells.astype(np.uint8)).resize((cols * 12, rows * 12), Image.NEAREST).save(path + ".cells.png")
