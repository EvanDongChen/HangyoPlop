// Hangyodon, traced from the user's reference pixel art (art/ref/reference.png).
// scripts/extract-reference.py recovered the native 53x56 grid from the upscaled image;
// the grid below is that trace, cleaned up by hand: 1px outlines, flat fills, symmetric body,
// eyes left empty (the app draws the pupils live so they follow the cursor).

pal({
  k: "#0d2236", // outline
  t: "#33ccba", // teal
  T: "#2aa9b4", // teal shade
  l: "#6fdccf", // teal rim light
  s: "#8eeee0", // belly scales
  f: "#1fa6de", // fin / crest blue
  F: "#1f84b8", // fin mid
  D: "#1d5f8a", // fin ridge
  h: "#6cc8f2", // fin highlight
  w: "#f4f8fa", // eye white
  e: "#0a0a12", // pupil
  p: "#f4a1bb", // lips
  q: "#d985ac", // lip deep pink
  M: "#936d7a", // lip mauve
  m: "#bb8d9f", // lip light mauve
  P: "#51263a", // mouth line
  n: "#ff9db0", // blush
  g: "#b7c0cf", // keyboard
  G: "#6d778d", // keyboard keys
  y: "#fff1c9", // paper / mug
  Y: "#d9b36a", // paper / mug shade
  u: "#7fc8ff", // water
})

// The master idle sprite (41x53), as edited by hand in the Hangyodon Pixel Editor artifact.
// Row 0 is blank; IDLE holds rows 1..52.
const IDLE = [
  "....................kkkkk................",
  "...................khhfffk...............",
  "..................khhfffffkkk............",
  "..................kffDFfffffFk...........",
  ".................kfffDFffDDffFk..........",
  ".................kfffDFfDFFfffFk.........",
  ".................kfffDFfDFfffDfk.........",
  "............kkkkkkkkkkkkkkkkDFfk.........",
  "..........kklllllllllllllllkkkk..........",
  ".........kllllltttttttttttlllllk.........",
  "........kllltttttttttttttttttlllk........",
  "........klltttttttttttttttttttllk........",
  ".......klltttttttttttttttttttttllk.......",
  "......klltttttttttttttttttttttttllk......",
  "......kltttttttttttttttttttttttttlk......",
  "......kltttttttttttttttttttttttttlk......",
  ".....klttttkkkkktttttttttkkkkkttttlk.....",
  ".....kltttkwwwwwktttttttkwwwwwktttlk.....",
  "..kkkklttkwwwwwwwktttttkwwwwwwwkttlkkkk..",
  ".khffkltkwwwwwwwwwktttkwwwwwwwwwktlkffhk.",
  "khhffkltkwwwwwwwwwktttkwwwwwwwwwktlkffhhk",
  "khfDDkltkwwwwwwwwwktttkwwwwwwwwwktlkDDfhk",
  "kffFFkltkwwwwwwwwwktttkwwwwwwwwwktlkFFffk",
  "kffffkltkwwwwwwwwwktttkwwwwwwwwwktlkffffk",
  "kfDDDklttkwwwwwwwktttttkwwwwwwwkttlkDDDfk",
  "kffFFkltttkwwwwwktttttttkwwwwwktttlkFFFfk",
  "kffffklttttkkkkktttttttttkkkkkttttlkffffk",
  ".kfffkTtttttttttttttttttttttttttttTkfffk.",
  "..kffkTtttkkkkkkkkkkkkkkkkkkkkktttTkffk..",
  "...kkkTkkkqpppppppppppppppppppqkkkTkkk...",
  ".....kkpppppppppppppppppppppppppppkk.....",
  "......kpPPPPPPpppppppppppppPPPPPPpk......",
  "......kpppppppPPPPPPPPPPPPPpppppppk......",
  ".....klkkMMMMMMMMMMMMMMMMMMMMMMMkklk.....",
  ".....klTkkkkkkkkkkkkkkkkkkkkkkkkkTlk.....",
  "....klttTTTTTTTTTTTTTTTTTTTTTTTTTttlk....",
  "....kltttttttttttttttttttttttttttttlk....",
  "...klttttttTtttTttTtttTttTtttTttttttlk...",
  ".kkltttttttTtttTttTtttTttTtttTtttttttlkk.",
  ".kllttttttttTTTttttTTTttttTTTttttttttllk.",
  ".kTTtttttttttttttttttttttttttttttttttTTk.",
  "..kTTTTTkkttttTtttTtttTtttTttttkkTTTTTk..",
  "...kkkkkkTttttTtttTtttTtttTttttTkkkkkk...",
  ".......kTttttttTTTtttttTTTttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTttttttttTTTTTTTttttttttTk.......",
  "......kTTttttttttTkkkkkTttttttttTTk......",
  ".....kTtttttttttttttktttttttttttttTk.....",
  ".....kTTttTttTTttTTTkTTTttTTttTttTTk.....",
  "......kkkkkkkkkkkkkkkkkkkkkkkkkkkkk......",
]
IDLE.forEach((r, i) => { if (r.length !== 41) throw new Error(`IDLE row ${i + 1} has ${r.length} cols`) })

