// Narrow bridge between the pet page and the main process.
const { contextBridge, ipcRenderer } = require("electron")

const on = (channel) => (fn) => {
  const handler = (_e, ...args) => fn(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

contextBridge.exposeInMainWorld("pet", {
  // main -> renderer
  onInit: on("init"),
  onSettings: on("settings"),
  onCursor: on("cursor"),
  onKey: on("key"),
  onWheel: on("wheel"),
  onDragMove: on("drag-move"),
  onDragEnd: on("drag-end"),
  onLayout: on("layout"),
  onActivity: on("activity"), // { kind: "stretch" | "drink", phase: "start" | "end" }
  onSay: on("say"), // { text, ms, mood }
  onJump: on("jump"),
  onAgent: on("agent"),
  onPomodoro: on("pomodoro"),
  onPrompt: on("prompt"),
  onOpenReminders: on("open-reminders"),
  onReminders: on("reminders"),
  onRecord: on("record"),

  // renderer -> main
  ready: () => ipcRenderer.send("ready"),
  setInteractive: (v) => ipcRenderer.send("interactive", v),
  setFocusable: (v) => ipcRenderer.send("focusable", v),
  dragStart: (x, y) => ipcRenderer.send("drag-start", x, y),
  dragStop: () => ipcRenderer.send("drag-stop"),
  contextMenu: () => ipcRenderer.send("context-menu"),
  promptResult: (id, value) => ipcRenderer.send("prompt-result", id, value),
  saveReminders: (list) => ipcRenderer.send("reminders-save", list),
  setPanelOpen: (open) => ipcRenderer.send("panel-open", open),
  saveRecording: (bytes) => ipcRenderer.invoke("save-recording", bytes),
  exitPeek: () => ipcRenderer.send("exit-peek"),
  dismissActivity: () => ipcRenderer.send("activity-dismiss"),
  pomodoro: (action) => ipcRenderer.send("pomodoro", action),
})

// Separate small API for the color editor window.
contextBridge.exposeInMainWorld("colorsApi", {
  get: () => ipcRenderer.invoke("colors-get"),
  preview: (colors) => ipcRenderer.send("colors-preview", colors),
  save: (colors) => ipcRenderer.send("colors-save", colors),
  savePreset: (preset) => ipcRenderer.invoke("colors-preset-save", preset),
  deletePreset: (name) => ipcRenderer.invoke("colors-preset-delete", name),
})
