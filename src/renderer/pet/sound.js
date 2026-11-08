// Synthesized fishy sounds: no audio files, nothing downloaded.
;(function () {
  let ctx = null
  let master = null
  let volume = 0.4
  let muted = false

  function audio() {
    if (!ctx) {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.connect(ctx.destination)
      applyVolume()
    }
    if (ctx.state === "suspended") ctx.resume()
    return ctx
  }

  function applyVolume() {
    if (master) master.gain.value = muted ? 0 : volume
  }

  // One bubble: a sine whose pitch swoops up quickly, like a "blub".
  function bubble(at, { from = 260, to = 820, dur = 0.11, gain = 0.5, type = "sine" } = {}) {
    const a = audio()
    const t = a.currentTime + at
    const osc = a.createOscillator()
    const g = a.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  let purrTimer = null

  window.Sound = {
    configure({ volume: v, muted: m }) {
      if (typeof v === "number") volume = Math.max(0, Math.min(1, v))
      if (typeof m === "boolean") muted = m
      applyVolume()
    },
    blub() {
      if (muted) return
      bubble(0, {})
      bubble(0.09, { from: 340, to: 1000, dur: 0.09, gain: 0.35 })
    },
    pop() {
      if (muted) return
      bubble(0, { from: 500, to: 1300, dur: 0.06, gain: 0.3 })
    },
    alert() {
      if (muted) return
      bubble(0, { from: 300, to: 700 })
      bubble(0.13, { from: 380, to: 900 })
      bubble(0.26, { from: 460, to: 1200, dur: 0.16, gain: 0.55 })
    },
    jump() {
      if (muted) return
      bubble(0, { from: 220, to: 1100, dur: 0.2, gain: 0.45, type: "triangle" })
    },
    startPurr() {
      if (purrTimer || muted) return
      const tick = () => {
        const f = 110 + Math.random() * 60
        bubble(0, { from: f, to: f * 1.9, dur: 0.14, gain: 0.18 })
        purrTimer = setTimeout(tick, 120 + Math.random() * 160)
      }
      tick()
    },
    stopPurr() {
      clearTimeout(purrTimer)
      purrTimer = null
    },
  }
})()