sprite("idle", { w: 41, h: 53 }, grid(0, 1, IDLE.join("\n")))

// ---------------------------------------------------------------- poses
// Every pose is an edit of IDLE on a taller 41x58 canvas (5 rows of headroom), so the art
// stays identical to the master everywhere the pose doesn't change it.
const W = 41, PH = 58, OFF = 5
const BLANK = ".".repeat(W)
const BASE = [...Array(OFF).fill(BLANK), BLANK, ...IDLE]
const mx = (x) => W - 1 - x

const put = (rows, x, y, ch) => {
  if (y < 0 || y >= rows.length || x < 0 || x >= W) return
  rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1)
}

// Shift everything above body row 46 (a plain row under the gills) down by d rows: a squash/bob.
const squash = (rows, d) => [...Array(d).fill(BLANK), ...rows.slice(0, 46 + OFF), ...rows.slice(46 + OFF + d)]
// Stretch the body d rows taller by repeating a plain body row.
const stretch = (rows, d) => [...rows.slice(d, 46 + OFF), ...Array(d).fill(rows[46 + OFF]), ...rows.slice(46 + OFF)]

// Eyes. dy = how far the head was shifted. Boxes are the eye outlines in IDLE coordinates.
function eyes(rows, mode, dy = 0) {
  if (mode === "open") return
  const Y = (y) => y + OFF + dy
  for (const side of ["L", "R"]) {
    const X = (x) => (side === "L" ? x : mx(x))
    if (mode === "lid") {
      for (let x = 9; x <= 17; x++) {
        for (const y of [18, 19, 20]) if (rows[Y(y)][X(x)] === "w") put(rows, X(x), Y(y), "T")
        if (rows[Y(21)][X(x)] === "w") put(rows, X(x), Y(21), "k")
      }
      continue
    }
    // keep the round eye outline; closed eyes fill the white with the eyelid
    if (mode === "closed") for (let y = 17; y <= 27; y++) for (let x = 8; x <= 18; x++) {
      if (rows[Y(y)][X(x)] === "w") put(rows, X(x), Y(y), "t")
    }
    const pts = {
      closed: [[9, 22], [10, 23], [11, 23], [12, 23], [13, 23], [14, 23], [15, 23], [16, 23], [17, 22]],
      happy: [[9, 23], [10, 22], [11, 21], [12, 21], [13, 21], [14, 21], [15, 21], [16, 22], [17, 23]],
      squeeze: [[11, 19], [12, 20], [13, 21], [14, 22], [13, 23], [12, 24], [11, 25], [10, 19], [10, 25]],
    }[mode]
    for (const [x, y] of pts) put(rows, X(x), Y(y), "k")
  }
}

