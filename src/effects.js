// ============================================================
// Effects: pooled particle systems + kart auras.
// Two THREE.Points pools (small/large particles) plus a few
// reusable blast spheres. Cheap and allocation-free per frame.
// ============================================================
import * as THREE from 'three';
import { DRIFT_COLORS } from './kart.js';
import { rand, clamp } from './utils.js';

const POOL_SMALL = 700;
const POOL_LARGE = 260;

class ParticlePool {
  constructor(scene, count, size) {
    this.count = count;
    this.baseSize = size;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.origCol = new Float32Array(count * 3); // store original color for proper fade
    this.sizes = new Float32Array(count); // per-particle size
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    // Fill sizes with base size
    this.sizes.fill(size);
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    // park everything far underground
    for (let i = 0; i < count; i++) this.pos[i * 3 + 1] = -999;
  }

  spawn(x, y, z, vx, vy, vz, color, life, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = _c.set(color);
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.origCol[i * 3] = c.r; this.origCol[i * 3 + 1] = c.g; this.origCol[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = gravity;
    this.sizes[i] = this.baseSize;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // Frame-rate independent fade: use life ratio for consistent color
      const lifeRatio = clamp(this.life[i] / this.maxLife[i], 0, 1);
      this.col[i * 3] = this.origCol[i * 3] * lifeRatio;
      this.col[i * 3 + 1] = this.origCol[i * 3 + 1] * lifeRatio;
      this.col[i * 3 + 2] = this.origCol[i * 3 + 2] * lifeRatio;
      // Size attenuation: shrink over lifetime
      this.sizes[i] = this.baseSize * (0.3 + 0.7 * lifeRatio);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
  }
}

const _c = new THREE.Color();

export class Effects {
  constructor(scene, trackTheme) {
    this.scene = scene;
    this._trackTheme = trackTheme || 'default'; // 'default', 'ice', 'sand', 'lava', 'space'
    this.small = new ParticlePool(scene, POOL_SMALL, 0.38);
    this.large = new ParticlePool(scene, POOL_LARGE, 1.05);

    // blast spheres (explosions)
    this.blasts = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.8, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.blasts.push({ mesh: m, t: 0, max: 0, radius: 1 });
    }

    // boost flame cones, one pair per kart, attached lazily
    this._flames = new Map(); // kart -> [cone, cone]
  }

