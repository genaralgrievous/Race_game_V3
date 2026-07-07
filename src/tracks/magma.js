// Magma Circuit — volcanic caldera ring road. Charred basalt track
// carves through lava fields and industrial vent stacks; walls keep
// you from tumbling into the molten flows. A steep climb up the
// east crater wall crests into a plunge, a tight S-bend threads
// between steaming pipe arrays, and a long sweeping hairpin
// wraps the caldera rim before dumping back to the start.
export const MAGMA = {
  id: 'magma',
  name: 'Magma Circuit',
  laps: 3,
  width: 14,
  grip: 0.9,
  walls: true,
  floating: false,
  theme: {
    skyTop: 0x1a0a04, skyBottom: 0x5c2210,             // smoky dark sky, ember horizon
    fog: { color: 0x3a1a0e, near: 120, far: 460 },
    ground: 0x2a1a12,                                   // charred volcanic ground
    road: 0x3c3032, roadEdge: 0xff5c14, rail: 0xd43a08, // dark basalt, glowing orange edges
    sun: { color: 0xffb070, intensity: 1.0, dir: [0.3, 0.8, 0.5] },
    ambient: 0x6e3828,
  },
  controlPoints: [
    [0, -140, 0],       // start line in the caldera floor
    [58, -142, 0],
    [120, -128, 2],     // entry into the east crater climb
    [158, -84, 5],      // climbing the wall
    [176, -24, 8],      // steep ascent continues
    [168, 40, 10],      // crest of the crater rim
    [134, 90, 6],       // plunging downhill
    [86, 120, 3],       // levelling out at the lava shelf
    [28, 130, 1],       // S-bend approach through pipes
    [-26, 108, 0],      // S-bend kink 1 — hard right
    [-68, 130, 0],      // S-bend kink 2 — snap left
    [-118, 116, 0],     // S exit into the west run
    [-156, 74, 2],      // long hairpin entry around the caldera rim
    [-172, 14, 3],      // hairpin mid — hugging the edge
    [-160, -46, 2],     // hairpin exit, descending
    [-130, -98, 0],     // sweeping back east
    [-168, -138, 0],    // wide hook at the south-west
    [-116, -156, 0],
    [-54, -148, 0],     // funnel onto the home straight
  ],
  boostPads: [
    { t: 0.20, len: 8 },   // crater climb — momentum for the crest
    { t: 0.55, len: 8 },   // reward for clean S-bend exit
    { t: 0.84, len: 8 },   // hairpin exit onto the final straight
  ],
  itemBoxRows: [
    { t: 0.08, count: 4 },
    { t: 0.35, count: 4 },
    { t: 0.62, count: 4 },
    { t: 0.78, count: 4 },
  ],
  decorations: [
    // industrial vent stacks flanking the S-bend
    { type: 'pipe', x: 60, z: 156, s: 1.6 },
    { type: 'pipe', x: 0, z: 160, s: 1.4 },
    { type: 'pipe', x: -50, z: 158, s: 1.8 },
    { type: 'pipe', x: -100, z: 150, s: 1.3 },
    // lava cones near the hairpin
    { type: 'cone', x: -200, z: 20, s: 2.0 },
    { type: 'cone', x: -196, z: -40, s: 1.6 },
    { type: 'cone', x: -188, z: 70, s: 1.8 },
    // boulder gates at the start
    { type: 'rock', x: 18, z: -162, s: 1.8 },
    { type: 'rock', x: -18, z: -162, s: 1.8 },
  ],
  scatter: [
    { type: 'rock', count: 60, minDist: 13, maxDist: 60 },
    { type: 'cone', count: 20, minDist: 16, maxDist: 55 },
    { type: 'pipe', count: 8, minDist: 20, maxDist: 50 },
  ],
};
