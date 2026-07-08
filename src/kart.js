// ============================================================
// Kart: arcade physics + procedural low-poly visuals.
//
// Motion model: `heading` is where the kart points, `travel` is
// where it actually moves. Travel chases heading at a grip rate;
// drifting lowers that rate, producing the slide. Speed is a
// scalar along travel. This gives MK-style forgiving handling
// with real counter-steer feel.
// ============================================================
import * as THREE from 'three';
import { PHYS } from './config.js';
import { clamp, lerp, damp, dampAngle, wrapAngle, angleDiff, rand } from './utils.js';

export const DRIFT_COLORS = [0x55b7ff, 0xffa726, 0xd76bff]; // blue, orange, purple

export class Kart {
  constructor(character, opts = {}) {
    this.character = character;
    this.isPlayer = !!opts.isPlayer;
    this.index = opts.index ?? 0;
    this.name = opts.name || character.name;

    // --- physics state ---
    this.pos = new THREE.Vector3();
    this.heading = 0;       // facing
    this.travel = 0;        // motion direction
    this.speed = 0;
    this.vy = 0;
    this.grounded = true;
    this.groundY = 0;
    this._prevGroundY = 0;

    // --- drift state machine: 'none' | 'hop' | 'drift' ---
    this.driftState = 'none';
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftTier = 0;     // 0 none, 1 blue, 2 orange, 3 purple

    // --- modifiers / timers ---
    this.boostTimer = 0;
    this.boostMult = PHYS.boostMult;
    this.spinTimer = 0;
    this.tumbleTimer = 0;
    this.squashTimer = 0;
    this.starTimer = 0;
    this.goldenTimer = 0;
    this.bulletTimer = 0;
    this.slipTimer = 0;
    this.respawnTimer = 0;
    this.padRefresh = 0;
    this.trickQueued = false;
    this.trickWindow = 0;
    this.airTime = 0;
    this.wrongWayTimer = 0;
    this.controlLock = true; // released at GO

    // --- inventory ---
    this.coins = 0;
    this.item = null;       // item id string
    this.itemCount = 0;     // charges (triple mushroom etc.)
    this.roulette = null;   // {t, result} while rolling
    this.dragging = false;  // holding item out behind as shield

    // --- battle mode ---
    this.balloons = 0;
    this.battleScore = 0;
    this.eliminated = false;

    // --- progress ---
    this.progressCont = 0;      // continuous sample index
    this.progressDist = 0;      // accumulated samples travelled (float)
    this.lap = 1;
    this.finished = false;
    this.finishTime = 0;
    this.rank = 1;

    // stats from character
    const c = character;
    this.stat = {
      speed: c.speed, accel: c.accel, handling: c.handling, weight: c.weight,
    };

    this.mesh = this._buildMesh();
    this._visual = { spinY: 0, tumbleX: 0, lean: 0, trickSpin: 0, bob: 0 };
  }

  // ----------------------------------------------------------
  reset(pos, heading, startIdx = 0) {
    this.pos.copy(pos);
    this.heading = heading;
    this.travel = heading;
    this.speed = 0; this.vy = 0; this.grounded = true;
    this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
    this.boostTimer = 0; this.spinTimer = 0; this.tumbleTimer = 0;
    this.squashTimer = 0; this.starTimer = 0; this.goldenTimer = 0;
    this.bulletTimer = 0; this.slipTimer = 0;
    this.item = null; this.itemCount = 0; this.roulette = null; this.dragging = false;
    this.coins = 0;
    this.progressCont = startIdx;
    this.progressDist = startIdx > 0 ? startIdx - 1e9 : 0; // fixed below by race
    this.lap = 1; this.finished = false;
    this.controlLock = true;
    this.mesh.position.copy(pos);
    this.mesh.rotation.set(0, heading, 0);
  }

  get isInvincible() { return this.starTimer > 0 || this.bulletTimer > 0 || this.respawnTimer > 0; }
  get isStunned() { return this.spinTimer > 0 || this.tumbleTimer > 0; }
  get maxCharge() { return PHYS.driftChargeTiers[2]; }

