// Hangyodon, traced from the user's reference pixel art (art/ref/reference.png).
// scripts/extract-reference.py recovered the native 53x56 grid from the upscaled image;
// the grid below is that trace, cleaned up by hand: 1px outlines, flat fills, symmetric body,
// eyes left empty (the app draws the pupils live so they follow the cursor).

pal({
  k: "#0d2236", // outline
  t: "#33ccba", // teal
  T: "#2aa9b4", // teal shade
  l: "#6fdccf", // teal rim light
  s: "#8eeee0", // belly scales
  f: "#1fa6de", // fin / crest blue
  F: "#1f84b8", // fin mid
  D: "#1d5f8a", // fin ridge
  h: "#6cc8f2", // fin highlight
  w: "#f4f8fa", // eye white
  e: "#0a0a12", // pupil
  p: "#f4a1bb", // lips
  M: "#a9798b", // lip shade
  P: "#51263a", // mouth line
  n: "#ff9db0", // blush
})

// Left half incl. the shared center column (21 cols); image rows 9..53.
const HALF = [
  "............kkkkkkkkk",
  "..........kklllllllll",
  ".........kllllltttttt",
  "........klllttttttttt",
  "........klltttttttttt",
  ".......kllttttttttttt",
  "......klltttttttttttt",
  "......klttttttttttttt",
  "......klttttttttttttt",
  ".....klttttkkkkkttttt",
  ".....kltttkwwwwwktttt",
  "..kkkklttkwwwwwwwkttt",
  ".khffkltkwwwwwwwwwktt",
  "khhfDkltkwwwwwwwwwktt",
  "khfDfkltkwwwwwwwwwktt",
  "kffDfkltkwwwwwwwwwktt",
  "kfDfDkltkwwwwwwwwwktt",
  "kfDfDklttkwwwwwwwkttt",
  "kfDffkltttkwwwwwktttt",
  "kffDfklttttkkkkkttttt",
  ".kfDfkTtttttttttttttt",
  "..kffkTtkkkkkkkkkkkkk",
  "...kkkkkppppppppppppp",
  "....kpPpppppppppppppp",
  "....kppPPPPPPPppppppp",
  "....kpppppppppPPPPPPP",
  ".....kMMMMMMMMMMMMMMM",
  "....kkkkkkkkkkkkkkkkk",
  "....klttTTTTTTTTTTTTT",
  "....klltttttttttttttt",
  "...klltttttTtttTttTtt",
  ".kkltttttttTtttTttTtt",
  ".kllttttttttTTTttttTT",
  ".kTTttttttttttttttttt",
  "..kTTTTTkkttttTtttTtt",
  "...kkkkkkTttttTtttTtt",
  ".......kTttttttTTTttt",
  ".......kTtttttttttttt",
  ".......kTtttttttttttt",
  ".......kTtttttttttttt",
  ".......kTttttttttTTTT",
  "......kTTttttttttTkkk",
  ".....kTtttttttttttttk",
  ".....kTTttTttTTttTTTk",
  "......kkkkkkkkkkkkkkk",
]
HALF.forEach((r, i) => { if (r.length !== 21) throw new Error(`HALF row ${i} has ${r.length} cols`) })

// Body, head, fins, lips (symmetric). Row 0 here = image row 9.
sprite("_body", { mx: "c", w: 41, h: HALF.length }, grid(0, 0, HALF.join("\n")))

// Crest leaning right with a curl (asymmetric). Image cols 21..38, rows 1..10.
sprite("_crest", `
  ......kkkkk.......
  .....khhfffk......
  ....khhffDffkkk...
  ....kfffDkffffFk..
  ...kffffDDffffDFk.
  ...kffffDfffDDffFk
  ...kffffffffFkfffk
  .............kDDfk
  .............kkkk.`)

const OX = 7, OY = 1 // image offset of the sprite canvas
sprite("idle", { w: 41, h: 53 },
  stamp("_body", 0, 9 - OY),
  grid(21 - OX, 2 - OY, `
  ......kkkkk.......
  .....khhfffk......
  ....khhffDffkkk...
  ....kfffDkffffFk..
  ...kffffDDffffDFk.
  ...kffffDfffDDffFk
  ...kffffffffFkfffk
  .............kDDfk
  .............kkkk.`))

// Pupils as in the reference (the app draws these live)
sprite("idle_preview", { base: "idle" },
  rect(14, 21, 3, 4, "e"), px(14, 21, "w"), rect(24, 21, 3, 4, "e"), px(24, 21, "w"))
