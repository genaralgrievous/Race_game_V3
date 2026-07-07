// ============================================================
// main: renderer, game state machine (menu <-> race), Grand Prix
// sequencing, pause, fixed-ish timestep loop.
// ============================================================
import * as THREE from 'three';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { Menu } from './menu.js';
import { AudioSys } from './audio.js';
import { Race } from './race.js';
import { trackById, CUPS, ARENA } from './tracks.js';
import { GP_POINTS, CHARACTERS } from './config.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const input = new Input();
const hud = new HUD();
const audio = new AudioSys();
const menu = new Menu(audio);

// Apply saved mute preference on startup
audio.setMuted(input.getMuted());

// Speed lines element
const speedLinesEl = document.getElementById('speedLines');
const _speedLines = [];
if (speedLinesEl) {
  for (let i = 0; i < 12; i++) {
    const line = document.createElement('div');
    line.className = 'line';
    line.style.left = (Math.random() * 100) + '%';
    line.style.height = (30 + Math.random() * 60) + 'px';
    line.style.animationDelay = (Math.random() * -0.3) + 's';
    line.style.opacity = (0.3 + Math.random() * 0.5).toString();
    speedLinesEl.appendChild(line);
    _speedLines.push(line);
  }
}

// Touch controls element
const touchControls = document.getElementById('touchControls');

let race = null;
let paused = false;
let gp = null;   // { cup, raceIdx, points: Map(name->pts), classId, charId, standingsMeta }

document.getElementById('loading').remove();
menu.title();

// ------------------------------------------------------------
menu.onStart = (cfg) => {
  if (cfg.mode === 'gp') {
    gp = {
      cup: CUPS.find(c => c.id === cfg.cupId) || CUPS[0],
      raceIdx: 0,
      classId: cfg.classId,
      charId: cfg.charId,
      points: new Map(),
    };
    startRace({ mode: 'race', trackId: gp.cup.tracks[0], classId: cfg.classId, charId: cfg.charId, gpRace: true });
  } else if (cfg.mode === 'battle') {
    startBattle(cfg);
  } else {
    startRace(cfg);
  }
};

function startRace(cfg) {
  disposeRace();
  const trackDef = trackById(cfg.trackId);
  hud.show();
  menu.hide();
  audio.setMusic(null);
  race = new Race({
    trackDef,
    mode: cfg.mode === 'tt' ? 'tt' : 'race',
    classId: cfg.classId,
    playerCharId: cfg.charId,
    hud, audio,
    onComplete: (res) => onRaceComplete(res, cfg),
  });
  hud.msg(trackDef.name, 2.2);
}

function startBattle(cfg) {
  disposeRace();
  hud.show();
  menu.hide();
  audio.setMusic(null);
  race = new Race({
    trackDef: ARENA,
    mode: 'battle',
    classId: cfg.classId || '150cc',
    playerCharId: cfg.charId,
    hud, audio,
    onComplete: (res) => onBattleComplete(res, cfg),
  });
  hud.msg('BALLOON BATTLE — last kart floating wins!', 3);
}

// ------------------------------------------------------------
function onRaceComplete(res, cfg) {
  if (res.mode === 'tt') {
    hud.hide();
    audio.setMusic('results');
    menu.ttResults(res, () => backToMenu());
    return;
  }
  if (cfg.gpRace) {
    // accumulate GP points
    for (const r of res.results) {
      const pts = GP_POINTS[r.rank - 1] ?? 0;
      const cur = gp.points.get(r.name) || { name: r.name, isPlayer: r.isPlayer, points: 0 };
      cur.points += pts;
      gp.points.set(r.name, cur);
    }
    hud.hide();
    audio.setMusic('results');
    menu.raceResults(res.results, {
      title: `${trackById(gp.cup.tracks[gp.raceIdx]).name} — Results`,
      points: GP_POINTS,
      continueLabel: 'Standings',
      onContinue: () => showStandings(),
    });
  } else {
    hud.hide();
    audio.setMusic('results');
    menu.raceResults(res.results, {
      title: 'Race Results',
      onContinue: () => backToMenu(),
    });
  }
}