  // ----------------------------------------------------------
  // Main physics step. ctx: { track, controls, classScale, karts,
  //   effects, audio, events } — events is a sink for game sounds
  //   & race notifications: events.emit(name, kart, data)
  // ----------------------------------------------------------
  update(dt, ctx) {
    const { track, controls: c, classScale, events } = ctx;
    const P = PHYS;

    // timers
    for (const t of ['boostTimer','spinTimer','tumbleTimer','squashTimer','starTimer',
                     'goldenTimer','bulletTimer','respawnTimer','padRefresh','trickWindow']) {
      if (this[t] > 0) this[t] = Math.max(0, this[t] - dt);
    }

    const stunned = this.isStunned;
    const locked = this.controlLock || this.respawnTimer > 0;

    // ---------- bullet autopilot ----------
    if (this.bulletTimer > 0 && !track.isArena) {
      this._bulletUpdate(dt, ctx);
      this._updateProgress(track);
      return;
    }

    // ---------- steering / drift state machine ----------
    let steer = locked || stunned ? 0 : c.steer;
    let turn = 0;
    const speedFactor = clamp(Math.abs(this.speed) / P.turnSpeedRef, 0, 1) /
                        (1 + Math.abs(this.speed) * P.turnHighSpeedFalloff);

    if (this.driftState === 'drift') {
      // steering adjusts drift tightness between min and max
      const steerT = (steer * this.driftDir + 1) / 2; // 0 = against, 1 = into
      turn = this.driftDir * lerp(P.driftTurnMin, P.driftTurnMax, steerT) * speedFactor;
      this.driftCharge += dt * (1 + P.driftChargeTightBonus * steerT);
      const tiers = P.driftChargeTiers;
      const newTier = this.driftCharge >= tiers[2] ? 3 : this.driftCharge >= tiers[1] ? 2 :
                      this.driftCharge >= tiers[0] ? 1 : 0;
      if (newTier > this.driftTier) {
        this.driftTier = newTier;
        events?.emit('driftTier', this, newTier);
      }
      // drift ends when hop button released, or speed collapses
      if (!c.hop || stunned || Math.abs(this.speed) < P.minDriftSpeed * 0.55) {
        if (this.driftTier > 0 && !stunned) {
          const bTime = P.driftBoostTimes[this.driftTier - 1];
          this.applyBoost(bTime, P.boostMult);
          events?.emit('miniTurbo', this, this.driftTier);
        }
        this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
      }
    } else if (this.driftState === 'slide') {
      // realistic handbrake slide: steering stays free (with extra
      // authority) while the rear barely grips — the kart oversteers
      // and must be caught with counter-steer like a real car
      turn = steer * P.turnRate * this.stat.handling * speedFactor * P.hbSteerBonus;
      const slipSigned = wrapAngle(this.heading - this.travel);
      const slip = Math.abs(slipSigned);
      // spark side follows the actual slide direction
      if (Math.sign(slipSigned) !== 0) this.driftDir = Math.sign(slipSigned);

      if (slip > 1.5 && Math.abs(this.speed) > 6) {
        // overcooked it — past ~85 degrees the rear is gone: spin out
        this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
        this.spinOut(events);
      } else {
        // mini-turbo charges only while genuinely sideways
        this.driftCharge += dt * P.hbChargeRate * clamp(slip / P.hbFullSlip, 0, 1);
        const tiers = P.driftChargeTiers;
        const newTier = this.driftCharge >= tiers[2] ? 3 : this.driftCharge >= tiers[1] ? 2 :
                        this.driftCharge >= tiers[0] ? 1 : 0;
        if (newTier > this.driftTier) {
          this.driftTier = newTier;
          events?.emit('driftTier', this, newTier);
        }
        if (!c.handbrake || stunned || Math.abs(this.speed) < P.hbMinSpeed * 0.5) {
          // the payoff is only earned on a controlled, deliberate release —
          // stalling out or getting hit forfeits it
          const manualRelease = !c.handbrake && !stunned;
          if (this.driftTier > 0 && manualRelease) {
            const bTime = P.driftBoostTimes[this.driftTier - 1];
            this.applyBoost(bTime, P.boostMult);
            events?.emit('miniTurbo', this, this.driftTier);
          }
          this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
        }
      }
    } else {
      turn = steer * P.turnRate * this.stat.handling * speedFactor;
      if (this.speed < -0.5) turn = -turn; // reversing inverts steering
    }
    if (!this.grounded) turn *= P.airTurnMult;
    this.heading = wrapAngle(this.heading + turn * dt);

    // handbrake slide initiation (no hop needed — realistic drift)
    if (!locked && !stunned && c.handbrake && this.grounded &&
        this.driftState === 'none' && Math.abs(this.speed) > P.hbMinSpeed) {
      this.driftState = 'slide';
      this.driftDir = Math.sign(steer) || 1;
      this.driftCharge = 0; this.driftTier = 0;
      events?.emit('driftStart', this);
    }

    // hop initiation
    if (!locked && !stunned && c.hopPressed && this.grounded && this.driftState === 'none') {
      this.vy = P.hopVelocity;
      this.grounded = false;
      this.driftState = 'hop';
      events?.emit('hop', this);
    }
    // trick: hop pressed shortly after a ramp launch
    if (!this.grounded && this.trickWindow > 0 && c.hopPressed && !this.trickQueued && this.driftState !== 'hop') {
      this.trickQueued = true;
      events?.emit('trick', this);
    }

    // ---------- speed ----------
    const info = track.roadInfo(this.pos, Math.round(this.progressCont));
    const onRoad = info.onRoad;
    const boosting = this.boostTimer > 0;

    // _aiSpeedBias (>=1) is the AI rubber-band catch-up written by ai.js;
    // it must scale the physics cap or feathered throttle can't exceed it.
    let base = P.maxSpeed * classScale * this.stat.speed *
               (1 + this.coins * P.coinSpeedBonus) * (this._aiSpeedBias || 1);
    let mult = 1;
    if (boosting) mult = Math.max(mult, this.boostMult);
    if (this.starTimer > 0) mult = Math.max(mult, P.starSpeedMult);
    if (this.squashTimer > 0) mult *= P.squashSpeedMult;
    if (!onRoad && !boosting && this.starTimer <= 0 && !track.isArena) mult *= P.offroadMult;
    const topSpeed = base * mult;

    const accelHeld = !locked && !stunned && c.accel;
    // below sliding speed the handbrake is just a brake
    const brakeHeld = !locked && !stunned &&
      (c.brake || (c.handbrake && this.driftState !== 'slide'));

    if (stunned) {
      this.speed = damp(this.speed, 0, 2.5, dt);
    } else if (this.driftState === 'slide') {
      // sliding: tires scrub speed off with slip angle; throttle still
      // drives the kart but loses efficiency the more sideways it is
      const slip = Math.abs(angleDiff(this.heading, this.travel));
      if (accelHeld) {
        const eff = 1 - P.hbAccelSlipLoss * clamp(slip / P.hbFullSlip, 0, 1);
        this.speed = damp(this.speed, topSpeed * eff, P.accelRate * this.stat.accel * eff, dt);
      }
      this.speed = Math.max(0, this.speed - (P.hbDrag + P.hbScrub * slip) * dt);
    } else if (accelHeld && !brakeHeld) {
      const rate = (boosting ? P.boostAccelRate : P.accelRate) * this.stat.accel;
      if (this.speed > topSpeed + 1) {
        // over the cap (offroad / boost expired): bleed down
        this.speed = damp(this.speed, topSpeed, onRoad ? 1.2 : 3.0, dt);
      } else {
        this.speed = damp(this.speed, topSpeed, rate, dt);
      }
    } else if (brakeHeld) {
      if (this.speed > 0.5) this.speed = Math.max(0, this.speed - P.brakeDecel * dt);
      else if (c.brake) this.speed = damp(this.speed, P.reverseMax * classScale, 1.6, dt);
      else this.speed = damp(this.speed, 0, 6, dt); // handbrake alone never reverses
    } else {
      this.speed = damp(this.speed, 0, P.coastDecel / Math.max(6, Math.abs(this.speed)), dt);
    }
    if (!onRoad && !boosting && this.speed > topSpeed) {
      this.speed = Math.max(topSpeed, this.speed - P.offroadDrag * dt);
    }

    // ---------- travel chases heading ----------
    const gripRate = (this.driftState === 'slide' ? P.hbGripRate :
                      this.driftState === 'drift' ? P.driftGripRate : P.gripRate) * track.grip;
    this.travel = this.grounded
      ? dampAngle(this.travel, this.heading, gripRate, dt)
      : dampAngle(this.travel, this.heading, gripRate * 0.12, dt);

    // ---------- integrate position ----------
    const dirX = Math.sin(this.travel), dirZ = Math.cos(this.travel);
    this.pos.x += dirX * this.speed * dt;
    this.pos.z += dirZ * this.speed * dt;

    // ---------- vertical / ground ----------
    const info2 = track.roadInfo(this.pos, Math.round(this.progressCont));
    this.groundY = info2.groundY;

    if (info2.groundY === null) {
      // over the void (floating tracks)
      this.grounded = false;
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y < P.fallResetY) {
        events?.emit('fall', this);
        this._respawn(track, events);
      }
    } else if (this.grounded) {
      const slope = (info2.groundY - this._prevGroundY) / Math.max(dt, 1e-4);
      if (info2.groundY < this.pos.y - 0.5) {
        // ground dropped away — launched off a crest/ramp
        this.grounded = false;
        this.vy = clamp(this._slopeVy || 0, 0, 11);
        this.trickWindow = 0.32;
        this.airTime = 0;
      } else {
        this.pos.y = info2.groundY;
        this._slopeVy = slope;
        this._prevGroundY = info2.groundY;
      }
    } else {
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      this.airTime += dt;
      if (this.pos.y <= info2.groundY + 0.01 && this.vy <= 0) {
        // landing
        this.pos.y = info2.groundY;
        this.grounded = true;
        this.vy = 0;
        this._prevGroundY = info2.groundY;
        this._slopeVy = 0;
        events?.emit('land', this);
        if (this.trickQueued) {
          this.trickQueued = false;
          this.applyBoost(P.trickBoostTime, P.boostMult);
          events?.emit('trickLand', this);
        }
        // landing while holding hop + steer => start drifting
        if (this.driftState === 'hop') {
          if (c.hop && Math.abs(c.steer) > 0.2 && this.speed > P.minDriftSpeed && !stunned) {
            this.driftState = 'drift';
            this.driftDir = Math.sign(c.steer);
            this.driftCharge = 0; this.driftTier = 0;
            events?.emit('driftStart', this);
          } else {
            this.driftState = 'none';
          }
        }
      }
    }

