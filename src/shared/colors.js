// Hangyodon color schemes, shared by the main process (menus) and the renderers (recoloring).
// The sprites are drawn with the CLASSIC palette; recoloring swaps those exact RGB values.
;(function (root) {
  const CLASSIC = {
    t: "#33ccba", T: "#2aa9b4", l: "#6fdccf", // skin / skin shade / skin rim light
    f: "#1fa6de", F: "#1f84b8", D: "#1d5f8a", h: "#6cc8f2", // fins: main / mid / ridge / light
    p: "#f4a1bb", q: "#d985ac", M: "#936d7a", P: "#51263a", // lips / deep pink / mauve / mouth line
  }

  // Each preset names three main colors; shades are derived.
  const PRESETS = [
    { name: "Classic", skin: "#33ccba", fin: "#1fa6de", lips: "#f4a1bb" },
    { name: "Sakura", skin: "#f6b6c8", fin: "#d9668e", lips: "#e0405e" },
    { name: "Lemon", skin: "#f5dd73", fin: "#e09a3a", lips: "#f08fa3" },
    { name: "Mint", skin: "#98e0b8", fin: "#3f9e78", lips: "#f4a1bb" },
    { name: "Lavender", skin: "#c3b2ef", fin: "#7a5fc4", lips: "#f4a1bb" },
    { name: "Koi", skin: "#fbf6f0", fin: "#ee6b3b", lips: "#e0405e" },
    { name: "Midnight", skin: "#4a5e8c", fin: "#26345c", lips: "#ff8ba3" },
    { name: "Ghost", skin: "#e9eef2", fin: "#a8b4c2", lips: "#d4a8b6" },
  ]

  const hexToRgb = (hex) => {
    const n = parseInt(String(hex).replace("#", ""), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t))

  const sameAs = (s, p) => !!s && s.skin === p.skin && s.fin === p.fin && s.lips === p.lips

  // Expand { skin, fin, lips } into the full sprite palette.
  function fullPalette(scheme) {
    if (!scheme || !scheme.skin || sameAs(scheme, PRESETS[0])) return { ...CLASSIC }
    const ink = "#0d2236"
    return {
      t: scheme.skin,
      T: mix(scheme.skin, ink, 0.16),
      l: mix(scheme.skin, "#ffffff", 0.3),
      f: scheme.fin,
      F: mix(scheme.fin, ink, 0.2),
      D: mix(scheme.fin, ink, 0.45),
      h: mix(scheme.fin, "#ffffff", 0.35),
      p: scheme.lips,
      q: mix(scheme.lips, "#9a2f6a", 0.3),
      M: mix(scheme.lips, ink, 0.45),
      P: mix(scheme.lips, ink, 0.75),
    }
  }

  // Overheated look: skin and fins glow red.
  const HOT = { t: "#ff6b5a", T: "#d63c3c", l: "#ffb0a0", f: "#c8283a", F: "#a01e2e", D: "#76131f", h: "#ff8a8a" }

  const api = { CLASSIC, PRESETS, HOT, fullPalette, sameAs, hexToRgb, rgbToHex, mix }
  if (typeof module !== "undefined" && module.exports) module.exports = api
  else root.HangyoColors = api
})(typeof window !== "undefined" ? window : globalThis)
