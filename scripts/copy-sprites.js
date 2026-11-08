// Copies the built pose PNGs into the app and makes the window/tray icon.
const fs = require("fs")
const path = require("path")
const root = path.join(__dirname, "..")
const from = path.join(root, "art", "out", "sprites")
const to = path.join(root, "src", "renderer", "pet", "sprites")
fs.mkdirSync(to, { recursive: true })
let n = 0
for (const f of fs.readdirSync(from)) {
  if (!f.endsWith(".png") || f.startsWith("_")) continue
  fs.copyFileSync(path.join(from, f), path.join(to, f))
  n++
}
console.log(`copied ${n} sprites -> ${path.relative(root, to)}`)
