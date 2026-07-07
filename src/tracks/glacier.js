// Frostbite Ridge — high-mountain glacier circuit. Dark blue ice
// carved through blinding snowfields; grip is low (0.62) so every
// corner is wide and forgiving. Long drift sweeper climbs the east
// ridge into a crest jump, a gentle snow chicane crosses the summit
// plateau, and a broad hairpin wraps a crystal outcrop before the
// icy run home. Watch the slide — momentum is everything up here.
export const GLACIER = {
  id: 'glacier',
  name: 'Frostbite Ridge',
  laps: 3,
  width: 16,
  grip: 0.62,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x1c3a6b, skyBottom: 0xd8eefb,
    fog: { color: 0xdceef8, near: 150, far: 500 },
    ground: 0xecf5fc, road: 0x2c4a63, roadEdge: 0x2f9bd6, rail: 0x9fd8ff,
    sun: { color: 0xeaf4ff, intensity: 1.05, dir: [0.35, 1, 0.5] },
    ambient: 0xa9c3de,
  },
  controlPoints: [
    [0, -138, 0],      // start/finish on the valley straight
    [70, -138, 0],
    [130, -118, 1],    // long right-hand sweeper begins the climb
    [168, -62, 3],
    [172, 2, 5],
    [158, 58, 6],      // crest — launch over the ridge line
    [116, 104, 2],     // landing zone, downhill left
    [52, 132, 0],
    [-6, 104, 1],      // summit chicane: flick right...
    [-62, 140, 2],     // ...then left across the plateau
    [-124, 126, 2],
    [-168, 88, 1],     // wide glacier hairpin around the crystals
    [-178, 26, 0],
    [-150, -32, 0],    // hairpin exit — carry speed downhill
    [-138, -92, 0],
    [-88, -132, 0],    // funnels onto the start straight
  ],
  boostPads: [
    { t: 0.27, len: 8 },   // sweeper exit — send it off the crest
    { t: 0.575, len: 8 },  // clean chicane exit reward
    { t: 0.80, len: 8 },   // hairpin exit, slingshot for the straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.37, count: 4 },
    { t: 0.62, count: 4 },
    { t: 0.85, count: 4 },
  ],
  decorations: [
    { type: 'crystal', x: -208, z: 30, s: 2.4 },  // hairpin landmark
    { type: 'crystal', x: -198, z: 68, s: 1.7 },
    { type: 'rock', x: 188, z: 20, s: 2.0 },      // crest gate boulders
    { type: 'rock', x: 144, z: 40, s: 1.8 },
    { type: 'crystal', x: 18, z: -162, s: 1.9 },  // start-line beacons
    { type: 'crystal', x: -18, z: -162, s: 1.9 },
  ],
  scatter: [
    { type: 'snowtree', count: 60, minDist: 14, maxDist: 60 },
    { type: 'rock', count: 16, minDist: 15, maxDist: 55 },
    { type: 'crystal', count: 14, minDist: 14, maxDist: 50 },
  ],
};
