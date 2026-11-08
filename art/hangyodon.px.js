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
  x: "#4b5468", // keyboard frame
  g: "#e1e6ee", // keycap
  G: "#9aa3b5", // keycap shadow
  j: "#7d8799", // pressed keycap
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

const toGrid = (rows) => {
  const first = rows.findIndex((r) => r !== BLANK)
  return grid(0, first, rows.slice(first).join("\n"))
}

// Arms reuse the idle arm stub pixels (rows 43..48, cols 0..9 on this canvas) and just move them:
// "up" flips the stub vertically so it flaps up, "up" also lifts it 2 rows, "down" lowers it
// 2 rows (resting on the keyboard). dy = how far the pose moved the body.
// Left shoulder with the arm flapped up (rows 41..49, cols 0..9 on this canvas).
const RAISED = [
  ".kkk.kltTT",
  "klllkklttt",
  "klTTtttttt",
  ".kTTtttttt",
  "..kkTttttt",
  "....kTtttt",
  ".....kTttt",
  "......kTtt",
  ".......kTt",
]
function stub(rows, side, mode, dy = 0) {
  const y0 = 43 + dy
  const X = (x) => (side === "L" ? x : mx(x))
  const block = []
  for (let y = 0; y < 6; y++) {
    let r = ""
    for (let x = 0; x < 10; x++) r += rows[y0 + y][X(x)]
    block.push(r)
  }
  if (mode === "remove") { noArm(rows, side, dy); return [] }
  if (mode === "up") {
    RAISED.forEach((r, i) => { for (let x = 0; x < 10; x++) put(rows, X(x), 41 + dy + i, r[x]) })
    return []
  }
  noArm(rows, side, dy)
  let out = block
  let at = y0
  if (mode === "up") {
    // flip, and swap the rim light and the underside shade so the lighting still comes from above
    out = block.slice().reverse().map((r) => r.replace(/[lT]/g, (c) => (c === "l" ? "T" : "l")))
  }
  if (mode === "down") at = y0 + 3
  if (mode === "tap" || mode === "lift") at = y0 + 2
  if (mode === "press") at = y0 + 4
  const pixels = []
  for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) {
    const ch = out[y][x]
    if (ch !== ".") { put(rows, X(x), at + y, ch); pixels.push([X(x), at + y, ch]) }
  }
  if (mode !== "keep") {
    // the lowered arm's top row needs outline wherever nothing sits above it
    for (let x = 0; x < 10; x++) {
      const c = rows[at][X(x)]
      if (c !== "." && c !== "k" && rows[at - 1][X(x)] === ".") {
        put(rows, X(x), at, "k")
        const p = pixels.find((q) => q[0] === X(x) && q[1] === at)
        if (p) p[2] = "k"
      }
    }
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
    if (mode === "down" || mode === "press" || mode === "lift") onTop.push(...px)
  }

  sprite(name, { w: W, h: PH }, ...props, toGrid(rows), ...after, (c) => { for (const [x, y, ch] of onTop) c.px(x, y, ch) })
}

