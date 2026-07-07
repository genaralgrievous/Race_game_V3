// ============================================================
// Track: builds renderable geometry + collision/lookup queries
// from a plain-data track definition (see tracks.js).
//
// Track definition contract:
// {
//   id, name: string,
//   theme: {
//     skyTop, skyBottom: hex,   fog: {color, near, far}?,
//     ground: hex, road: hex, roadEdge: hex, rail: hex?,
//     sun: {color, intensity, dir:[x,y,z]}?, ambient: hex?
//   },
//   controlPoints: [[x, z, y?], ...]   // closed loop, y = elevation
//   width: number,                     // full road width
//   laps: number,
//   grip: number = 1,                  // surface grip (ice < 1)
//   walls: bool = false,               // road edges act as walls
//   floating: bool = false,            // offroad = fall + respawn
//   boostPads: [{t, len}]              // t = 0..1 along spline, len in units
//   itemBoxRows: [{t, count}],
//   decorations: [{type, x, z, s?}],   // explicit props
//   scatter: [{type, count, minDist, maxDist, s?}], // random props off-road
//   type: 'circuit' | 'arena',         // arena = battle mode
//   arenaRadius: number (arena only)
// }
// Decoration types: tree, palm, rock, pipe, building, cloud,
//                   cactus, crystal, cone, snowtree,
//                   pyramid, obelisk, umbrella, boat, lighthouse,
//                   mountain, flowers, torii, neonsign, lamppost
// theme.water (optional): { x, z, size, color, level } — a sea/lake
//   plane rendered at that height (place it off to one side).
// ============================================================
import * as THREE from 'three';
import { Spline, clamp, rand } from './utils.js';

const SHOULDER = 11;      // grass shoulder that follows road height
const BOX_ROW_SPACING = 3.2;

export class Track {
  constructor(def) {
    this.def = def;
    this.name = def.name;
    this.laps = def.laps || 3;
    this.width = def.width || 14;
    this.halfW = this.width / 2;
    this.grip = def.grip ?? 1;
    this.walls = !!def.walls;
    this.floating = !!def.floating;
    this.isArena = def.type === 'arena';

    this.group = new THREE.Group();
    this.obstacles = [];        // {x, z, r} collision circles
    this.itemBoxSpots = [];     // Vector3 positions
    this.boostSet = new Set();  // sample indices that are boost pads

    if (this.isArena) {
      this._buildArena(def);
    } else {
      this.spline = new Spline(def.controlPoints);
      this.N = this.spline.count;
      this._computeBarriers(def);
      this._buildRoad(def);
      this._buildBoostPads(def);
      this._buildItemBoxSpots(def);
    }
    this._buildGround(def);
    this._buildDecorations(def);
    this._buildSky(def);
  }

  // ----------------------------------------------------------
  // Queries
  // ----------------------------------------------------------

  // Main per-frame query for karts.
  // Returns { idx, cont, lateral, onRoad, groundY, heading }
  roadInfo(pos, hint = null) {
    if (this.isArena) {
      const r = Math.hypot(pos.x, pos.z);
      return {
        idx: 0, cont: 0, lateral: 0,
        onRoad: r < this.arenaRadius,
        groundY: 0,
        heading: 0,
      };
    }
    const cont = this.spline.continuousIndex(pos, hint);
    const idx = Math.floor(cont);
    const lateral = this.spline.lateralOffset(pos, idx);
    const roadY = this.spline.pointAt(cont).y;
    const absL = Math.abs(lateral);
    const onRoad = absL <= this.halfW;

    let groundY;
    if (absL <= this.halfW) {
      groundY = roadY;
    } else if (this.floating) {
      groundY = absL <= this.halfW + 1.2 ? roadY : null;  // null => falling
    } else {
      const f = clamp((absL - this.halfW) / SHOULDER, 0, 1);
      groundY = roadY * (1 - f);  // blend down to the base plane
    }
    return { idx, cont, lateral, onRoad, groundY, heading: this.spline.heading(idx) };
  }

  isBoostPad(idx, lateral) {
    return this.boostSet.has(((idx % this.N) + this.N) % this.N) && Math.abs(lateral) <= this.halfW;
  }

  // True when this stretch of road has a guard rail (physical barrier).
  barrierAt(idx) {
    if (!this._barrier) return false;
    return this._barrier[((idx % this.N) + this.N) % this.N] === 1;
  }

