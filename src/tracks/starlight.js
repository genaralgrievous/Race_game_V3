// Starlight Causeway — the finale. A neon ribbon floating in deep
// space: no walls, no ground, offroad means falling into the void.
// Climbs a long right-hand sweeper to its highest crest, dives
// through a triple-kink chicane, swoops down the left side and
// snaps through a diagonal hairpin back onto the home causeway.
export const STARLIGHT = {
  id: 'starlight',
  name: 'Starlight Causeway',
  laps: 3,
  width: 13,
  grip: 1,
  walls: false,
  floating: true,
  theme: {
    skyTop: 0x030108, skyBottom: 0x41207a,          // black space over indigo horizon
    fog: { color: 0x2a1252, near: 150, far: 540 },
    ground: 0x0a0514,                                // never drawn (floating)
    road: 0x22dcd2, roadEdge: 0xff3dae, rail: 0xc44dff, // neon teal, hot pink, violet glow
    sun: { color: 0xcfc0ff, intensity: 1.25, dir: [-0.3, 1, 0.4] },
    ambient: 0x6050b8,
  },
  controlPoints: [
    [0, -140, 8],      // start line on the home causeway
    [58, -142, 10],    // straight — slipstream / item duels
    [112, -128, 12],   // sweeper entry
    [154, -86, 14],    // long right-hand drift, climbing...
    [174, -26, 17],
    [164, 38, 18],     // the crest — highest point on the track
    [128, 90, 15],     // diving out of the sweeper
    [74, 114, 12],     // chicane approach
    [30, 92, 10],      // kink 1 (right)
    [-16, 114, 8],     // kink 2 (left)
    [-64, 94, 7],      // kink 3 (right) — lowest dip
    [-114, 112, 9],    // chicane exit
    [-152, 70, 12],    // left corner, swinging south
    [-158, 12, 14],    // re-climbing the west edge
    [-128, -38, 12],   // hooking inward
    [-74, -48, 10],    // hairpin entry
    [-52, -84, 8],     // hairpin apex — hard right
    [-96, -110, 7],    // diagonal drop toward the bottom
    [-134, -132, 7],   // final left switch
    [-76, -148, 7],    // onto the home causeway
  ],
  boostPads: [
    { t: 0.335, len: 8 },  // crest exit — hold the drift, get launched downhill
    { t: 0.56, len: 7 },   // clean chicane exit reward
    { t: 0.885, len: 8 },  // hairpin exit onto the final straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.40, count: 4 },
    { t: 0.66, count: 4 },
    { t: 0.81, count: 4 },
  ],
  // Giant crystals drifting in the void, far off the racing line.
  decorations: [
    { type: 'crystal', x: 230, z: -160, s: 2.6 },
    { type: 'crystal', x: 250, z: 80, s: 3.0 },
    { type: 'crystal', x: 60, z: 195, s: 2.2 },
    { type: 'crystal', x: -225, z: 160, s: 2.8 },
    { type: 'crystal', x: -245, z: -60, s: 2.4 },
    { type: 'crystal', x: -180, z: -205, s: 2.6 },
    { type: 'crystal', x: 45, z: -235, s: 2.0 },
    { type: 'crystal', x: 20, z: -15, s: 1.8 },   // one in the loop's hollow core
  ],
};
