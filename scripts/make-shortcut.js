// Adds "HangyoPlop" shortcuts to the Desktop and the Start Menu (Windows).
// They start the pet straight from this folder, with no console window.
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")

if (process.platform !== "win32") {
  console.log("Shortcuts are only set up on Windows. Run `npm start` instead.")
  process.exit(0)
}

const root = path.join(__dirname, "..")
const electron = path.join(root, "node_modules", "electron", "dist", "electron.exe")
const icon = path.join(root, "build", "icon.ico")
if (!fs.existsSync(electron)) {
  console.error("Run `npm install` first.")
  process.exit(1)
}

const esc = (p) => p.replace(/'/g, "''")
const ps = `
$shell = New-Object -ComObject WScript.Shell
$targets = @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('Programs')) ''))
foreach ($dir in $targets) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'HangyoPlop.lnk'))
  $lnk.TargetPath = '${esc(electron)}'
  $lnk.Arguments = '"${esc(root)}"'
  $lnk.WorkingDirectory = '${esc(root)}'
  $lnk.IconLocation = '${esc(icon)}'
  $lnk.Description = 'HangyoPlop desktop pet'
  $lnk.Save()
  Write-Output ("Created " + (Join-Path $dir 'HangyoPlop.lnk'))
}
`
const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8" })
process.stdout.write(out)
console.log("Done. Double-click HangyoPlop on your Desktop, or find it in the Start Menu.")
