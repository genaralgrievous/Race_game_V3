// Riviera Royale — high summer on a Monaco-inspired street circuit.
// Harbor-front start straight into Sainte-Dévote, the long Beau
// Rivage climb to Casino Square, Mirabeau, the famously tight
// Fairmont hairpin, Portier and the sweeping tunnel run along the
// water, the Nouvelle chicane, Tabac, the Piscine S-curves and the
// Rascasse hook back onto the straight. Armco everywhere (walls),
// yachts bobbing in the turquoise Mediterranean below.
export const RIVIERA = {
  id: 'riviera',
  name: 'Riviera Royale',
  laps: 3,
  width: 14,
  grip: 1,
  walls: true,          // street circuit — barriers line every meter
  floating: false,
  theme: {
    skyTop: 0x1e78d8, skyBottom: 0xc4e8ff,           // vivid summer azure
    fog: { color: 0xd8ecff, near: 160, far: 560 },
    ground: 0xcbb894,                                 // sun-bleached stone
    road: 0x686c74, roadEdge: 0xd8433b, rail: 0xe8ecf2, // asphalt, red-white curbs, silver Armco
    sun: { color: 0xfff4d8, intensity: 1.25, dir: [0.35, 1, 0.2] },
    ambient: 0xa8bcd8,
    water: { x: 0, z: -290, size: 240, color: 0x189ecf, level: 0.02 }, // the Mediterranean
  },
  controlPoints: [
    [0, -150, 0],       // start/finish on the harbor straight
    [64, -152, 0],
    [120, -146, 0],
    [156, -120, 0],     // Sainte-Dévote — first right
    [170, -72, 2],      // Beau Rivage — the climb begins
    [172, -18, 4],
    [158, 34, 6],       // Massenet sweeps left...
    [120, 68, 7],       // ...into Casino Square (the crest)
    [78, 76, 6],
    [52, 48, 5],        // Mirabeau — downhill right hook
    [32, 38, 4],        // short run to the famous hairpin
    [-6, 54, 3.5],      // Fairmont hairpin — tightest corner on the tour
    [2, 4, 3],          // hairpin exit, still descending
    [30, -18, 2.5],     // Portier — right onto the waterfront
    [6, -52, 2],        // the tunnel sweep (fast, curving right)
    [-42, -66, 1],
    [-84, -58, 0.5],    // Nouvelle chicane — hard brake, jink left...
    [-102, -74, 0],     // ...and right
    [-130, -62, 0],     // Tabac
    [-150, -86, 0],     // Piscine S — flick right...
    [-140, -114, 0],    // ...flick left around the pool
    [-160, -134, 0],    // Rascasse — slow left hook
    [-118, -154, 0],    // Anthony Noghès, back onto the straight
    [-58, -154, 0],
  ],
  boostPads: [
    { t: 0.235, len: 8 },   // crest of the Beau Rivage climb
    { t: 0.565, len: 7 },   // tunnel exit — carry it into the chicane
    { t: 0.93, len: 8 },    // Noghès exit onto the pit straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.34, count: 4 },
    { t: 0.60, count: 4 },
    { t: 0.84, count: 4 },
  ],
  decorations: [
    // the principality: hotel rows above the climb and around Casino
    { type: 'building', x: 198, z: -60, s: 1.3 },
    { type: 'building', x: 200, z: -8, s: 1.5 },
    { type: 'building', x: 192, z: 44, s: 1.2 },
    { type: 'building', x: 138, z: 102, s: 1.6 },   // the Casino itself
    { type: 'building', x: 96, z: 108, s: 1.2 },
    // apartment block filling the loop between waterfront and straight
    { type: 'building', x: -30, z: -108, s: 1.3 },
    { type: 'building', x: -68, z: -112, s: 1.1 },
    { type: 'building', x: 8, z: -104, s: 1.0 },
    // yachts moored in the Mediterranean
    { type: 'boat', x: -40, z: -205, s: 1.6 },
    { type: 'boat', x: 30, z: -225, s: 2.0 },
    { type: 'boat', x: 95, z: -200, s: 1.4 },
    { type: 'boat', x: -105, z: -215, s: 1.7 },
    { type: 'boat', x: 150, z: -235, s: 1.5 },
    // lighthouse on the harbor mole
    { type: 'lighthouse', x: 205, z: -175, s: 1.2 },
  ],
  scatter: [
    { type: 'palm', count: 34, minDist: 13, maxDist: 45 },
    { type: 'flowers', count: 40, minDist: 12, maxDist: 30 },
    { type: 'lamppost', count: 24, minDist: 12, maxDist: 20 },
    { type: 'building', count: 14, minDist: 24, maxDist: 70 },
  ],
};
