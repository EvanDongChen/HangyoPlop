// Tiny JSON settings store kept in the app's userData folder. Everything is local; nothing syncs.
const fs = require("fs")
const path = require("path")

const DEFAULTS = {
  petName: "Hangyodon",
  userName: "",
  showPetName: true,
  fixedMessage: "",
  scale: 3,
  position: null,
  peekEdge: null,
  peekNotify: true,
  stretchIntervalMin: 30,
  drinkIntervalMin: 0,
  soundMuted: false,
  volume: 0.4,
  launchAtLogin: false,
  pomodoroFocusMin: 25,
  pomodoroRestMin: 5,
  shareSeconds: 8,
  showReminderButton: false,
  agents: { claude: true, codex: true, hooks: true },
  colors: null, // null = classic palette
  customPresets: [],
  reminders: [],
}

function createStore(dir) {
  const file = path.join(dir, "settings.json")
  let data = { ...DEFAULTS }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"))
    data = { ...DEFAULTS, ...raw, agents: { ...DEFAULTS.agents, ...(raw.agents || {}) } }
  } catch {
    // first run or unreadable file: keep defaults
  }

  let saveTimer = null
  function flush() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = null
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2))
      fs.renameSync(file + ".tmp", file)
    } catch (err) {
      console.error("[store] save failed", err)
    }
  }

  return {
    get: (key) => data[key],
    all: () => data,
    set(key, value) {
      data[key] = value
      if (!saveTimer) saveTimer = setTimeout(flush, 300)
    },
    flush,
  }
}

module.exports = { createStore, DEFAULTS }
