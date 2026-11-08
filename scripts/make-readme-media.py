"""Builds the README images in docs/images from the sprites and from a tour capture folder.

usage: python scripts/make-readme-media.py <tour-dir>
   (tour-dir from: HANGYO_TOUR=<dir> HANGYO_TOUR_SCALE=3 HANGYO_TOUR_SEQ=1 npm start)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

SPR = "src/renderer/pet/sprites"
OUT = "docs/images"
BG = (226, 238, 240)
WHITE = (0xF4, 0xF8, 0xFA)
EYES = {"idle0": 0, "idle1": 1, "pressL0": 0, "pressL1": 0, "pressL2": 0, "pressR0": 0, "pressR1": 0, "pressR2": 0,
        "scroll": 0, "hunt": 3, "drink0": 0, "drag": 0, "think": 2, "peek": 0}


def sprite(name, k=5, look=(0, 0), bg=BG, pad=(0, 0)):
    im = Image.open(f"{SPR}/{name}.png").convert("RGBA")
    px = im.load()
    if name in EYES:
        dy = EYES[name] + look[1]
        for cx in (13, 27):
            for yy in range(4):
                for xx in range(3):
                    x, y = cx - 1 + xx + look[0], 25 + dy + yy
                    if px[x, y][:3] == WHITE:
                        px[x, y] = (255, 255, 255, 255) if (xx, yy) == (0, 0) else (10, 10, 18, 255)
    canvas = Image.new("RGBA", (im.width, im.height + pad[1]), bg + (255,))
    canvas.alpha_composite(im, (0, pad[0]))
    return canvas.convert("RGB").resize((canvas.width * k, canvas.height * k), Image.NEAREST)


def gif(path, frames, durations):
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True)


os.makedirs(OUT, exist_ok=True)

# hero: idle breathing with a blink and a glance
seq = [("idle0", (0, 0), 700), ("idle1", (0, 0), 700), ("idle0", (2, 0), 700), ("blink", (0, 0), 140),
       ("idle0", (2, 0), 500), ("idle1", (-2, 0), 700), ("idle0", (-2, 1), 700)]
gif(f"{OUT}/hero.gif", [sprite(n, 6, l) for n, l, _ in seq], [d for *_, d in seq])

# small animation loops, each with a label row
def loop(name, frames, k=4):
    gif(f"{OUT}/{name}.gif", [sprite(n, k, l, pad=(p, 6 - p)) for n, l, p, _ in frames], [d for *_, d in frames])

loop("typing", [(n, (0, 1), 0, 170) for n in ["pressL0", "pressR1", "pressL2", "pressR0", "pressL1", "pressR2"]])
loop("purr", [("happy0", (0, 0), 0, 380), ("happy1", (0, 0), 0, 380)])
loop("sleep", [("sleep0", (0, 0), 0, 1100), ("sleep1", (0, 0), 0, 1100)])
loop("jump", [("jumpCrouch", (0, 0), 6, 140), ("jumpAir", (0, 0), 0, 260), ("jumpAir", (0, 0), 2, 160),
              ("jumpCrouch", (0, 0), 6, 160), ("idle0", (0, 0), 6, 500)])
loop("wave", [("wave", (0, 0), 0, 300), ("happy0", (0, 0), 0, 300)])
loop("stretch", [("stretch0", (0, 0), 0, 700), ("stretch1", (0, 0), 0, 900)])

# all poses, labeled
names = ["idle0", "blink", "sleep0", "happy0", "pressL0", "pressR2", "scroll", "hunt", "jumpCrouch", "jumpAir",
         "stretch0", "stretch1", "drink0", "drink1", "drag", "think", "wave", "peek"]
labels = {"idle0": "idle", "blink": "blink", "sleep0": "sleep", "happy0": "purr", "pressL0": "typing", "pressR2": "typing",
          "scroll": "scroll", "hunt": "hunt", "jumpCrouch": "jump", "jumpAir": "jump", "stretch0": "stretch",
          "stretch1": "big stretch", "drink0": "drink", "drink1": "sip", "drag": "dragged", "think": "thinking",
          "wave": "wave", "peek": "peek"}
k, cols, pad, lab = 3, 9, 10, 20
W, H = 41 * k, 58 * k
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (W + pad) + pad, rows * (H + lab + pad) + pad), BG)
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("consola.ttf", 14)
except Exception:
    font = ImageFont.load_default()
for i, n in enumerate(names):
    x = pad + (i % cols) * (W + pad)
    y = pad + (i // cols) * (H + lab + pad)
    sheet.paste(sprite(n, k), (x, y + lab))
    d.text((x, y), labels[n], fill=(13, 34, 54), font=font)
sheet.save(f"{OUT}/poses.png")

# app screenshots from the tour, on a soft background
tour = sys.argv[1] if len(sys.argv) > 1 else None
if tour:
    def shot(src, dst, margin=14):
        im = Image.open(os.path.join(tour, src)).convert("RGBA")
        box = im.getbbox()
        im = im.crop((max(0, box[0] - margin), max(0, box[1] - margin), min(im.width, box[2] + margin), min(im.height, box[3] + margin)))
        bg = Image.new("RGBA", im.size, BG + (255,))
        bg.alpha_composite(im)
        bg.convert("RGB").save(f"{OUT}/{dst}")
    for src, dst in [("02-say.png", "speech.png"), ("07-pomodoro.png", "pomodoro.png"), ("08-reminders.png", "reminders.png"),
                     ("09-stretch.png", "stretch-break.png"), ("10-drink.png", "drink-break.png"), ("11-peek.png", "peek.png")]:
        shot(src, dst)
    seqdir = os.path.join(tour, "seq")
    files = sorted(f for f in os.listdir(seqdir) if f.endswith(".png"))
    ims = [Image.open(os.path.join(seqdir, f)).convert("RGBA") for f in files]
    box = None
    for im in ims:
        b = im.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    box = (max(0, box[0] - 12), max(0, box[1] - 12), box[2] + 12, box[3] + 12)
    frames = []
    for im in ims:
        bg = Image.new("RGBA", im.size, BG + (255,))
        bg.alpha_composite(im)
        frames.append(bg.crop(box).convert("RGB"))
    gif(f"{OUT}/claude-thinking.gif", frames, [90] * len(frames))
print("wrote", sorted(os.listdir(OUT)))
