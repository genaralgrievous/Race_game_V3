// ============================================================
// Track registry: 8 Grand Prix tracks + the battle arena.
// Individual track definitions live in src/tracks/*.js and
// follow the contract documented at the top of track.js.
// ============================================================
import { MEADOW } from './tracks/meadow.js';
import { DUNES } from './tracks/dunes.js';
import { GLACIER } from './tracks/glacier.js';
import { STARLIGHT } from './tracks/starlight.js';
import { CORAL } from './tracks/coral.js';
import { MAGMA } from './tracks/magma.js';
import { NEON } from './tracks/neon.js';
import { CLOUDTOP } from './tracks/cloudtop.js';

export const TRACKS = [MEADOW, DUNES, GLACIER, STARLIGHT, CORAL, MAGMA, NEON, CLOUDTOP];

export const CUPS = [
  {
    id: 'comet',
    name: 'Comet Cup',
    tracks: [MEADOW.id, DUNES.id, GLACIER.id, STARLIGHT.id],
  },
  {
    id: 'nebula',
    name: 'Nebula Cup',
    tracks: [CORAL.id, MAGMA.id, NEON.id, CLOUDTOP.id],
  },
];

export function trackById(id) {
  return TRACKS.find(t => t.id === id) || TRACKS[0];
}

// Battle arena (Balloon Battle)
export const ARENA = {
  id: 'arena',
  name: 'Bumper Dome',
  type: 'arena',
  arenaRadius: 52,
  laps: 1,
  width: 104,
  theme: {
    skyTop: 0x151b3d, skyBottom: 0x4a3a75,
    ground: 0x2b3054, road: 0x4a5170, roadEdge: 0xe8b13d, rail: 0x7f8fc9,
    sun: { color: 0xffffff, intensity: 1.0, dir: [0.4, 1, 0.3] },
    ambient: 0x8890c8,
  },
  scatter: [
    { type: 'crystal', count: 14, minDist: 58, maxDist: 90 },
    { type: 'rock', count: 10, minDist: 56, maxDist: 85 },
  ],
  decorations: [],
};