// Mouth "o": swap the mouth line for a small open mouth.
function mouthO(rows, dy = 0) {
  const Y = (y) => y + OFF + dy
  for (const y of [31, 32, 33]) for (let x = 7; x <= 33; x++) if (rows[Y(y)][x] === "P") put(rows, x, Y(y), "p")
  for (let x = 18; x <= 22; x++) { put(rows, x, Y(31), "P"); put(rows, x, Y(33), "P") }
  for (let x = 17; x <= 23; x++) put(rows, x, Y(32), "P")
}

function blush(rows, dy = 0) {
  for (const x of [8, 9, 31, 32]) put(rows, x, 28 + OFF + dy, "n")
}

// Remove an arm stub and close the body outline where it was. dy = squash amount.
function noArm(rows, side, dy = 0) {
  const edge = { 38: 4, 39: 5, 40: 5, 41: 6, 42: 6, 43: 7 }
  for (const [yy, c] of Object.entries(edge)) {
    const y = Number(yy) + OFF + dy
    for (let x = 0; x <= 9; x++) {
      const ch = x < c ? "." : x === c ? "k" : x === c + 1 ? "T" : "t"
      put(rows, side === "L" ? x : mx(x), y, ch)
    }
  }
}

// Any colored pixel that touches transparency becomes outline, so moved parts never leave gaps.
function closeOutline(rows) {
  const out = rows.slice()
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < W; x++) {
    const c = rows[y][x]
    if (c === "." || c === "k") continue
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const X = x + dx, Y = y + dy
      return X < 0 || Y < 0 || X >= W || Y >= rows.length || rows[Y][X] === "."
    })
    if (open) out[y] = out[y].slice(0, x) + "k" + out[y].slice(x + 1)
  }
  return out
}

const toGrid = (rows) => {
  const first = rows.findIndex((r) => r !== BLANK)
  return grid(0, first, rows.slice(first).join("\n"))
}

// Arms reuse the idle arm stub pixels (rows 43..48, cols 0..9 on this canvas) and just move them:
// "up" flips the stub vertically so it flaps up, "upHigh" also lifts it 2 rows, "down" lowers it
// 2 rows (resting on the keyboard). dy = how far the pose moved the body.
function stub(rows, side, mode, dy = 0) {
  const y0 = 43 + dy
  const X = (x) => (side === "L" ? x : mx(x))
  const block = []
  for (let y = 0; y < 6; y++) {
    let r = ""
    for (let x = 0; x < 10; x++) r += rows[y0 + y][X(x)]
    block.push(r)
  }
  noArm(rows, side, dy)
  let out = block
  let at = y0
  if (mode === "up" || mode === "upHigh") {
    // flip, and swap the rim light and the underside shade so the lighting still comes from above
    out = block.slice().reverse().map((r) => r.replace(/[lT]/g, (c) => (c === "l" ? "T" : "l")))
    if (mode === "upHigh") {
      at = y0 - 2
      // the lifted arm's top edge sits right under the neck: turn the shoulder pixels left
      // stranded above it into outline so nothing pokes out
      for (const y of [y0 - 4, y0 - 3]) for (let x = 0; x <= 8; x++) {
        const c = rows[y][X(x)]
        if (c !== "." && c !== "k") put(rows, X(x), y, "k")
      }
    }
  }
  if (mode === "down") at = y0 + 3
  const pixels = []
  for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
    const ch = out[y][x]
    if (ch !== ".") { put(rows, X(x), at + y, ch); pixels.push([X(x), at + y, ch]) }
  }
  return pixels
}

function pose(name, { eyes: e = "open", mouth, blush: b, squash: sq = 0, tall = 0, arms = {}, props = [], after = [] } = {}) {
  let rows = BASE.slice()
  if (sq) rows = squash(rows, sq)
  if (tall) rows = stretch(rows, tall)
  const dy = sq - tall
  eyes(rows, e, dy)
  if (mouth === "o") mouthO(rows, dy)
  if (b) blush(rows, dy)
  // a lowered arm rests on top of props like the keyboard, so it is painted again last
  const onTop = []
  for (const [side, mode] of Object.entries(arms)) {
    const px = stub(rows, side, mode, dy)
    if (mode === "down") onTop.push(...px)
  }
  rows = closeOutline(rows)
  for (const p of onTop) p[2] = rows[p[1]][p[0]]
  sprite(name, { w: W, h: PH }, ...props, toGrid(rows), ...after, (c) => { for (const [x, y, ch] of onTop) c.px(x, y, ch) })
}