    // ---------- boost pads ----------
    if (this.grounded && track.isBoostPad && track.isBoostPad(info2.idx, info2.lateral)) {
      if (this.padRefresh <= 0) events?.emit('boostPad', this);
      this.applyBoost(P.padBoostTime, P.boostMult);
      this.padRefresh = 0.6;
    }

    // ---------- walls / obstacles ----------
    if (track.clampToBounds(this)) {
      this.speed *= (1 - 2.2 * dt);
      // reflect travel slightly toward the road direction
      if (!track.isArena) this.travel = dampAngle(this.travel, info2.heading ?? this.travel, 6, dt);
      // arena: just clamp position, keep current travel direction
    }
    if (track.collideObstacles(this)) {
      if (this.starTimer > 0 || this.bulletTimer > 0) {
        // smash through decorations while invincible: no penalty
      } else {
        this.speed *= (1 - 4.5 * dt);
        if (Math.abs(this.speed) > 18 && events) events.emit('bump', this);
      }
    }

    // ---------- slipstream ----------
    this._slipstream(dt, ctx, onRoad);

    // ---------- progress / laps ----------
    if (!track.isArena) this._updateProgress(track, events);

    // wrong-way detection
    if (!track.isArena && this.isPlayer) {
      const trackH = track.spline.heading(Math.floor(this.progressCont));
      const facing = Math.abs(angleDiff(this.travel, trackH));
      if (facing > 2.2 && Math.abs(this.speed) > 6) this.wrongWayTimer += dt;
      else this.wrongWayTimer = 0;
    }
  }

  _slipstream(dt, ctx, onRoad) {
    const P = PHYS;
    if (!ctx.karts || this.boostTimer > 0 || !onRoad || Math.abs(this.speed) < 14) {
      this.slipTimer = Math.max(0, this.slipTimer - dt * 2);
      return;
    }
    let inWake = false;
    for (const other of ctx.karts) {
      if (other === this || other.finished) continue;
      const dx = other.pos.x - this.pos.x, dz = other.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > P.slipRange || dist < 2) continue;
      const angTo = Math.atan2(dx, dz);
      if (Math.abs(angleDiff(angTo, this.travel)) > 0.30) continue;
      // lateral offset from the leader's wake line
      const lat = Math.abs(Math.sin(angleDiff(angTo, other.travel))) * dist;
      if (lat > P.slipLateral) continue;
      if (Math.abs(other.speed) < 14) continue;
      inWake = true;
      break;
    }
    if (inWake) {
      this.slipTimer += dt;
      if (this.slipTimer >= P.slipTimeNeeded) {
        this.slipTimer = 0;
        this.applyBoost(P.slipstreamBoostTime, P.slipstreamBoostMult);
        ctx.events?.emit('slipstream', this);
      }
    } else {
      this.slipTimer = Math.max(0, this.slipTimer - dt * 2);
    }
  }

  _bulletUpdate(dt, ctx) {
    const { track } = ctx;
    const P = PHYS;
    const sp = track.spline;
    const look = 6;
    const target = sp.pointAt((this.progressCont + look) % sp.count);
    const desired = Math.atan2(target.x - this.pos.x, target.z - this.pos.z);
    this.heading = dampAngle(this.heading, desired, 7, dt);
    this.travel = this.heading;
    this.speed = P.maxSpeed * ctx.classScale * P.bulletSpeedMult;
    this.pos.x += Math.sin(this.travel) * this.speed * dt;
    this.pos.z += Math.cos(this.travel) * this.speed * dt;
    const info = track.roadInfo(this.pos, Math.round(this.progressCont));
    if (info.groundY !== null) this.pos.y = damp(this.pos.y, info.groundY + 0.5, 8, dt);
    this.grounded = true;
    if (this.bulletTimer <= 0) ctx.events?.emit('bulletEnd', this);
  }

  _updateProgress(track, events = null) {
    const sp = track.spline;
    const N = sp.count;
    const cont = sp.continuousIndex(this.pos, Math.round(this.progressCont));
    let delta = cont - (this.progressCont % N);
    // wrap to [-N/2, N/2)
    while (delta > N / 2) delta -= N;
    while (delta < -N / 2) delta += N;
    // reject teleports (respawn sets progress explicitly)
    if (Math.abs(delta) < N / 6) {
      this.progressDist += delta;
      this.progressCont = cont;
    }
    const newLap = Math.floor(this.progressDist / N) + 1;
    if (newLap > this.lap) {
      this.lap = newLap;
      events?.emit('lap', this, newLap);
    } else if (newLap < this.lap) {
      this.lap = Math.max(1, newLap); // drove backwards over the line
    }
  }

  _respawn(track, events) {
    const sp = track.spline;
    const idx = Math.max(0, Math.floor(this.progressCont) - 4);
    const p = sp.point(idx);
    this.pos.set(p.x, p.y + 0.5, p.z);
    this.heading = this.travel = sp.heading(idx);
    this.speed = 0; this.vy = 0; this.grounded = true;
    this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
    this.boostTimer = 0;
    this.respawnTimer = PHYS.respawnDelay;
    this.progressCont = idx;
    // keep progressDist consistent with the respawn point
    const N = sp.count;
    const lapBase = Math.floor(this.progressDist / N) * N;
    this.progressDist = Math.min(this.progressDist, lapBase + idx);
    events?.emit('respawn', this);
  }

  applyBoost(time, mult = PHYS.boostMult) {
    this.boostMult = Math.max(mult, this.boostTimer > 0 ? this.boostMult : 0);
    this.boostTimer = Math.max(this.boostTimer, time);
    // instant punch so boosts feel snappy
    const target = PHYS.maxSpeed * (this._classScale || 1) * this.stat.speed * mult;
    if (this.speed < target * 0.92 && this.speed > -2) this.speed = Math.max(this.speed, target * 0.85);
  }

  // ---------- hit reactions ----------
  spinOut(events) {
    if (this.isInvincible || this.tumbleTimer > 0) return false;
    this.spinTimer = PHYS.spinTime;
    this.speed *= 0.4;
    this.coins = Math.max(0, this.coins - PHYS.coinsLostOnSpin);
    this._endDrift();
    events?.emit('spin', this);
    return true;
  }

  tumble(events, strength = 1) {
    if (this.isInvincible) return false;
    this.tumbleTimer = PHYS.tumbleTime * strength;
    this.speed *= 0.15;
    this.vy = Math.max(this.vy, 3.5 * strength);
    this.grounded = false;
    this.coins = Math.max(0, this.coins - PHYS.coinsLostOnTumble);
    this._endDrift();
    events?.emit('tumble', this);
    return true;
  }

  squash(events) {
    if (this.isInvincible || this.bulletTimer > 0) return false;
    this.squashTimer = PHYS.squashTime;
    this.speed *= 0.5;
    this._endDrift();
    events?.emit('squash', this);
    return true;
  }

  _endDrift() {
    this.driftState = 'none'; this.driftCharge = 0; this.driftTier = 0;
  }

  // ----------------------------------------------------------
  // Visuals
  // ----------------------------------------------------------
  _buildMesh() {
    const c = this.character;
    const g = new THREE.Group();
    const bodyMats = [];
    const mat = (color) => {
      const m = new THREE.MeshLambertMaterial({ color });
      bodyMats.push(m);
      return m;
    };

    // chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.7), mat(c.color));
    chassis.position.y = 0.55;
    g.add(chassis);
    // nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.9), mat(c.color));
    nose.position.set(0, 0.62, 1.55);
    nose.rotation.x = 0.18;
    g.add(nose);
    // seat back
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.3), mat(c.accent));
    seat.position.set(0, 1.0, -0.85);
    g.add(seat);
    // driver: torso + helmet
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.5), mat(c.accent));
    torso.position.set(0, 1.15, -0.25);
    g.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat(c.color));
    helmet.position.set(0, 1.75, -0.25);
    g.add(helmet);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x1a1d26 }));
    visor.position.set(0, 1.75, 0.08);
    g.add(visor);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x23252b });
    const hubMat = new THREE.MeshLambertMaterial({ color: 0xcfd3da });
    this.wheels = [];
    for (const [x, z, front] of [[-0.95, 0.95, 1], [0.95, 0.95, 1], [-0.95, -0.95, 0], [0.95, -0.95, 0]]) {
      const w = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8).rotateZ(Math.PI / 2), hubMat);
      w.add(tire, hub);
      w.position.set(x, 0.42, z);
      w.userData.front = !!front;
      g.add(w);
      this.wheels.push(w);
    }

    // exhausts (boost flame anchors)
    const exMat = new THREE.MeshLambertMaterial({ color: 0x9aa0ab });
    this.exhausts = [];
    for (const x of [-0.45, 0.45]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.5, 8), exMat);
      ex.position.set(x, 0.72, -1.45);
      ex.rotation.x = Math.PI / 2.4;
      g.add(ex);
      this.exhausts.push(ex);
    }

    // blob shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 18),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    this.shadow = shadow;

    // container: outer group positions on track, inner tilts/spins for effects
    const outer = new THREE.Group();
    this.body = g;
    outer.add(g);
    outer.add(shadow);
    this._bodyMats = bodyMats;
    this._baseColors = bodyMats.map(m => m.color.getHex());
    return outer;
  }

  updateVisual(dt, time) {
    const v = this._visual;
    const m = this.mesh;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);

    // spin-out: fast yaw spin
    if (this.spinTimer > 0) v.spinY += dt * 13;
    else v.spinY = damp(v.spinY, Math.round(v.spinY / (Math.PI * 2)) * Math.PI * 2, 12, dt);

    // tumble: roll over
    if (this.tumbleTimer > 0) v.tumbleX += dt * 9;
    else v.tumbleX = damp(v.tumbleX, Math.round(v.tumbleX / (Math.PI * 2)) * Math.PI * 2, 10, dt);

    // trick spin
    if (this.trickQueued && !this.grounded) v.trickSpin += dt * 9;
    else v.trickSpin = damp(v.trickSpin, Math.round(v.trickSpin / (Math.PI * 2)) * Math.PI * 2, 9, dt);

    // drift lean
    const targetLean = this.driftState === 'drift' ? -this.driftDir * 0.20 :
      -clamp(wrapAngle(this.heading - this.travel), -0.5, 0.5) * 0.35;
    v.lean = damp(v.lean, targetLean, 8, dt);

    m.rotation.y = this.heading;
    this.body.rotation.set(v.tumbleX, v.spinY + v.trickSpin, v.lean);

    // squash scale
    const sq = this.squashTimer > 0 ? PHYS.squashScale : 1;
    const targetScale = sq;
    this.body.scale.y = damp(this.body.scale.y, targetScale, 8, dt);
    this.body.scale.x = damp(this.body.scale.x, targetScale === 1 ? 1 : 1.15, 8, dt);
    this.body.scale.z = this.body.scale.x;

    // wheels
    for (const w of this.wheels) {
      w.rotation.x += this.speed * dt / 0.42;
      if (w.userData.front) w.rotation.y = damp(w.rotation.y, (this.driftState === 'drift' ? this.driftDir * 0.5 : 0), 10, dt);
    }

    // star rainbow flash
    if (this.starTimer > 0) {
      const hue = (time * 2.2) % 1;
      for (const mat of this._bodyMats) {
        mat.emissive.setHSL(hue, 0.9, 0.5);
        mat.emissiveIntensity = 0.85;
      }
    } else if (this.respawnTimer > 0) {
      const blink = Math.sin(time * 25) > 0 ? 0.5 : 0;
      for (const mat of this._bodyMats) { mat.emissive.set(0xffffff); mat.emissiveIntensity = blink * 0.4; }
    } else if (this.bulletTimer > 0) {
      for (const mat of this._bodyMats) { mat.emissive.set(0x222233); mat.emissiveIntensity = 0.9; }
    } else {
      for (const mat of this._bodyMats) mat.emissiveIntensity = 0;
    }

    // shadow: sits on the ground, fades with height
    if (this.groundY !== null) {
      this.shadow.visible = true;
      this.shadow.position.y = (this.groundY - this.pos.y) + 0.08;
      const h = clamp(this.pos.y - this.groundY, 0, 8);
      this.shadow.material.opacity = 0.32 * (1 - h / 10);
      const s = 1 + h * 0.05;
      this.shadow.scale.set(s, s, s);
    } else {
      this.shadow.visible = false;
    }
  }
}
