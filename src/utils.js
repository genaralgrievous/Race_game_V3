// ============================================================
// Math helpers + arc-length-sampled closed Catmull-Rom spline.
// ============================================================
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Frame-rate independent exponential damping.
export const damp = (current, target, rate, dt) =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export const dampAngle = (current, target, rate, dt) =>
  current + wrapAngle(target - current) * (1 - Math.exp(-rate * dt));

export const angleDiff = (a, b) => wrapAngle(a - b);

// Weighted random pick: weights is {key: weight} or parallel arrays.
export function weightedPick(keys, weights) {
  let total = 0;
  for (const w of weights) total += w;
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fmtTime = (t) => {
  if (t == null || !isFinite(t)) return "--:--.---";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t * 1000) % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};


// Simpler, correct ordinal suffix.
export function posSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
}

// ============================================================
// Closed Catmull-Rom spline sampled at ~equal arc length.
// Control points: [x, z, y?] arrays. Y is elevation (defaults 0).
// ============================================================
export class Spline {
  constructor(controlPoints, samplesPerSegment = 22) {
    this.cps = controlPoints.map(p => new THREE.Vector3(p[0], p[2] || 0, p[1]));
    const n = this.cps.length;

    // Dense pre-sampling.
    const dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = this.cps[(i - 1 + n) % n];
      const p1 = this.cps[i];
      const p2 = this.cps[(i + 1) % n];
      const p3 = this.cps[(i + 2) % n];
      for (let j = 0; j < samplesPerSegment; j++) {
        const t = j / samplesPerSegment;
        dense.push(catmullRom(p0, p1, p2, p3, t));
      }
    }

    // Resample to uniform arc length.
    let total = 0;
    const lens = [0];
    for (let i = 1; i <= dense.length; i++) {
      total += dense[i % dense.length].distanceTo(dense[i - 1]);
      lens.push(total);
    }
    this.totalLength = total;

    const targetCount = Math.max(200, Math.round(total / 1.6)); // one sample every ~1.6 units
    this.samples = [];
    let di = 0;
    for (let i = 0; i < targetCount; i++) {
      const targetLen = (i / targetCount) * total;
      while (di < dense.length - 1 && lens[di + 1] < targetLen) di++;
      const segLen = lens[di + 1] - lens[di] || 1e-6;
      const f = (targetLen - lens[di]) / segLen;
      const a = dense[di], b = dense[(di + 1) % dense.length];
      this.samples.push(a.clone().lerp(b, f));
    }
    this.count = this.samples.length;
    this.segLength = total / this.count;

    // Direction (unit, horizontal-ish), left normal, curvature per sample.
    this.dirs = []; this.lefts = []; this.curvatures = []; this.headings = [];
    for (let i = 0; i < this.count; i++) {
      const a = this.samples[i];
      const b = this.samples[(i + 1) % this.count];
      const d = b.clone().sub(a);
      const dh = new THREE.Vector3(d.x, 0, d.z).normalize();
      this.dirs.push(d.normalize());
      this.lefts.push(new THREE.Vector3(dh.z, 0, -dh.x)); // left of travel dir
      this.headings.push(Math.atan2(dh.x, dh.z));
    }
    for (let i = 0; i < this.count; i++) {
      const h0 = this.headings[(i - 2 + this.count) % this.count];
      const h1 = this.headings[(i + 2) % this.count];
      this.curvatures.push(wrapAngle(h1 - h0) / (4 * this.segLength));
    }
  }

  point(i) { return this.samples[((i % this.count) + this.count) % this.count]; }
  dir(i) { return this.dirs[((i % this.count) + this.count) % this.count]; }
  left(i) { return this.lefts[((i % this.count) + this.count) % this.count]; }
  heading(i) { return this.headings[((i % this.count) + this.count) % this.count]; }
  curvature(i) { return this.curvatures[((i % this.count) + this.count) % this.count]; }

  // Interpolated point at fractional index.
  pointAt(f) {
    const i = Math.floor(f);
    const t = f - i;
    return this.point(i).clone().lerp(this.point(i + 1), t);
  }

  // Find nearest sample index. With a hint, only searches locally (fast path).
  nearest(pos, hint = null, window = 30) {
    let best = -1, bestD = Infinity;
    if (hint != null) {
      for (let o = -window; o <= window; o++) {
        const i = ((hint + o) % this.count + this.count) % this.count;
        const d = pos.distanceToSquared(this.samples[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
      // If the local window found something reasonable, accept it.
      if (bestD < 60 * 60) return best;
    }
    for (let i = 0; i < this.count; i += 2) {
      const d = pos.distanceToSquared(this.samples[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  // Continuous index: nearest sample plus projection onto the next segment.
  continuousIndex(pos, hint = null) {
    const i = this.nearest(pos, hint);
    const a = this.point(i), b = this.point(i + 1);
    const ab = b.clone().sub(a);
    const t = clamp(pos.clone().sub(a).dot(ab) / (ab.lengthSq() || 1e-6), 0, 1);
    return (i + t) % this.count;
  }

  // Signed lateral offset from centerline (positive = left of travel dir).
  lateralOffset(pos, i) {
    const rel = pos.clone().sub(this.point(i));
    return rel.dot(this.left(i));
  }
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const out = new THREE.Vector3();
  out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  out.z = 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
  return out;
}