  attachKart(kart) {
    const cones = [];
    for (const ex of kart.exhausts) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 1.0, 8),
        new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.9, depthWrite: false }));
      cone.rotation.x = -Math.PI / 2.4 - Math.PI / 2;
      cone.position.copy(ex.position).add(new THREE.Vector3(0, 0.15, -0.55));
      cone.visible = false;
      kart.body.add(cone);
      cones.push(cone);
    }
    this._flames.set(kart, cones);
  }

  // Called per frame per kart: sparks, smoke, flames.
  kartAuras(kart, dt, time) {
    // drift sparks at rear wheels
    if (kart.driftState === 'drift' && kart.grounded && kart.driftTier > 0) {
      const color = DRIFT_COLORS[kart.driftTier - 1];
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? 1 : -1;
        const a = kart.heading;
        const bx = kart.pos.x - Math.sin(a) * 1.1 + Math.cos(a) * 0.95 * side;
        const bz = kart.pos.z - Math.cos(a) * 1.1 - Math.sin(a) * 0.95 * side;
        if (Math.random() < 0.75) {
          this.small.spawn(bx, kart.pos.y + 0.25, bz,
            rand(-3, 3) - Math.sin(a) * 6, rand(1.5, 4.5), rand(-3, 3) - Math.cos(a) * 6,
            color, rand(0.18, 0.4), 9);
        }
      }
    }
    // drift smoke (any drift, even uncharged)
    if (kart.driftState === 'drift' && kart.grounded && Math.random() < 0.5) {
      const a = kart.heading;
      this.small.spawn(
        kart.pos.x - Math.sin(a) * 1.2 + rand(-0.8, 0.8),
        kart.pos.y + 0.2,
        kart.pos.z - Math.cos(a) * 1.2 + rand(-0.8, 0.8),
        rand(-1, 1), rand(0.5, 1.5), rand(-1, 1),
        0xcccccc, rand(0.3, 0.6), 0);
    }
    // boost flames
    const cones = this._flames.get(kart);
    if (cones) {
      const on = kart.boostTimer > 0 || kart.bulletTimer > 0;
      for (const c of cones) {
        c.visible = on;
        if (on) {
          const flick = 0.75 + Math.sin(time * 40 + kart.index) * 0.3;
          c.scale.set(1, flick * 1.4, 1);
          c.material.color.setHSL(0.08 + Math.sin(time * 30) * 0.03, 1, 0.6);
        }
      }
      if (on && Math.random() < 0.6) {
        const a = kart.heading;
        this.small.spawn(
          kart.pos.x - Math.sin(a) * 1.6, kart.pos.y + 0.6, kart.pos.z - Math.cos(a) * 1.6,
          -Math.sin(a) * 8 + rand(-1.5, 1.5), rand(0, 1.5), -Math.cos(a) * 8 + rand(-1.5, 1.5),
          0xffa726, rand(0.15, 0.35), 0);
      }
    }
    // star sparkles
    if (kart.starTimer > 0 && Math.random() < 0.5) {
      _c.setHSL(Math.random(), 0.9, 0.65);
      this.small.spawn(
        kart.pos.x + rand(-1, 1), kart.pos.y + rand(0.3, 1.8), kart.pos.z + rand(-1, 1),
        rand(-1, 1), rand(1, 3), rand(-1, 1), _c.getHex(), rand(0.3, 0.6), 0);
    }
    // Environment-specific particles: surface kick-up while driving fast
    if (kart.grounded && Math.abs(kart.speed) > 20 && Math.random() < 0.35) {
      const a = kart.heading;
      const trackTheme = this._trackTheme;
      // Determine particle color from track theme
      let dustColor = 0x886644; // default brown dust
      if (trackTheme === 'ice') dustColor = 0xd8eeff;      // snow powder
      else if (trackTheme === 'sand') dustColor = 0xe6c078; // sand spray
      else if (trackTheme === 'lava') dustColor = 0x553322; // ash
      else if (trackTheme === 'space') dustColor = 0x7755cc; // cosmic dust

      this.small.spawn(
        kart.pos.x - Math.sin(a) * 1.2 + rand(-0.6, 0.6),
        kart.pos.y + 0.1,
        kart.pos.z - Math.cos(a) * 1.2 + rand(-0.6, 0.6),
        rand(-0.5, 0.5), rand(0.3, 1.2), rand(-0.5, 0.5),
        dustColor, rand(0.25, 0.5), 2);
    }
  }

  boostBurst(kart) {
    const a = kart.heading;
    for (let i = 0; i < 14; i++) {
      this.small.spawn(
        kart.pos.x - Math.sin(a) * 1.4, kart.pos.y + 0.5, kart.pos.z - Math.cos(a) * 1.4,
        -Math.sin(a) * rand(6, 14) + rand(-3, 3), rand(0, 3), -Math.cos(a) * rand(6, 14) + rand(-3, 3),
        0xffd23f, rand(0.25, 0.5), 2);
    }
  }

  explosion(pos, radius = 6, color = 0xffb347) {
    for (const b of this.blasts) {
      if (b.t > 0) continue;
      b.t = 0.5; b.max = 0.5; b.radius = radius;
      b.mesh.visible = true;
      b.mesh.position.copy(pos);
      b.mesh.material.color.set(color);
      break;
    }
    for (let i = 0; i < 26; i++) {
      const a = rand(Math.PI * 2), r = rand(2, 9);
      this.large.spawn(pos.x, pos.y + 0.5, pos.z,
        Math.cos(a) * r, rand(3, 11), Math.sin(a) * r,
        Math.random() < 0.5 ? 0xff8b3d : 0x54432a, rand(0.4, 0.9), 12);
    }
  }

  hitPoof(pos, color = 0xffffff) {
    for (let i = 0; i < 12; i++) {
      const a = rand(Math.PI * 2);
      this.small.spawn(pos.x, pos.y + 0.6, pos.z,
        Math.cos(a) * rand(2, 6), rand(2, 6), Math.sin(a) * rand(2, 6),
        color, rand(0.3, 0.55), 8);
    }
  }

  coinSparkle(pos) {
    for (let i = 0; i < 8; i++) {
      this.small.spawn(pos.x + rand(-0.5, 0.5), pos.y + 0.8, pos.z + rand(-0.5, 0.5),
        rand(-2, 2), rand(2, 5), rand(-2, 2), 0xffd23f, rand(0.3, 0.5), 6);
    }
  }

  confetti(pos, count = 60) {
    for (let i = 0; i < count; i++) {
      _c.setHSL(Math.random(), 0.85, 0.6);
      this.large.spawn(pos.x + rand(-4, 4), pos.y + rand(4, 9), pos.z + rand(-4, 4),
        rand(-3, 3), rand(-1, 3), rand(-3, 3), _c.getHex(), rand(1.2, 2.4), 4);
    }
  }

  trickFlash(kart) {
    for (let i = 0; i < 10; i++) {
      this.small.spawn(kart.pos.x + rand(-1, 1), kart.pos.y + rand(0, 1.5), kart.pos.z + rand(-1, 1),
        rand(-3, 3), rand(1, 4), rand(-3, 3), 0x7ce7ff, rand(0.25, 0.45), 0);
    }
  }

  update(dt) {
    this.small.update(dt);
    this.large.update(dt);
    for (const b of this.blasts) {
      if (b.t <= 0) { b.mesh.visible = false; continue; }
      b.t -= dt;
      const f = 1 - b.t / b.max;
      const s = 0.4 + f * b.radius;
      b.mesh.scale.set(s, s, s);
      b.mesh.material.opacity = 0.85 * (1 - f);
      if (b.t <= 0) b.mesh.visible = false;
    }
  }
}