  // Mark samples that need a guard rail: everywhere on floating tracks
  // (their drawn rails should actually hold you), and any stretch of a
  // normal track that climbs above the surrounding terrain — driving
  // off a high crest shouldn't mean tumbling down the embankment.
  _computeBarriers(def) {
    const N = this.N;
    this._barrier = new Uint8Array(N);
    if (def.barriers === false) return;
    if (this.floating || this.walls) {
      this._barrier.fill(1);
      return;
    }
    const THRESHOLD = 2.4;   // road height above the base plane
    for (let i = 0; i < N; i++) {
      if (this.spline.point(i).y > THRESHOLD) this._barrier[i] = 1;
    }
    // dilate runs so rails begin a little before the climb and merge
    // nearby stretches into one continuous rail
    const PAD = 6;
    const src = this._barrier.slice();
    for (let i = 0; i < N; i++) {
      if (!src[i]) continue;
      for (let o = -PAD; o <= PAD; o++) this._barrier[((i + o) % N + N) % N] = 1;
    }
    // drop stubs too short to matter visually or physically
    const runs = this._barrierRuns();
    for (const [a, b, len] of runs) {
      if (len < 10) {
        for (let i = 0; i < len; i++) this._barrier[(a + i) % N] = 0;
      }
    }
  }

  // Contiguous barrier stretches as [startIdx, endIdx, length] (circular).
  _barrierRuns() {
    const N = this.N, B = this._barrier;
    const runs = [];
    if (!B) return runs;
    // find a gap to start scanning from (fully-railed track => one run)
    let start = -1;
    for (let i = 0; i < N; i++) if (!B[i]) { start = i; break; }
    if (start === -1) return [[0, N - 1, N]];
    let runStart = -1;
    for (let o = 0; o <= N; o++) {
      const i = (start + o) % N;
      if (B[i] && runStart === -1) runStart = i;
      else if (!B[i] && runStart !== -1) {
        const len = ((i - runStart) % N + N) % N;
        runs.push([runStart, ((i - 1) % N + N) % N, len]);
        runStart = -1;
      }
    }
    return runs;
  }

  // Push a kart out of static obstacles. Returns true if a hit happened.
  collideObstacles(kart) {
    let hit = false;
    for (const o of this.obstacles) {
      const dx = kart.pos.x - o.x, dz = kart.pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const minD = o.r + 1.2;
      if (d < minD && d > 1e-4) {
        const push = (minD - d);
        kart.pos.x += (dx / d) * push;
        kart.pos.z += (dz / d) * push;
        hit = true;
      }
    }
    return hit;
  }

  // Wall clamp (used when def.walls, and for arena boundary).
  clampToBounds(kart) {
    if (this.isArena) {
      const r = Math.hypot(kart.pos.x, kart.pos.z);
      const maxR = this.arenaRadius - 1.2;
      if (r > maxR) {
        kart.pos.x *= maxR / r; kart.pos.z *= maxR / r;
        return true;
      }
      return false;
    }
    const info = this.roadInfo(kart.pos, Math.round(kart.progressCont));
    if (!this.walls && !this.barrierAt(info.idx)) return false;
    // launched well above the rail (trick off a crest): sail over it
    const roadY = this.spline.point(info.idx).y;
    if (kart.pos.y > roadY + 2.3) return false;
    const limit = this.halfW - 0.9;
    if (Math.abs(info.lateral) > limit) {
      const left = this.spline.left(info.idx);
      const over = Math.abs(info.lateral) - limit;
      const s = Math.sign(info.lateral);
      kart.pos.x -= left.x * over * s;
      kart.pos.z -= left.z * over * s;
      return true;
    }
    return false;
  }

