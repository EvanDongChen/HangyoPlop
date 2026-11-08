// HangyoPlop: an offline Hangyodon desktop pet.
// Main process: owns the pet window, its layout modes, global input, timers and menus.
const path = require("path")
const fs = require("fs")
const { app, BrowserWindow, screen, ipcMain, Menu, Tray, nativeImage, dialog } = require("electron")
const { createStore } = require("./store")
const { createAgentWatcher } = require("./agents")
const { PRESETS } = require("../shared/colors")

const SPRITE_W = 42
const SPRITE_H = 48
const MIN_SCALE = 2
const MAX_SCALE = 6
const DEFAULT_SCALE = 3
const BUBBLE_ROOM = 230 // space above the pet for speech bubbles, panels and jumps
const ACTIVITY_MS = 5600
const BOTTOM_PAD = 24 // room under the pet for its name

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let store
let win = null
let colorWin = null
let tray = null
let layout = { mode: "normal", edge: null }
let rendererReady = false
const pending = []

// ---------------------------------------------------------------- helpers

function send(channel, ...args) {
  if (!win || win.isDestroyed()) return
  if (!rendererReady) { pending.push([channel, args]); return }
  win.webContents.send(channel, ...args)
}

const petName = () => store.get("petName") || "Hangyodon"
const userName = () => store.get("userName") || "Human"
const scale = () => Math.max(MIN_SCALE, Math.min(MAX_SCALE, store.get("scale") || DEFAULT_SCALE))

function say(text, ms = 4500, mood = "") {
  send("say", { text, ms, mood })
}

function publicSettings() {
  const s = store.all()
  return {
    petName: petName(),
    userName: s.userName,
    showPetName: s.showPetName,
    fixedMessage: s.fixedMessage,
    soundMuted: s.soundMuted,
    volume: s.volume,
    colors: s.colors,
    showReminderButton: s.showReminderButton,
    shareSeconds: s.shareSeconds,
  }
}

function pushSettings() {
  send("settings", publicSettings())
  rebuildTrayMenu()
}

function setSetting(key, value) {
  store.set(key, value)
  pushSettings()
}

// ---------------------------------------------------------------- layout

function petSize(s = scale()) {
  return { w: SPRITE_W * s, h: SPRITE_H * s }
}

function normalWindowSize() {
  const p = petSize()
  return { width: Math.max(p.w + 140, 330), height: p.h + BUBBLE_ROOM + BOTTOM_PAD }
}

function workAreaAt(point) {
  return screen.getDisplayNearestPoint({ x: Math.round(point.x), y: Math.round(point.y) }).workArea
}

// The pet's position is stored as its bottom-center point so resizing keeps it planted.
function anchor() {
  const saved = store.get("position")
  if (saved && Number.isFinite(saved.cx) && Number.isFinite(saved.bottom)) return saved
  const wa = screen.getPrimaryDisplay().workArea
  return { cx: wa.x + wa.width - 160, bottom: wa.y + wa.height - 10 }
}

function clampAnchor(a) {
  const p = petSize()
  const wa = workAreaAt({ x: a.cx, y: a.bottom - p.h / 2 })
  return {
    cx: Math.min(Math.max(a.cx, wa.x + p.w / 2), wa.x + wa.width - p.w / 2),
    bottom: Math.min(Math.max(a.bottom, wa.y + p.h), wa.y + wa.height - BOTTOM_PAD + 4),
  }
}

function boundsForNormal(a) {
  const { width, height } = normalWindowSize()
  return { x: Math.round(a.cx - width / 2), y: Math.round(a.bottom - height + BOTTOM_PAD), width, height }
}

function anchorFromBounds(b) {
  return { cx: b.x + b.width / 2, bottom: b.y + b.height - BOTTOM_PAD }
}

