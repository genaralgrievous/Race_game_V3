// Neon City — midnight cyberpunk street circuit. Narrow neon-lit
// asphalt weaves between skyscraper canyons; walls line every edge
// so rebounds are part of the strategy. A fast kink section darts
// through the downtown blocks, a 90-degree grid turn opens into a
// long drag strip past the holo-towers, then a tight double-apex
// hairpin loops the overpass back to the start.
export const NEON = {
  id: 'neon',
  name: 'Neon City',
  laps: 3,
  width: 13.5,
  grip: 1,
  walls: true,
  floating: false,
  theme: {
    skyTop: 0x04020c, skyBottom: 0x1a0832,             // deep midnight purple
    fog: { color: 0x120624, near: 100, far: 440 },
    ground: 0x0c0614,                                   // dark city floor
    road: 0x18142a, roadEdge: 0xe830d0, rail: 0x2af0e8, // dark road, hot pink, teal glow
    sun: { color: 0xd0b0ff, intensity: 0.8, dir: [0.2, 1, 0.3] },
    ambient: 0x5030a0,
  },
  controlPoints: [
    [0, -132, 0],       // start line — main boulevard
    [54, -136, 0],
    [112, -120, 0],     // right turn into the downtown kinks
    [142, -72, 0],      // kink 1 — quick right jink
    [124, -26, 0],      // kink 2 — snap left between towers
    [150, 22, 0],       // kink 3 — back right, thread the needle
    [128, 72, 0],       // exit kinks into the east boulevard
    [80, 114, 0],       // sweeping left onto the north drag strip
    [18, 132, 0],
    [-48, 126, 0],      // drag strip — flat out between holo-towers
    [-110, 112, 0],
    [-150, 78, 0],      // braking zone for the double-apex hairpin
    [-168, 22, 0],      // hairpin apex 1 — tight left
    [-156, -34, 0],     // short link between apexes
    [-170, -82, 0],     // hairpin apex 2 — tighter left
    [-146, -124, 0],    // hairpin exit, accelerating hard
    [-100, -146, 0],
    [-48, -140, 0],     // merging back onto the main boulevard
  ],
  boostPads: [
    { t: 0.42, len: 7 },   // kink exit reward — clean line through downtown
    { t: 0.58, len: 8 },   // mid drag strip — flat-out blast
    { t: 0.90, len: 8 },   // hairpin exit onto the home straight
  ],
  itemBoxRows: [
    { t: 0.08, count: 4 },
    { t: 0.32, count: 4 },
    { t: 0.54, count: 4 },
    { t: 0.78, count: 4 },
  ],
  decorations: [
    // skyscraper blocks flanking the downtown kinks
    { type: 'building', x: 190, z: -60, s: 1.4 },
    { type: 'building', x: 186, z: 10, s: 1.6 },
    { type: 'building', x: 178, z: 80, s: 1.2 },
    // holo-towers along the north drag strip
    { type: 'building', x: -20, z: 168, s: 1.8 },
    { type: 'building', x: -80, z: 162, s: 1.5 },
    // pipe infrastructure at the hairpin
    { type: 'pipe', x: -204, z: 20, s: 1.6 },
    { type: 'pipe', x: -200, z: -50, s: 1.4 },
    // traffic cones at braking zones
    { type: 'cone', x: -140, z: 100, s: 0.8 },
    { type: 'cone', x: -152, z: 92, s: 0.8 },
  ],
  scatter: [
    { type: 'building', count: 30, minDist: 20, maxDist: 80 },
    { type: 'pipe', count: 15, minDist: 18, maxDist: 60 },
    { type: 'cone', count: 20, minDist: 12, maxDist: 45 },
  ],
};