  // Grid of start positions behind the start line (sample 0).
  startPositions(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const idx = this.N - 8 - row * 5;
      const p = this.spline.point(idx).clone();
      const left = this.spline.left(idx);
      const off = (col === 0 ? 1 : -1) * this.halfW * 0.38;
      p.x += left.x * off; p.z += left.z * off;
      out.push({ pos: p, heading: this.spline.heading(idx), idx });
    }
    return out;
  }

  // ----------------------------------------------------------
  // Geometry builders
  // ----------------------------------------------------------
  _buildRoad(def) {
    const theme = def.theme;
    const N = this.N, sp = this.spline, hw = this.halfW;

    const pos = [], col = [], idxArr = [];
    const roadC = new THREE.Color(theme.road ?? 0x565a63);
    const roadC2 = roadC.clone().multiplyScalar(0.92);
    const up = 0.06;

    for (let i = 0; i <= N; i++) {
      const p = sp.point(i), left = sp.left(i);
      const c = (Math.floor(i / 6) % 2 === 0) ? roadC : roadC2;
      pos.push(p.x + left.x * hw, p.y + up, p.z + left.z * hw);
      pos.push(p.x - left.x * hw, p.y + up, p.z - left.z * hw);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      idxArr.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const road = new THREE.Mesh(geo, mat);
    road.name = 'road';
    this.group.add(road);

    // Curbs: alternating stripes on both edges.
    this._buildCurbs(def);
    // Start line.
    this._buildStartLine();
    // Rails: full loop on walled/floating tracks, otherwise guard rails
    // over the elevated stretches only.
    if (this.walls || this.floating) this._buildRails(def);
    else this._buildRailSegments(def);
  }

  _buildCurbs(def) {
    const N = this.N, sp = this.spline, hw = this.halfW;
    const cw = 1.15;
    const cA = new THREE.Color(def.theme.roadEdge ?? 0xd8433b);
    const cB = new THREE.Color(0xf2f2f2);
    for (const side of [1, -1]) {
      const pos = [], col = [], idxArr = [];
      for (let i = 0; i <= N; i++) {
        const p = sp.point(i), left = sp.left(i);
        const c = (Math.floor(i / 3) % 2 === 0) ? cA : cB;
        pos.push(p.x + left.x * hw * side, p.y + 0.09, p.z + left.z * hw * side);
        pos.push(p.x + left.x * (hw + cw) * side, p.y + 0.09, p.z + left.z * (hw + cw) * side);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        if (side === 1) idxArr.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        else idxArr.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idxArr);
      geo.computeVertexNormals();
      this.group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));
    }
  }

  _buildStartLine() {
    const sp = this.spline, hw = this.halfW;
    const cells = 8, rows = 2;
    const geo = new THREE.BufferGeometry();
    const pos = [], col = [], idxArr = [];
    let v = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cells; c++) {
        const i0 = r, i1 = r + 1;
        const p0 = sp.point(i0), p1 = sp.point(i1);
        const l0 = sp.left(i0), l1 = sp.left(i1);
        const f0 = -hw + (c / cells) * this.width;
        const f1 = -hw + ((c + 1) / cells) * this.width;
        const white = (r + c) % 2 === 0;
        const cc = white ? 0.95 : 0.08;
        const quad = [
          [p0.x + l0.x * f0, p0.y + 0.12, p0.z + l0.z * f0],
          [p0.x + l0.x * f1, p0.y + 0.12, p0.z + l0.z * f1],
          [p1.x + l1.x * f1, p1.y + 0.12, p1.z + l1.z * f1],
          [p1.x + l1.x * f0, p1.y + 0.12, p1.z + l1.z * f0],
        ];
        for (const q of quad) { pos.push(...q); col.push(cc, cc, cc); }
        idxArr.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    this.group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
  }

  _buildRails(def) {
    const N = this.N, sp = this.spline, hw = this.halfW;
    const railC = def.theme.rail ?? 0xffd23f;
    const mat = new THREE.MeshLambertMaterial({ color: railC, emissive: railC, emissiveIntensity: 0.25 });
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= N; i += 2) {
        const p = sp.point(i), left = sp.left(i);
        pts.push(new THREE.Vector3(
          p.x + left.x * (hw + 0.6) * side,
          p.y + 0.55,
          p.z + left.z * (hw + 0.6) * side));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      // tubularSegments must be an integer — N can be odd
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.floor(N / 2), 0.18, 6, true), mat);
      this.group.add(tube);
    }
  }

  // Guard rails over elevated stretches (non-walled, non-floating tracks).
  _buildRailSegments(def) {
    const runs = this._barrierRuns();
    if (!runs.length) return;
    const sp = this.spline, hw = this.halfW;
    const railC = def.theme.rail ?? 0xffd23f;
    const mat = new THREE.MeshLambertMaterial({ color: railC, emissive: railC, emissiveIntensity: 0.25 });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x777d88 });
    for (const [a, , len] of runs) {
      for (const side of [1, -1]) {
        const pts = [];
        for (let o = 0; o <= len; o += 2) {
          const i = (a + Math.min(o, len - 1)) % this.N;
          const p = sp.point(i), left = sp.left(i);
          pts.push(new THREE.Vector3(
            p.x + left.x * (hw + 0.6) * side,
            p.y + 0.55,
            p.z + left.z * (hw + 0.6) * side));
        }
        if (pts.length < 2) continue;
        const curve = new THREE.CatmullRomCurve3(pts, false);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, Math.max(2, pts.length * 2), 0.16, 6, false), mat);
        this.group.add(tube);
        // support posts every few samples
        for (let o = 2; o < len; o += 8) {
          const i = (a + o) % this.N;
          const p = sp.point(i), left = sp.left(i);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 5), postMat);
          post.position.set(
            p.x + left.x * (hw + 0.6) * side,
            p.y + 0.28,
            p.z + left.z * (hw + 0.6) * side);
          this.group.add(post);
        }
      }
    }
  }

  _buildBoostPads(def) {
    if (!def.boostPads) return;
    const sp = this.spline, N = this.N;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa726, side: THREE.DoubleSide });
    const mat2 = new THREE.MeshBasicMaterial({ color: 0xfff176, side: THREE.DoubleSide });
    for (const pad of def.boostPads) {
      const start = Math.floor(pad.t * N);
      const len = Math.max(2, Math.round((pad.len || 7) / sp.segLength));
      for (let o = 0; o < len; o++) this.boostSet.add((start + o) % N);
      // chevron quads
      for (let o = 0; o < len; o += 2) {
        const i = (start + o) % N;
        const p = sp.point(i), left = sp.left(i), d = sp.dir(i);
        const w = this.halfW * 0.85;
        const g = new THREE.PlaneGeometry(w * 2, sp.segLength * 1.9);
        const m = new THREE.Mesh(g, o % 4 === 0 ? mat : mat2);
        m.position.set(p.x + d.x, p.y + 0.11, p.z + d.z);
        // orient: rotate plane so its "up" follows track dir
        m.rotation.set(-Math.PI / 2, 0, -Math.atan2(d.x, d.z));
        this.group.add(m);
      }
    }
  }

  _buildItemBoxSpots(def) {
    const rows = def.itemBoxRows || [];
    const sp = this.spline, N = this.N;
    for (const row of rows) {
      const i = Math.floor(row.t * N) % N;
      const p = sp.point(i), left = sp.left(i);
      const count = row.count || 4;
      for (let c = 0; c < count; c++) {
        const f = (count === 1) ? 0 : (c / (count - 1) - 0.5) * 2;
        const off = f * (this.halfW - 2.2);
        this.itemBoxSpots.push(new THREE.Vector3(
          p.x + left.x * off, p.y + 1.1, p.z + left.z * off));
      }
    }
  }

  _buildArena(def) {
    this.arenaRadius = def.arenaRadius || 55;
    const R = this.arenaRadius;

    // Floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(R, 48),
      new THREE.MeshLambertMaterial({ color: def.theme.road ?? 0x565a63 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    this.group.add(floor);

    // Concentric ring markings
    for (const rr of [R * 0.33, R * 0.66]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rr - 0.4, rr + 0.4, 48),
        new THREE.MeshBasicMaterial({ color: def.theme.roadEdge ?? 0xd8433b }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.1;
      this.group.add(ring);
    }

    // Wall
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R + 0.7, R + 0.7, 2.4, 48, 1, true),
      new THREE.MeshLambertMaterial({ color: def.theme.rail ?? 0x8090b0, side: THREE.DoubleSide }));
    wall.position.y = 1.2;
    this.group.add(wall);

    // Item boxes: two rings
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.itemBoxSpots.push(new THREE.Vector3(Math.cos(a) * R * 0.5, 1.1, Math.sin(a) * R * 0.5));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      this.itemBoxSpots.push(new THREE.Vector3(Math.cos(a) * R * 0.82, 1.1, Math.sin(a) * R * 0.82));
    }

    // Center pillar obstacle
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4.6, 5, 16),
      new THREE.MeshLambertMaterial({ color: def.theme.roadEdge ?? 0xd8433b }));
    pillar.position.y = 2.5;
    this.group.add(pillar);
    this.obstacles.push({ x: 0, z: 0, r: 4.6 });
  }

  _buildGround(def) {
    if (!this.floating) {
      const c = def.theme.ground ?? 0x3f8f43;
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(1600, 1600, 1, 1),
        new THREE.MeshLambertMaterial({ color: c }));
      g.rotation.x = -Math.PI / 2;
      g.position.y = -0.02;
      this.group.add(g);
    }
    // Optional sea/lake plane off to one side of the map.
    const w = def.theme.water;
    if (w) {
      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(w.size ?? 900, w.size ?? 900, 1, 1),
        new THREE.MeshLambertMaterial({
          color: w.color ?? 0x2277cc, transparent: true, opacity: 0.88,
          emissive: w.color ?? 0x2277cc, emissiveIntensity: 0.15,
        }));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(w.x ?? 0, w.level ?? 0.1, w.z ?? 0);
      this.group.add(sea);
    }
  }

  _buildSky(def) {
    const top = new THREE.Color(def.theme.skyTop ?? 0x3a7bd5);
    const bottom = new THREE.Color(def.theme.skyBottom ?? 0xbfe3ff);
    const geo = new THREE.SphereGeometry(700, 20, 12);
    const col = [];
    const posAttr = geo.getAttribute('position');
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i) / 700; // -1..1
      const t = clamp((y + 0.25) / 0.9, 0, 1);
      const c = bottom.clone().lerp(top, t);
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false }));
    sky.name = 'sky';
    this.group.add(sky);
  }

  _buildDecorations(def) {
    const list = [...(def.decorations || [])];
    // Random scatter around the track, kept off the road.
    for (const sc of (def.scatter || [])) {
      let placed = 0, tries = 0;
      while (placed < sc.count && tries < sc.count * 30) {
        tries++;
        let x, z;
        if (this.isArena) {
          const a = rand(Math.PI * 2), r = this.arenaRadius + rand(6, 40);
          x = Math.cos(a) * r; z = Math.sin(a) * r;
        } else {
          const i = Math.floor(rand(this.N));
          const p = this.spline.point(i), left = this.spline.left(i);
          const side = Math.random() < 0.5 ? 1 : -1;
          const dist = rand(sc.minDist ?? this.halfW + 4, sc.maxDist ?? this.halfW + 45);
          x = p.x + left.x * dist * side;
          z = p.z + left.z * dist * side;
          // reject if actually near the road elsewhere
          const info = this.roadInfo(new THREE.Vector3(x, 0, z));
          if (Math.abs(info.lateral) < this.halfW + 3) continue;
        }
        list.push({ type: sc.type, x, z, s: sc.s ? sc.s * rand(0.75, 1.35) : rand(0.75, 1.35) });
        placed++;
      }
    }
    for (const d of list) this._addProp(d);
  }

  _addProp(d) {
    const s = d.s || 1;
    const g = new THREE.Group();
    g.position.set(d.x, 0, d.z);
    let collR = 0;
    const lam = (c, e = 0) => new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0x000000, emissiveIntensity: e });

    switch (d.type) {
      case 'tree': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 2.2 * s, 6), lam(0x7a4f2a));
        trunk.position.y = 1.1 * s;
        const fol = new THREE.Mesh(new THREE.ConeGeometry(2.1 * s, 3.6 * s, 7), lam(0x2f8f3e));
        fol.position.y = 3.6 * s;
        g.add(trunk, fol); collR = 1.1 * s; break;
      }
      case 'snowtree': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 1.8 * s, 6), lam(0x6b4b2a));
        trunk.position.y = 0.9 * s;
        const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.0 * s, 2.8 * s, 7), lam(0x2d6b4f));
        f1.position.y = 2.8 * s;
        const snow = new THREE.Mesh(new THREE.ConeGeometry(1.2 * s, 1.4 * s, 7), lam(0xf4fbff));
        snow.position.y = 4.3 * s;
        g.add(trunk, f1, snow); collR = 1.0 * s; break;
      }
      case 'palm': {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.42 * s, 4.4 * s, 6), lam(0xa0703c));
        trunk.position.y = 2.2 * s; trunk.rotation.z = 0.12;
        g.add(trunk);
        for (let i = 0; i < 5; i++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s, 3.4 * s, 4), lam(0x3aa653));
          const a = (i / 5) * Math.PI * 2;
          leaf.position.set(Math.cos(a) * 1.2 * s + 0.5, 4.4 * s, Math.sin(a) * 1.2 * s);
          leaf.rotation.set(Math.sin(a) * 1.25, 0, Math.cos(a) * 1.25 + 0.2);
          g.add(leaf);
        }
        collR = 0.8 * s; break;
      }
      case 'rock': {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 * s, 0), lam(0x8b8f98));
        rock.position.y = 0.8 * s;
        rock.rotation.set(rand(3), rand(3), rand(3));
        g.add(rock); collR = 1.5 * s; break;
      }
      case 'pipe': {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 2.6 * s, 12), lam(0x2fae4e));
        pipe.position.y = 1.3 * s;
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.45 * s, 1.45 * s, 0.6 * s, 12), lam(0x27913f));
        rim.position.y = 2.6 * s;
        g.add(pipe, rim); collR = 1.5 * s; break;
      }
      case 'building': {
        const h = (4 + rand(9)) * s;
        const b = new THREE.Mesh(new THREE.BoxGeometry(4 * s, h, 4 * s),
          lam(new THREE.Color().setHSL(rand(1), 0.25, 0.45).getHex()));
        b.position.y = h / 2;
        const win = new THREE.Mesh(new THREE.BoxGeometry(4.05 * s, h * 0.7, 4.05 * s),
          new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.25 }));
        win.position.y = h / 2;
        g.add(b, win); collR = 2.9 * s; break;
      }
      case 'cloud': {
        const m = lam(0xffffff);
        for (let i = 0; i < 3; i++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry((1.6 - i * 0.35) * s, 8, 6), m);
          puff.position.set((i - 1) * 1.8 * s, 18 + rand(14), rand(-1, 1));
          puff.scale.y = 0.6;
          g.add(puff);
        }
        collR = 0; break;
      }
      case 'cactus': {
        const m = lam(0x4c9e4c);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.6 * s, 3.4 * s, 8), m);
        body.position.y = 1.7 * s;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 1.6 * s, 8), m);
        arm.position.set(0.8 * s, 2.2 * s, 0); arm.rotation.z = -0.9;
        g.add(body, arm); collR = 0.9 * s; break;
      }
      case 'crystal': {
        const m = new THREE.MeshLambertMaterial({
          color: 0x9fd8ff, emissive: 0x5f9fff, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 });
        const c1 = new THREE.Mesh(new THREE.OctahedronGeometry(1.3 * s, 0), m);
        c1.position.y = 1.5 * s; c1.scale.y = 1.9; c1.rotation.y = rand(3);
        const c2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.7 * s, 0), m);
        c2.position.set(1.1 * s, 0.8 * s, 0.4 * s); c2.scale.y = 1.6;
        g.add(c1, c2); collR = 1.3 * s; break;
      }
      case 'cone': {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6 * s, 1.4 * s, 10), lam(0xe86a17));
        cone.position.y = 0.7 * s;
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.5 * s, 0.28 * s, 10), lam(0xffffff));
        stripe.position.y = 0.75 * s;
        g.add(cone, stripe); collR = 0.7 * s; break;
      }
      case 'pyramid': {
        const body = new THREE.Mesh(new THREE.ConeGeometry(9 * s, 8 * s, 4), lam(0xd9b26e));
        body.position.y = 4 * s;
        body.rotation.y = Math.PI / 4 + rand(0.3);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 1.5 * s, 4), lam(0xf5e3a8, 0.35));
        cap.position.y = 8.4 * s; cap.rotation.y = body.rotation.y;
        g.add(body, cap); collR = 8 * s; break;
      }
      case 'obelisk': {
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 6 * s, 0.9 * s), lam(0xc9a86a));
        shaft.position.y = 3 * s;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.1 * s, 4), lam(0xf5d78e, 0.3));
        tip.position.y = 6.5 * s; tip.rotation.y = Math.PI / 4;
        g.add(shaft, tip); collR = 0.9 * s; break;
      }
      case 'umbrella': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.07 * s, 2.4 * s, 6), lam(0xe8e0d0));
        pole.position.y = 1.2 * s;
        const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 0.8 * s, 8),
          lam(new THREE.Color().setHSL(rand(1), 0.85, 0.55).getHex()));
        canopy.position.y = 2.4 * s;
        g.add(pole, canopy); collR = 0.5 * s; break;
      }
      case 'boat': {
        const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.7 * s, 3.6 * s), lam(0xffffff));
        hull.position.y = 0.35 * s;
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 3.4 * s, 5), lam(0x8a6a48));
        mast.position.y = 2.2 * s;
        const sailGeo = new THREE.BufferGeometry();
        sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([
          0, 0.6 * s, 0,  0, 3.8 * s, 0,  1.9 * s, 0.9 * s, 0], 3));
        sailGeo.computeVertexNormals();
        const sail = new THREE.Mesh(sailGeo, new THREE.MeshLambertMaterial({ color: 0xfdf6e3, side: THREE.DoubleSide }));
        sail.position.y = 0.4 * s;
        g.add(hull, mast, sail);
        g.rotation.y = rand(Math.PI * 2);
        collR = 0; break;   // boats sit out on the water
      }
      case 'lighthouse': {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * s, 1.6 * s, 8 * s, 10), lam(0xf4f0e6));
        tower.position.y = 4 * s;
        for (let b = 0; b < 3; b++) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62 * s - b * 0.17 * s, 1.62 * s - b * 0.17 * s, 0.7 * s, 10), lam(0xd8433b));
          band.position.y = (1.4 + b * 2.4) * s;
          g.add(band);
        }
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 8, 6), lam(0xfff2a8, 0.9));
        lamp.position.y = 8.5 * s;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0 * s, 1.0 * s, 8), lam(0x8a2f28));
        roof.position.y = 9.5 * s;
        g.add(tower, lamp, roof); collR = 1.7 * s; break;
      }
      case 'mountain': {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(16 * s, 22 * s, 7), lam(0x7a8494));
        peak.position.y = 11 * s;
        peak.rotation.y = rand(Math.PI * 2);
        const snow = new THREE.Mesh(new THREE.ConeGeometry(5.5 * s, 7.5 * s, 7), lam(0xf7fbff));
        snow.position.y = 18.3 * s; snow.rotation.y = peak.rotation.y;
        g.add(peak, snow); collR = 14 * s; break;
      }
      case 'flowers': {
        for (let f = 0; f < 7; f++) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 6, 5),
            lam(new THREE.Color().setHSL(rand(1), 0.9, 0.62).getHex(), 0.25));
          bloom.position.set(rand(-1.4, 1.4) * s, 0.22 * s, rand(-1.4, 1.4) * s);
          g.add(bloom);
        }
        collR = 0; break;
      }
      case 'torii': {
        const red = 0xd8352a;
        for (const px of [-1.5, 1.5]) {
          const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.26 * s, 3.6 * s, 8), lam(red));
          pillar.position.set(px * s, 1.8 * s, 0);
          g.add(pillar);
        }
        const beamTop = new THREE.Mesh(new THREE.BoxGeometry(4.6 * s, 0.35 * s, 0.5 * s), lam(0x2b2320));
        beamTop.position.y = 3.75 * s;
        const beamMid = new THREE.Mesh(new THREE.BoxGeometry(3.8 * s, 0.28 * s, 0.4 * s), lam(red));
        beamMid.position.y = 2.9 * s;
        g.add(beamTop, beamMid);
        g.rotation.y = rand(Math.PI * 2);
        collR = 1.8 * s; break;
      }
      case 'neonsign': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 4.5 * s, 6), lam(0x3a3f4a));
        pole.position.y = 2.25 * s;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 1.5 * s, 0.2 * s),
          lam(new THREE.Color().setHSL(rand(1), 1, 0.6).getHex(), 1.1));
        panel.position.y = 4.2 * s;
        panel.rotation.y = rand(Math.PI * 2);
        g.add(pole, panel); collR = 0.5 * s; break;
      }
      case 'lamppost': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.12 * s, 3.8 * s, 6), lam(0x2f3540));
        pole.position.y = 1.9 * s;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6), lam(0xffe9a8, 1.0));
        bulb.position.y = 3.9 * s;
        g.add(pole, bulb); collR = 0.4 * s; break;
      }
      default: return;
    }
    if (collR > 0) this.obstacles.push({ x: d.x, z: d.z, r: collR });
    this.group.add(g);
  }
}