function applyLayout(next) {
  if (!win) return
  layout = next
  const p = petSize()
  let bounds
  if (next.mode === "normal") {
    bounds = boundsForNormal(clampAnchor(anchor()))
  } else if (next.mode === "peek") {
    // Pet lies sideways with its head poking in from the screen edge.
    const a = anchor()
    const wa = workAreaAt({ x: a.cx, y: a.bottom })
    const w = p.h
    const h = p.w + 20
    const y = Math.min(Math.max(Math.round(a.bottom - p.h / 2 - h / 2), wa.y), wa.y + wa.height - h)
    const visible = Math.round(w * 0.56)
    const x = next.edge === "left" ? wa.x - (w - visible) : wa.x + wa.width - visible
    bounds = { x, y, width: w, height: h }
  } else {
    // "big": stretch/drink breaks take over the middle of the screen.
    const a = anchor()
    const wa = workAreaAt({ x: a.cx, y: a.bottom })
    const side = Math.round(wa.height * 0.72)
    bounds = { x: wa.x + Math.round((wa.width - side) / 2), y: wa.y + Math.round((wa.height - side) / 2), width: side, height: side }
  }
  win.setBounds(bounds)
  send("layout", { ...next, scale: scale(), width: bounds.width, height: bounds.height })
}

function setPeek(edge) {
  store.set("peekEdge", edge)
  if (layout.mode === "big") return // applied when the activity ends
  applyLayout(edge ? { mode: "peek", edge } : { mode: "normal" })
  rebuildTrayMenu()
}

function moveToCenter() {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  store.set("position", { cx: wa.x + wa.width / 2, bottom: wa.y + wa.height / 2 + petSize().h / 2 })
  store.set("peekEdge", null)
  applyLayout({ mode: "normal" })
  rebuildTrayMenu()
}

function setScale(s) {
  store.set("scale", Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)))
  applyLayout(layout.mode === "big" ? layout : store.get("peekEdge") ? { mode: "peek", edge: store.get("peekEdge") } : { mode: "normal" })
  rebuildTrayMenu()
}

// ---------------------------------------------------------------- window