function showStandings() {
  const standings = [...gp.points.values()].sort((a, b) => b.points - a.points);
  const isLast = gp.raceIdx >= gp.cup.tracks.length - 1;
  menu.gpStandings(standings, gp.raceIdx + 1, gp.cup.tracks.length, () => {
    if (isLast) { gp = null; backToMenu(); }
    else {
      gp.raceIdx++;
      startRace({ mode: 'race', trackId: gp.cup.tracks[gp.raceIdx], classId: gp.classId, charId: gp.charId, gpRace: true });
    }
  }, isLast);
}

function onBattleComplete(res, cfg) {
  hud.hide();
  audio.setMusic('results');
  menu.raceResults(res.results, {
    title: `Balloon Battle — ${res.reason}`,
    onContinue: () => backToMenu(),
  });
}

function backToMenu() {
  disposeRace();
  hud.hide();
  audio.setMusic('menu');
  menu.show();
  menu.main();
}

function disposeRace() {
  if (race) { race.dispose(); race = null; }
  audio.engineOff();   // don't let the engine hum drone over the menus
  paused = false;
}

// ------------------------------------------------------------
// Pause
// ------------------------------------------------------------
function togglePause() {
  if (!race || race.state === 'done') return;
  paused = !paused;
  if (paused) {
    race._pausedMusic = audio.musicMode;   // capture before stopAll nulls it
    audio.stopAll();
    menu.pause(
      () => { paused = false; menu.hide(); input.flushEdges(); if (race._pausedMusic) audio.setMusic(race._pausedMusic); },
      () => { // restart current race
        const cfg = race._restartCfg;
        paused = false; menu.hide(); input.flushEdges();
        cfg();
      },
      () => { paused = false; gp = null; backToMenu(); });
  } else {
    menu.hide();
    input.flushEdges();
    if (race._pausedMusic) audio.setMusic(race._pausedMusic);
  }
}

// stash a restart closure on the race
const _origStartRace = startRace;
startRace = function (cfg) {
  _origStartRace(cfg);
  race._restartCfg = () => startRace(cfg);
};
const _origStartBattle = startBattle;
startBattle = function (cfg) {
  _origStartBattle(cfg);
  race._restartCfg = () => startBattle(cfg);
};

// ------------------------------------------------------------
// Resize
// ------------------------------------------------------------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (race) race.resize(innerWidth, innerHeight);
});

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - last) / 1000, 1 / 20); // clamp long frames
  last = now;

  const controls = input.update();
  if (controls.anyPressed) audio.unlock();

  // Sync mute state every frame — the button must work in menus too
  const muteState = input.getMuted();
  if (audio.muted !== muteState) audio.setMuted(muteState);

  if (race) {
    if (controls.pausePressed) togglePause();
    if (!paused) {
      race.update(dt, controls);
      hud.update(dt);
    }
    renderer.render(race.scene, race.camera);

    // Speed lines: show during boost/bullet
    if (speedLinesEl && race.player) {
      const boosting = race.player.boostTimer > 0 || race.player.bulletTimer > 0;
      speedLinesEl.classList.toggle('active', boosting && !paused);
    }

    // Show touch controls only during gameplay
    if (touchControls) {
      touchControls.classList.toggle('active',
        input._touchActive && !paused && race.state !== 'done');
    }
  } else {
    // Hide speed lines and touch controls when not racing
    if (speedLinesEl) speedLinesEl.classList.remove('active');
    if (touchControls) touchControls.classList.remove('active');
  }
}
requestAnimationFrame(loop);

// Debug hook for automated testing.
window.__game = {
  get race() { return race; },
  input, hud, menu, audio, renderer,
  startRace: (cfg) => startRace(cfg),
  THREE,
};
