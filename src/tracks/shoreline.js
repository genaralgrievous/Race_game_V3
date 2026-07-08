// Shoreline Grand — high noon on the Long Beach waterfront. Full
// throttle down Shoreline Drive with the turquoise Pacific and a
// parasol-studded beach on one side, then a roundabout hairpin
// around the plaza fountain, a right-angle scramble through the
// downtown blocks, and a long elevated sweeper (rails hold you on
// the overpass) dropping to a tight final hook back onto the shore.
// Run wide and you're ploughing golden sand. Walls: none.
export const SHORELINE = {
  id: 'shoreline',
  name: 'Shoreline Grand',
  laps: 3,
  width: 15,
  grip: 1,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x1690dd, skyBottom: 0xc8f0f8,           // bright cyan noon sky
    fog: { color: 0xd4f0f6, near: 160, far: 560 },   // sea-haze shimmer
    ground: 0xe3c47c, road: 0x5a6470,                // golden sand / grey-blue asphalt
    roadEdge: 0xf5f6f1, rail: 0x2fa8b5,              // bleached curbs, teal overpass rail
    sun: { color: 0xfff4d6, intensity: 1.25, dir: [0.25, 1.0, 0.18] }, // straight overhead
    ambient: 0x9fc9d9,                               // cool sky bounce
    water: { x: 20, z: 365, size: 420, color: 0x17b5c9, level: 0.05 }, // the Pacific
  },
  controlPoints: [
    [-60, 124, 0],    // start/finish on Shoreline Drive, ocean to the right
    [30, 126, 0],     //   the long beachfront drag
    [110, 126, 0],    // braking zone for Turn 1
    [160, 106, 0],    // T1: hard left off the shore
    [172, 55, 0],     // up Aquarium Way, heading uptown
    [168, 0, 0],      // fountain plaza approach
    [150, -42, 0],    // roundabout hairpin wrapping the fountain...
    [112, -38, 0],    //   ...180 degrees around the spray
    [98, -2, 0],      // hairpin exit, back toward the sea
    [98, 58, 0],      // 90-right into the downtown grid
    [48, 64, 0],      //   block-to-block on Ocean Blvd
    [0, 56, 0],       // 90-right up Pine Avenue
    [-4, 0, 0],       //   canyon of storefronts
    [-8, -40, 0],     // 90-left at the top of the grid
    [-60, -58, 0],    // opening onto the back section
    [-105, -105, 3],  // climbing the Seaside Way overpass (rails on)
    [-155, -136, 4],  // crest of the long sweeper
    [-176, -70, 3],   // sweeping down the west side
    [-170, 5, 0],     // back at beach level
    [-158, 75, 0],    // lining up the final hook
    [-130, 112, 0],   // T11-style tight left onto Shoreline Drive
  ],
  boostPads: [
    { t: 0.375, len: 8 },  // clean fountain-hairpin exit
    { t: 0.80, len: 8 },   // off the overpass, flat-out down the west side
    { t: 0.955, len: 8 },  // slingshot onto the beachfront straight
  ],
  itemBoxRows: [
    { t: 0.11, count: 4 },
    { t: 0.40, count: 4 },
    { t: 0.64, count: 4 },
    { t: 0.87, count: 4 },
  ],
  decorations: [
    // the harbor lighthouse off the point past Turn 1
    { type: 'lighthouse', x: 225, z: 165, s: 1.5 },
    // plaza fountain in the hairpin island (crystal = the water jet)
    { type: 'crystal', x: 132, z: -18, s: 1.5 },
    { type: 'flowers', x: 121, z: -10 }, { type: 'flowers', x: 143, z: -10 },
    { type: 'flowers', x: 132, z: -30 }, { type: 'flowers', x: -70, z: 108 },
    // palms lining the beach side of Shoreline Drive
    { type: 'palm', x: -120, z: 142, s: 1.2 }, { type: 'palm', x: -75, z: 142, s: 1.0 },
    { type: 'palm', x: -30, z: 143, s: 1.3 }, { type: 'palm', x: 15, z: 142, s: 1.1 },
    { type: 'palm', x: 60, z: 143, s: 1.2 }, { type: 'palm', x: 105, z: 142, s: 1.0 },
    // parasol clusters on the hot sand
    { type: 'umbrella', x: -45, z: 146 }, { type: 'umbrella', x: -25, z: 151, s: 0.9 },
    { type: 'umbrella', x: 5, z: 145, s: 1.1 }, { type: 'umbrella', x: 75, z: 148 },
    { type: 'umbrella', x: 95, z: 152, s: 0.9 },
    // pleasure craft out on the swell
    { type: 'boat', x: 60, z: 205, s: 2.0 }, { type: 'boat', x: -70, z: 235, s: 1.7 },
    { type: 'boat', x: 160, z: 195, s: 1.6 },
    // the downtown blocks the grid section threads through
    { type: 'building', x: 35, z: 18, s: 1.4 }, { type: 'building', x: 62, z: 8, s: 1.8 },
    { type: 'building', x: 25, z: -16, s: 1.6 }, { type: 'building', x: 58, z: -22, s: 1.3 },
    { type: 'building', x: -45, z: 20, s: 1.5 },
    { type: 'building', x: -30, z: -88, s: 2.2 },   // the convention center
    { type: 'neonsign', x: 75, z: 42 },             // "THE PIKE" arcade sign
    { type: 'lamppost', x: -20, z: 108 }, { type: 'lamppost', x: 60, z: 108 },
  ],
  scatter: [
    { type: 'palm', count: 30, minDist: 15, maxDist: 60 },
    { type: 'umbrella', count: 18, minDist: 14, maxDist: 55, s: 0.9 },
    { type: 'flowers', count: 24, minDist: 13, maxDist: 40 },
    { type: 'rock', count: 12, minDist: 16, maxDist: 70, s: 0.9 },  // breakwater stones
  ],
};