function createWindow() {
  const b = boundsForNormal(clampAnchor(anchor()))
  win = new BrowserWindow({
    ...b,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  win.setAlwaysOnTop(true, "screen-saver")
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.setIgnoreMouseEvents(true, { forward: true })
  win.loadFile(path.join(__dirname, "..", "renderer", "pet", "index.html"))
  win.once("ready-to-show", () => win.showInactive())
  if (process.env.HANGYO_DEBUG) {
    win.webContents.on("console-message", (_e, level, message, line, source) =>
      console.log(`[pet:${level}] ${message} (${path.basename(source)}:${line})`))
  }
  win.on("closed", () => { win = null })
}

ipcMain.on("ready", () => {
  rendererReady = true
  send("init", {
    settings: publicSettings(),
    reminders: store.get("reminders"),
  })
  const edge = store.get("peekEdge")
  applyLayout(edge ? { mode: "peek", edge } : { mode: "normal" })
  for (const [ch, args] of pending.splice(0)) win.webContents.send(ch, ...args)
  sendPomodoro()
  if (!store.get("greeted")) {
    store.set("greeted", true)
    setTimeout(() => say(`Blub! I'm ${petName()}. Right-click me for options!`, 7000, "wave"), 900)
  } else if (store.get("userName")) {
    setTimeout(() => say(`Hi, ${store.get("userName")}!`, 3000, "wave"), 900)
  }
})

ipcMain.on("interactive", (_e, on) => {
  if (!win) return
  if (on) win.setIgnoreMouseEvents(false)
  else if (!dragging) win.setIgnoreMouseEvents(true, { forward: true })
})

ipcMain.on("focusable", (_e, on) => {
  if (!win) return
  win.setFocusable(!!on)
  if (on) win.focus()
})

ipcMain.on("panel-open", (_e, open) => {
  if (!win) return
  win.setFocusable(!!open)
  if (open) win.focus()
})

ipcMain.on("context-menu", () => {
  if (!win) return
  buildMenu().popup({ window: win })
})

// ---------------------------------------------------------------- dragging

let dragging = null

ipcMain.on("drag-start", (_e, localX, localY) => {
  if (!win || layout.mode === "big") return
  const cur = screen.getCursorScreenPoint()
  if (layout.mode === "peek") {
    // Pull the pet out of the edge: re-center the normal layout under the cursor.
    store.set("peekEdge", null)
    store.set("position", { cx: cur.x, bottom: cur.y + petSize().h * 0.35 })
    const b = boundsForNormal(anchor())
    layout = { mode: "normal" }
    win.setBounds(b)
    send("layout", { mode: "normal", scale: scale(), width: b.width, height: b.height })
    localX = cur.x - b.x
    localY = cur.y - b.y
    rebuildTrayMenu()
  }
  const b = win.getBounds()
  dragging = { offX: localX, offY: localY, last: { x: b.x, y: b.y } }
  win.setIgnoreMouseEvents(false)
  const tick = () => {
    if (!dragging || !win) return
    const p = screen.getCursorScreenPoint()
    const x = Math.round(p.x - dragging.offX)
    const y = Math.round(p.y - dragging.offY)
    const dx = x - dragging.last.x
    const dy = y - dragging.last.y
    if (dx || dy) {
      win.setPosition(x, y)
      dragging.last = { x, y }
    }
    send("drag-move", { dx, dy })
  }
  dragging.timer = setInterval(tick, 16)
})

function endDrag() {
  if (!dragging || !win) return
  clearInterval(dragging.timer)
  dragging = null
  const b = win.getBounds()
  const a = anchorFromBounds(b)
  const p = petSize()
  const wa = workAreaAt({ x: a.cx, y: a.bottom - p.h / 2 })
  store.set("position", { cx: a.cx, bottom: a.bottom })
  send("drag-end")
  if (a.cx - p.w * 0.25 < wa.x) setPeek("left")
  else if (a.cx + p.w * 0.25 > wa.x + wa.width) setPeek("right")
  else {
    store.set("position", clampAnchor(a))
    applyLayout({ mode: "normal" })
  }
}

ipcMain.on("drag-stop", endDrag)

ipcMain.on("exit-peek", () => {
  if (layout.mode !== "peek") return
  const edge = layout.edge
  const p = petSize()
  const wa = workAreaAt(anchor())
  const a = anchor()
  store.set("position", { cx: edge === "left" ? wa.x + p.w / 2 + 10 : wa.x + wa.width - p.w / 2 - 10, bottom: a.bottom })
  setPeek(null)
})

// ---------------------------------------------------------------- cursor + global input

let inputHookOk = false
let lastCursor = { x: -1, y: -1 }
function pollCursor() {
  if (!win || win.isDestroyed()) return
  const p = screen.getCursorScreenPoint()
  if (p.x === lastCursor.x && p.y === lastCursor.y) return
  lastCursor = p
  const b = win.getBounds()
  send("cursor", { x: p.x - b.x, y: p.y - b.y })
}

// uiohook keycodes (scan codes) on the left half of a QWERTY keyboard.
const LEFT_KEYS = new Set([1, 2, 3, 4, 5, 6, 15, 16, 17, 18, 19, 20, 29, 30, 31, 32, 33, 34, 41, 42, 44, 45, 46, 47, 48, 56, 58, 59, 60, 61, 62, 3675])

function startInputHooks() {
  let hook
  try {
    ;({ uIOhook: hook } = require("uiohook-napi"))
  } catch (err) {
    console.warn("[input] global hooks unavailable:", err.message)
    return null
  }
  let alt = false
  hook.on("keydown", (e) => {
    let side = LEFT_KEYS.has(e.keycode) ? "L" : "R"
    if (e.keycode === 57) side = (alt = !alt) ? "L" : "R" // space alternates paws
    send("key", { side })
  })
  hook.on("wheel", (e) => send("wheel", { amount: e.rotation }))
  hook.on("mouseup", () => { if (dragging) endDrag() })
  try {
    hook.start()
  } catch (err) {
    console.warn("[input] could not start hooks:", err.message)
    return null
  }
  inputHookOk = true
  return hook
}

// ---------------------------------------------------------------- stretch + drink breaks

let activity = null // { kind, timer, returnTo }
const activityQueue = []
const breakTimers = { stretch: null, drink: null }

function doActivity(kind, { manual = false } = {}) {
  if (!win) return
  if (layout.mode === "peek" && !manual && !store.get("peekNotify")) return
  if (activity || dragging) {
    if (!activityQueue.includes(kind)) activityQueue.push(kind)
    return
  }
  const returnTo = layout.mode === "peek" ? { mode: "peek", edge: layout.edge } : { mode: "normal" }
  applyLayout({ mode: "big" })
  activity = { kind, returnTo }
  send("activity", { kind, phase: "start" })
  const text = kind === "stretch"
    ? `${userName()}, time to stretch! Blub~`
    : `${userName()}, time to drink some water! Blub!`
  say(text, ACTIVITY_MS, kind)
  activity.timer = setTimeout(endActivity, ACTIVITY_MS)
}

function endActivity() {
  if (!activity) return
  clearTimeout(activity.timer)
  const { returnTo, kind } = activity
  activity = null
  send("activity", { kind, phase: "end" })
  const edge = store.get("peekEdge")
  applyLayout(edge ? { mode: "peek", edge } : returnTo.mode === "peek" ? { mode: "normal" } : returnTo)
  const next = activityQueue.shift()
  if (next) setTimeout(() => doActivity(next), 1200)
}

ipcMain.on("activity-dismiss", endActivity)

function scheduleBreaks() {
  for (const kind of ["stretch", "drink"]) {
    clearInterval(breakTimers[kind])
    const min = store.get(kind === "stretch" ? "stretchIntervalMin" : "drinkIntervalMin")
    breakTimers[kind] = min > 0 ? setInterval(() => doActivity(kind), min * 60_000) : null
  }
}

// Short pop-out so notifications are visible in peek mode.
let popTimer = null
function popOutForNotice(ms = 6000) {
  if (layout.mode !== "peek") return true
  if (!store.get("peekNotify")) return false
  const edge = layout.edge
  const p = petSize()
  const wa = workAreaAt(anchor())
  const a = anchor()
  store.set("position", { cx: edge === "left" ? wa.x + p.w / 2 + 10 : wa.x + wa.width - p.w / 2 - 10, bottom: a.bottom })
  applyLayout({ mode: "normal" })
  clearTimeout(popTimer)
  popTimer = setTimeout(() => {
    if (store.get("peekEdge") && layout.mode === "normal" && !dragging) applyLayout({ mode: "peek", edge: store.get("peekEdge") })
  }, ms)
  return true
}

function notice(text, { ms = 6000, mood = "jump" } = {}) {
  if (!popOutForNotice(ms + 600)) return
  setTimeout(() => {
    say(text, ms, mood)
    send("jump", { mood })
  }, layout.mode === "normal" ? 0 : 200)
}

// ---------------------------------------------------------------- reminders

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function checkReminders() {
  const now = new Date()
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  const list = store.get("reminders") || []
  let changed = false
  for (const r of list) {
    if (!r.enabled || r.time !== hhmm) continue
    const days = Array.isArray(r.days) ? r.days : []
    if (days.length && !days.includes(now.getDay())) continue
    const key = `${todayKey(now)} ${hhmm}`
    if (r.lastFired === key) continue
    r.lastFired = key
    if (!days.length) r.enabled = false
    changed = true
    const name = store.get("userName")
    notice(name ? `${name}! ${r.message}` : r.message, { ms: 12000, mood: "wave" })
  }
  if (changed) {
    store.set("reminders", list)
    send("reminders", list)
  }
}

ipcMain.on("reminders-save", (_e, list) => {
  if (!Array.isArray(list)) return
  const clean = list.slice(0, 50).map((r) => ({
    id: String(r.id || Date.now() + Math.random()),
    time: /^\d\d:\d\d$/.test(r.time) ? r.time : "09:00",
    days: Array.isArray(r.days) ? r.days.filter((d) => d >= 0 && d <= 6) : [],
    message: String(r.message || "").slice(0, 80),
    enabled: r.enabled !== false,
    lastFired: r.lastFired || null,
  }))
  store.set("reminders", clean)
  send("reminders", clean)
})

// ---------------------------------------------------------------- pomodoro

const pomo = { phase: "idle", running: false, endsAt: 0, remainingMs: 0, timer: null }

function phaseMs(phase) {
  return (phase === "focus" ? store.get("pomodoroFocusMin") : store.get("pomodoroRestMin")) * 60_000
}

function sendPomodoro() {
  const remaining = pomo.running ? Math.max(0, pomo.endsAt - Date.now()) : pomo.remainingMs
  send("pomodoro", { phase: pomo.phase, running: pomo.running, remainingSec: Math.ceil(remaining / 1000) })
}

function pomoTick() {
  if (!pomo.running) return
  if (Date.now() >= pomo.endsAt) {
    if (pomo.phase === "focus") {
      pomo.phase = "rest"
      notice(`${userName()}, take a break!`, { ms: 6000, mood: "jump" })
    } else {
      pomo.phase = "focus"
      notice(`${userName()}, back to focus!`, { ms: 5000, mood: "focus" })
    }
    pomo.endsAt = Date.now() + phaseMs(pomo.phase)
  }
  sendPomodoro()
}

function pomoStart() {
  if (pomo.running) return
  if (pomo.phase === "idle") {
    pomo.phase = "focus"
    pomo.remainingMs = phaseMs("focus")
    say(`Focus time! ${store.get("pomodoroFocusMin")} min. Blub!`, 3000, "focus")
  }
  pomo.running = true
  pomo.endsAt = Date.now() + pomo.remainingMs
  clearInterval(pomo.timer)
  pomo.timer = setInterval(pomoTick, 1000)
  sendPomodoro()
  rebuildTrayMenu()
}

function pomoPause() {
  if (!pomo.running) return
  pomo.running = false
  pomo.remainingMs = Math.max(0, pomo.endsAt - Date.now())
  clearInterval(pomo.timer)
  sendPomodoro()
  rebuildTrayMenu()
}

function pomoReset() {
  clearInterval(pomo.timer)
  Object.assign(pomo, { phase: "idle", running: false, endsAt: 0, remainingMs: 0, timer: null })
  sendPomodoro()
  rebuildTrayMenu()
}

ipcMain.on("pomodoro", (_e, action) => {
  if (action === "start") pomoStart()
  else if (action === "pause") pomoPause()
  else if (action === "reset") pomoReset()
})

// ---------------------------------------------------------------- agents

const sessions = new Map() // session -> { state, at }
let agentState = "idle"

function onAgentState({ session, state }) {
  if (state === "complete") {
    sessions.delete(session)
    notice("Task complete! Blub blub!", { ms: 4000, mood: "complete" })
  } else if (state === "notification") {
    sessions.set(session, { state: "waiting", at: Date.now() })
    notice(`${userName()}, needs your attention!`, { ms: 6000, mood: "wave" })
  } else if (state === "error") {
    sessions.delete(session)
    say("Oh no, something went wrong...", 4000)
  } else if (state === "idle") {
    sessions.delete(session)
  } else {
    sessions.set(session, { state, at: Date.now() })
  }
  updateAgentState()
}

function updateAgentState() {
  const now = Date.now()
  let next = "idle"
  for (const [key, s] of sessions) {
    if (now - s.at > 3 * 60_000) { sessions.delete(key); continue }
    if (s.state === "thinking" || s.state === "working") next = "thinking"
  }
  if (next !== agentState) {
    agentState = next
    send("agent", { state: next })
  }
}

let agents = null

// ---------------------------------------------------------------- prompts (small inline forms)

let promptSeq = 0
const promptWaiters = new Map()

function prompt(opts) {
  return new Promise((resolve) => {
    if (!win) return resolve(null)
    if (layout.mode === "peek") ipcMain.emit("exit-peek")
    const id = ++promptSeq
    promptWaiters.set(id, resolve)
    win.setFocusable(true)
    win.focus()
    send("prompt", { id, ...opts })
  })
}

ipcMain.on("prompt-result", (_e, id, value) => {
  const resolve = promptWaiters.get(id)
  promptWaiters.delete(id)
  if (win && !promptWaiters.size) win.setFocusable(false)
  if (resolve) resolve(value)
})

async function askText(key, title, { maxLength = 24, placeholder = "" } = {}) {
  const v = await prompt({ kind: "text", title, value: store.get(key) || "", maxLength, placeholder })
  if (v === null || v === undefined) return
  setSetting(key, String(v).trim().slice(0, maxLength))
  return String(v).trim()
}

async function askMinutes(key, title, min, max) {
  const v = await prompt({ kind: "number", title, value: store.get(key), min, max, unit: "MIN" })
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n < min || n > max) return
  store.set(key, n)
  rebuildTrayMenu()
}

// ---------------------------------------------------------------- show-off recording

async function startRecording(seconds) {
  if (layout.mode === "peek") ipcMain.emit("exit-peek")
  store.set("shareSeconds", seconds)
  send("record", { seconds })
}

ipcMain.handle("save-recording", async (_e, bytes) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const res = await dialog.showSaveDialog({
    title: "Save Hangyodon video",
    defaultPath: path.join(app.getPath("videos"), `hangyodon-${stamp}.webm`),
    filters: [{ name: "WebM video", extensions: ["webm"] }],
  })
  if (res.canceled || !res.filePath) return false
  fs.writeFileSync(res.filePath, Buffer.from(bytes))
  return true
})

