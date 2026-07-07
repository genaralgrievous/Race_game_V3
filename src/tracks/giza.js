// Giza Sunset Sprint — dusk on the Giza plateau. A deep-umber road
// laps the necropolis: obelisk-lined avenue past the start line,
// climb to a raised causeway on the plateau rim (guard rails hold
// you above the sand), then a long drift sweeper orbiting the three
// great pyramids before a tight wadi S-slalom drops past an oasis.
// The Nile glints far to the east under a violet-to-amber sky.
export const GIZA = {
  id: 'giza',
  name: 'Giza Sunset Sprint',
  laps: 3,
  width: 14,
  grip: 1,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x4a2d6e, skyBottom: 0xf5a34e,          // dusky violet to amber
    fog: { color: 0xc4826f, near: 135, far: 480 },
    ground: 0xa87f45, road: 0x4a3226,               // dark gold sand / deep umber
    roadEdge: 0xe0aa4c, rail: 0xe8b05a,             // gilded edging
    sun: { color: 0xffc178, intensity: 0.95, dir: [0.8, 0.35, 0.2] }, // long low sun
    ambient: 0x7a6a9e,                               // cool violet shadow fill
    water: { x: 420, z: 0, size: 300, color: 0x3a4a7a, level: 0.05 }, // the distant Nile
  },
  controlPoints: [
    [0, -140, 0],      // start line, mid-avenue of obelisks heading east
    [70, -138, 0],
    [130, -120, 0],    // turn 1 arcs up the east side
    [160, -70, 0],
    [168, -10, 3],     // climb onto the raised causeway (rails kick in)
    [160, 55, 4],      //   plateau rim overlooking the Nile
    [130, 115, 2],     // descend into the long left sweeper...
    [70, 150, 0],      //   ...orbiting the pyramid trio
    [0, 158, 0],
    [-70, 145, 0],
    [-125, 110, 0],    // sweeper exit, dropping toward the wadi
    [-150, 55, 0],     // wadi S-slalom: tight left-right-left
    [-110, 20, 0],
    [-148, -20, 0],
    [-105, -55, 0],    // S exit past the oasis
    [-150, -105, 0],   // hard left horseshoe at the quarry
    [-70, -140, 0],    // straight run back to the start line
  ],
  boostPads: [
    { t: 0.30, len: 8 },   // causeway crest — carry speed into the sweeper
    { t: 0.80, len: 8 },   // reward for a clean wadi S exit
    { t: 0.945, len: 8 },  // launch down the obelisk avenue
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.44, count: 4 },
    { t: 0.63, count: 4 },
    { t: 0.87, count: 4 },
  ],
  decorations: [
    // the great trio on their NE-SW diagonal, inside the sweeper
    { type: 'pyramid', x: 88, z: 52, s: 5.0 },     // Khufu
    { type: 'pyramid', x: 25, z: 95, s: 4.2 },     // Khafre
    { type: 'pyramid', x: -45, z: 85, s: 3.0 },    // Menkaure
    // avenue of obelisks flanking the start/finish straight
    { type: 'obelisk', x: -50, z: -127, s: 1.4 },
    { type: 'obelisk', x: -50, z: -153, s: 1.4 },
    { type: 'obelisk', x: -25, z: -127, s: 1.4 },
    { type: 'obelisk', x: -25, z: -153, s: 1.4 },
    { type: 'obelisk', x: 0, z: -127, s: 1.4 },
    { type: 'obelisk', x: 0, z: -153, s: 1.4 },
    { type: 'obelisk', x: 25, z: -127, s: 1.4 },
    { type: 'obelisk', x: 25, z: -153, s: 1.4 },
    { type: 'obelisk', x: 50, z: -127, s: 1.4 },
    { type: 'obelisk', x: 50, z: -153, s: 1.4 },
    // oasis just west of the wadi
    { type: 'palm', x: -182, z: 20, s: 1.2 },
    { type: 'palm', x: -172, z: 2, s: 1.0 },
    { type: 'palm', x: -192, z: -8, s: 1.1 },
    { type: 'palm', x: -178, z: 38, s: 0.9 },
    { type: 'palm', x: -190, z: 32, s: 1.3 },
    // weathered wadi boulders
    { type: 'rock', x: -128, z: 0, s: 2.0 },
    { type: 'rock', x: -90, z: -10, s: 1.6 },
    { type: 'rock', x: -170, z: -60, s: 1.8 },
    // a felucca drifting on the Nile
    { type: 'boat', x: 400, z: 60, s: 2.0 },
  ],
  scatter: [
    { type: 'rock', count: 45, minDist: 14, maxDist: 65, s: 1.1 },
    { type: 'palm', count: 14, minDist: 15, maxDist: 55 },
    { type: 'obelisk', count: 12, minDist: 18, maxDist: 70, s: 0.8 }, // ruined stelae
  ],
};
