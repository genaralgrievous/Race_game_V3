// Meadow Falls — friendly opening circuit. Rolling hills, one
// crest jump on the back straight, generous width.
export const MEADOW = {
  id: 'meadow',
  name: 'Meadow Falls',
  laps: 3,
  width: 15,
  grip: 1,
  walls: false,
  floating: false,
  theme: {
    skyTop: 0x2f74d0, skyBottom: 0xbfe6ff,
    fog: { color: 0xcfe8ff, near: 160, far: 520 },
    ground: 0x4da24f, road: 0x5c6068, roadEdge: 0xd8433b, rail: 0xffd23f,
    sun: { color: 0xfff3d6, intensity: 1.15, dir: [0.5, 1, 0.35] },
    ambient: 0x9db8d8,
  },
  controlPoints: [
    [0, -120, 0], [60, -126, 0], [118, -102, 0], [148, -52, 0],
    [138, 8, 2], [158, 66, 6], [122, 108, 8], [64, 118, 3],
    [12, 92, 0], [-38, 108, 0], [-92, 120, 0], [-132, 82, 0],
    [-122, 24, 0], [-100, -18, 4], [-104, -52, 5], [-122, -84, 0],
    [-64, -108, 0],
  ],
  boostPads: [
    { t: 0.30, len: 8 },
    { t: 0.585, len: 8 },
  ],
  itemBoxRows: [
    { t: 0.10, count: 4 },
    { t: 0.42, count: 4 },
    { t: 0.72, count: 4 },
  ],
  decorations: [
    { type: 'pipe', x: 20, z: -138, s: 1.1 },
    { type: 'pipe', x: -20, z: -138, s: 1.1 },
    { type: 'building', x: 190, z: 20, s: 1.2 },
  ],
  scatter: [
    { type: 'tree', count: 70, minDist: 14, maxDist: 60 },
    { type: 'rock', count: 12, minDist: 16, maxDist: 55 },
    { type: 'cloud', count: 14, minDist: 30, maxDist: 160 },
  ],
};
