// Hangyodon desktop pet: every pose comes from one parametric drawing function,
// so proportions and colors stay identical across frames.
// Pupils are NOT drawn here: the app draws them at runtime so the eyes can follow the cursor.
// Build: node .claude/skills/pxl-pixel-art/bin/pxl.js build art/hangyodon.px.js --out assets/sprites-build

pal({
  k: "#1b2338", // outline
  h: "#c9f1f5", // skin highlight
  b: "#86cfe0", // skin
  B: "#5aa6c4", // skin shade
  f: "#3d80b9", // fin
  F: "#2b5c90", // fin shade
  c: "#f1faf8", // belly
  C: "#c9e3e4", // belly shade
  r: "#e9516c", // lips
  R: "#b23250", // lip shade / mouth
  p: "#ffa3b4", // lip highlight
  w: "#ffffff", // eye white
  e: "#151a28", // eye lines
  n: "#ffb3c1", // blush
  g: "#a7afc0", // keyboard
  G: "#6d778d", // keyboard keys
  m: "#fff1c9", // paper / cup
  M: "#d9b36a", // paper / cup shade
  u: "#7fc8ff", // water
})
ramps("kFfBbh", "kRrp", "kCcw", "kGgw", "kMm")

const CX = 20

// Mirror a poly's x coordinate (vertices sit on pixel corners).
const mxx = (x) => 2 * CX + 1 - x
const mirrorPoly = (pts) => pts.map((v, i) => (i % 2 === 0 ? mxx(v) : v))

function outlinedEllipse(c, cx, cy, rx, ry, col) {
  c.ellipse(cx, cy, rx + 1, ry + 1, "k")
  c.ellipse(cx, cy, rx, ry, col)
}

function arm(c, x0, y0, x1, y1) {
  c.line(x0, y0, x1, y1, "k", 5)
  c.line(x0, y0, x1, y1, "B", 3)
}

// arm presets for the LEFT arm, relative to body center (bx, by); right arm is mirrored.
const ARMS = {
  down: [-7, -2, -10, 3],
  up: [-8, -4, -14, -26],
  front: [-6, -2, -2, 1],
  pressDown: [-6, -2, -5, 6],
  pressUp: [-6, -2, -6, 1],
  pounce: [-6, 0, -9, 6],
  dangle: [-8, -4, -13, -14],
  wave: [-8, -3, -14, -13],
  chin: [-6, -2, -2, -6],
}

function drawArm(c, mode, side, bx, by) {
  const a = ARMS[mode]
  if (!a) return
  const s = side === "L" ? 1 : -1
  const X = (dx) => (side === "L" ? bx + dx : 2 * CX - (bx + dx))
  arm(c, X(a[0]), by + a[1], X(a[2]), by + a[3])
  void s
}

function eye(c, x, y, mode) {
  if (mode === "open" || mode === "lid") {
    c.ellipse(x, y, 3, 3, "e")
    c.ellipse(x, y, 2, 2, "w")
    if (mode === "lid") { c.hline(x - 2, y - 2, 5, "B"); c.hline(x - 2, y - 1, 5, "e") }
  } else if (mode === "closed") {
    c.px(x - 2, y, "e"); c.hline(x - 1, y + 1, 3, "e"); c.px(x + 2, y, "e")
  } else if (mode === "happy") {
    c.px(x - 2, y + 1, "e"); c.px(x - 1, y, "e"); c.px(x, y - 1, "e"); c.px(x + 1, y, "e"); c.px(x + 2, y + 1, "e")
  } else if (mode === "squeeze") {
    c.px(x - 2, y - 1, "e"); c.px(x - 1, y, "e"); c.px(x, y, "e"); c.px(x + 1, y, "e"); c.px(x + 2, y - 1, "e")
    c.px(x - 1, y + 1, "e"); c.px(x + 1, y + 1, "e")
  }
}

function lips(c, x, y, mode) {
  if (mode === "o") {
    c.ellipse(x, y + 1, 4, 3, "k")
    c.ellipse(x, y + 1, 3, 2, "r")
    c.ellipse(x, y + 1, 1, 1, "R")
    c.px(x - 2, y, "p")
    return
  }
  c.ellipse(x, y, 6, 3, "k")
  c.ellipse(x, y, 5, 2, "r")
  c.hline(x - 4, y, 9, "R")
  if (mode === "smile") { c.px(x - 5, y - 1, "R"); c.px(x + 5, y - 1, "R") }
  c.hline(x - 3, y - 2, 2, "p")
  c.px(x + 2, y - 2, "p")
}

