// ============================================================
// Race: owns a scene, a track, 8 karts, the item system, the
// countdown, positions, laps, finishing and (for battle mode)
// balloons. Modes: 'race' (single/GP), 'tt', 'battle'.
// ============================================================
import * as THREE from 'three';
import { Track } from './track.js';
import { Kart } from './kart.js';
import { AIController } from './ai.js';
import { ItemSystem } from './items.js';
import { Effects } from './effects.js';
import { GhostRecorder, GhostPlayer, loadGhost, saveGhost } from './ghost.js';
import { CHARACTERS, CLASSES, PHYS, RACE, BATTLE } from './config.js';
import { clamp, damp, dampAngle, shuffle, rand } from './utils.js';

class EventBus {
  constructor() { this.handlers = {}; }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); }
  emit(name, ...args) {
    const hs = this.handlers[name];
    if (hs) for (const fn of hs) fn(...args);
  }
}

export class Race {
  constructor(opts) {
    // opts: { trackDef, mode, classId, playerCharId, hud, audio, onComplete }
    this.opts = opts;
    this.mode = opts.mode || 'race';
    this.isTT = this.mode === 'tt';
    this.isBattle = this.mode === 'battle';
    this.classId = opts.classId || '150cc';
    this.classScale = CLASSES[this.classId].speedScale;
    this.aiSkill = CLASSES[this.classId].aiSkill;
    this.hud = opts.hud;
    this.audio = opts.audio;
    this.onComplete = opts.onComplete;

    this.scene = new THREE.Scene();
    this.events = new EventBus();
    this.time = 0;            // wall time in race
    this.raceTime = 0;        // running clock after GO
    this.state = 'countdown'; // countdown | running | done
    this.countdownT = RACE.countdownStep * 3 + 0.9;
    this._goFlashT = 0;
    this._results = null;
    this._autoFillT = 0;
    this.battleTimer = BATTLE.duration;

    // --- track ---
    this.track = new Track(opts.trackDef);
    this.scene.add(this.track.group);
    this._setupLights(opts.trackDef.theme);

    // --- effects ---
    // Determine track environment theme for particles
    const grip = opts.trackDef.grip ?? 1;
    const isFloating = !!opts.trackDef.floating;
    let envTheme = 'default';
    if (grip < 0.8) envTheme = 'ice';
    else if (isFloating) envTheme = 'space';
    else {
      const groundColor = opts.trackDef.theme?.ground ?? 0;
      // Sandy/desert tracks
      if (groundColor > 0xaa0000 && ((groundColor >> 8) & 0xff) > 0x90) envTheme = 'sand';
    }
    this.effects = new Effects(this.scene, envTheme);

    // --- karts ---
    this._spawnKarts(opts);

    // --- items ---
    this.items = new ItemSystem(this.scene, this.track, this.karts, this.effects,
      this.events, { battle: this.isBattle });
    for (const k of this.karts) {
      if (k.ai) k.ai.itemSystem = this.items;
    }

    // --- Time Trial extras ---
    if (this.isTT) {
      this.player.item = 'mush3';
      this.player.itemCount = RACE.ttMushrooms;
      this.recorder = new GhostRecorder(this.player);
      const g = loadGhost(opts.trackDef.id);
      if (g) {
        this.ghost = new GhostPlayer(this.scene, g, CHARACTERS.find(c => c.id === g.charId));
        this.ghostTime = g.time;
      }
    }

    // --- camera ---
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.3, 1500);
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this._initCamera();

