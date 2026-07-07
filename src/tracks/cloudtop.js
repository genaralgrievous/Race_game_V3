// Cloudtop Express — a golden ribbon spiralling through the upper
// atmosphere. Narrow, floating, no walls — fall off and you plummet
// through the clouds. Dramatic elevation swings from cloud-base
// troughs to soaring peaks; a steep climb launches into the highest
// crest, a triple-dip roller-coaster section tests nerve, and a
// sweeping banked descent funnels into a white-knuckle chicane
// before the final glide home.
export const CLOUDTOP = {
  id: 'cloudtop',
  name: 'Cloudtop Express',
  laps: 3,
  width: 12,
  grip: 1,
  walls: false,
  floating: true,
  theme: {
    skyTop: 0x4a98e0, skyBottom: 0xe8f4ff,             // bright heavenly blue-white
    fog: { color: 0xe0f0ff, near: 140, far: 500 },
    ground: 0xd0e8f8,                                   // never drawn (floating)
    road: 0xd4a830, roadEdge: 0xf0f0f0, rail: 0xffeea0, // golden road, white edges, soft glow
    sun: { color: 0xfffff0, intensity: 1.3, dir: [0.4, 1, 0.35] },
    ambient: 0xb8d0e8,
  },
  controlPoints: [
    [0, -130, 14],      // start line — mid-altitude home straight
    [56, -134, 14],
    [112, -118, 16],    // banking right, beginning the grand ascent
    [152, -72, 19],     // climbing steeply
    [170, -10, 22],     // the great ascent continues
    [156, 50, 25],      // summit — highest point, soaring above all
    [114, 96, 20],      // diving off the peak
    [58, 118, 15],      // roller-coaster dip 1 — plunge
    [10, 100, 18],      // dip 1 — back up
    [-38, 120, 13],     // dip 2 — plunge again
    [-88, 104, 17],     // dip 2 — rise
    [-132, 118, 12],    // dip 3 — final plunge, lowest trough
    [-162, 76, 14],     // exit the rollercoaster, sweeping left
    [-172, 16, 16],     // long banked descent around the west
    [-156, -42, 14],    // chicane approach — brake hard
    [-126, -80, 12],    // chicane kink right
    [-154, -116, 11],   // chicane kink left — threading the clouds
    [-114, -142, 12],   // chicane exit
    [-54, -138, 13],    // gliding back onto the home straight
  ],
  boostPads: [
    { t: 0.30, len: 8 },   // summit exit — launch off the peak
    { t: 0.60, len: 7 },   // clean roller-coaster exit reward
    { t: 0.88, len: 8 },   // chicane exit onto the home straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.38, count: 4 },
    { t: 0.55, count: 4 },
    { t: 0.80, count: 4 },
  ],
  // Crystals and clouds drifting in the sky around the track.
  decorations: [
    { type: 'crystal', x: 210, z: -80, s: 2.4 },   // east sky landmark
    { type: 'crystal', x: 200, z: 60, s: 2.0 },
    { type: 'crystal', x: -210, z: 40, s: 2.6 },   // west sky landmark
    { type: 'crystal', x: -200, z: -80, s: 2.2 },
    { type: 'cloud', x: 120, z: 160, s: 3.0 },     // cloud banks
    { type: 'cloud', x: -60, z: 180, s: 2.8 },
    { type: 'cloud', x: 40, z: -180, s: 2.6 },
    { type: 'crystal', x: 10, z: -10, s: 1.8 },    // floating crystal in the loop core
  ],
  scatter: [
    { type: 'cloud', count: 50, minDist: 25, maxDist: 160 },
    { type: 'crystal', count: 20, minDist: 18, maxDist: 70 },
  ],
};
