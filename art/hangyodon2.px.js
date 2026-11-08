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
  q: "#d985ac", // lip deep pink
  M: "#936d7a", // lip mauve
  m: "#bb8d9f", // lip light mauve
  P: "#51263a", // mouth line
  n: "#ff9db0", // blush
})

// The master idle sprite (41x53), as edited by hand in the Hangyodon Pixel Editor artifact.
// Row 0 is blank; IDLE holds rows 1..52.
const IDLE = [
  "....................kkkkk................",
  "...................khhfffk...............",
  "..................khhfffffkkk............",
  "..................kffDFfffffFk...........",
  ".................kfffDFffDDffFk..........",
  ".................kfffDFfDFFfffFk.........",
  ".................kfffDFfDFfffDfk.........",
  "............kkkkkkkkkkkkkkkkDFfk.........",
  "..........kklllllllllllllllkkkk..........",
  ".........kllllltttttttttttlllllk.........",
  "........kllltttttttttttttttttlllk........",
  "........klltttttttttttttttttttllk........",
  ".......klltttttttttttttttttttttllk.......",
  "......klltttttttttttttttttttttttllk......",
  "......kltttttttttttttttttttttttttlk......",
  "......kltttttttttttttttttttttttttlk......",
  ".....klttttkkkkktttttttttkkkkkttttlk.....",
  ".....kltttkwwwwwktttttttkwwwwwktttlk.....",
  "..kkkklttkwwwwwwwktttttkwwwwwwwkttlkkkk..",
  ".khffkltkwwwwwwwwwktttkwwwwwwwwwktlkffhk.",
  "khhffkltkwwwwwwwwwktttkwwwwwwwwwktlkffhhk",
  "khfDDkltkwwwwwwwwwktttkwwwwwwwwwktlkDDfhk",
  "kffFFkltkwwwwwwwwwktttkwwwwwwwwwktlkFFffk",
  "kffffkltkwwwwwwwwwktttkwwwwwwwwwktlkffffk",
  "kfDDDklttkwwwwwwwktttttkwwwwwwwkttlkDDDfk",
  "kffFFkltttkwwwwwktttttttkwwwwwktttlkFFFfk",
  "kffffklttttkkkkktttttttttkkkkkttttlkffffk",
  ".kfffkTtttttttttttttttttttttttttttTkfffk.",
  "..kffkTtttkkkkkkkkkkkkkkkkkkkkktttTkffk..",
  "...kkkTkkkqpppppppppppppppppppqkkkTkkk...",
  ".....kkpppppppppppppppppppppppppppkk.....",
  "......kpPPPPPPpppppppppppppPPPPPPpk......",
  "......kpppppppPPPPPPPPPPPPPpppppppk......",
  ".....klkkMMMMMMMMMMMMMMMMMMMMMMMkklk.....",
  ".....klTkkkkkkkkkkkkkkkkkkkkkkkkkTlk.....",
  "....klttTTTTTTTTTTTTTTTTTTTTTTTTTttlk....",
  "....kltttttttttttttttttttttttttttttlk....",
  "...klttttttTtttTttTtttTttTtttTttttttlk...",
  ".kkltttttttTtttTttTtttTttTtttTtttttttlkk.",
  ".kllttttttttTTTttttTTTttttTTTttttttttllk.",
  ".kTTtttttttttttttttttttttttttttttttttTTk.",
  "..kTTTTTkkttttTtttTtttTtttTttttkkTTTTTk..",
  "...kkkkkkTttttTtttTtttTtttTttttTkkkkkk...",
  ".......kTttttttTTTtttttTTTttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTtttttttttttttttttttttttTk.......",
  ".......kTttttttttTTTTTTTttttttttTk.......",
  "......kTTttttttttTkkkkkTttttttttTTk......",
  ".....kTtttttttttttttktttttttttttttTk.....",
  ".....kTTttTttTTttTTTkTTTttTTttTttTTk.....",
  "......kkkkkkkkkkkkkkkkkkkkkkkkkkkkk......",
]
IDLE.forEach((r, i) => { if (r.length !== 41) throw new Error(`IDLE row ${i + 1} has ${r.length} cols`) })

sprite("idle", { w: 41, h: 53 }, grid(0, 1, IDLE.join("\n")))

// Pupils as in the reference (the app draws these live)
sprite("idle_preview", { base: "idle" },
  rect(14, 21, 3, 4, "e"), px(14, 21, "w"), rect(24, 21, 3, 4, "e"), px(24, 21, "w"))