    this._wireEvents();
    this._updateRanks();
  }

  // ----------------------------------------------------------
  _setupLights(theme) {
    const sun = theme.sun || { color: 0xffffff, intensity: 1.1, dir: [0.5, 1, 0.35] };
    const dl = new THREE.DirectionalLight(sun.color, sun.intensity);
    dl.position.set(sun.dir[0] * 100, sun.dir[1] * 100, sun.dir[2] * 100);
    this.scene.add(dl);
    this.scene.add(new THREE.AmbientLight(theme.ambient ?? 0x8899bb, 0.85));
    if (theme.fog) this.scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
  }

  _spawnKarts(opts) {
    this.karts = [];
    const playerChar = CHARACTERS.find(c => c.id === opts.playerCharId) || CHARACTERS[0];
    const others = shuffle(CHARACTERS.filter(c => c.id !== playerChar.id));
    const count = this.isTT ? 1 : RACE.kartCount;

    let spawns;
    if (this.isBattle) {
      spawns = [];
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const r = this.track.arenaRadius * 0.72;
        spawns.push({
          pos: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
          heading: Math.atan2(-Math.cos(a), -Math.sin(a)),
          idx: 0,
        });
      }
    } else {
      spawns = this.track.startPositions(count);
    }

    for (let i = 0; i < count; i++) {
      const isPlayer = i === (this.isBattle ? 0 : count - 1) || this.isTT;
      // player starts at the BACK of the grid in races (classic kart-racer fairness)
      const ch = isPlayer ? playerChar : others.pop();
      const kart = new Kart(ch, { isPlayer, index: i });
      const s = spawns[i];
      kart.reset(s.pos, s.heading, s.idx);
      kart.progressCont = s.idx;
      kart.progressDist = s.idx - this.track.spline?.count || 0;
      if (!this.isBattle && this.track.spline) {
        // start slightly "behind" the line: progressDist negative offset
        kart.progressDist = s.idx - this.track.spline.count;
        kart.lap = 1;
      }
      kart._classScale = this.classScale;
      if (this.isBattle) { kart.balloons = BATTLE.balloons; }
      this.scene.add(kart.mesh);
      this.effects.attachKart(kart);
      if (isPlayer) this.player = kart;
      else {
        kart.ai = new AIController(kart, {
          skill: clamp(this.aiSkill + rand(-0.12, 0.12), 0.15, 1),
          getPlayer: () => this.player,
          battle: this.isBattle,
        });
      }
      this.karts.push(kart);
    }
  }

  _initCamera() {
    const k = this.player;
    const back = 8.5;
    this._camPos.set(
      k.pos.x - Math.sin(k.heading) * back,
      k.pos.y + 3.6,
      k.pos.z - Math.cos(k.heading) * back);
    this.camera.position.copy(this._camPos);
    this._camLook.copy(k.pos);
  }

  _wireEvents() {
    const A = this.audio, H = this.hud, E = this.effects;
    const ev = this.events;
    const ifPlayer = (k, fn) => { if (k === this.player) fn(); };

    ev.on('hop', k => ifPlayer(k, () => A.play('hop')));
    ev.on('land', k => ifPlayer(k, () => A.play('land')));
    ev.on('driftTier', (k, tier) => ifPlayer(k, () => A.play('driftTier' + tier)));
    ev.on('miniTurbo', (k) => { E.boostBurst(k); ifPlayer(k, () => A.play('boost')); });
    ev.on('boostPad', (k) => { E.boostBurst(k); ifPlayer(k, () => A.play('boost')); });
    ev.on('slipstream', (k) => { E.boostBurst(k); ifPlayer(k, () => A.play('boost')); });
    ev.on('trick', (k) => { E.trickFlash(k); ifPlayer(k, () => A.play('trick')); });
    ev.on('trickLand', (k) => { E.boostBurst(k); ifPlayer(k, () => A.play('boost')); });
    ev.on('spin', k => { ifPlayer(k, () => A.play('spin')); });
    ev.on('tumble', k => { E.hitPoof(k.pos, 0xffffff); if (k === this.player) { A.play('hit'); H.flash(0.25); } });
    ev.on('squash', k => ifPlayer(k, () => A.play('hit')));
    ev.on('lightning', () => { A.play('lightning'); H.flash(0.5); });
    ev.on('fall', k => ifPlayer(k, () => A.play('fall')));
    ev.on('respawn', k => ifPlayer(k, () => A.play('respawn')));
    ev.on('boxHit', k => ifPlayer(k, () => A.play('box')));
    ev.on('itemGet', k => ifPlayer(k, () => A.play('item_get')));
    ev.on('coin', k => ifPlayer(k, () => { A.play('coin'); H.noteItemUsed(); }));
    ev.on('shoot', k => ifPlayer(k, () => { A.play('shoot'); H.noteItemUsed(); }));
    ev.on('shieldBlock', k => ifPlayer(k, () => A.play('hit')));
    ev.on('blast', () => A.play('explosion'));
    ev.on('bump', k => ifPlayer(k, () => A.play('bump')));
    ev.on('itemUse', (k, id) => {
      if (id === 'star' && k === this.player) A.play('star');
      if (id === 'rocket') A.play('bullet');
      if (k === this.player) H.noteItemUsed();
    });
    ev.on('lap', (k, lap) => {
      if (k !== this.player) return;
      const total = this.track.laps;
      if (lap > total) return;
      if (lap === total) { H.msg('FINAL LAP!', 2); A.play('lap'); A.setMusic('final'); }
      else { A.play('lap'); }
    });
    ev.on('kartHit', ({ victim, attacker, type }) => {
      if (!this.isBattle) return;
      if (victim.balloons > 0) {
        victim.balloons--;
        if (attacker && attacker !== victim) attacker.battleScore += BATTLE.koPoints;
        A.play('balloon');
        if (victim.balloons <= 0) {
          victim.eliminated = true;
          victim.mesh.visible = false;
          E.explosion(victim.pos.clone(), 4, 0xffffff);
        }
      }
    });
  }

  // ----------------------------------------------------------
  update(dt, input) {
    this.time += dt;
    const H = this.hud;

    // ---------- countdown ----------
    if (this.state === 'countdown') {
      const prev = this.countdownT;
      this.countdownT -= dt;
      const step = RACE.countdownStep;
      const beat = Math.ceil(this.countdownT / step);
      const prevBeat = Math.ceil(prev / step);
      if (beat !== prevBeat && beat >= 1 && beat <= 3) {
        H.countdown(String(beat));
        this.audio.play('countBeep');
      }
      // track rocket-start timing for the player
      if (input.accel && this.player._accelHeldAt === undefined) {
        this.player._accelHeldAt = this.countdownT;
      } else if (!input.accel) {
        this.player._accelHeldAt = undefined;
      }
      if (this.countdownT <= 0) {
        this.state = 'running';
        H.countdown('GO!');
        this._goFlashT = 0.8;
        this.audio.play('countGo');
        this.audio.setMusic(this.isBattle ? 'battle' : 'race');
        for (const k of this.karts) {
          k.controlLock = false;
          // rocket starts
          const heldAt = k === this.player ? k._accelHeldAt : (k.ai ? rand(0, PHYS.rocketPenaltyWindow) : undefined);
          if (heldAt !== undefined && heldAt <= PHYS.rocketWindow + 0.02 && heldAt > 0) {
            k.applyBoost(PHYS.rocketBoostTime, PHYS.boostMult);
            this.events.emit('miniTurbo', k, 1);
          }
        }
      }
    } else if (this._goFlashT > 0) {
      this._goFlashT -= dt;
      if (this._goFlashT <= 0) H.countdown('');
    }

    if (this.state === 'running') {
      this.raceTime += dt;
      if (this.isBattle) {
        this.battleTimer -= dt;
        if (this.battleTimer <= 0) return this._finishBattle('TIME!');
        const alive = this.karts.filter(k => !k.eliminated);
        if (alive.length <= 1) return this._finishBattle('KNOCKOUT!');
        if (this.player.eliminated && !this._specT) this._specT = 2.5;
        if (this._specT) { this._specT -= dt; if (this._specT <= 0) return this._finishBattle('ELIMINATED'); }
      }
    }

    // ---------- karts ----------
    const ctx = {
      track: this.track, classScale: this.classScale, karts: this.karts,
      effects: this.effects, events: this.events, time: this.time,
      raceState: this.state, countdownT: this.countdownT,
    };
    for (const k of this.karts) {
      if (k.eliminated) continue;
      const controls = k.isPlayer ? input : k.ai.compute(dt, ctx);
      ctx.controls = controls;
      k.update(dt, ctx);
      this.items.handleInput(k, controls, dt);
      k.updateVisual(dt, this.time);
      this.effects.kartAuras(k, dt, this.time);
    }

    // ---------- kart-vs-kart collisions ----------
    this._kartCollisions(dt);

    // ---------- systems ----------
    this.items.update(dt, this.time);
    this.effects.update(dt);
    if (!this.isBattle) this._updateRanks();
    if (!this.isBattle) this._checkFinishes(dt);

    // ---------- TT ghost ----------
    if (this.isTT && this.state === 'running' && !this.player.finished) {
      this.recorder.update(dt, this.raceTime);
      if (this.ghost) this.ghost.update(this.raceTime);
    }

    // ---------- camera & HUD ----------
    this._updateCamera(dt);
    this._updateHUD(dt);

    // engine audio from player kart (silenced once the race is over —
    // results screens shouldn't have an idle drone under the music)
    const p = this.player;
    if (this.state === 'done') {
      this.audio.engineOff();
    } else {
      this.audio.setEngine(
        clamp(Math.abs(p.speed) / (PHYS.maxSpeed * this.classScale * 1.3), 0, 1),
        p.boostTimer > 0 || p.bulletTimer > 0,
        p.driftState === 'drift' || p.driftState === 'slide');
    }
  }

  _kartCollisions(dt) {
    const P = PHYS;
    for (let i = 0; i < this.karts.length; i++) {
      for (let j = i + 1; j < this.karts.length; j++) {
        const a = this.karts[i], b = this.karts[j];
        if (a.eliminated || b.eliminated) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const dy = Math.abs(b.pos.y - a.pos.y);
        if (dy > 2) continue;
        const d = Math.hypot(dx, dz);
        const minD = P.kartRadius * 2;
        if (d >= minD || d < 1e-4) continue;

        const nx = dx / d, nz = dz / d;
        const overlap = minD - d;
        const wa = a.stat.weight, wb = b.stat.weight;
        const total = wa + wb;
        // separate
        a.pos.x -= nx * overlap * (wb / total);
        a.pos.z -= nz * overlap * (wb / total);
        b.pos.x += nx * overlap * (wa / total);
        b.pos.z += nz * overlap * (wa / total);

        // star / bullet karts flatten normal karts
        const aInv = a.starTimer > 0 || a.bulletTimer > 0;
        const bInv = b.starTimer > 0 || b.bulletTimer > 0;
        if (aInv && !bInv) {
          if (b.tumble(this.events)) this.events.emit('kartHit', { victim: b, attacker: a, type: 'star' });
          continue;
        }
        if (bInv && !aInv) {
          if (a.tumble(this.events)) this.events.emit('kartHit', { victim: a, attacker: b, type: 'star' });
          continue;
        }

        // momentum bump: heavier kart wins
        const rel = (Math.sin(a.travel) * a.speed - Math.sin(b.travel) * b.speed) * nx +
                    (Math.cos(a.travel) * a.speed - Math.cos(b.travel) * b.speed) * nz;
        const imp = clamp(Math.abs(rel) * 0.25, 0.8, P.bumpRestitution);
        // push each sideways proportional to the other's weight
        a._bumpX = (a._bumpX || 0) - nx * imp * (wb / total) * 2;
        a._bumpZ = (a._bumpZ || 0) - nz * imp * (wb / total) * 2;
        b._bumpX = (b._bumpX || 0) + nx * imp * (wa / total) * 2;
        b._bumpZ = (b._bumpZ || 0) + nz * imp * (wa / total) * 2;
        if ((a.isPlayer || b.isPlayer) && Math.abs(rel) > 6) this.events.emit('bump', this.player);
      }
    }
    // apply and decay bump velocities
    for (const k of this.karts) {
      if (k._bumpX) {
        k.pos.x += k._bumpX * dt * 8;
        k.pos.z += k._bumpZ * dt * 8;
        k._bumpX = damp(k._bumpX, 0, 7, dt);
        k._bumpZ = damp(k._bumpZ, 0, 7, dt);
        if (Math.abs(k._bumpX) < 0.02) { k._bumpX = 0; k._bumpZ = 0; }
      }
    }
  }

  _updateRanks() {
    const sorted = this.karts.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressDist - a.progressDist;
    });
    sorted.forEach((k, i) => k.rank = i + 1);
    this._sorted = sorted;
  }

  _checkFinishes(dt) {
    if (this.state !== 'running') return;
    const N = this.track.spline.count;
    const goal = this.track.laps * N;
    for (const k of this.karts) {
      if (!k.finished && k.progressDist >= goal) {
        k.finished = true;
        k.finishTime = this.raceTime;
        k.finishOrder = this.karts.filter(x => x.finished).length;
        if (k === this.player) {
          this.hud.msg('FINISH!', 2.5);
          this.audio.play('finish');
          this.audio.setMusic('results');
          this.effects.confetti(k.pos);
          this._autoFillT = RACE.finishAutoFill;
          if (this.isTT) return this._finishTT();
        }
      }
      // AI keeps driving after finishing (victory lap)
    }
    if (this.player.finished) {
      this._autoFillT -= dt;
      const allDone = this.karts.every(k => k.finished);
      if (allDone || this._autoFillT <= 0) this._finishRace();
    }
  }

  _finishRace() {
    if (this.state === 'done') return;
    this.state = 'done';
    this._updateRanks();
    const results = this._sorted.map(k => ({
      name: k.name, charId: k.character.id, isPlayer: k.isPlayer,
      time: k.finished ? k.finishTime : null, rank: k.rank,
    }));
    this.onComplete && this.onComplete({ mode: this.mode, results });
  }

  _finishTT() {
    this.state = 'done';
    const t = this.player.finishTime;
    const frames = this.recorder.frames;
    const prevBest = this.ghostTime ?? null;
    const charId = this.player.character.id;
    // saveGhost now accepts charId directly — no double-write needed
    const isRecord = saveGhost(this.opts.trackDef.id, t, frames, charId) ||
      (prevBest === null);
    this.onComplete && this.onComplete({
      mode: 'tt', time: t, best: prevBest === null ? t : Math.min(prevBest, t),
      newRecord: prevBest === null || t < prevBest,
    });
  }

  _finishBattle(reason) {
    if (this.state === 'done') return;
    this.state = 'done';
    const sorted = this.karts.slice().sort((a, b) => {
      const av = (a.eliminated ? 0 : 1), bv = (b.eliminated ? 0 : 1);
      if (av !== bv) return bv - av;
      if (a.balloons !== b.balloons) return b.balloons - a.balloons;
      return b.battleScore - a.battleScore;
    });
    const results = sorted.map((k, i) => ({
      name: k.name, charId: k.character.id, isPlayer: k.isPlayer,
      balloons: k.balloons, score: k.battleScore, rank: i + 1,
    }));
    this.onComplete && this.onComplete({ mode: 'battle', reason, results });
  }

  // ----------------------------------------------------------
  _updateCamera(dt) {
    const k = this.player;
    const back = 8.5, height = 3.6;
    // follow travel direction a touch during drifts for the slide feel
    const camAngle = dampAngle(this._camAngle ?? k.heading,
      (k.driftState === 'drift' || k.driftState === 'slide')
        ? (k.heading + (k.travel - k.heading) * 0.5) : k.heading,
      5.5, dt);
    this._camAngle = camAngle;

    const tx = k.pos.x - Math.sin(camAngle) * back;
    const tz = k.pos.z - Math.cos(camAngle) * back;
    const ty = k.pos.y + height;
    this._camPos.x = damp(this._camPos.x, tx, 10, dt);
    this._camPos.y = damp(this._camPos.y, ty, 7, dt);
    this._camPos.z = damp(this._camPos.z, tz, 10, dt);
    this.camera.position.copy(this._camPos);

    this._camLook.x = damp(this._camLook.x, k.pos.x + Math.sin(camAngle) * 4, 14, dt);
    this._camLook.y = damp(this._camLook.y, k.pos.y + 1.4, 14, dt);
    this._camLook.z = damp(this._camLook.z, k.pos.z + Math.cos(camAngle) * 4, 14, dt);
    this.camera.lookAt(this._camLook);

    // FOV kick while boosting
    const targetFov = (k.boostTimer > 0 || k.bulletTimer > 0) ? 74 : 65;
    this.camera.fov = damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();
  }

  _updateHUD(dt) {
    const H = this.hud, p = this.player;
    if (this.isBattle) {
      H.setBattle(this.battleTimer, p.balloons, p.battleScore);
    } else {
      H.setLap(Math.min(p.lap, this.track.laps), this.track.laps);
      H.setPos(p.rank, this.karts.length);
      H.setCoins(p.coins);
      if (this.isTT) H.setTimer(this.raceTime, this.ghostTime);
    }
    H.setSpeed(Math.abs(p.speed) * 4.4); // vanity km/h
    H.setItem(p, dt);
    H.wrongWay(p.wrongWayTimer > PHYS.wrongWayTime);
    H.drawMinimap(this.track, this.karts, p);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.items.dispose();
    if (this.ghost) this.ghost.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }
}
