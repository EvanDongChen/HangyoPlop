// Watches coding agents running on this machine so Hangyodon can think along and celebrate.
// Everything is local: it tails the agents' own session logs and listens on 127.0.0.1 only.
const fs = require("fs")
const os = require("os")
const path = require("path")
const http = require("http")

const POLL_MS = 1500
const RECENT_MS = 10 * 60 * 1000
const MAX_FILES = 80
const HOOK_PORT = Number(process.env.HANGYOPLOP_PORT) || 23457

// Reads appended lines from a set of growing JSONL files.
class JsonlTail {
  constructor({ listFiles, onObject }) {
    this.listFiles = listFiles
    this.onObject = onObject
    this.tracked = new Map()
    this.timer = null
  }

  start() {
    if (this.timer) return
    this.startedAt = Date.now()
    this.poll()
    this.timer = setInterval(() => this.poll(), POLL_MS)
  }

  stop() {
    clearInterval(this.timer)
    this.timer = null
    this.tracked.clear()
  }

  poll() {
    let files = []
    try { files = this.listFiles() } catch { return }
    for (const file of files) this.pollFile(file)
    for (const [file, t] of this.tracked) {
      if (Date.now() - t.seenAt > RECENT_MS) this.tracked.delete(file)
    }
  }

  pollFile(file) {
    let stat
    try { stat = fs.statSync(file) } catch { return }
    let t = this.tracked.get(file)
    if (!t) {
      // Start at the end for files that existed before we launched; read new ones from the top.
      const isNew = stat.birthtimeMs >= this.startedAt - 2000
      t = { offset: isNew ? 0 : stat.size, partial: "", seenAt: Date.now(), state: {} }
      this.tracked.set(file, t)
    }
    if (stat.size < t.offset) t.offset = 0
    if (stat.size === t.offset) return
    let buf
    try {
      const fd = fs.openSync(file, "r")
      buf = Buffer.alloc(stat.size - t.offset)
      fs.readSync(fd, buf, 0, buf.length, t.offset)
      fs.closeSync(fd)
    } catch { return }
    t.offset = stat.size
    t.seenAt = Date.now()
    const lines = (t.partial + buf.toString("utf8")).split("\n")
    t.partial = lines.pop() || ""
    if (t.partial.length > 1 << 20) t.partial = ""
    for (const line of lines) {
      if (!line.trim()) continue
      let obj
      try { obj = JSON.parse(line) } catch { continue }
      this.onObject(obj, file, t.state)
    }
  }
}

function recentJsonl(dir, depth, filter = () => true) {
  const out = []
  const walk = (d, level) => {
    if (level > depth || out.length >= MAX_FILES) return
    let entries
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (e.name !== "subagents") walk(p, level + 1); continue }
      if (!e.name.endsWith(".jsonl") || !filter(e.name)) continue
      try { if (Date.now() - fs.statSync(p).mtimeMs <= RECENT_MS) out.push(p) } catch {}
    }
  }
  walk(dir, 0)
  return out
}

function claudeEvent(obj) {
  const msg = obj.message
  if (obj.type === "user" && msg && msg.role === "user") {
    const content = Array.isArray(msg.content) ? msg.content : [msg.content]
    const text = content.map((c) => (typeof c === "string" ? c : c && c.text) || "").join(" ")
    if (text.startsWith("[Request interrupted by user")) return "idle"
    if (content.some((c) => c && c.type === "tool_result")) return "working"
    return "thinking"
  }
  if (obj.type !== "assistant" || !msg || msg.role !== "assistant") return null
  const content = Array.isArray(msg.content) ? msg.content : []
  const tool = content.find((c) => c && c.type === "tool_use")
  if (tool) {
    if (tool.name === "AskUserQuestion" || tool.name === "ExitPlanMode") return "notification"
    return "working"
  }
  if (msg.stop_reason === "end_turn") return "complete"
  return "thinking"
}

function codexEvent(obj) {
  const p = obj.payload || {}
  const type = p.type || ""
  if (obj.type === "event_msg") {
    if (type === "task_started" || type === "user_message") return "thinking"
    if (type === "agent_reasoning" || type === "agent_message") return "thinking"
    if (type === "exec_command_begin" || type === "patch_apply_begin") return "working"
    if (type === "task_complete") return "complete"
    if (type === "turn_aborted") return "idle"
    if (/approval|request_user_input/.test(type)) return "notification"
  }
  if (obj.type === "response_item") {
    if (type === "function_call" || type === "custom_tool_call" || type === "local_shell_call") return "working"
  }
  return null
}

/**
 * onState({ agent, session, state }) where state is one of
 * idle | thinking | working | notification | complete | error.
 */
function createAgentWatcher(onState) {
  const emit = (agent, session, state) => onState({ agent, session, state })

  const tailFor = (agent, listFiles, mapper) =>
    new JsonlTail({
      listFiles,
      onObject(obj, file, st) {
        if (typeof obj.timestamp === "string" && Date.parse(obj.timestamp) < Date.now() - 60_000) return
        const state = mapper(obj)
        if (!state) return
        // Only celebrate turns we saw begin, so replays of old lines stay quiet.
        if (state === "complete" && !st.active) return
        st.active = state === "thinking" || state === "working" || state === "notification"
        if (state === st.last && state === "working" && Date.now() - (st.at || 0) < 8000) return
        st.last = state
        st.at = Date.now()
        emit(agent, file, state)
      },
    })

  const monitors = {
    claude: tailFor("claude", () => recentJsonl(path.join(os.homedir(), ".claude", "projects"), 3), claudeEvent),
    codex: tailFor(
      "codex",
      () => recentJsonl(path.join(os.homedir(), ".codex", "sessions"), 4, (n) => n.startsWith("rollout-")),
      codexEvent,
    ),
  }

  // Any tool can POST {"agent":"x","state":"complete"} to http://127.0.0.1:23457/agent-state
  let server = null
  function startHooks() {
    if (server) return
    server = http.createServer((req, res) => {
      if (req.method !== "POST" || req.url !== "/agent-state") { res.writeHead(404).end(); return }
      let body = ""
      req.on("data", (c) => { body += c; if (body.length > 65536) req.destroy() })
      req.on("end", () => {
        try {
          const j = JSON.parse(body || "{}")
          const state = String(j.state || "")
          if (["idle", "thinking", "working", "notification", "complete", "error"].includes(state)) {
            emit(String(j.agent || "hook"), String(j.session || j.agent || "hook"), state)
          }
        } catch {}
        res.writeHead(204).end()
      })
    })
    server.on("error", (err) => { console.warn("[agents] hook server:", err.message); server = null })
    server.listen(HOOK_PORT, "127.0.0.1")
  }
  function stopHooks() {
    if (server) server.close()
    server = null
  }

  return {
    configure(enabled) {
      for (const [key, mon] of Object.entries(monitors)) (enabled[key] ? mon.start() : mon.stop())
      enabled.hooks ? startHooks() : stopHooks()
    },
    stopAll() {
      for (const mon of Object.values(monitors)) mon.stop()
      stopHooks()
    },
    HOOK_PORT,
  }
}

module.exports = { createAgentWatcher, claudeEvent, codexEvent }
