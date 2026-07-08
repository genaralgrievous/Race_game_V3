// Neo-Tokyo Loop — the Shuto C1 inner loop at 2 a.m., kart-sized.
// One unbroken elevated expressway (y 5-7, so guard rails run the
// whole lap): the Shibaura slipstream straight, Hamazakibashi's first
// sweep, long flowing bayside sweepers, a tight Hakozaki interchange
// hairpin, a fast Ginza S-weave threading the tower canyons, then
// Miyakezaka's linked curves and the Tanimachi kink back onto the
// straight. Near-black indigo night, ember smog, red/teal neon below.
export const NEOTOKYO = {
  id: 'neotokyo', name: 'Neo-Tokyo Loop',
  laps: 3, width: 13.5, grip: 1,
  walls: true, floating: false,      // expressway barriers — nobody leaves the C1
  theme: {
    skyTop: 0x05070f, skyBottom: 0x371f16,          // black-indigo sky, ember smog glow
    fog: { color: 0x10141f, near: 145, far: 470 },
    ground: 0x0d1017, road: 0x2b303c,               // dark city blocks / lit asphalt
    roadEdge: 0xff4a1e, rail: 0x17d7c1,             // hot red-orange lines, teal barriers
    sun: { color: 0xa9c4ff, intensity: 0.85, dir: [-0.35, 0.75, 0.45] }, // cold moon
    ambient: 0x3d4a66,                               // sodium-blue night fill
  },
  controlPoints: [
    [-10, -150, 5],    // start line on the Shibaura slipstream straight
    [62, -150, 5],
    [125, -134, 5],    // Hamazakibashi: turn 1 arcs up the bay side
    [158, -85, 6],
    [148, -22, 7],     // long flowing elevated sweepers past Shiodome
    [168, 40, 7],
    [158, 100, 6],     // climbing lane toward the interchange knot
    [156, 150, 6],     // Hakozaki hairpin: out along the ramp finger...
    [136, 176, 5],     //   ...180 around the pylon sign...
    [112, 150, 5],     //   ...and back down the parallel deck
    [108, 108, 5],     // tight interchange exit
    [62, 118, 5],      // Ginza S-weave: fast left-right-left
    [8, 140, 6],       //   threading the tower canyons
    [-52, 112, 6],
    [-105, 138, 7],    // last flick, highest deck of the lap
    [-152, 108, 7],    // Takebashi corner onto the west side
    [-168, 48, 7],     // Miyakezaka: long linked curves...
    [-148, -12, 6],
    [-172, -72, 6],    //   ...swinging wide past the palace moat
    [-138, -122, 5],   // Tanimachi kink
    [-85, -148, 5],    // launch onto the straight (grid forms up here)
  ],
  boostPads: [
    { t: 0.175, len: 8 },  // Hamazakibashi exit — carry it up the bay side
    { t: 0.462, len: 8 },  // clean hairpin exit into the Ginza weave
    { t: 0.905, len: 8 },  // Tanimachi exit — slipstream duels down the straight
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 }, { t: 0.34, count: 4 },
    { t: 0.61, count: 4 }, { t: 0.86, count: 4 },
  ],
  decorations: [
    // grand red torii glowing beside the start straight
    { type: 'torii', x: 30, z: -118, s: 7.0 },
    // downtown core rising inside the loop
    { type: 'building', x: 55, z: 45, s: 5.0 },
    { type: 'building', x: 0, z: 66, s: 4.4 },
    { type: 'building', x: -60, z: 30, s: 4.8 },
    { type: 'building', x: 95, z: -55, s: 3.6 },
    { type: 'building', x: -45, z: -70, s: 4.2 },
    // tower canyon the Ginza weave threads through
    { type: 'building', x: 35, z: 170, s: 3.8 },
    { type: 'building', x: -28, z: 168, s: 4.2 },
    { type: 'building', x: -90, z: 175, s: 3.6 },
    { type: 'building', x: 32, z: 90, s: 3.2 },
    { type: 'building', x: -75, z: 85, s: 3.4 },
    // skyline crowding the outside of the expressway
    { type: 'building', x: 205, z: -20, s: 3.6 },
    { type: 'building', x: 198, z: 88, s: 3.2 },
    { type: 'building', x: -208, z: 20, s: 3.8 },
    { type: 'building', x: -205, z: -110, s: 3.4 },
    { type: 'building', x: 45, z: -200, s: 4.6 },
    { type: 'building', x: -45, z: -195, s: 4.0 },
    // signature neon: hairpin-pylon sign, T1 billboard, start-line glow
    { type: 'neonsign', x: 135, z: 148, s: 3.0 },
    { type: 'neonsign', x: 178, z: -88, s: 2.6 },
    { type: 'neonsign', x: -12, z: -136, s: 2.8 },
    // lamppost row down the outside of the main straight
    { type: 'lamppost', x: -75, z: -161, s: 2.4 },
    { type: 'lamppost', x: -40, z: -161, s: 2.4 },
    { type: 'lamppost', x: -5, z: -161, s: 2.4 },
    { type: 'lamppost', x: 30, z: -161, s: 2.4 },
    { type: 'lamppost', x: 65, z: -161, s: 2.4 },
  ],
  scatter: [
    { type: 'building', count: 40, minDist: 34, maxDist: 72, s: 1.6 }, // mid-rise sprawl
    { type: 'neonsign', count: 34, minDist: 15, maxDist: 42, s: 1.8 }, // izakaya glow
    { type: 'lamppost', count: 30, minDist: 12, maxDist: 17, s: 2.2 }, // highway lighting
  ],
};
