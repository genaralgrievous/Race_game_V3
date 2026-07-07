// Sunscorch Dunes — blazing desert canyon. Terracotta road over
// sun-bleached sand: a crest jump on the right-hand straight, a
// long 180-degree sweeper over the dune ridge, then a tight
// S-slalom down the canyon floor past pipe ruins. Adobe town
// shimmers in the haze beyond the far ridge.
export const DUNES = {
  id: 'dunes',
  name: 'Sunscorch Dunes',
  laps: 3,
  width: 14.5,
  grip: 1,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x3d84c9, skyBottom: 0xffdda6,
    fog: { color: 0xf2d5a8, near: 150, far: 520 },
    ground: 0xe6c078, road: 0x9b4a2e, roadEdge: 0xcf3b2a, rail: 0xffb84d,
    sun: { color: 0xffe8bf, intensity: 1.25, dir: [0.55, 0.9, 0.25] },
    ambient: 0xd6b18a,
  },
  controlPoints: [
    [0, -150, 0],     // start line, bottom straight heading east
    [64, -152, 0],
    [126, -138, 0],
    [168, -96, 0],    // turn 1 sweeps up the right side
    [180, -34, 5],    // dune crest — jump on the straight
    [182, 30, 0],
    [168, 92, 2],     // long 180-degree left sweeper begins
    [122, 138, 4],    //   riding the dune ridge
    [58, 152, 3],
    [-6, 144, 1],
    [-40, 96, 0],     //   exit heading back south
    [-14, 52, 0],     // tight S-slalom down the canyon floor
    [-46, 10, 0],
    [-16, -34, 0],
    [-52, -78, 0],    // S exit onto the westward run
    [-124, -92, 0],
    [-168, -122, 0],  // hard left horseshoe at the canyon mouth
    [-140, -156, 0],
    [-70, -152, 0],   // back onto the start straight
  ],
  boostPads: [
    { t: 0.18, len: 8 },   // launch pad on the run-up to the crest
    { t: 0.73, len: 8 },   // reward for a clean S exit
    { t: 0.895, len: 8 },  // horseshoe exit onto the front straight
  ],
  itemBoxRows: [
    { t: 0.11, count: 4 },
    { t: 0.36, count: 4 },
    { t: 0.57, count: 4 },
    { t: 0.86, count: 4 },
  ],
  decorations: [
    // distant adobe town beyond the ridge
    { type: 'building', x: -46, z: 224, s: 1.2 },
    { type: 'building', x: -12, z: 236, s: 1.0 },
    { type: 'building', x: 22, z: 226, s: 1.3 },
    { type: 'building', x: 60, z: 238, s: 0.9 },
    // half-buried pipe ruins on the canyon floor
    { type: 'pipe', x: 58, z: 16, s: 1.5 },
    { type: 'pipe', x: 84, z: 40, s: 1.2 },
    { type: 'pipe', x: 44, z: 58, s: 1.0 },
  ],
  scatter: [
    { type: 'cactus', count: 55, minDist: 13, maxDist: 60 },
    { type: 'rock', count: 40, minDist: 14, maxDist: 70, s: 1.2 },
    { type: 'palm', count: 12, minDist: 16, maxDist: 50 },
  ],
};