// ---------------------------------------------------------------- colors

function openColorEditor() {
  if (colorWin && !colorWin.isDestroyed()) { colorWin.focus(); return }
  colorWin = new BrowserWindow({
    width: 560,
    height: 520,
    resizable: false,
    title: `${petName()} colors`,
    autoHideMenuBar: true,
    backgroundColor: "#f4f0e6",
    icon: iconImage(),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true },
  })
  colorWin.loadFile(path.join(__dirname, "..", "renderer", "colors", "index.html"))
  colorWin.on("closed", () => {
    colorWin = null
    pushSettings() // drop any unsaved preview
  })
}

ipcMain.handle("colors-get", () => ({
  colors: store.get("colors") || PRESETS[0],
  presets: PRESETS,
  custom: store.get("customPresets") || [],
}))
ipcMain.on("colors-preview", (_e, colors) => send("settings", { ...publicSettings(), colors }))
ipcMain.on("colors-save", (_e, colors) => setSetting("colors", colors))
ipcMain.handle("colors-preset-save", (_e, preset) => {
  const list = (store.get("customPresets") || []).filter((p) => p.name !== preset.name)
  list.push(preset)
  store.set("customPresets", list.slice(-20))
  rebuildTrayMenu()
  return store.get("customPresets")
})
ipcMain.handle("colors-preset-delete", (_e, name) => {
  store.set("customPresets", (store.get("customPresets") || []).filter((p) => p.name !== name))
  rebuildTrayMenu()
  return store.get("customPresets")
})

