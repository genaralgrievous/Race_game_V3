// Coral Cove — tropical boardwalk circuit above turquoise shallows.
// Gentle sweeping bends hug the reef line, a short ramp launches
// over a tidal channel, and the home stretch runs along the beach.
// Wide and forgiving — a great second-cup track.
export const CORAL = {
  id: 'coral',
  name: 'Coral Cove',
  laps: 3,
  width: 15,
  grip: 1,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x1ca4d8, skyBottom: 0xa8e8f0,            // bright turquoise gradient
    fog: { color: 0xb4ecf0, near: 160, far: 520 },
    ground: 0x30b8b0,                                  // shallow turquoise water
    road: 0xc49a6c, roadEdge: 0xe85a6f, rail: 0xffdc5e, // boardwalk wood, coral pink, sunny
    sun: { color: 0xfff8e0, intensity: 1.2, dir: [0.45, 1, 0.4] },
    ambient: 0x88c8d8,
  },
  controlPoints: [
    [0, -130, 0],       // start line along the beach front
    [56, -136, 0],
    [114, -124, 0],     // gentle right into the reef sweep
    [152, -82, 0],
    [164, -20, 0],      // east straightaway alongside the reef
    [156, 42, 0],
    [126, 94, 0],       // long left-hander around the point
    [72, 128, 0],
    [10, 138, 0],       // north shore — widest part of the cove
    [-52, 124, 0],
    [-104, 96, 2],      // ramp approach — rising boardwalk
    [-138, 48, 5],      // jump crest over the tidal channel
    [-148, -10, 0],     // landing zone, dropping back down
    [-130, -64, 0],     // hairpin sweeper around the rock outcrop
    [-152, -108, 0],
    [-112, -140, 0],    // funnelling back toward the beach
    [-52, -142, 0],
  ],
  boostPads: [
    { t: 0.25, len: 8 },   // reef straightaway — clear run
    { t: 0.60, len: 8 },   // launch pad before the ramp jump
    { t: 0.88, len: 8 },   // hairpin exit onto the home straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.38, count: 4 },
    { t: 0.68, count: 4 },
    { t: 0.82, count: 4 },
  ],
  decorations: [
    // coral reef clusters off the east side
    { type: 'crystal', x: 200, z: -40, s: 2.0 },
    { type: 'crystal', x: 196, z: 30, s: 1.6 },
    { type: 'crystal', x: 186, z: 90, s: 1.8 },
    // rock outcrop at the hairpin
    { type: 'rock', x: -180, z: -80, s: 2.2 },
    { type: 'rock', x: -174, z: -50, s: 1.6 },
    // palm gateway at start/finish
    { type: 'palm', x: 16, z: -148, s: 1.3 },
    { type: 'palm', x: -16, z: -148, s: 1.3 },
  ],
  scatter: [
    { type: 'palm', count: 50, minDist: 14, maxDist: 60 },
    { type: 'rock', count: 18, minDist: 15, maxDist: 55 },
    { type: 'crystal', count: 22, minDist: 14, maxDist: 50 },
    { type: 'cloud', count: 10, minDist: 30, maxDist: 160 },
  ],
};