/**
 * o.hy head center y, o.by body center y, o.armL/o.armR arm presets,
 * o.eyes eye mode, o.mouth lip mode, o.blush, o.prop ("keyboard" | "roll" | "cup" | "cupTilt"),
 * o.feet ("stand" | "tuck" | "dangle"), o.armsBehind (draw arms before body).
 */
function hangyodon(c, o = {}) {
  // +4 leaves headroom so the crest never clips in tall poses
  const hy = (o.hy ?? 14) + 4
  const by = (o.by ?? 30) + 4
  const armL = o.armL ?? "down"
  const armR = o.armR ?? armL
  const feet = o.feet ?? "stand"

  const raised = (m) => m === "up" || m === "dangle" || m === "wave"

  // feet
  if (feet !== "tuck") {
    const fy = feet === "dangle" ? by + 8 : by + 7
    outlinedEllipse(c, CX - 4, fy, 3, 1, "B")
    outlinedEllipse(c, CX + 4, fy, 3, 1, "B")
  }

  // body + belly
  outlinedEllipse(c, CX, by, 8, 7, "b")
  c.ellipse(CX, by + 1, 5, 5, "c")
  c.shade((x, y) => ((x - CX) / 5) ** 2 + ((y - by - 1) / 5) ** 2 <= 1 && y >= by + 4)
  c.shade((x, y) => ((x - CX) / 8.5) ** 2 + ((y - by) / 7.5) ** 2 <= 1 && x >= CX + 5 && c.is(x, y, "b"))

  if (feet === "tuck") {
    outlinedEllipse(c, CX - 4, by + 6, 2, 1, "B")
    outlinedEllipse(c, CX + 4, by + 6, 2, 1, "B")
  }

  // side fins (ears), dorsal crest
  const finL = [CX - 10, hy - 4, CX - 18, hy - 9, CX - 17, hy + 1, CX - 10, hy + 4]
  const crest = [CX - 4, hy - 8, CX - 2, hy - 14, CX + 1, hy - 11, CX + 3, hy - 15, CX + 5, hy - 8]
  for (const pts of [finL, mirrorPoly(finL), crest]) c.poly(pts, "f")
  c.line(CX - 16, hy - 6, CX - 11, hy - 1, "F")
  c.line(mxx(CX - 16) - 1, hy - 6, mxx(CX - 11) - 1, hy - 1, "F")
  c.vline(CX, hy - 10, 2, "F")

  // arms raised above the head: over the fins, behind the head
  if (raised(armL)) drawArm(c, armL, "L", CX, by)
  if (raised(armR)) drawArm(c, armR, "R", CX, by)

  // head
  outlinedEllipse(c, CX, hy, 12, 9, "b")
  const inHead = (x, y) => ((x - CX) / 12.4) ** 2 + ((y - hy) / 9.4) ** 2 <= 1
  c.shade((x, y) => inHead(x, y) && !(((x - CX + 2) / 12.4) ** 2 + ((y - hy + 2) / 9.4) ** 2 <= 1) && c.is(x, y, "b"))
  c.light((x, y) => ((x - CX + 6) / 4) ** 2 + ((y - hy + 5) / 2) ** 2 <= 1 && c.is(x, y, "b"))

  // arms in front of the body (drawn after head when they reach the face)
  if (!raised(armL) && armL !== "chin") drawArm(c, armL, "L", CX, by)
  if (!raised(armR) && armR !== "chin") drawArm(c, armR, "R", CX, by)

  // face
  const eyes = o.eyes ?? "open"
  eye(c, CX - 6, hy - 1, eyes)
  eye(c, CX + 6, hy - 1, eyes)
  if (o.blush) { c.hline(CX - 10, hy + 3, 2, "n"); c.hline(CX + 9, hy + 3, 2, "n") }
  lips(c, CX, hy + 5, o.mouth ?? "pout")

  // props
  if (o.prop === "keyboard") {
    c.rect(CX - 13, by + 4, 27, 6, "k")
    c.rect(CX - 12, by + 5, 25, 4, "g")
    for (let i = 0; i < 6; i++) { c.hline(CX - 11 + i * 4, by + 6, 2, "G"); c.hline(CX - 9 + i * 4, by + 7, 2, "G") }
    // paws on top of the keyboard
    const ax = (side, mode) => {
      const a = ARMS[mode]
      return side === "L" ? CX + a[2] : 2 * CX - (CX + a[2])
    }
    for (const [side, mode] of [["L", armL], ["R", armR]]) {
      const x = ax(side, mode), y = by + ARMS[mode][3]
      c.ellipse(x, y, 2, 1, "k"); c.ellipse(x, y, 1, 0, "B")
    }
  }
  if (o.prop === "roll") {
    c.rect(CX - 8, by - 1, 17, 5, "k")
    c.rect(CX - 7, by, 15, 3, "m")
    c.hline(CX - 7, by + 2, 15, "M")
    c.rect(CX - 8, by - 1, 2, 5, "M"); c.rect(CX + 7, by - 1, 2, 5, "M")
  }
  if (o.prop === "cup" || o.prop === "cupTilt") {
    const tilt = o.prop === "cupTilt"
    const x = CX + 4, y = hy + (tilt ? 3 : 5)
    arm(c, CX + 7, by - 2, x + 3, y + 7)
    c.rect(x - 1, y - 1, 8, 9, "k")
    c.rect(x, y, 6, 7, "m")
    c.vline(x + 5, y, 7, "M")
    c.hline(x, y, 6, tilt ? "u" : "M")
    c.rect(x + 7, y + 2, 2, 3, "k"); c.px(x + 7, y + 3, "m")
  }
  if (armL === "chin") drawArm(c, "chin", "L", CX, by)
  if (armR === "chin") drawArm(c, "chin", "R", CX, by)
}

