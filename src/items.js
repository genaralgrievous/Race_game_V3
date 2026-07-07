// ============================================================
// ItemSystem: boxes, roulette (position-weighted RNG),
// projectiles (green/red/spiny shells), hazards (bananas),
// drag shields, and instant-effect items.
//
// Emits through the race event bus:
//   itemRoll, itemGet, itemUse, shoot, kartHit {attacker},
//   boxHit, coin, lightning, blast
// ============================================================
import * as THREE from 'three';
import { ITEMS, ITEM_ORDER, ITEM_WEIGHTS, BATTLE_ITEMS, ITEM_TUNING as T, PHYS } from './config.js';
import { weightedPick, rand, clamp, damp, dampAngle, angleDiff } from './utils.js';

export class ItemSystem {
  constructor(scene, track, karts, effects, events, opts = {}) {
    this.scene = scene;
    this.track = track;
    this.karts = karts;
    this.effects = effects;
    this.events = events;
    this.battle = !!opts.battle;

    this.projectiles = [];
    this.hazards = [];
    this.boxes = [];
    this._buildBoxes();

    // per-kart dragged item meshes
    this._dragMeshes = new Map();
  }

  // ----------------------------------------------------------
  _buildBoxes() {
    const geo = new THREE.BoxGeometry(1.7, 1.7, 1.7);
    for (const spot of this.track.itemBoxSpots) {
      const mat = new THREE.MeshLambertMaterial({
        color: 0x7fd8ff, transparent: true, opacity: 0.65,
        emissive: 0x3a86ff, emissiveIntensity: 0.5,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(spot);
      const q = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mesh.add(q);
      this.scene.add(mesh);
      this.boxes.push({ pos: spot, mesh, active: true, timer: 0, phase: rand(6) });
    }
  }

  // ----------------------------------------------------------
  // Roulette
  // ----------------------------------------------------------
  startRoll(kart) {
    kart.roulette = { t: T.rouletteTime, icons: 0 };
    this.events.emit('itemRoll', kart);
  }

  _resolveRoll(kart) {
    let id;
    if (this.battle) {
      const keys = Object.keys(BATTLE_ITEMS);
      id = weightedPick(keys, keys.map(k => BATTLE_ITEMS[k]));
    } else {
      const row = ITEM_WEIGHTS[clamp(kart.rank, 1, 8) - 1];
      id = weightedPick(ITEM_ORDER, row);
      // sanity fallbacks
      if (id === 'spiny' && kart.rank === 1) id = 'banana';
      if (id === 'red' && kart.rank === 1) id = 'green';
    }
    kart.item = id;
    kart.itemCount = id === 'mush3' ? 3 : 1;
    kart.roulette = null;
    this.events.emit('itemGet', kart, id);
  }

  // ----------------------------------------------------------
  // Use / drag logic — called each frame with that kart's controls.
  // ----------------------------------------------------------
  handleInput(kart, c, dt) {
    if (kart.roulette) {
      kart.roulette.t -= dt;
      if (kart.roulette.t <= 0) this._resolveRoll(kart);
      return;
    }
    if (!kart.item || kart.isStunned || kart.controlLock) return;

    const draggable = ['banana', 'green', 'red'].includes(kart.item);

    if (c.itemPressed) {
      if (draggable) {
        kart.dragging = true;
        this._ensureDragMesh(kart);
      } else {
        this._activate(kart, c);
      }
    }
    if (c.itemReleased && kart.dragging) {
      kart.dragging = false;
      this._removeDragMesh(kart);
      this._activate(kart, c);
    }
  }

  _activate(kart, c) {
    const id = kart.item;
    const back = c.brake; // hold brake/down to throw backwards / lob forward
    const consume = () => {
      kart.itemCount--;
      if (kart.itemCount <= 0) { kart.item = null; kart.itemCount = 0; }
    };

    switch (id) {
      case 'coin':
        kart.coins = Math.min(PHYS.coinMax, kart.coins + T.coinPickup);
        kart.applyBoost(0.35, 1.1);
        this.effects.coinSparkle(kart.pos);
        this.events.emit('coin', kart);
        consume(); break;

      case 'banana':
        this._dropBanana(kart, back);
        consume(); break;

      case 'green':
        this._fireShell(kart, 'green', back);
        consume(); break;

      case 'red':
        this._fireShell(kart, 'red', back);
        consume(); break;

      case 'spiny':
        this._fireSpiny(kart);
        consume(); break;

      case 'mush':
      case 'mush3':
        kart.applyBoost(PHYS.mushroomBoostTime, 1.38);
        this.effects.boostBurst(kart);
        this.events.emit('itemUse', kart, 'mush');
        consume(); break;

      case 'golden':
        if (kart.goldenTimer <= 0) {
          kart.goldenTimer = PHYS.goldenTime;
        }
        kart.applyBoost(PHYS.mushroomBoostTime * 0.85, 1.38);
        this.effects.boostBurst(kart);
        this.events.emit('itemUse', kart, 'mush');
        // not consumed — expires with goldenTimer (see update)
        break;

      case 'star':
        kart.starTimer = PHYS.starTime;
        this.events.emit('itemUse', kart, 'star');
        consume(); break;

      case 'light':
        this._lightning(kart);
        consume(); break;

      case 'rocket':
        kart.bulletTimer = PHYS.bulletTime;
        this.events.emit('itemUse', kart, 'rocket');
        consume(); break;
    }
  }

  _dropBanana(kart, forward) {
    const a = kart.heading;
    const banana = {
      type: 'banana',
      pos: kart.pos.clone(),
      owner: kart,
      vel: null,
      vy: 0,
      mesh: this._bananaMesh(),
      age: 0,
    };
    if (forward) {
      // lob it ahead
      banana.pos.add(new THREE.Vector3(Math.sin(a) * 2, 1.5, Math.cos(a) * 2));
      banana.vel = new THREE.Vector3(Math.sin(a) * T.throwForwardArc, 0, Math.cos(a) * T.throwForwardArc);
      banana.vy = 9;
    } else {
      banana.pos.add(new THREE.Vector3(-Math.sin(a) * 3.2, 0.4, -Math.cos(a) * 3.2));
      // zero velocity but let gravity run: a banana dropped mid-air
      // (off a jump) must fall to the road instead of hovering
      banana.vel = new THREE.Vector3(0, 0, 0);
      banana.vy = 0;
    }
    banana.mesh.position.copy(banana.pos);
    this.scene.add(banana.mesh);
    this.hazards.push(banana);
    this.events.emit('shoot', kart, 'banana');
  }

  _bananaMesh() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.22, 8, 10, Math.PI * 1.2),
      new THREE.MeshLambertMaterial({ color: 0xf7d94c }));
    b.rotation.x = Math.PI / 2; b.rotation.z = Math.PI * 0.9;
    b.position.y = 0.35;
    g.add(b);
    return g;
  }

  _shellMesh(color) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 8),
      new THREE.MeshLambertMaterial({ color }));
    shell.scale.y = 0.7;
    shell.position.y = 0.5;
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
      new THREE.MeshLambertMaterial({ color: 0xf2e8cf }));
    rim.scale.y = 0.7;
    rim.position.y = 0.5;
    g.add(shell, rim);
    return g;
  }

  _fireShell(kart, type, back) {
    // back-thrown reds become straight backward shots (classic behavior)
    const dir = back ? kart.heading + Math.PI : kart.heading;
    const speed = type === 'green' ? T.greenSpeed : T.redSpeed;
    const proj = {
      type,
      pos: kart.pos.clone().add(new THREE.Vector3(
        Math.sin(back ? kart.heading + Math.PI : kart.heading) * 2.4, 0.2,
        Math.cos(back ? kart.heading + Math.PI : kart.heading) * 2.4)),
      heading: dir,
      speed,
      owner: kart,
      age: 0,
      bounces: 0,
      cont: kart.progressCont,
      target: null,
      mesh: this._shellMesh(type === 'green' ? 0x35b04a : 0xd8433b),
      backFired: back,
    };
    if (type === 'red' && !back && !this.battle) {
      proj.target = this._kartAhead(kart);
    } else if (type === 'red' && this.battle) {
      proj.target = this._nearestOpponent(kart);
    }
    proj.mesh.position.copy(proj.pos);
    this.scene.add(proj.mesh);
    this.projectiles.push(proj);
    this.events.emit('shoot', kart, type);
  }

  _fireSpiny(kart) {
    const leader = this.karts.filter(k => !k.finished && k !== kart)
      .sort((a, b) => a.rank - b.rank)[0];
    const proj = {
      type: 'spiny',
      pos: kart.pos.clone().add(new THREE.Vector3(0, 2.5, 0)),
      heading: kart.heading,
      speed: T.spinySpeed,
      owner: kart,
      age: 0,
      cont: kart.progressCont,
      target: leader || null,
      state: 'fly', // fly -> dive
      diveT: 0,
      mesh: this._shellMesh(0x2f6fd8),
    };
    const wing = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.9, 4),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    wing.rotation.z = Math.PI / 2; wing.position.set(0, 0.6, -0.6);
    proj.mesh.add(wing);
    this.scene.add(proj.mesh);
    this.projectiles.push(proj);
    this.events.emit('shoot', kart, 'spiny');
  }

  _lightning(user) {
    this.events.emit('lightning', user);
    for (const k of this.karts) {
      if (k === user || k.finished) continue;
      if (k.squash(this.events)) {
        this.events.emit('kartHit', { victim: k, attacker: user, type: 'light' });
      }
    }
  }

  _kartAhead(kart) {
    // nearest kart with a better rank (rank-1 ideally)
    let best = null, bestRank = -Infinity;
    for (const k of this.karts) {
      if (k === kart || k.finished) continue;
      if (k.rank < kart.rank && k.rank > bestRank) { best = k; bestRank = k.rank; }
    }
    return best;
  }

  _nearestOpponent(kart) {
    let best = null, bestD = Infinity;
    for (const k of this.karts) {
      if (k === kart || k.eliminated) continue;
      const d = k.pos.distanceToSquared(kart.pos);
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  }

  // ----------------------------------------------------------
  // Drag shield visuals + collision anchor
  // ----------------------------------------------------------
  _ensureDragMesh(kart) {
    if (this._dragMeshes.has(kart)) return;
    const mesh = kart.item === 'banana'
      ? this._bananaMesh()
      : this._shellMesh(kart.item === 'green' ? 0x35b04a : 0xd8433b);
    this.scene.add(mesh);
    this._dragMeshes.set(kart, mesh);
  }

  _removeDragMesh(kart) {
    const m = this._dragMeshes.get(kart);
    if (m) { this.scene.remove(m); this._disposeMesh(m); this._dragMeshes.delete(kart); }
  }

  dragPoint(kart) {
    const a = kart.heading;
    return new THREE.Vector3(
      kart.pos.x - Math.sin(a) * T.dragOffset,
      kart.pos.y + 0.4,
      kart.pos.z - Math.cos(a) * T.dragOffset);
  }

  // consume a dragged item (blocked a shell / hit a kart)
  _consumeDragged(kart) {
    kart.dragging = false;
    kart.itemCount = 0;
    kart.item = null;
    this._removeDragMesh(kart);
  }

  // ----------------------------------------------------------
  // Per-frame update
  // ----------------------------------------------------------
  update(dt, time) {
    // golden mushroom expiry
    for (const k of this.karts) {
      if (k.item === 'golden' && k.goldenTimer <= 0 && k._goldenStarted) {
        k.item = null; k.itemCount = 0; k._goldenStarted = false;
      }
      if (k.item === 'golden' && k.goldenTimer > 0) k._goldenStarted = true;
    }

    // ---- item boxes ----
    for (const box of this.boxes) {
      if (!box.active) {
        box.timer -= dt;
        if (box.timer <= 0) { box.active = true; box.mesh.visible = true; box.mesh.scale.set(0.01, 0.01, 0.01); }
        continue;
      }
      const s = Math.min(1, box.mesh.scale.x + dt * 3);
      box.mesh.scale.set(s, s, s);
      box.mesh.rotation.x = time * 1.3 + box.phase;
      box.mesh.rotation.y = time * 1.7 + box.phase;
      box.mesh.position.y = box.pos.y + Math.sin(time * 2 + box.phase) * 0.25;

      for (const k of this.karts) {
        if (k.finished || k.eliminated) continue;
        if (k.item || k.roulette) continue;
        if (k.pos.distanceToSquared(box.mesh.position) < 2.4 * 2.4) {
          box.active = false;
          box.timer = T.boxRespawn;
          box.mesh.visible = false;
          this.startRoll(k);
          this.effects.hitPoof(box.mesh.position, 0x7fd8ff);
          this.events.emit('boxHit', k);
          break;
        }
      }
    }

    // ---- dragged items follow their kart ----
    for (const [kart, mesh] of this._dragMeshes) {
      if (!kart.dragging || kart.isStunned) {
        // stunned karts drop what they were dragging
        if (kart.isStunned && kart.item) {
          if (kart.item === 'banana') this._dropBanana(kart, false);
          kart.item = null; kart.itemCount = 0;
        }
        this._consumeDragged(kart);
        continue;
      }
      mesh.position.copy(this.dragPoint(kart));
      mesh.rotation.y = kart.heading;
    }

    // ---- hazards (bananas) ----
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.age += dt;
      // flying (lobbed) bananas
      if (h.vel) {
        h.vy -= PHYS.gravity * dt;
        h.pos.x += h.vel.x * dt;
        h.pos.y += h.vy * dt;
        h.pos.z += h.vel.z * dt;
        const info = this.track.roadInfo(h.pos);
        const gy = info.groundY;
        if (gy === null) { this._removeHazard(i); continue; }
        if (h.pos.y <= gy + 0.3) { h.pos.y = gy + 0.3; h.vel = null; }
        h.mesh.position.copy(h.pos);
      }
      // collide with karts
      for (const k of this.karts) {
        if (k.eliminated) continue;
        if (h.owner === k && h.age < 0.8) continue;
        if (k.pos.distanceToSquared(h.pos) < 1.8 * 1.8) {
          if (k.starTimer > 0 || k.bulletTimer > 0) {
            this.effects.hitPoof(h.pos, 0xf7d94c);
            this._removeHazard(i);
          } else if (this._shieldBlocks(k, h.pos)) {
            this._removeHazard(i);
          } else if (k.spinOut(this.events)) {
            this.events.emit('kartHit', { victim: k, attacker: h.owner, type: 'banana' });
            this.effects.hitPoof(h.pos, 0xf7d94c);
            this._removeHazard(i);
          }
          break;
        }
      }
    }

    // ---- projectiles ----
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      const alive = p.type === 'spiny' ? this._updateSpiny(p, dt) : this._updateShell(p, dt);
      if (!alive) { this._removeProjectile(i); continue; }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y += dt * 9;

      // vs dragged shields & karts
      let consumed = false;
      for (const k of this.karts) {
        if (k === p.owner && p.age < 0.5) continue;
        if (k.eliminated) continue;
        if (p.type === 'red' && k === p.owner && p.age < 1.2) continue;
        // shield first
        if (this._shieldBlocks(k, p.pos)) { consumed = true; break; }
        if (k.pos.distanceToSquared(p.pos) < 2.1 * 2.1) {
          if (k.starTimer > 0 || k.bulletTimer > 0 || k.respawnTimer > 0) {
            consumed = true;
          } else if (k.tumble(this.events)) {
            this.events.emit('kartHit', { victim: k, attacker: p.owner, type: p.type });
            consumed = true;
          }
          break;
        }
      }
      if (consumed) {
        this.effects.hitPoof(p.pos, p.type === 'green' ? 0x35b04a : 0xd8433b);
        this._removeProjectile(i);
        continue;
      }

      // shells destroy bananas
      for (let hi = this.hazards.length - 1; hi >= 0; hi--) {
        if (this.hazards[hi].pos.distanceToSquared(p.pos) < 1.6 * 1.6) {
          this.effects.hitPoof(p.pos, 0xf7d94c);
          this._removeHazard(hi);
          this._removeProjectile(i);
          consumed = true;
          break;
        }
      }
    }
  }

  _shieldBlocks(kart, hitPos) {
    if (!kart.dragging) return false;
    const dp = this.dragPoint(kart);
    if (dp.distanceToSquared(hitPos) < 1.7 * 1.7) {
      this.effects.hitPoof(dp, 0xffffff);
      this.events.emit('shieldBlock', kart);
      this._consumeDragged(kart);
      return true;
    }
    return false;
  }

  _updateShell(p, dt) {
    if (p.age > (p.type === 'green' ? T.greenLife : T.redLife)) return false;

    if (p.type === 'red' && p.target && !p.target.finished && !p.target.eliminated) {
      const toT = Math.hypot(p.target.pos.x - p.pos.x, p.target.pos.z - p.pos.z);
      if (this.battle || toT < T.redHomingDist) {
        // direct homing
        const desired = Math.atan2(p.target.pos.x - p.pos.x, p.target.pos.z - p.pos.z);
        p.heading = dampAngle(p.heading, desired, 6, dt);
      } else {
        // follow the road centerline forward
        const sp = this.track.spline;
        p.cont = sp.continuousIndex(p.pos, Math.round(p.cont));
        const ahead = sp.pointAt((p.cont + 5) % sp.count);
        const desired = Math.atan2(ahead.x - p.pos.x, ahead.z - p.pos.z);
        p.heading = dampAngle(p.heading, desired, 8, dt);
      }
    }

    p.pos.x += Math.sin(p.heading) * p.speed * dt;
    p.pos.z += Math.cos(p.heading) * p.speed * dt;

    const info = this.track.roadInfo(p.pos, p.cont != null ? Math.round(p.cont) : null);
    p.cont = info.cont;   // keep the spline hint fresh or lateral goes stale after ~60 units
    if (info.groundY === null) return false; // fell off a floating track
    p.pos.y = info.groundY + 0.15;

    // green shells bounce off walls; despawn well off-road otherwise
    const absL = Math.abs(info.lateral);
    if (this.track.isArena) {
      const r = Math.hypot(p.pos.x, p.pos.z);
      const maxR = this.track.arenaRadius - 0.8;
      if (r > maxR) {
        // reflect off circular wall
        const nx = -p.pos.x / r, nz = -p.pos.z / r;
        const dx = Math.sin(p.heading), dz = Math.cos(p.heading);
        const dot = dx * nx + dz * nz;
        p.heading = Math.atan2(dx - 2 * dot * nx, dz - 2 * dot * nz);
        p.pos.x = -nx * maxR; p.pos.z = -nz * maxR;
        if (++p.bounces > T.greenBounces) return false;
      }
    } else if (this.track.walls || this.track.barrierAt(info.idx)) {
      if (absL > this.track.halfW - 0.6) {
        const left = this.track.spline.left(info.idx);
        const trackH = this.track.spline.heading(info.idx);
        const rel = angleDiff(p.heading, trackH);
        p.heading = trackH - rel; // mirror across track direction
        const s = Math.sign(info.lateral);
        p.pos.x -= left.x * (absL - (this.track.halfW - 0.7)) * s;
        p.pos.z -= left.z * (absL - (this.track.halfW - 0.7)) * s;
        if (++p.bounces > T.greenBounces) return false;
      }
    } else if (absL > this.track.halfW + 7) {
      return false; // rolled off into the scenery
    }
    return true;
  }

  _updateSpiny(p, dt) {
    if (p.age > 14) return false;
    const sp = this.track.spline;
    if (!p.target || p.target.finished) {
      p.target = this.karts.filter(k => !k.finished && k !== p.owner).sort((a, b) => a.rank - b.rank)[0];
      if (!p.target) return false;
    }
    const t = p.target;
    const distXZ = Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z);

    if (p.state === 'fly') {
      // race along the spline toward the leader, hovering
      p.cont = sp.continuousIndex(p.pos, Math.round(p.cont));
      const ahead = sp.pointAt((p.cont + 7) % sp.count);
      let desired = Math.atan2(ahead.x - p.pos.x, ahead.z - p.pos.z);
      if (distXZ < 30) desired = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      p.heading = dampAngle(p.heading, desired, 5, dt);
      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += Math.cos(p.heading) * p.speed * dt;
      const info = this.track.roadInfo(p.pos, Math.round(p.cont));
      const gy = info.groundY ?? p.pos.y - 3;
      p.pos.y = damp(p.pos.y, gy + 4.5, 5, dt);
      if (distXZ < 6) { p.state = 'dive'; p.diveT = 0.55; }
    } else {
      // hover above the target, then slam down
      p.diveT -= dt;
      p.pos.x = damp(p.pos.x, t.pos.x, 10, dt);
      p.pos.z = damp(p.pos.z, t.pos.z, 10, dt);
      p.pos.y = damp(p.pos.y, t.pos.y + (p.diveT > 0.18 ? 4.5 : 0.5), 8, dt);
      if (p.diveT <= 0) {
        this._explode(p);
        return false;
      }
    }
    return true;
  }

  _explode(p) {
    this.effects.explosion(p.pos.clone(), 7, 0x6fa8ff);
    this.events.emit('blast', p.pos);
    for (const k of this.karts) {
      if (k.eliminated) continue;
      const d = Math.hypot(k.pos.x - p.pos.x, k.pos.z - p.pos.z);
      if (d < T.spinyBlastRadius) {
        if (k.tumble(this.events, k === p.target ? 1.4 : 1)) {
          this.events.emit('kartHit', { victim: k, attacker: p.owner, type: 'spiny' });
        }
      }
    }
  }

  // Free GPU buffers — scene.remove alone leaks geometries/materials
  // across races (three.js dispose contract).
  _disposeMesh(m) {
    m.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(x => x.dispose());
        else o.material.dispose();
      }
    });
  }

  _removeProjectile(i) {
    this.scene.remove(this.projectiles[i].mesh);
    this._disposeMesh(this.projectiles[i].mesh);
    this.projectiles.splice(i, 1);
  }

  _removeHazard(i) {
    this.scene.remove(this.hazards[i].mesh);
    this._disposeMesh(this.hazards[i].mesh);
    this.hazards.splice(i, 1);
  }

  dispose() {
    for (const p of this.projectiles) { this.scene.remove(p.mesh); this._disposeMesh(p.mesh); }
    for (const h of this.hazards) { this.scene.remove(h.mesh); this._disposeMesh(h.mesh); }
    for (const b of this.boxes) { this.scene.remove(b.mesh); this._disposeMesh(b.mesh); }
    for (const [, m] of this._dragMeshes) { this.scene.remove(m); this._disposeMesh(m); }
  }
}
