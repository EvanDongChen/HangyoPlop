// Hangyodon color schemes, shared by the main process (menus) and the renderers (recoloring).
// The sprites are drawn with the CLASSIC palette; recoloring swaps those exact RGB values.
;(function (root) {
  const CLASSIC = {
    h: "#c9f1f5", b: "#86cfe0", B: "#5aa6c4", // skin highlight / skin / skin shade
    f: "#3d80b9", F: "#2b5c90", // fin / fin shade
    c: "#f1faf8", C: "#c9e3e4", // belly / belly shade
    r: "#e9516c", R: "#b23250", p: "#ffa3b4", // lips / lip shade / lip highlight
  }

  // Each preset only names the four main colors; shades are derived.
  const PRESETS = [
    { name: "Classic", skin: "#86cfe0", fin: "#3d80b9", belly: "#f1faf8", lips: "#e9516c" },
    { name: "Sakura", skin: "#f6b6c8", fin: "#d9668e", belly: "#fff4f6", lips: "#e0405e" },
    { name: "Lemon", skin: "#f5dd73", fin: "#e09a3a", belly: "#fffbea", lips: "#e9516c" },
    { name: "Mint", skin: "#98e0b8", fin: "#3f9e78", belly: "#f3fff8", lips: "#ef6a7d" },
    { name: "Lavender", skin: "#c3b2ef", fin: "#7a5fc4", belly: "#f8f5ff", lips: "#e9516c" },
    { name: "Koi", skin: "#fbf6f0", fin: "#ee6b3b", belly: "#ffffff", lips: "#e0405e" },
    { name: "Midnight", skin: "#4a5e8c", fin: "#26345c", belly: "#c9d4ea", lips: "#ff7b93" },
    { name: "Ghost", skin: "#e9eef2", fin: "#a8b4c2", belly: "#ffffff", lips: "#c8a0ad" },
  ]

  const hexToRgb = (hex) => {
    const n = parseInt(String(hex).replace("#", ""), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t))

  const sameMain = (s) =>
    s.skin === PRESETS[0].skin && s.fin === PRESETS[0].fin && s.belly === PRESETS[0].belly && s.lips === PRESETS[0].lips

  // Expand { skin, fin, belly, lips } into the full sprite palette.
  function fullPalette(scheme) {
    if (!scheme || sameMain(scheme)) return { ...CLASSIC }
    const ink = "#1b2338"
    return {
      h: mix(scheme.skin, "#ffffff", 0.45),
      b: scheme.skin,
      B: mix(scheme.skin, ink, 0.28),
      f: scheme.fin,
      F: mix(scheme.fin, ink, 0.3),
      c: scheme.belly,
      C: mix(scheme.belly, ink, 0.14),
      r: scheme.lips,
      R: mix(scheme.lips, ink, 0.32),
      p: mix(scheme.lips, "#ffffff", 0.45),
    }
  }

  // Overheated look: skin and fins glow red.
  const HOT = { h: "#ffc0b0", b: "#ff6b5a", B: "#d63c3c", f: "#b8202e", F: "#86131f" }

  const api = { CLASSIC, PRESETS, HOT, fullPalette, hexToRgb, rgbToHex, mix }
  if (typeof module !== "undefined" && module.exports) module.exports = api
  else root.HangyoColors = api
})(typeof window !== "undefined" ? window : globalThis)