const W = 40, H = 46
const pose = (name, o) => sprite(name, { w: W, h: H, outline: "k" }, (c) => hangyodon(c, o))

pose("idle0", {})
pose("idle1", { hy: 15, by: 30 })
pose("blink", { eyes: "closed" })
pose("sleep0", { hy: 16, eyes: "closed", mouth: "pout" })
pose("sleep1", { hy: 17, eyes: "closed", mouth: "pout" })
pose("happy0", { eyes: "happy", blush: true, mouth: "smile" })
pose("happy1", { hy: 15, eyes: "happy", blush: true, mouth: "smile" })
pose("pressL", { armL: "pressDown", armR: "pressUp", prop: "keyboard", eyes: "open" })
pose("pressR", { armL: "pressUp", armR: "pressDown", prop: "keyboard", eyes: "open" })
pose("scroll", { armL: "front", prop: "roll" })
pose("hunt", { hy: 18, by: 32, armL: "pounce", eyes: "open", mouth: "o", feet: "stand" })
pose("jumpCrouch", { hy: 18, by: 32, armL: "down", eyes: "squeeze", mouth: "smile" })
pose("jumpAir", { hy: 12, by: 28, armL: "up", eyes: "happy", mouth: "o", feet: "tuck", blush: true })
pose("stretch0", { hy: 13, by: 30, armL: "up", eyes: "closed", mouth: "o" })
pose("stretch1", { hy: 11, by: 29, armL: "up", eyes: "squeeze", mouth: "o", blush: true })
pose("drink0", { armL: "down", armR: "none", prop: "cup", eyes: "open", mouth: "o" })
pose("drink1", { armL: "down", armR: "none", prop: "cupTilt", eyes: "closed", mouth: "o", blush: true })
pose("drag", { armL: "dangle", eyes: "open", mouth: "o", feet: "dangle" })
pose("think", { armL: "down", armR: "chin", eyes: "lid", mouth: "pout" })
pose("wave", { armL: "down", armR: "wave", eyes: "happy", mouth: "smile", blush: true })
pose("peek", { armL: "front", eyes: "open" })

// Review sheet (not used by the app)
const POSES = ["idle0", "idle1", "blink", "sleep0", "sleep1", "happy0", "happy1", "pressL", "pressR", "scroll", "hunt",
  "jumpCrouch", "jumpAir", "stretch0", "stretch1", "drink0", "drink1", "drag", "think", "wave", "peek"]
scene("review_a", { w: 44 * 6, h: 50 * 2, bg: "#f4f0e6" }, ...POSES.slice(0, 12).map((n, i) => stamp(n, (i % 6) * 44, Math.floor(i / 6) * 50)))
scene("review_b", { w: 44 * 6, h: 50 * 2, bg: "#f4f0e6" }, ...POSES.slice(12).map((n, i) => stamp(n, (i % 6) * 44, Math.floor(i / 6) * 50)))
