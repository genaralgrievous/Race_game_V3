// ============================================================
// Time Trial ghosts: record positional data over time, save the
// best run per track to localStorage, replay as a translucent kart.
// ============================================================
import * as THREE from 'three';

const KEY = (trackId) => `cometkarts-ghost-${trackId}`;
const SAMPLE_DT = 1 / 12;

export class GhostRecorder {
  constructor(kart) {
    this.kart = kart;
    this.frames = [];   // [t, x, y, z, heading]
    this._acc = 0;
  }
  update(dt, raceTime) {
    this._acc += dt;
    if (this._acc < SAMPLE_DT) return;
    this._acc = 0;
    const k = this.kart;
    this.frames.push([
      Math.round(raceTime * 1000) / 1000,
      Math.round(k.pos.x * 100) / 100,
      Math.round(k.pos.y * 100) / 100,
      Math.round(k.pos.z * 100) / 100,
      Math.round(k.heading * 1000) / 1000,
    ]);
  }
}

export function loadGhost(trackId) {
  try {
    const raw = localStorage.getItem(KEY(trackId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.frames || !data.frames.length) return null;
    return data; // { time, frames, name }
  } catch { return null; }
}

export function saveGhost(trackId, time, frames, charId) {
  try {
    const existing = loadGhost(trackId);
    if (existing && existing.time <= time) return false;
    localStorage.setItem(KEY(trackId), JSON.stringify({ time, frames, charId }));
    return true;
  } catch { return false; }
}

export function bestTime(trackId) {
  const g = loadGhost(trackId);
  return g ? g.time : null;
}

export class GhostPlayer {
  constructor(scene, data, character) {
    this.data = data;
    this.scene = scene;
    this.mesh = this._buildMesh(character);
    scene.add(this.mesh);
    this._i = 0;
  }

  _buildMesh(character) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({
      color: character ? character.color : 0xaad4ff,
      transparent: true, opacity: 0.42, depthWrite: false,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.7), mat);
    chassis.position.y = 0.55;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat);
    helmet.position.set(0, 1.75, -0.25);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.5), mat);
    torso.position.set(0, 1.15, -0.25);
    g.add(chassis, helmet, torso);
    return g;
  }

  update(raceTime) {
    const f = this.data.frames;
    if (!f.length) return;
    while (this._i < f.length - 2 && f[this._i + 1][0] < raceTime) this._i++;
    const a = f[this._i], b = f[Math.min(this._i + 1, f.length - 1)];
    const span = Math.max(b[0] - a[0], 1e-4);
    const t = Math.min(Math.max((raceTime - a[0]) / span, 0), 1);
    this.mesh.position.set(
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] + (b[3] - a[3]) * t);
    let dh = b[4] - a[4];
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.mesh.rotation.y = a[4] + dh * t;
  }

  dispose() { this.scene.remove(this.mesh); }
}
