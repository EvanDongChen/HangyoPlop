// Color editor: pick four colors, preview live on the real pet, save looks as presets.
;(async () => {
  const C = window.HangyoColors
  const api = window.colorsApi
  const $ = (id) => document.getElementById(id)
  const FIELDS = ["skin", "fin", "lips"]

  const { colors, presets, custom: initialCustom } = await api.get()
  let custom = initialCustom
  let current = { skin: colors.skin, fin: colors.fin, lips: colors.lips }

  const img = new Image()
  img.src = "../pet/sprites/idle0.png"
  await new Promise((r) => { img.onload = r; img.onerror = r })

  const canvas = $("preview")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  function drawPreview() {
    const pal = C.fullPalette(current)
    const map = new Map()
    for (const [k, hex] of Object.entries(C.CLASSIC)) {
      const f = C.hexToRgb(hex)
      map.set((f[0] << 16) | (f[1] << 8) | f[2], C.hexToRgb(pal[k]))
    }
    ctx.clearRect(0, 0, 41, 58)
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, 41, 58)
    const d = data.data
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue
      const to = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
      if (to) { d[i] = to[0]; d[i + 1] = to[1]; d[i + 2] = to[2] }
    }
    ctx.putImageData(data, 0, 0)
    for (const x of [12, 26]) {
      ctx.fillStyle = "#0a0a12"
      ctx.fillRect(x, 25, 3, 4)
      ctx.fillStyle = "#fff"
      ctx.fillRect(x, 25, 1, 1)
    }
  }

  function sync() {
    for (const f of FIELDS) $(f).value = current[f]
    drawPreview()
    api.preview({ ...current })
  }

  for (const f of FIELDS) {
    $(f).addEventListener("input", (e) => {
      current[f] = e.target.value
      drawPreview()
      api.preview({ ...current })
    })
  }

  function renderPresets() {
    const wrap = $("presets")
    wrap.textContent = ""
    const add = (p, removable) => {
      const b = document.createElement("button")
      b.type = "button"
      for (const f of ["skin", "fin", "lips"]) {
        const sw = document.createElement("span")
        sw.className = "sw"
        sw.style.background = p[f]
        b.appendChild(sw)
      }
      b.append(" " + p.name)
      b.addEventListener("click", () => { current = { skin: p.skin, fin: p.fin, lips: p.lips }; $("preset-name").value = removable ? p.name : ""; sync() })
      wrap.appendChild(b)
      if (removable) {
        const x = document.createElement("button")
        x.type = "button"
        x.className = "custom-x"
        x.title = `Delete ${p.name}`
        x.textContent = "×"
        x.addEventListener("click", async () => { custom = await api.deletePreset(p.name); renderPresets() })
        wrap.appendChild(x)
      }
    }
    presets.forEach((p) => add(p, false))
    custom.forEach((p) => add(p, true))
  }

  $("save-preset").addEventListener("click", async () => {
    const name = $("preset-name").value.trim()
    if (!name) { $("preset-name").focus(); return }
    custom = await api.savePreset({ name, ...current })
    renderPresets()
  })
  $("apply").addEventListener("click", () => { api.save({ ...current }); window.close() })
  $("cancel").addEventListener("click", () => window.close())

  renderPresets()
  sync()
})()