const keyboard = (c) => {
  c.rect(4, 49, 33, 9, "k")
  c.rect(5, 50, 31, 7, "g")
  for (let i = 0; i < 7; i++) { c.hline(7 + i * 4, 51, 3, "G"); c.hline(7 + i * 4, 55, 3, "G") }
  for (let i = 0; i < 7; i++) c.hline(8 + i * 4, 53, 3, "G")
}
const roll = (c) => {
  c.rect(8, 45, 25, 6, "k")
  c.rect(9, 46, 23, 4, "y")
  c.hline(9, 49, 23, "Y")
  c.rect(9, 46, 2, 4, "Y"); c.rect(30, 46, 2, 4, "Y")
}
const mug = (tilt) => (c) => {
  const x = 30, y = tilt ? 34 : 36
  c.rect(x, y, 7, 8, "k")
  c.rect(x + 1, y + 1, 5, 6, "y")
  c.vline(x + 5, y + 1, 6, "Y")
  c.hline(x + 1, y + 1, 5, tilt ? "u" : "Y")
  c.rect(x + 7, y + 2, 2, 4, "k"); c.px(x + 7, y + 3, "y"); c.px(x + 7, y + 4, "y")
}

pose("idle0")
pose("idle1", { squash: 1 })
pose("blink", { eyes: "closed" })
pose("sleep0", { eyes: "closed", squash: 1 })
pose("sleep1", { eyes: "closed", squash: 2 })
pose("happy0", { eyes: "happy", blush: true })
pose("happy1", { eyes: "happy", blush: true, squash: 1 })
pose("pressL", { arms: { L: "down" }, after: [keyboard] })
pose("pressR", { arms: { R: "down" }, after: [keyboard] })
pose("scroll", { after: [roll] })
pose("hunt", { squash: 3 })
pose("jumpCrouch", { eyes: "squeeze", squash: 3 })
pose("jumpAir", { eyes: "happy", mouth: "o", blush: true, arms: { L: "upHigh", R: "upHigh" } })
pose("stretch0", { eyes: "closed", mouth: "o", arms: { L: "up", R: "up" } })
pose("stretch1", { eyes: "squeeze", mouth: "o", blush: true, tall: 3, arms: { L: "upHigh", R: "upHigh" } })
pose("drink0", { mouth: "o", arms: { R: "upHigh" }, after: [mug(false)] })
pose("drink1", { eyes: "closed", mouth: "o", blush: true, arms: { R: "upHigh" }, after: [mug(true)] })
pose("drag", { mouth: "o", arms: { L: "upHigh", R: "upHigh" } })
pose("think", { eyes: "lid" })
pose("wave", { eyes: "happy", blush: true, arms: { R: "upHigh" } })
pose("peek")

const POSES = ["idle0", "idle1", "blink", "sleep0", "sleep1", "happy0", "happy1", "pressL", "pressR", "scroll", "hunt",
  "jumpCrouch", "jumpAir", "stretch0", "stretch1", "drink0", "drink1", "drag", "think", "wave", "peek"]
scene("poses_a", { w: 44 * 7, h: 60 * 2, bg: "#e6ecec" }, ...POSES.slice(0, 14).map((n, i) => stamp(n, (i % 7) * 44 + 1, Math.floor(i / 7) * 60 + 1)))
scene("poses_b", { w: 44 * 7, h: 60, bg: "#e6ecec" }, ...POSES.slice(14).map((n, i) => stamp(n, i * 44 + 1, 1)))

// Pupils as in the reference (the app draws these live)
sprite("idle_preview", { base: "idle" },
  rect(14, 21, 3, 4, "e"), px(14, 21, "w"), rect(24, 21, 3, 4, "e"), px(24, 21, "w"))
