// ============================================================
// Comet Karts — central tuning config.
// Every gameplay-relevant constant lives here so the whole
// game can be rebalanced from one file.
// ============================================================

export const PHYS = {
  // --- base kart movement (150cc reference values, units/second) ---
  maxSpeed: 36,            // top speed on road
  accelRate: 1.9,          // exponential approach rate toward max speed
  brakeDecel: 46,          // braking deceleration
  coastDecel: 10,          // deceleration when not accelerating
  reverseMax: -11,         // max reverse speed
  offroadMult: 0.52,       // max-speed multiplier off the road
  offroadDrag: 24,         // extra decel when offroad above the offroad cap

  // --- steering ---
  turnRate: 2.05,          // rad/s at full steer, mid speed
  turnSpeedRef: 7,         // speed at which full turn authority is reached
  turnHighSpeedFalloff: 0.010, // turn authority loss per unit speed
  airTurnMult: 0.35,       // steering authority while airborne
  gripRate: 8.5,           // how fast travel direction chases heading (on road)
  driftGripRate: 2.3,      // same, while drifting (lower = more slide)

  // --- hop / drift / mini-turbo ---
  hopVelocity: 5.4,
  gravity: 19,
  minDriftSpeed: 13,
  driftTurnMin: 0.55,      // rad/s drifting, steering fully against the drift
  driftTurnMax: 2.75,      // rad/s drifting, steering fully into the drift
  driftChargeTiers: [1.0, 2.15, 3.5],   // seconds of charge: blue / orange / purple
  driftBoostTimes: [0.62, 1.15, 1.75],  // boost duration per tier
  driftChargeTightBonus: 0.65, // extra charge rate when steering into the drift

  // --- realistic handbrake drift (hold C) ---
  hbGripRate: 1.05,        // travel barely chases heading => big slip angles
  hbSteerBonus: 1.3,       // extra steering authority while sliding
  hbDrag: 4.0,             // base decel while the handbrake is down
  hbScrub: 2.8,            // extra decel per radian of slip (tyres scrubbing)
  hbMinSpeed: 13,          // below this the handbrake just brakes
  hbChargeRate: 1.05,      // mini-turbo charge per second at full slip
  hbFullSlip: 0.55,        // slip angle (rad) that counts as "full slip"
  hbAccelSlipLoss: 0.55,   // throttle efficiency lost at full slip

  // --- boosts ---
  boostMult: 1.32,         // top-speed multiplier while boosting
  boostAccelRate: 5.5,     // faster approach while boosting
  mushroomBoostTime: 1.5,
  padBoostTime: 1.05,
  trickBoostTime: 0.75,
  slipstreamBoostTime: 0.95,
  slipstreamBoostMult: 1.20,

  // --- slipstream detection ---
  slipRange: 26,           // how far ahead the leading kart may be
  slipLateral: 3.2,        // max lateral offset from the leader's wake
  slipTimeNeeded: 0.85,    // seconds inside the wake before the boost fires

  // --- collisions ---
  kartRadius: 1.6,
  bumpRestitution: 6.0,    // impulse scale for kart-vs-kart bumps

  // --- hit reactions (seconds) ---
  spinTime: 1.0,           // banana
  tumbleTime: 1.5,         // shells / explosions
  squashTime: 3.6,         // lightning
  squashScale: 0.45,
  squashSpeedMult: 0.62,

  // --- star / bullet ---
  starTime: 7.5,
  starSpeedMult: 1.15,
  goldenTime: 7.5,
  bulletTime: 5.0,
  bulletSpeedMult: 2.15,

  // --- coins ---
  coinMax: 10,
  coinSpeedBonus: 0.004,   // +0.4% max speed per coin
  coinsLostOnTumble: 3,
  coinsLostOnSpin: 1,

  // --- misc ---
  respawnDelay: 1.1,       // seconds of freeze after Lakitu-style reset
  fallResetY: -26,         // fall this far below the road => respawn
  wrongWayTime: 1.4,       // seconds driving backwards before the warning
  rocketWindow: 0.45,      // press accel within this window before GO => rocket start
  rocketPenaltyWindow: 1.4,// held longer than this before GO => burnout (no boost)
  rocketBoostTime: 1.0,
};

// Engine classes scale global speed and AI aggression.
export const CLASSES = {
  '50cc':  { label: '50cc',  speedScale: 0.72, aiSkill: 0.40, unlockNote: 'Relaxed' },
  '100cc': { label: '100cc', speedScale: 0.86, aiSkill: 0.65, unlockNote: 'Standard' },
  '150cc': { label: '150cc', speedScale: 1.00, aiSkill: 0.85, unlockNote: 'Fast' },
  '200cc': { label: '200cc', speedScale: 1.22, aiSkill: 1.00, unlockNote: 'You WILL need the brake' },
};