// ---------------------------------------------------------------- menus

function radioMinutes(key, values, labelFor, onCustom, extra = []) {
  const current = store.get(key)
  const items = values.map((v) => ({
    label: labelFor(v),
    type: "radio",
    checked: current === v,
    click: () => { store.set(key, v); afterIntervalChange(key) },
  }))
  if (onCustom) {
    items.push({
      label: values.includes(current) ? "Custom…" : `Custom (${current} min)…`,
      type: "radio",
      checked: !values.includes(current),
      click: onCustom,
    })
  }
  return [...extra, ...items]
}

function afterIntervalChange(key) {
  if (key === "stretchIntervalMin" || key === "drinkIntervalMin") scheduleBreaks()
  rebuildTrayMenu()
}

const every = (m) => (m === 0 ? "Off" : m < 60 ? `Every ${m} minutes` : m === 60 ? "Every hour" : m === 90 ? "Every 1 hour 30 minutes" : "Every 2 hours")

function buildMenu() {
  const s = store.all()
  const peekEdge = s.peekEdge
  const colorsNow = s.colors || PRESETS[0]
  const allPresets = [...PRESETS, ...(s.customPresets || [])]
  const pomoLabel = pomo.running ? "Pause" : pomo.phase !== "idle" ? "Resume" : "Start"
  const pomoStatus = pomo.phase === "idle" ? "" : ` (${pomo.phase === "focus" ? "Focus" : "Break"}${pomo.running ? "" : ", paused"})`

  return Menu.buildFromTemplate([
    { label: `${petName()} · offline`, enabled: false },
    { type: "separator" },
    { label: `Move ${petName()} to center`, click: moveToCenter },
    {
      label: "Peek mode",
      submenu: [
        { label: "Peek from left", type: "radio", checked: peekEdge === "left", click: () => setPeek("left") },
        { label: "Peek from right", type: "radio", checked: peekEdge === "right", click: () => setPeek("right") },
        { label: "Exit peek mode", enabled: !!peekEdge, click: () => ipcMain.emit("exit-peek") },
        { type: "separator" },
        {
          label: "Notify in peek mode",
          sublabel: "Pops out briefly, then returns to peek",
          type: "checkbox",
          checked: !!s.peekNotify,
          click: (i) => { store.set("peekNotify", i.checked) },
        },
      ],
    },
    {
      label: "Size",
      submenu: [
        ...Array.from({ length: MAX_SCALE - MIN_SCALE + 1 }, (_, i) => MIN_SCALE + i).map((n) => ({
          label: `${n}x  (${SPRITE_W * n} × ${SPRITE_H * n})`,
          type: "radio",
          checked: scale() === n,
          click: () => setScale(n),
        })),
        { type: "separator" },
        { label: "Smaller", enabled: scale() > MIN_SCALE, click: () => setScale(scale() - 1) },
        { label: "Larger", enabled: scale() < MAX_SCALE, click: () => setScale(scale() + 1) },
        { label: "Reset size", click: () => setScale(DEFAULT_SCALE) },
      ],
    },
    { type: "separator" },
    {
      label: `Pomodoro${pomoStatus}`,
      submenu: [
        { label: pomoLabel, click: () => (pomo.running ? pomoPause() : pomoStart()) },
        { label: "Reset", enabled: pomo.phase !== "idle", click: pomoReset },
        { type: "separator" },
        {
          label: "Focus time",
          submenu: radioMinutes("pomodoroFocusMin", [15, 25, 30, 45, 50, 60], (m) => `${m} min`, () =>
            askMinutes("pomodoroFocusMin", "Focus minutes", 1, 180)),
        },
        {
          label: "Break time",
          submenu: radioMinutes("pomodoroRestMin", [3, 5, 10, 15, 20], (m) => `${m} min`, () =>
            askMinutes("pomodoroRestMin", "Break minutes", 1, 60)),
        },
      ],
    },
    {
      label: "Break stretch",
      submenu: radioMinutes("stretchIntervalMin", [0, 15, 30, 45, 60, 90, 120], every, null, [
        { label: "Start break stretch now", click: () => doActivity("stretch", { manual: true }) },
        { type: "separator" },
      ]),
    },
    {
      label: "Drink water",
      submenu: radioMinutes("drinkIntervalMin", [0, 15, 30, 45, 60, 90, 120], every, null, [
        { label: "Drink water now", click: () => doActivity("drink", { manual: true }) },
        { type: "separator" },
      ]),
    },
    {
      label: "Reminders",
      submenu: [
        { label: "Open reminders", click: () => { if (layout.mode === "peek") ipcMain.emit("exit-peek"); send("open-reminders") } },
        {
          label: "Show clock button",
          type: "checkbox",
          checked: !!s.showReminderButton,
          click: (i) => setSetting("showReminderButton", i.checked),
        },
      ],
    },
    {
      label: "Name",
      submenu: [
        { label: s.userName ? `Tell my name (${s.userName})…` : "Tell my name…", click: async () => {
          const n = await askText("userName", "Your name (used in reminders)", { placeholder: "Enter your name" })
          if (n) say(`Hi, ${n}! Blub!`, 3500, "wave")
        } },
        { label: `Set ${petName()}'s name…`, click: () => askText("petName", "Pet name", { placeholder: "Hangyodon" }) },
        { label: "Show name", type: "checkbox", checked: !!s.showPetName, click: (i) => setSetting("showPetName", i.checked) },
      ],
    },
    {
      label: "Fixed message",
      submenu: [
        { label: s.fixedMessage ? "Edit fixed message…" : "Set fixed message…", click: () =>
          askText("fixedMessage", "Pinned message above the head", { maxLength: 80, placeholder: "e.g. Ship it!" }) },
        { label: "Clear", enabled: !!s.fixedMessage, click: () => setSetting("fixedMessage", "") },
      ],
    },
    { type: "separator" },
    {
      label: "Colors",
      submenu: [
        ...allPresets.map((p) => ({
          label: p.name,
          type: "radio",
          checked: colorsNow.skin === p.skin && colorsNow.fin === p.fin && colorsNow.belly === p.belly && colorsNow.lips === p.lips,
          click: () => setSetting("colors", { name: p.name, skin: p.skin, fin: p.fin, belly: p.belly, lips: p.lips }),
        })),
        { type: "separator" },
        { label: "Color editor…", click: openColorEditor },
      ],
    },
    {
      label: `Show off my ${petName()}`,
      submenu: [5, 8, 15, 30].map((sec) => ({ label: `Record ${sec} seconds`, click: () => startRecording(sec) })),
    },
    {
      label: "Sound",
      submenu: [
        { label: "Mute", type: "checkbox", checked: !!s.soundMuted, click: (i) => setSetting("soundMuted", i.checked) },
        { type: "separator" },
        { label: "Volume", enabled: false },
        ...[0.1, 0.25, 0.4, 0.6, 0.8, 1].map((v) => ({
          label: `${Math.round(v * 100)}%`,
          type: "radio",
          checked: Math.abs((s.volume || 0) - v) < 0.01,
          click: () => setSetting("volume", v),
        })),
      ],
    },
    {
      label: "Agent monitoring",
      submenu: [
        ...[
          ["claude", "Claude Code"],
          ["codex", "Codex CLI"],
          ["hooks", `Local hook endpoint (127.0.0.1:${agents ? agents.HOOK_PORT : ""})`],
        ].map(([key, label]) => ({
          label,
          type: "checkbox",
          checked: !!s.agents[key],
          click: (i) => {
            store.set("agents", { ...store.get("agents"), [key]: i.checked })
            agents.configure(store.get("agents"))
          },
        })),
      ],
    },
    { label: "Jump (test)", click: () => send("jump", { mood: "complete" }) },
    {
      label: "Open at login",
      type: "checkbox",
      checked: !!s.launchAtLogin,
      click: (i) => {
        store.set("launchAtLogin", i.checked)
        app.setLoginItemSettings({ openAtLogin: i.checked })
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ])
}

function iconImage() {
  return nativeImage.createFromPath(path.join(__dirname, "..", "renderer", "pet", "tray.png"))
}

function rebuildTrayMenu() {
  if (tray) tray.setContextMenu(buildMenu())
}

function createTray() {
  tray = new Tray(iconImage())
  tray.setToolTip("HangyoPlop")
  tray.on("click", () => {
    if (!win) return
    if (layout.mode === "peek") ipcMain.emit("exit-peek")
    else if (!win.isVisible()) win.showInactive()
    send("jump", { mood: "wave" })
  })
  rebuildTrayMenu()
}

// ---------------------------------------------------------------- lifecycle

app.on("second-instance", () => {
  if (win) send("jump", { mood: "wave" })
})

app.whenReady().then(() => {
  store = createStore(app.getPath("userData"))
  app.setLoginItemSettings({ openAtLogin: !!store.get("launchAtLogin") })
  createWindow()
  createTray()
  scheduleBreaks()
  setInterval(pollCursor, 33)
  setInterval(checkReminders, 10_000)
  setInterval(updateAgentState, 30_000)
  const hook = startInputHooks()
  if (!hook) setTimeout(() => say("I can't feel the keyboard here, but I'm still happy to keep you company!", 5000), 4000)
  agents = createAgentWatcher(onAgentState)
  agents.configure(store.get("agents"))
  rebuildTrayMenu()

  screen.on("display-removed", () => applyLayout(layout.mode === "big" ? { mode: "normal" } : layout))
  screen.on("display-metrics-changed", () => { if (layout.mode !== "big") applyLayout(layout) })

  app.on("before-quit", () => {
    store.flush()
    if (agents) agents.stopAll()
    if (hook) try { hook.stop() } catch {}
  })
})

app.on("window-all-closed", (e) => e.preventDefault())

// ---------------------------------------------------------------- dev: scripted screenshot tour
// HANGYO_TOUR=<dir> walks through the main states and saves window captures, then quits.
if (process.env.HANGYO_TOUR) {
  const dir = process.env.HANGYO_TOUR
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const shot = async (name) => {
    const img = await win.webContents.capturePage()
    fs.writeFileSync(path.join(dir, `${name}.png`), img.toPNG())
  }
  ipcMain.once("ready", async () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify({ inputHookOk, packaged: app.isPackaged }))
    await wait(1500)
    await shot("01-idle")
    say("Hi! I'm Hangyodon. Blub!", 3000, "wave")
    await wait(400)
    await shot("02-say")
    for (let i = 0; i < 40; i++) { send("key", { side: i % 2 ? "L" : "R" }); await wait(45) }
    await shot("03-typing-hot")
    await wait(2500)
    for (let i = 0; i < 6; i++) { send("wheel", { amount: 1 }); await wait(60) }
    await shot("04-scroll")
    await wait(600)
    send("jump", { mood: "complete" })
    await wait(400)
    await shot("05-jump")
    await wait(1400)
    onAgentState({ session: "tour", state: "thinking" })
    await wait(300)
    await shot("06-think")
    onAgentState({ session: "tour", state: "idle" })
    pomoStart()
    await wait(3200)
    await shot("07-pomodoro")
    pomoReset()
    send("open-reminders")
    await wait(300)
    await shot("08-reminders")
    doActivity("stretch", { manual: true })
    await wait(1200)
    await shot("09-stretch")
    endActivity()
    await wait(300)
    doActivity("drink", { manual: true })
    await wait(1500)
    await shot("10-drink")
    endActivity()
    await wait(300)
    setPeek("left")
    await wait(500)
    await shot("11-peek")
    setPeek(null)
    store.set("peekEdge", null)
    store.flush()
    app.quit()
  })
}
