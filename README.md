# ☄️ Comet Karts

A complete Mario-Kart-style arcade racer that runs in your browser — built
from scratch with vanilla JavaScript ES modules and Three.js (vendored
locally, no build step, no install, works offline).

## ▶️ How to play

Python is the only requirement (already on most Windows machines):

1. Double-click **`start_game.bat`** — it starts a tiny local server and
   opens the game in your browser.
   (Or manually: `python serve.py` then open <http://localhost:8788>.)
2. Pick a mode, class, and racer. Go fast, throw shells.

> A local server is needed because browsers block ES modules from `file://`.

## 🎮 Controls

| Input | Action |
| --- | --- |
| **W / ↑** | Accelerate |
| **S / ↓** | Brake / reverse (also: back-throw modifier for items) |
| **A D / ← →** | Steer |
| **SPACE or SHIFT** | Hop — hold + steer to **drift**; colored sparks (blue → orange → purple) mean a bigger **mini-turbo** on release |
| **C / Left Ctrl** | **Handbrake drift** (realistic mode) — no hop needed: hold to break the rear loose, counter-steer to control the slide. Slip angle scrubs speed like real tires, sideways time charges the same mini-turbo tiers, and over-rotating past ~85° spins you out. Below sliding speed it's just a handbrake. |
| **E / Q / ENTER** | Use item — **hold** to drag it behind you as a shield |
| **ESC / P** | Pause |
| **Gamepad** | Left stick steer, A gas, B brake, RB drift, X handbrake, LB item |
| **Touch** | On-screen controls appear automatically on touch devices |

**Pro tips**
- Hold gas during the “1” of the countdown for a **rocket start**.
- Tap hop as you leave a ramp crest for a **trick boost** on landing.
- Tailgate a rival for ~1 second to get a **slipstream** speed burst.
- Held items (banana/shells) block one incoming shell while dragged.

## 🕹️ Modes

- **Grand Prix** — two 4-track cups (Comet & Nebula). Points 15/12/10/9/8/7/6/5, standings between races, champion crowned at the end.
- **Single Race** — any of the 8 tracks.
- **Time Trial** — solo with 3 mushrooms; your best run is saved as a **ghost** you race against next time (stored in the browser).
- **Balloon Battle** — arena combat, 3 balloons each, last kart floating (or most KOs at the timer) wins.

**Engine classes** 50cc → 200cc scale global speed and AI skill; 200cc genuinely requires braking.

## 🏁 The systems under the hood (per the design spec)

- **Arcade physics** — heading/travel split gives forgiving high-grip driving with real slide during drifts; bumps, not spin-outs, on contact.
- **Drift/mini-turbo state machine** — hop → drift state → charge timer → 3 spark tiers → boost scaled by tier.
- **Position-weighted item roulette** — a probability matrix per race position: leaders draw coins/bananas, the back of the pack draws Bullet-style rockets, lightning, stars, golden mushrooms (see `src/config.js`).
- **Item states** — inventory, instant use, or dragged as a physical shield.
- **Rubber-banding** — AI speed subtly biases toward the player’s position, plus the item matrix does the heavy lifting.
- **AI drivers** — pure-pursuit racing line with corner-speed planning, real drifting (they earn their mini-turbos), hazard dodging, item timing, distinct per-driver personalities.
- **8 themed tracks** — meadows, desert canyon, ice ridge (low grip!), a floating space causeway (fall = respawn), coral shallows, a volcano, a walled neon street circuit, and cloudtop ramps — all data-driven spline definitions in `src/tracks/`.
- **Procedural audio** — engine hum, every SFX, and all five chiptune music loops are synthesized live with WebAudio; zero audio files.

## 📁 Project layout

```
index.html          page shell, HUD/menu DOM + CSS
serve.py            tiny no-cache dev server
vendor/three.module.js
src/
  config.js         every tuning constant (physics, item matrix, classes)
  utils.js          math + arc-length Catmull-Rom spline
  input.js          keyboard / gamepad / touch
  track.js          track builder + road queries (the track-def contract)
  tracks/…          8 track definitions (pure data)
  kart.js           kart physics + drift state machine + visuals
  ai.js             AI drivers
  items.js          boxes, roulette, projectiles, shields
  race.js           countdown, ranks, laps, collisions, camera, modes
  ghost.js          time-trial ghosts (localStorage)
  hud.js  menu.js   DOM UI
  audio.js          procedural WebAudio engine/sfx/music
  effects.js        particle systems
```

Have fun — and watch out for blue shells. 🔵