// A small open laptop in front of him: the keyboard deck shows on both sides of the lid,
// the lid's back (with a bubble logo) faces us. Paws tap on the deck's keys.
const laptopDeck = (c) => {
  c.hline(4, 52, 33, "k")
  for (let y = 53; y <= 56; y++) { c.px(3, y, "k"); c.hline(4, y, 33, "x"); c.px(37, y, "k") }
  c.hline(3, 57, 35, "k")
  for (const x of [5, 8, 30, 33]) { c.hline(x, 53, 2, "g"); c.hline(x, 55, 2, "g") }
  for (const x of [6, 31]) c.hline(x, 54, 2, "g")
}
const laptopLid = (c) => {
  c.rect(11, 42, 19, 15, "k")
  c.rect(12, 43, 17, 13, "g")
  c.vline(28, 43, 13, "G")
  c.hline(12, 55, 17, "G")
  // bubble logo
  c.hline(19, 47, 3, "u"); c.rect(18, 48, 5, 3, "u"); c.hline(19, 51, 3, "u"); c.px(19, 48, "w")
}
const keyboard = (press) => (c) => laptopDeck(c)
// Typing arms hang from the shoulders as part of the silhouette (cols 0..9, from row 43),
// with the paw resting on a big keycap. The pressing paw reaches 2 rows lower.
const ARM_PRESS = [
  "...klttttt",
  "..kltttttt",
  "..kltttttt",
  "..kTtttttt",
  "..kTtttttt",
  "..kTTttttt",
  "..kTTTTkTt",
  "..kTTTTkTt",
  "..kTTTTkTt",
  "...kTTkkTt",
  "....kk.kTt",
]
const ARM_LIFT = [
  "...klttttt",
  "..kltttttt",
  "..kltttttt",
  "..kTtttttt",
  "..kTtttttt",
  "..kTTttttt",
  "..kTTTTkTt",
  "...kTTkkTt",
  "....kk.kTt",
]
// painted over the keyboard so the paws rest on top of it
const typingArm = (side, block) => (c) => {
  block.forEach((r, dy) => {
    for (let x = 0; x < r.length; x++) if (r[x] !== ".") c.px(side === "L" ? x : mx(x), 43 + dy, r[x])
  })
}
const typing = (press) => ({
  arms: { L: "remove", R: "remove" },
  after: [laptopDeck, typingArm("L", press === "L" ? ARM_PRESS : ARM_LIFT), typingArm("R", press === "R" ? ARM_PRESS : ARM_LIFT), laptopLid],
})
const roll = (c) => {
  c.rect(7, 45, 27, 6, "k")
  c.rect(8, 46, 25, 4, "y")
  c.hline(8, 49, 25, "Y")
  c.rect(8, 46, 2, 4, "Y"); c.rect(31, 46, 2, 4, "Y")
}
const mug = (tilt) => (c) => {
  const x = 30, y = tilt ? 33 : 35
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
pose("pressL", typing("L"))
pose("pressR", typing("R"))
pose("scroll", { after: [roll] })
pose("hunt", { squash: 3 })
pose("jumpCrouch", { eyes: "squeeze", squash: 3 })
pose("jumpAir", { eyes: "happy", mouth: "o", blush: true, arms: { L: "up", R: "up" } })
pose("stretch0", { eyes: "closed", mouth: "o", arms: { L: "up", R: "up" } })
pose("stretch1", { eyes: "squeeze", mouth: "o", blush: true, tall: 3, arms: { L: "up", R: "up" } })
pose("drink0", { mouth: "o", arms: { R: "up" }, after: [mug(false)] })
pose("drink1", { eyes: "closed", mouth: "o", blush: true, arms: { R: "up" }, after: [mug(true)] })
pose("drag", { mouth: "o", arms: { L: "up", R: "up" } })
pose("think", { eyes: "lid" })
pose("wave", { eyes: "happy", blush: true, arms: { R: "up" } })
pose("peek")

const POSES = ["idle0", "idle1", "blink", "sleep0", "sleep1", "happy0", "happy1", "pressL", "pressR", "scroll", "hunt",
  "jumpCrouch", "jumpAir", "stretch0", "stretch1", "drink0", "drink1", "drag", "think", "wave", "peek"]
scene("poses_a", { w: 44 * 7, h: 60 * 2, bg: "#e6ecec" }, ...POSES.slice(0, 14).map((n, i) => stamp(n, (i % 7) * 44 + 1, Math.floor(i / 7) * 60 + 1)))
scene("poses_b", { w: 44 * 7, h: 60, bg: "#e6ecec" }, ...POSES.slice(14).map((n, i) => stamp(n, i * 44 + 1, 1)))

// Pupils as in the reference (the app draws these live)
sprite("idle_preview", { base: "idle" },
  rect(14, 21, 3, 4, "e"), px(14, 21, "w"), rect(24, 21, 3, 4, "e"), px(24, 21, "w"))