// Playable characters. Stats are multipliers around 1.0.
export const CHARACTERS = [
  { id: 'dash',  name: 'Dash',  color: 0xe23b3b, accent: 0xffffff, speed: 1.00, accel: 1.00, handling: 1.00, weight: 1.00, desc: 'All-rounder' },
  { id: 'bolt',  name: 'Bolt',  color: 0xf7d048, accent: 0x333333, speed: 0.96, accel: 1.12, handling: 1.06, weight: 0.82, desc: 'Quick off the line' },
  { id: 'titan', name: 'Titan', color: 0x3f9e4d, accent: 0xd8ffd8, speed: 1.07, accel: 0.88, handling: 0.92, weight: 1.30, desc: 'Heavy hitter' },
  { id: 'pixie', name: 'Pixie', color: 0xf273b6, accent: 0xffffff, speed: 0.94, accel: 1.08, handling: 1.14, weight: 0.72, desc: 'Corner queen' },
  { id: 'chill', name: 'Chill', color: 0x53c8e8, accent: 0x0b3b4d, speed: 0.98, accel: 1.03, handling: 1.08, weight: 0.90, desc: 'Smooth operator' },
  { id: 'blaze', name: 'Blaze', color: 0xf28c28, accent: 0x51260a, speed: 1.05, accel: 0.95, handling: 0.96, weight: 1.10, desc: 'Top-speed demon' },
  { id: 'shade', name: 'Shade', color: 0x8459d8, accent: 0x1d1035, speed: 1.02, accel: 0.98, handling: 1.00, weight: 1.05, desc: 'Mysterious drifter' },
  { id: 'mecha', name: 'Mecha', color: 0x9aa5b1, accent: 0x2b2f36, speed: 1.03, accel: 0.92, handling: 1.02, weight: 1.22, desc: 'Cold precision' },
];

// ============================================================
// Item system
// ============================================================
export const ITEMS = {
  coin:     { name: 'Coins',            icon: '🪙' },
  banana:   { name: 'Banana',           icon: '🍌' },
  green:    { name: 'Green Shell',      icon: '🟢' },
  red:      { name: 'Red Shell',        icon: '🔴' },
  spiny:    { name: 'Spiny Shell',      icon: '🔵' },
  mush:     { name: 'Mushroom',         icon: '🍄' },
  mush3:    { name: 'Triple Mushroom',  icon: '🍄' },
  golden:   { name: 'Golden Mushroom',  icon: '✨' },
  star:     { name: 'Star',             icon: '⭐' },
  light:    { name: 'Lightning',        icon: '⚡' },
  rocket:   { name: 'Rocket',           icon: '🚀' },
};

// Position-weighted probability matrix. Row = race position (1st..8th).
// Columns:            coin banana green red spiny mush mush3 gold star light rocket
export const ITEM_WEIGHTS = [
  /* 1st */ [ 32,  27,  27,   0,   0,   6,   0,   0,   0,   0,   0 ],
  /* 2nd */ [ 18,  22,  25,  17,   2,   9,   4,   0,   0,   0,   0 ],
  /* 3rd */ [  9,  17,  21,  22,   5,  13,   7,   2,   0,   0,   0 ],
  /* 4th */ [  4,  11,  14,  22,   8,  16,  11,   6,   3,   0,   0 ],
  /* 5th */ [  0,   7,   9,  17,  10,  15,  16,  11,   7,   3,   0 ],
  /* 6th */ [  0,   3,   5,  11,  10,  11,  18,  16,  11,   7,   4 ],
  /* 7th */ [  0,   1,   2,   5,   8,   9,  15,  19,  15,  11,  11 ],
  /* 8th */ [  0,   0,   1,   2,   6,   7,  11,  18,  17,  13,  20 ],
];
export const ITEM_ORDER = ['coin','banana','green','red','spiny','mush','mush3','golden','star','light','rocket'];

// Battle mode uses a flat, restricted item table.
export const BATTLE_ITEMS = { banana: 22, green: 26, red: 20, mush: 18, star: 8, mush3: 6 };

export const ITEM_TUNING = {
  rouletteTime: 1.35,       // seconds the roulette spins
  boxRespawn: 3.5,          // seconds before an item box reappears
  greenSpeed: 52,
  greenLife: 7,
  greenBounces: 6,
  redSpeed: 48,
  redLife: 9,
  redHomingDist: 14,        // switch from path-following to direct homing
  spinySpeed: 78,
  spinyBlastRadius: 8.5,
  coinPickup: 2,            // coins granted by the coin item
  dragOffset: 2.4,          // how far behind the kart a dragged item sits
  throwForwardArc: 26,      // forward banana toss velocity
};

// Grand Prix points for positions 1..8 (MK8-style for 8 racers).
export const GP_POINTS = [15, 12, 10, 9, 8, 7, 6, 5];

export const RACE = {
  kartCount: 8,
  defaultLaps: 3,
  countdownStep: 0.85,      // seconds per countdown beat
  finishAutoFill: 12,       // seconds after player finish before DNF karts are auto-placed
  ttMushrooms: 3,           // mushrooms granted in Time Trial
};

export const BATTLE = {
  duration: 120,            // seconds
  balloons: 3,
  koPoints: 1,
};

// AI tuning
export const AI = {
  lookaheadMin: 9,
  lookaheadSpeedFactor: 0.55,
  lookaheadMax: 26,
  rubberBandRange: 110,     // distance over which rubber-banding saturates
  rubberBandBoost: 0.16,    // max speed bonus when far behind the player
  rubberBandSlow: 0.10,     // max speed penalty when far ahead
  itemDelayMin: 0.6,
  itemDelayMax: 3.2,
  driftMinCharge: 0.9,      // AI releases drift after at least this much charge
  mistakeRate: 0.35,        // per-driver wobble scale at low skill
};
