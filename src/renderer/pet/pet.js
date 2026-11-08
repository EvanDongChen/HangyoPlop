// Pet renderer: picks a pose every frame, draws it on a 42x44 canvas (with live pupils,
// and the scroll paper), and runs the in-window UI (bubble, panels, prompts).
;(() => {
  const api = window.pet
  const C = window.HangyoColors

  const SW = 41
  const SH = 58
  const POSES = ["idle0", "idle1", "blink", "sleep0", "sleep1", "happy0", "happy1", "pressL0", "pressL1", "pressL2", "pressR0", "pressR1", "pressR2", "scroll", "hunt",
    "jumpCrouch", "jumpAir", "stretch0", "stretch1", "drink0", "drink1", "drag", "think", "wave", "peek", "blub", "yawn", "finUp"]
  // Eye-center row for poses that have open eyes (pupils are drawn live). Columns are fixed.
  // Poses with open eyes, and how far each one moved the head down from idle0.
  const EYE_SHIFT = { idle0: 0, idle1: 1, pressL0: 0, pressL1: 0, pressL2: 0, pressR0: 0, pressR1: 0, pressR2: 0, scroll: 0, hunt: 3, drink0: 0, drag: 0, think: 0, peek: 0, blub: 0, finUp: 0 }
  const EYE_CX = [13, 27] // eye-white centers (columns) in idle0
  const EYE_CY = 27 // eye-white center row in idle0
  const EYE_WHITE = [0xf4, 0xf8, 0xfa]
  const HEAD_ROWS = 40 // rows 0..39 are the head and lips: petting zone

  const $ = (id) => document.getElementById(id)
  const body = document.body
  const box = $("pet-box")
  const canvas = $("pet")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  const bubbleEl = $("bubble")

  const now = () => performance.now()
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  // ------------------------------------------------------------ state

  const S = {
    settings: {},
    layout: { mode: "normal", scale: 3, width: 330, height: 360 },
    cursor: { x: -9999, y: -9999, lastX: null, lastY: null },
    lastActive: now(),
    wakeUntil: 0,
    blinkAt: now() + 2500,
    blinkUntil: 0,
    press: { side: "L", n: 0, until: 0 },
    scroll: { until: 0, paper: 0, offset: 0 },
    drag: null, // { vx, vy, stretch, wobble, wobbleV }
    dragRelease: null,
    jump: null, // { start, hops }
    hunt: { energy: 0, lastFastDx: 0, until: 0, dir: 0 },
    purr: { until: 0, accum: 0, last: null },
    agent: "idle",
    activity: null,
    waveUntil: 0,
    focusUntil: 0,
    pointerDown: null,
    pomodoro: null,
    fidget: null, // { kind, start, until }: a little idle animation
    nextFidget: 0,
    lastBusy: 0,
    reminders: [],
    transient: null, // { text, until }
    interactive: false,
    recording: null,
  }

  // ------------------------------------------------------------ sprites + recoloring

  const base = {}
  let normalSet = {}

  function loadImages() {
    return Promise.all(POSES.map((name) => new Promise((resolve) => {
      const img = new Image()
      img.onload = () => { base[name] = img; resolve() }
      img.onerror = () => resolve()
      img.src = `sprites/${name}.png`
    })))
  }

  function recolorSet(palette) {
    const map = new Map()
    for (const [key, hex] of Object.entries(C.CLASSIC)) {
      const from = C.hexToRgb(hex)
      const to = C.hexToRgb(palette[key] || hex)
      map.set((from[0] << 16) | (from[1] << 8) | from[2], to)
    }
    const out = {}
    for (const name of POSES) {
      const img = base[name]
      if (!img) continue
      const c = document.createElement("canvas")
      c.width = SW
      c.height = SH
      const x = c.getContext("2d", { willReadFrequently: true })
      x.drawImage(img, 0, 0)
      const data = x.getImageData(0, 0, SW, SH)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue
        const to = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
        if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2] }
      }
      x.putImageData(data, 0, 0)
      out[name] = c
    }
    return out
  }

  function rebuildSprites() {
    const palette = C.fullPalette(S.settings.colors)
    normalSet = recolorSet(palette)
  }

  // ------------------------------------------------------------ layout

  function applyLayout(l) {
    S.layout = l
    body.dataset.mode = l.mode
    const s = l.mode === "big" ? Math.max(3, Math.floor((Math.min(l.width, l.height) * 0.6) / SH)) : l.scale
    S.drawScale = s
    document.documentElement.style.setProperty("--s", `${s}px`)
    const w = SW * s
    const h = SH * s
    if (l.mode === "peek") {
      box.style.left = `${Math.round((l.width - w) / 2)}px`
      box.style.top = `${Math.round((l.height - h) / 2)}px`
      box.style.transform = `rotate(${l.edge === "left" ? 90 : -90}deg)`
    } else if (l.mode === "big") {
      box.style.left = `${Math.round((l.width - w) / 2)}px`
      box.style.top = `${Math.round(l.height * 0.9 - h)}px`
      box.style.transform = ""
    } else {
      // main keeps the window on screen and says where the pet sits inside it
      const cx = l.pet ? l.pet.cx : l.width / 2
      const bottom = l.pet ? l.pet.bottom : l.height - 24
      box.style.left = `${Math.round(cx - w / 2)}px`
      box.style.top = `${Math.round(bottom - h)}px`
      box.style.transform = ""
    }
    positionPanels()
    fitBubble()
  }

  // Panels, the timer chip and the clock button stay inside the window (which main keeps on
  // screen): panels open above the pet, or below it when there's more room there.
  function positionPanels() {
    const W = S.layout.width
    const H = S.layout.height
    const top = box.offsetTop
    const petW = box.offsetWidth
    const petCx = box.offsetLeft + petW / 2
    const above = top
    const below = H - (top + box.offsetHeight) - 22 // leave the name visible
    for (const el of [$("prompt"), $("reminders")]) {
      const pw = el.offsetWidth || 300
      el.style.transform = "none"
      el.style.left = `${Math.round(clamp(petCx - pw / 2, 4, W - pw - 4))}px`
      if (above >= 170 || above >= below) {
        el.style.top = ""
        el.style.bottom = `${H - top + 6}px`
        el.style.maxHeight = `${Math.max(100, above - 10)}px`
      } else {
        el.style.bottom = ""
        el.style.top = `${top + box.offsetHeight + 22}px`
        el.style.maxHeight = `${Math.max(100, below - 6)}px`
      }
    }
    body.classList.toggle("pomo-left", W - (box.offsetLeft + petW) < 90)
    body.classList.toggle("thought-left", box.offsetLeft > W - (box.offsetLeft + petW))
    body.classList.toggle("clock-right", box.offsetLeft < 34)
  }

  // Keep the speech bubble inside the window: slide it sideways, or show it under the pet when
  // there's no room above (the tail keeps pointing at the head).
  function fitBubble() {
    if (bubbleEl.classList.contains("hidden")) return
    const W = S.layout.width
    const petCx = box.offsetLeft + box.offsetWidth / 2
    const bw = bubbleEl.offsetWidth
    const left = petCx - bw / 2
    const shift = left < 4 ? 4 - left : left + bw > W - 4 ? W - 4 - (left + bw) : 0
    bubbleEl.style.marginLeft = `${Math.round(shift)}px`
    bubbleEl.style.setProperty("--tail", `${Math.round(-shift)}px`)
    const roomAbove = box.offsetTop + 5 * (S.drawScale || 3)
    bubbleEl.classList.toggle("below", bubbleEl.offsetHeight + 12 > roomAbove)
  }

  // ------------------------------------------------------------ pose selection

  function pickPose(t) {
    const L = S.layout
    if (S.activity) {
      const e = t - S.activity.start
      if (S.activity.kind === "stretch") return e % 1800 < 900 ? "stretch0" : "stretch1"
      return e % 2400 < 1000 ? "drink0" : "drink1"
    }
    if (L.mode === "peek") return t < S.blinkUntil ? "blink" : "peek"
    if (S.drag) return "drag"
    if (S.jump) {
      const e = t - S.jump.start
      const hop = 760
      const k = e % hop
      if (e >= hop * S.jump.hops) { S.jump = null; return pickPose(t) }
      return k < 120 || k > 660 ? "jumpCrouch" : "jumpAir"
    }
    if (t < S.hunt.until) return "hunt"
    if (t < S.purr.until) return Math.floor(t / 380) % 2 ? "happy1" : "happy0"
    if (t < S.press.until) return `press${S.press.side}${S.press.n}`
    if (t < S.focusUntil) { const k = Math.floor(t / 110); return `press${k % 2 ? "L" : "R"}${k % 3}` }
    if (t < S.scroll.until) return "scroll"
    if (t < S.waveUntil) return Math.floor(t / 300) % 2 ? "wave" : "happy0"
    if (S.agent === "thinking") return t < S.blinkUntil ? "blink" : "think"
    if (isSleeping(t)) return Math.floor(t / 1400) % 2 ? "sleep1" : "sleep0"
    const fp = fidgetPose(t)
    if (fp) return fp
    if (t < S.wakeUntil) return "blink"
    if (t < S.blinkUntil) return "blink"
    return Math.floor(t / 750) % 2 ? "idle1" : "idle0"
  }

  const SLEEP_AFTER_MS = 45_000
  function isSleeping(t) {
    return S.layout.mode === "normal" && !S.transient && t - S.lastActive > SLEEP_AFTER_MS
  }

  function markActive() {
    const t = now()
    if (isSleeping(t)) S.wakeUntil = t + 620
    S.lastActive = t
  }

  // ------------------------------------------------------------ drawing

  let frameData = null

  function pupilOffset(ex, ey) {
    // cursor in window coords -> sprite coords, using the canvas' on-screen box
    const r = canvas.getBoundingClientRect()
    if (!r.width) return [0, 0]
    let sx, sy
    const L = S.layout
    if (L.mode === "peek") {
      // rotated canvas: map the eye position to screen space
      if (L.edge === "left") { sx = r.left + (1 - ey / SH) * r.width; sy = r.top + (ex / SW) * r.height }
      else { sx = r.left + (ey / SH) * r.width; sy = r.top + (1 - ex / SW) * r.height }
    } else {
      sx = r.left + (ex / SW) * r.width
      sy = r.top + (ey / SH) * r.height
    }
    let dx = S.cursor.x - sx
    let dy = S.cursor.y - sy
    if (L.mode === "peek") {
      ;[dx, dy] = L.edge === "left" ? [dy, -dx] : [-dy, dx]
    }
    const dist = Math.hypot(dx, dy)
    if (dist < 6) return [0, 0]
    // look further toward the edge of the eye the further away the cursor is
    const reach = Math.min(1, dist / 160)
    return [Math.round((dx / dist) * 3 * reach), Math.round((dy / dist) * 2.5 * reach)]
  }

  function drawPupils(pose, t) {
    const shift = EYE_SHIFT[pose]
    if (shift === undefined) return
    const cy = EYE_CY + shift
    let [ox, oy] = pupilOffset((EYE_CX[0] + EYE_CX[1]) / 2, cy)
    const look = glanceAt(t)
    if (look) [ox, oy] = look
    if (pose === "think") { oy = 2; if (S.agent === "thinking") ox = Math.floor(t / 1500) % 2 ? 2 : -2 }
    if (pose === "hunt") oy = Math.max(oy, 0)
    // a 3x4 pupil, painted only over eye-white pixels so it never spills past the eye
    const img = ctx.getImageData(0, 0, SW, SH)
    const d = img.data
    for (const cx of EYE_CX) {
      const x0 = cx - 1 + ox
      const y0 = cy - 2 + oy
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 3; x++) {
        const i = (y * SW + x) * 4
        if (d[i] !== EYE_WHITE[0] || d[i + 1] !== EYE_WHITE[1] || d[i + 2] !== EYE_WHITE[2]) continue
        const shine = x === x0 && y === y0
        d[i] = d[i + 1] = shine ? 255 : 10
        d[i + 2] = shine ? 255 : 18
      }
    }
    ctx.putImageData(img, 0, 0)
  }

  function drawPaper(t) {
    const len = Math.round(S.scroll.paper)
    if (len <= 0) return
    const x = 13
    const w = 15
    const y0 = 53
    ctx.fillStyle = "#0d2236"
    ctx.fillRect(x - 1, y0, w + 2, len + 1)
    ctx.fillStyle = "#fff1c9"
    ctx.fillRect(x, y0, w, len)
    ctx.fillStyle = "#d9b36a"
    const off = Math.floor(S.scroll.offset) % 3
    for (let y = y0 + off; y < y0 + len; y += 3) ctx.fillRect(x + 2, y, w - 4 - ((y * 7) % 4), 1)
  }

  function draw(t) {
    const pose = pickPose(t)
    S.pose = pose
    ctx.clearRect(0, 0, SW, SH)
    const img = normalSet[pose]
    if (img) ctx.drawImage(img, 0, 0)
    drawPupils(pose, t)
    if (pose === "scroll") drawPaper(t)
    frameData = ctx.getImageData(0, 0, SW, SH).data

    // effects classes
    body.classList.toggle("purring", t < S.purr.until)
    body.classList.toggle("sleeping", pose === "sleep0" || pose === "sleep1")
  }

  // ------------------------------------------------------------ motion (transforms)

  function updateTransform(t, dt) {
    let ty = 0
    let tx = 0
    let sx = 1
    let sy = 1
    let skew = 0
    const s = S.drawScale || 3

    if (S.jump) {
      const e = t - S.jump.start
      const k = e % 760
      if (k >= 120 && k <= 660) ty = -Math.sin(((k - 120) / 540) * Math.PI) * 13 * s
      else { sy = 0.94; sx = 1.04 }
    }
    if (S.drag) {
      const d = S.drag
      const targetStretch = 0.1 + clamp(-d.vy * 0.012, -0.06, 0.45)
      d.stretch += (targetStretch - d.stretch) * 0.25
      d.wobbleV += (-0.1 * d.wobble - 0.16 * d.wobbleV) + d.vx * 0.02
      d.wobble = clamp(d.wobble + d.wobbleV, -22, 22)
      d.vx *= 0.6
      d.vy *= 0.6
      sy = 1 + d.stretch
      sx = 1 / Math.sqrt(sy)
      skew = d.wobble
    } else if (S.dragRelease) {
      // springy settle after letting go
      const e = (t - S.dragRelease) / 520
      if (e >= 1) S.dragRelease = null
      else {
        const k = Math.sin(e * Math.PI * 3) * (1 - e)
        sy = 1 - k * 0.12
        sx = 1 + k * 0.1
      }
    }
    if (t < S.hunt.until) {
      tx = S.hunt.dir * s * 2 * Math.sin((t / 90) % (Math.PI * 2))
      sy *= 0.97
    }
    if (S.activity && S.activity.kind === "stretch") {
      const e = t - S.activity.start
      sy = 1 + Math.max(0, Math.sin((e / 1800) * Math.PI * 2)) * 0.08
      sx = 1 / Math.sqrt(sy)
    }
    if (t < S.purr.until) sx *= 1 + Math.sin(t / 60) * 0.01
    if (S.fidget && S.fidget.kind === "sway" && t < S.fidget.until && !S.drag && !S.jump) {
      tx += (Math.floor((t - S.fidget.start) / 380) % 2 ? 1 : -1) * s // whole art pixels, stays crisp
    }
    canvas.style.transform = `translate(${tx}px, ${ty}px) skewX(${skew}deg) scale(${sx}, ${sy})`
    canvas.style.transformOrigin = S.drag ? "50% 6%" : "50% 100%"
  }

  // ------------------------------------------------------------ scroll easing

  function stepScroll(t, dt) {
    const sc = S.scroll
    const goal = t < sc.until ? 5 : 0
    sc.paper += (goal - sc.paper) * Math.min(1, dt / 120)
    if (sc.paper < 0.2) sc.paper = 0
  }

  // ------------------------------------------------------------ idle fidgets
  // When nothing has happened for a few seconds he does small things on his own.

  const FIDGETS = [
    ["glance", 3, 2200], ["bubbles", 2, 2600], ["fins", 2, 1300], ["sway", 2, 2300],
    ["yawn", 1, 1500], ["hop", 1, 900], ["stretch", 1, 1700],
  ]

  // Anything the person does (typing, scrolling, dragging, a message) stops the fidget and
  // pushes the next one back.
  function busy() {
    S.lastBusy = now()
    S.fidget = null
    body.classList.remove("bubbling")
  }

  function canFidget(t) {
    return S.layout.mode === "normal" && !S.drag && !S.jump && !S.activity && S.agent === "idle" &&
      !isSleeping(t) && t >= S.purr.until && t >= S.press.until && t >= S.scroll.until && t >= S.waveUntil &&
      t >= S.focusUntil && t >= S.hunt.until && t - S.lastBusy > 6000 && !S.transient
  }

  function stepFidget(t) {
    if (S.fidget && t >= S.fidget.until) {
      S.fidget = null
      body.classList.remove("bubbling")
    }
    if (S.fidget) {
      if (!canFidget(t) && S.fidget.kind !== "hop") { S.fidget = null; body.classList.remove("bubbling") }
      return
    }
    if (!S.nextFidget) S.nextFidget = t + 6000 + Math.random() * 4000
    if (t < S.nextFidget) return
    if (!canFidget(t)) { S.nextFidget = t + 2500; return }
    const total = FIDGETS.reduce((n, f) => n + f[1], 0)
    let r = Math.random() * total
    let pick = FIDGETS[0]
    for (const f of FIDGETS) { if ((r -= f[1]) < 0) { pick = f; break } }
    if (S.lastFidget === pick[0]) pick = FIDGETS[(FIDGETS.indexOf(pick) + 1) % FIDGETS.length]
    S.lastFidget = pick[0]
    S.fidget = { kind: pick[0], start: t, until: t + pick[2] }
    if (pick[0] === "hop") S.jump = { start: t, hops: 1 }
    if (pick[0] === "bubbles") {
      body.classList.remove("bubbling")
      void body.offsetWidth
      body.classList.add("bubbling")
    }
    S.nextFidget = t + pick[2] + 6000 + Math.random() * 8000
  }

  function fidgetPose(t) {
    const f = S.fidget
    if (!f || t >= f.until) return null
    const e = t - f.start
    if (f.kind === "bubbles") return "blub"
    if (f.kind === "yawn") return e < 1000 ? "yawn" : e < 1150 ? "blink" : "idle0"
    if (f.kind === "fins") return Math.floor(e / 130) % 2 ? "finUp" : "idle0"
    if (f.kind === "stretch") return e < 1300 ? "stretch0" : "idle1"
    return null // glance, sway and hop use the normal idle frames
  }

  // During a glance the eyes look left, right, then up, whatever the cursor is doing.
  function glanceAt(t) {
    const f = S.fidget
    if (!f || f.kind !== "glance" || t >= f.until) return null
    const e = t - f.start
    return e < 650 ? [-3, 0] : e < 1300 ? [3, 0] : e < 1800 ? [0, -2] : [0, 0]
  }

  // ------------------------------------------------------------ main loop

  let lastT = now()
  function frame() {
    const t = now()
    const dt = t - lastT
    lastT = t
    if (t > S.blinkAt) {
      S.blinkUntil = t + 140
      S.blinkAt = t + 2500 + Math.random() * 3500
      if (Math.random() < 0.2) S.blinkAt = t + 320 // occasional double blink
    }
    stepScroll(t, dt)
    stepFidget(t)
    updateTransform(t, dt)
    draw(t)
    updateBubble(t)
    if (S.recording) S.recording.draw(t)
    requestAnimationFrame(frame)
  }

  // ------------------------------------------------------------ speech bubble

  function say(text, ms = 4000) {
    S.transient = { text, until: now() + ms }
    renderBubble()
  }

  let shownText = null
  function renderBubble() {
    const t = now()
    let text = ""
    let fixed = false
    const thinking = false
    if (S.transient && t < S.transient.until) text = S.transient.text
    else if (S.settings.fixedMessage && S.layout.mode === "normal") { text = S.settings.fixedMessage; fixed = true }
    const key = `${fixed}:${thinking}:${text}`
    if (key === shownText) return
    shownText = key
    if (thinking) bubbleEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'
    else bubbleEl.textContent = text
    bubbleEl.classList.toggle("hidden", !text && !thinking)
    bubbleEl.classList.toggle("fixed", fixed)
    bubbleEl.classList.toggle("think", thinking)
    // restart pop animation
    bubbleEl.style.animation = "none"
    void bubbleEl.offsetWidth
    bubbleEl.style.animation = ""
    fitBubble()
  }

  // Thought bubble beside the head: "..." while Claude works, a light bulb when it's done.
  const thoughtEl = $("thought")
  const BULB = `<svg viewBox="0 0 12 14" width="30" height="35" shape-rendering="crispEdges" aria-label="done">
    <rect x="3" y="0" width="6" height="1" fill="#0d2236"/><rect x="2" y="1" width="1" height="1" fill="#0d2236"/><rect x="9" y="1" width="1" height="1" fill="#0d2236"/>
    <rect x="1" y="2" width="1" height="5" fill="#0d2236"/><rect x="10" y="2" width="1" height="5" fill="#0d2236"/>
    <rect x="3" y="1" width="6" height="1" fill="#ffe680"/><rect x="2" y="2" width="8" height="5" fill="#ffd23f"/>
    <rect x="3" y="2" width="2" height="2" fill="#fff6c8"/>
    <rect x="2" y="7" width="1" height="1" fill="#0d2236"/><rect x="9" y="7" width="1" height="1" fill="#0d2236"/>
    <rect x="3" y="7" width="6" height="2" fill="#ffd23f"/><rect x="3" y="9" width="1" height="1" fill="#0d2236"/><rect x="8" y="9" width="1" height="1" fill="#0d2236"/>
    <rect x="4" y="9" width="4" height="1" fill="#e0a800"/>
    <rect x="3" y="10" width="6" height="3" fill="#8b95a8"/><rect x="3" y="11" width="6" height="1" fill="#5d6678"/>
    <rect x="2" y="10" width="1" height="3" fill="#0d2236"/><rect x="9" y="10" width="1" height="3" fill="#0d2236"/>
    <rect x="4" y="13" width="4" height="1" fill="#0d2236"/>
  </svg>`
  let thoughtShown = ""
  function renderThought(t) {
    let mode = ""
    if (t < (S.doneUntil || 0)) mode = "bulb"
    else if (S.agent === "thinking") mode = "dots"
    if (S.layout.mode !== "normal" || S.drag) mode = ""
    if (mode === thoughtShown) return
    thoughtShown = mode
    thoughtEl.classList.toggle("hidden", !mode)
    thoughtEl.classList.toggle("bulb", mode === "bulb")
    thoughtEl.innerHTML = mode === "dots" ? '<span class="dot"></span><span class="dot"></span><span class="dot"></span>' : mode === "bulb" ? BULB : ""
    thoughtEl.style.animation = "none"
    void thoughtEl.offsetWidth
    thoughtEl.style.animation = ""
  }

  function updateBubble(t) {
    if (S.transient && t >= S.transient.until) S.transient = null
    renderBubble()
    renderThought(t)
  }

  // ------------------------------------------------------------ hit testing + mouse passthrough

  function spritePoint(clientX, clientY) {
    const r = canvas.getBoundingClientRect()
    if (!r.width || !r.height) return null
    let u, v
    const L = S.layout
    if (L.mode === "peek") {
      const fx = (clientX - r.left) / r.width
      const fy = (clientY - r.top) / r.height
      if (L.edge === "left") { v = (1 - fx) * SH; u = fy * SW } else { v = fx * SH; u = (1 - fy) * SW }
    } else {
      u = ((clientX - r.left) / r.width) * SW
      v = ((clientY - r.top) / r.height) * SH
    }
    return { u: Math.floor(u), v: Math.floor(v) }
  }

  function overPet(clientX, clientY) {
    const p = spritePoint(clientX, clientY)
    if (!p || !frameData) return null
    // a little forgiveness: any opaque pixel within 1px counts
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = p.u + dx
        const y = p.v + dy
        if (x < 0 || y < 0 || x >= SW || y >= SH) continue
        if (frameData[(y * SW + x) * 4 + 3] > 0) return p
      }
    }
    return null
  }

  function setInteractive(on) {
    if (on === S.interactive) return
    S.interactive = on
    api.setInteractive(on)
  }

  function refreshInteractive(e) {
    if (S.drag || S.pointerDown) return setInteractive(true)
    const target = document.elementFromPoint(e.clientX, e.clientY)
    const overUi = target && target.closest && target.closest(".ui")
    const pet = overPet(e.clientX, e.clientY)
    body.classList.toggle("over-pet", !!pet)
    if (pet || overUi) body.classList.add("hover")
    else if (!target || !target.closest("#pet-box")) body.classList.remove("hover")
    setInteractive(!!(pet || overUi))
    return pet
  }

  // ------------------------------------------------------------ petting (purr)

  function handlePetting(e, pet) {
    const P = S.purr
    if (!pet || pet.v >= HEAD_ROWS || S.layout.mode !== "normal" || S.drag || S.activity || e.buttons) {
      P.last = null
      return
    }
    if (P.last) P.accum += Math.hypot(e.clientX - P.last.x, e.clientY - P.last.y)
    P.last = { x: e.clientX, y: e.clientY, t: now() }
    if (P.accum > 90) {
      const wasPurring = now() < P.until
      P.until = now() + 450
      P.accum = 70
      if (!wasPurring) Sound.startPurr()
      clearTimeout(P.stopTimer)
      P.stopTimer = setTimeout(stopPurrIfDone, 470)
    }
  }

  function stopPurrIfDone() {
    if (now() >= S.purr.until) { Sound.stopPurr(); S.purr.accum = 0 }
    else S.purr.stopTimer = setTimeout(stopPurrIfDone, 120)
  }

  // ------------------------------------------------------------ hunting (cursor shake)

  function trackCursor(x, y) {
    const c = S.cursor
    if (c.lastX !== null) {
      const dx = x - c.lastX
      const dy = y - c.lastY
      const speed = Math.hypot(dx, dy)
      if (speed > 1) markActive()
      const H = S.hunt
      H.energy *= 0.86
      if (speed > 26 && Math.abs(dx) > Math.abs(dy) * 0.6) {
        if (H.lastFastDx && Math.sign(dx) !== Math.sign(H.lastFastDx)) H.energy += 1
        H.lastFastDx = dx
      }
      const r = canvas.getBoundingClientRect()
      const near = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) < 520
      if (H.energy > 2.3 && near && S.layout.mode === "normal" && !S.drag && !S.activity && !S.jump) {
        if (now() > H.until) Sound.pop()
        H.until = now() + 1100
        H.dir = Math.sign(x - (r.left + r.width / 2)) || 1
      }
    }
    c.lastX = x
    c.lastY = y
    c.x = x
    c.y = y
  }

  // ------------------------------------------------------------ pointer handling

  window.addEventListener("mousemove", (e) => {
    const pet = refreshInteractive(e)
    handlePetting(e, pet)
    const pd = S.pointerDown
    if (pd && !S.drag && Math.hypot(e.screenX - pd.x, e.screenY - pd.y) > 4) startDrag(pd)
  })

  window.addEventListener("mouseleave", () => {
    body.classList.remove("hover", "over-pet")
    S.purr.last = null
  })

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || !overPet(e.clientX, e.clientY)) return
    S.pointerDown = { x: e.screenX, y: e.screenY, cx: e.clientX, cy: e.clientY }
    setInteractive(true)
  })

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return
    const pd = S.pointerDown
    S.pointerDown = null
    if (S.drag) { api.dragStop(); return }
    if (pd && overPet(e.clientX, e.clientY)) onClickPet()
  })

  canvas.addEventListener("dblclick", (e) => {
    if (S.layout.mode === "normal" && overPet(e.clientX, e.clientY)) startJump(1)
  })

  window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    if (overPet(e.clientX, e.clientY)) api.contextMenu()
  })

  function startDrag(pd) {
    if (S.layout.mode === "big") return
    S.drag = { vx: 0, vy: 0, stretch: 0, wobble: 0, wobbleV: 0 }
    body.classList.add("dragging")
    Sound.stopPurr()
    S.purr.until = 0
    markActive()
    busy()
    api.dragStart(pd.cx, pd.cy)
  }

  let lastClick = 0
  function onClickPet() {
    busy()
    markActive()
    if (S.activity) { window.pet.dismissActivity && window.pet.dismissActivity(); return }
    if (S.layout.mode === "peek") { api.exitPeek(); return }
    const t = now()
    if (t - lastClick < 320) return // part of a double click
    lastClick = t
    Sound.blub()
    S.waveUntil = t + 900
  }

  // ------------------------------------------------------------ reactions from main

  function startJump(hops = 1) {
    if (S.layout.mode === "peek" || S.drag) return
    S.jump = { start: now(), hops }
    Sound.jump()
    markActive()
  }

  function onSay({ text, ms, mood }) {
    busy()
    markActive()
    say(text, ms)
    if (mood === "wave") { S.waveUntil = now() + 2200; Sound.alert() }
    else if (mood === "focus") { S.focusUntil = now() + 1400; Sound.blub() }
    else if (mood === "complete" || mood === "jump") Sound.alert()
    else if (mood === "stretch" || mood === "drink") Sound.blub()
  }

  function onJump({ mood } = {}) {
    busy()
    if (mood === "wave") { S.waveUntil = now() + 1600; Sound.blub(); return }
    if (mood === "focus") { S.focusUntil = now() + 1400; return }
    startJump(mood === "complete" ? 2 : 1)
  }

  // ------------------------------------------------------------ pomodoro chip

  function fmt(sec) {
    const m = Math.floor(sec / 60)
    return `${String(m).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`
  }

  function onPomodoro(p) {
    S.pomodoro = p
    body.classList.toggle("pomodoro", p.phase !== "idle")
    const chip = $("pomo")
    chip.classList.toggle("rest", p.phase === "rest")
    chip.classList.toggle("paused", !p.running && p.phase !== "idle")
    $("pomo-time").textContent = fmt(p.remainingSec)
    $("pomo-toggle").textContent = p.running ? "II" : "▶"
    $("pomo-toggle").title = p.running ? "Pause" : "Resume"
  }
  $("pomo-toggle").addEventListener("click", () => api.pomodoro(S.pomodoro && S.pomodoro.running ? "pause" : "start"))
  $("pomo-reset").addEventListener("click", () => api.pomodoro("reset"))

  // ------------------------------------------------------------ prompt form

  const promptForm = $("prompt")
  const promptInput = $("prompt-input")
  let promptId = null

  function openPrompt(p) {
    if (promptId !== null) api.promptResult(promptId, null)
    promptId = p.id
    $("prompt-title").textContent = p.title || ""
    $("prompt-unit").textContent = p.unit || ""
    promptInput.type = p.kind === "number" ? "number" : "text"
    promptInput.maxLength = p.maxLength || 80
    promptInput.placeholder = p.placeholder || ""
    if (p.kind === "number") { promptInput.min = p.min; promptInput.max = p.max } else { promptInput.removeAttribute("min"); promptInput.removeAttribute("max") }
    promptInput.value = p.value ?? ""
    $("reminders").classList.add("hidden")
    promptForm.classList.remove("hidden")
    positionPanels()
    setTimeout(() => { promptInput.focus(); promptInput.select() }, 50)
  }

  function closePrompt(value) {
    if (promptId === null) return
    const id = promptId
    promptId = null
    promptForm.classList.add("hidden")
    api.promptResult(id, value)
  }

  promptForm.addEventListener("submit", (e) => { e.preventDefault(); closePrompt(promptInput.value) })
  $("prompt-cancel").addEventListener("click", () => closePrompt(null))
  promptInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closePrompt(null) })

  // ------------------------------------------------------------ reminders panel

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const remPanel = $("reminders")
  const remForm = $("rem-form")
  let editingId = null
  let repeatMode = "once"

  ;(function buildDayPicker() {
    const wrap = remForm.querySelector(".days")
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      const label = document.createElement("label")
      label.innerHTML = `<input type="checkbox" value="${d}">${DAY_NAMES[d]}`
      wrap.appendChild(label)
    }
  })()

  function setRepeat(mode) {
    repeatMode = mode
    for (const b of remForm.querySelectorAll("[data-repeat]")) b.classList.toggle("on", b.dataset.repeat === mode)
    $("rem-days").classList.toggle("hidden", mode !== "days")
  }
  for (const b of remForm.querySelectorAll("[data-repeat]")) b.addEventListener("click", () => setRepeat(b.dataset.repeat))
  for (const b of remForm.querySelectorAll("[data-quick]")) {
    b.addEventListener("click", () => {
      const pick = { daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], weekends: [0, 6] }[b.dataset.quick]
      for (const cb of remForm.querySelectorAll(".days input")) cb.checked = pick.includes(Number(cb.value))
    })
  }

  function describeDays(days) {
    if (!days || !days.length) return "Once"
    const s = [...days].sort().join(",")
    if (s === "0,1,2,3,4,5,6") return "Daily"
    if (s === "1,2,3,4,5") return "Weekdays"
    if (s === "0,6") return "Weekends"
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(" ")
  }

  function renderReminders() {
    const list = $("rem-list")
    list.textContent = ""
    if (!S.reminders.length) {
      const p = document.createElement("div")
      p.className = "rem-empty"
      p.textContent = `Add a reminder and ${S.settings.petName || "Hangyodon"} will tell you on time.`
      list.appendChild(p)
      return
    }
    const sorted = [...S.reminders].sort((a, b) => a.time.localeCompare(b.time))
    for (const r of sorted) {
      const row = document.createElement("div")
      row.className = "rem" + (r.enabled ? "" : " off")
      const t = document.createElement("div")
      t.className = "t"
      t.textContent = r.time
      const m = document.createElement("div")
      m.className = "m"
      m.textContent = r.message
      m.title = r.message
      const acts = document.createElement("div")
      acts.className = "acts"
      const mk = (label, fn) => {
        const b = document.createElement("button")
        b.type = "button"
        b.textContent = label
        b.addEventListener("click", fn)
        acts.appendChild(b)
      }
      mk(r.enabled ? "On" : "Off", () => saveReminders(S.reminders.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled, lastFired: null } : x))))
      mk("Edit", () => openReminderForm(r))
      mk("Delete", () => saveReminders(S.reminders.filter((x) => x.id !== r.id)))
      const d = document.createElement("div")
      d.className = "d"
      d.textContent = describeDays(r.days)
      row.append(t, m, acts, d)
      list.appendChild(row)
    }
  }

  function saveReminders(list) {
    S.reminders = list
    renderReminders()
    api.saveReminders(list)
  }

  function openReminderForm(r) {
    editingId = r ? r.id : null
    const d = new Date(Date.now() + 10 * 60_000)
    $("rem-time").value = r ? r.time : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    $("rem-msg").value = r ? r.message : ""
    setRepeat(r && r.days && r.days.length ? "days" : "once")
    for (const cb of remForm.querySelectorAll(".days input")) cb.checked = !!(r && r.days && r.days.includes(Number(cb.value)))
    $("rem-save").textContent = r ? "Update" : "Save"
    remForm.classList.remove("hidden")
    setTimeout(() => $("rem-msg").focus(), 30)
  }

  remForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const days = repeatMode === "days"
      ? [...remForm.querySelectorAll(".days input")].filter((c) => c.checked).map((c) => Number(c.value))
      : []
    if (repeatMode === "days" && !days.length) { setRepeat("once") }
    const entry = { id: editingId || String(Date.now()), time: $("rem-time").value, days, message: $("rem-msg").value.trim(), enabled: true, lastFired: null }
    if (!entry.message || !entry.time) return
    const list = editingId ? S.reminders.map((x) => (x.id === editingId ? entry : x)) : [...S.reminders, entry]
    remForm.classList.add("hidden")
    saveReminders(list)
    say("Got it! I'll remind you. Blub!", 2500)
  })
  $("rem-cancel").addEventListener("click", () => remForm.classList.add("hidden"))
  $("rem-add").addEventListener("click", () => openReminderForm(null))

  function openReminders() {
    if (promptId !== null) closePrompt(null)
    renderReminders()
    remPanel.classList.remove("hidden")
    positionPanels()
    api.setPanelOpen(true)
  }
  function closeReminders() {
    remPanel.classList.add("hidden")
    remForm.classList.add("hidden")
    api.setPanelOpen(false)
  }
  $("rem-close").addEventListener("click", closeReminders)
  $("clock-btn").addEventListener("click", () => (remPanel.classList.contains("hidden") ? openReminders() : closeReminders()))
  remPanel.addEventListener("keydown", (e) => { if (e.key === "Escape") closeReminders() })

  // ------------------------------------------------------------ show-off recording

  function startRecording(seconds) {
    if (S.recording) return
    const W = 360
    const H = 420
    const rc = document.createElement("canvas")
    rc.width = W
    rc.height = H
    const x = rc.getContext("2d")
    x.imageSmoothingEnabled = false
    const stream = rc.captureStream(30)
    const chunks = []
    const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 2_500_000 })
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    const started = now()
    const k = 7
    S.recording = {
      draw(t) {
        x.fillStyle = "#dff3f8"
        x.fillRect(0, 0, W, H)
        // little sea floor
        x.fillStyle = "#f4e3b5"
        x.fillRect(0, H - 70, W, 70)
        x.fillStyle = "#e6cf93"
        for (let i = 0; i < W; i += 28) x.fillRect(i + ((i / 28) % 2) * 9, H - 52, 10, 4)
        const pw = SW * k
        const ph = SH * k
        let dy = 0
        if (S.jump) {
          const kk = (t - S.jump.start) % 760
          if (kk >= 120 && kk <= 660) dy = -Math.sin(((kk - 120) / 540) * Math.PI) * 13 * k
        }
        x.drawImage(canvas, Math.round((W - pw) / 2), Math.round(H - 40 - ph + dy), pw, ph)
        x.fillStyle = "#1b2338"
        x.font = "bold 18px Consolas, monospace"
        x.textAlign = "center"
        x.fillText(S.settings.petName || "Hangyodon", W / 2, H - 14)
        const left = Math.max(0, seconds - (t - started) / 1000)
        $("rec-time").textContent = `${left.toFixed(0)}s`
      },
    }
    $("rec").classList.remove("hidden")
    rec.onstop = async () => {
      S.recording = null
      $("rec").classList.add("hidden")
      const blob = new Blob(chunks, { type: "video/webm" })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const ok = await api.saveRecording(bytes)
      if (ok) say("Saved! Show me off~", 3000)
    }
    rec.start(250)
    say("Recording! Strike a pose!", 2000)
    S.waveUntil = now() + 1600
    setTimeout(() => rec.stop(), seconds * 1000)
  }

  // ------------------------------------------------------------ settings

  function applySettings(s) {
    const prevColors = JSON.stringify(S.settings.colors || null)
    S.settings = { ...S.settings, ...s }
    Sound.configure({ volume: S.settings.volume, muted: !!S.settings.soundMuted })
    $("name-badge").textContent = S.settings.petName || ""
    body.dataset.showName = S.settings.showPetName ? "1" : "0"
    body.dataset.clock = S.settings.showReminderButton ? "1" : "0"
    if (JSON.stringify(S.settings.colors || null) !== prevColors || !Object.keys(normalSet).length) rebuildSprites()
    shownText = null
    renderBubble()
  }

  // ------------------------------------------------------------ wiring

  api.onInit(({ settings, reminders }) => {
    S.reminders = reminders || []
    applySettings(settings)
  })
  api.onSettings(applySettings)
  api.onLayout(applyLayout)
  api.onCursor(({ x, y }) => trackCursor(x, y))
  api.onKey(({ side }) => {
    const t = now()
    markActive()
    busy()
    // hit a random key with the paw on that side, never the same key twice in a row
    let n = Math.floor(Math.random() * 3)
    if (S.press.side === side && n === S.press.n) n = (n + 1 + Math.floor(Math.random() * 2)) % 3
    S.press = { side, n, until: t + 180 }
  })
  api.onWheel(() => {
    const t = now()
    markActive()
    busy()
    S.scroll.until = t + 360
    S.scroll.offset += 1
  })
  api.onDragMove(({ dx, dy }) => {
    if (!S.drag) return
    S.drag.vx += dx
    S.drag.vy += dy
  })
  api.onDragEnd(() => {
    S.drag = null
    S.dragRelease = now()
    body.classList.remove("dragging")
    Sound.pop()
  })
  api.onActivity(({ kind, phase }) => {
    busy()
    if (phase === "start") S.activity = { kind, start: now() }
    else S.activity = null
    markActive()
  })
  api.onSay(onSay)
  api.onJump(onJump)
  api.onAgent(({ state }) => {
    busy()
    if (state === "done") {
      S.agent = "idle"
      S.doneUntil = now() + 3200
      Sound.alert()
    } else S.agent = state
    markActive()
  })
  api.onPomodoro(onPomodoro)
  api.onPrompt(openPrompt)
  api.onOpenReminders(openReminders)
  api.onReminders((list) => { S.reminders = list || []; if (!remPanel.classList.contains("hidden")) renderReminders() })
  api.onRecord(({ seconds }) => startRecording(seconds))

  loadImages().then(() => {
    rebuildSprites()
    requestAnimationFrame(frame)
    api.ready()
  })
})()
