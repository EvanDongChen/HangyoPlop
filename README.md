# HangyoPlop

A pixel-art Hangyodon desktop pet for Windows. It is inspired by Comnyang but works fully offline:
there's no account, no license check, no auto-update and no analytics. Settings stay in
`%APPDATA%\HangyoPlop\settings.json`.

## Run it

```sh
npm install
npm start          # dev run
npm run dist       # builds dist/HangyoPlop Setup 0.1.0.exe (installer) and dist/HangyoPlop 0.1.0.exe (portable)
```

`npm start` clears `ELECTRON_RUN_AS_NODE`. VS Code terminals set that variable, and it stops Electron from starting.

Right-click Hangyodon or the tray icon to open the menu.

## What it does

| Trigger | Hangyodon |
|---|---|
| Cursor moves | Eyes follow it |
| Stroke the head with the cursor | Purrs (happy face, hearts, bubbly gurgle) |
| Shake the cursor fast nearby | Hunting pose, wiggles toward it |
| Typing | Kneads a little keyboard with the paw on that side of the keyboard |
| Typing very fast | Overheats: turns red and steams |
| Mouse wheel | Unrolls a paper scroll |
| Drag | Stretches like mochi, wobbles when shaken, springs back on release |
| Drag past a screen edge | Peek mode: lies sideways and peeks in from the edge |
| Click / double-click | Wave + blub / jump |
| 45 s without input | Falls asleep (Zzz) |
| Coding agent working | Thinking face with dots |
| Coding agent finishes | Double jump + "Task complete!" |
| Agent needs approval | Waves: "needs your attention!" |

Menu features:
- **Pomodoro**: start, pause, resume and reset, plus focus and break lengths (presets or custom). A pixel timer chip sits beside the pet; hover over it for controls.
- **Break stretch / Drink water**: interval reminders where Hangyodon grows big in the middle of the screen. "Start now" runs one straight away.
- **Reminders**: a time and a message, either once or on chosen days (daily, weekdays, weekends or custom). Use the clock button or the menu.
- **Name**: your name (used in reminders), the pet's name, and whether to show it.
- **Fixed message**: a note pinned above the head.
- **Colors**: 8 presets plus a color editor with saveable looks.
- **Show off my Hangyodon**: records a 5–30 s `.webm` clip of the pet.
- **Peek mode**: left or right, and whether notices still pop out while peeking.
- Also: size (2x–6x), move to center, sound (mute and volume), open at login.

## Coding agents

All of this is local. The app reads the agents' own session logs:

- **Claude Code**: `~/.claude/projects/**/*.jsonl`
- **Codex CLI**: `~/.codex/sessions/**/rollout-*.jsonl`

Any other tool can report its state to the localhost endpoint:

```sh
curl -X POST http://127.0.0.1:23457/agent-state -d "{\"agent\":\"mytool\",\"state\":\"complete\"}"
```

`state` is one of `thinking`, `working`, `notification`, `complete`, `error` or `idle`. Each source can be switched off under **Agent monitoring**.

## Art

All poses come from one parametric drawing in [art/hangyodon.px.js](art/hangyodon.px.js). The app draws the pupils live so the eyes can follow the cursor. To rebuild the sprites after editing the art:

```sh
npm run art
```

## Code map

- [src/main/main.js](src/main/main.js): window layouts (normal, peek, big), drag, global input, breaks, reminders, pomodoro, menus
- [src/main/agents.js](src/main/agents.js): agent log tailing and the localhost hook server
- [src/main/store.js](src/main/store.js): JSON settings
- [src/renderer/pet/pet.js](src/renderer/pet/pet.js): pose state machine, canvas drawing, petting, hunting, heat, bubble, reminders panel, recording
- [src/renderer/pet/sound.js](src/renderer/pet/sound.js): synthesized sounds (no audio files)
- [src/renderer/colors/](src/renderer/colors/): color editor window
- [src/shared/colors.js](src/shared/colors.js): palettes and presets

Dev helper: `HANGYO_TOUR=<dir> npm start` walks through the main states, saves window captures to `<dir>`, then quits.
