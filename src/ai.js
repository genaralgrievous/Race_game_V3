// ============================================================
// AIController: fills a controls object each frame.
// Pure-pursuit on the spline with per-driver personality,
// drift usage on sustained curves, hazard avoidance, item
// logic, and distance-based rubber-banding toward the player.
// ============================================================
import { AI, PHYS } from './config.js';
import { clamp, lerp, rand, angleDiff, wrapAngle } from './utils.js';
import { Input } from './input.js';

export class AIController {
  constructor(kart, opts = {}) {
    this.kart = kart;
    this.skill = opts.skill ?? 0.8;          // 0..1 from engine class
    this.itemSystem = opts.itemSystem;
    this.getPlayer = opts.getPlayer;         // () => player kart (or null in battle)
    this.battle = !!opts.battle;

    // personality
    this.lineOffset = rand(-0.30, 0.30);     // preferred lane (fraction of halfW)
    this.wobbleSeed = rand(100);
    this.aggression = rand(0.4, 1);
    this.reaction = rand(0.05, 0.35);

    this.controls = Input.emptyControls();
    this._itemTimer = rand(AI.itemDelayMin, AI.itemDelayMax);
    this._driftHold = 0;
    this._driftCooldown = 0;
    this._startDelay = rand(0.02, 0.5) * (1.2 - this.skill);
    this._stuckT = 0;
    this._reverseT = 0;
    this._battleTarget = null;
    this._battleRetarget = 0;
  }

  compute(dt, ctx) {
    const c = this.controls;
    c.hopPressed = false; c.itemPressed = false; c.itemReleased = false;
    if (this.battle) return this._computeBattle(dt, ctx);

    const k = this.kart;
    const track = ctx.track;
    const sp = track.spline;
    const time = ctx.time;

    // ---------- rubber-banding ----------
    let speedBias = 1;
    const player = this.getPlayer && this.getPlayer();
    if (player && player !== k) {
      const gap = (player.progressDist - k.progressDist) * sp.segLength; // + => AI behind
      const f = clamp(gap / AI.rubberBandRange, -1, 1);
      speedBias = f > 0
        ? 1 + AI.rubberBandBoost * f * (0.5 + this.skill * 0.5)
        : 1 - AI.rubberBandSlow * -f;
    }
    // Catch-up must raise the kart's REAL top speed — throttle feathering
    // alone can't exceed the physics cap. kart.js multiplies base speed
    // by _aiSpeedBias. The slow-down side stays throttle-based.
    k._aiSpeedBias = Math.max(1, speedBias);
    // AI throttles by *feathering* accel rather than a hidden speed cap:
    const skillTop = lerp(0.88, 1.0, this.skill) * speedBias;
    const topAllowed = PHYS.maxSpeed * ctx.classScale * k.stat.speed * skillTop;

    // ---------- corner-speed planning ----------
    // Scan the road just ahead for its sharpest bend, then derive a
    // takeable speed. The kart's steering is rate-limited, so max
    // cornering speed ~= angularRate / curvature, scaled by grip.
    let aheadCurv = 0;
    for (let d = 4; d <= 24; d += 3) {
      aheadCurv = Math.max(aheadCurv,
        Math.abs(sp.curvature(Math.floor((k.progressCont + d / sp.segLength) % sp.count))));
    }
    // Turn authority scales with handling; skilled drivers (who drift)
    // can commit to hotter entries than rookies who steer normally.
    const turnBudget = (1.3 + 0.5 * this.skill) * k.stat.handling * track.grip;
    const cornerSpeed = clamp(turnBudget / Math.max(aheadCurv, 0.001), 10, 999);
    const targetSpeed = Math.min(topAllowed, cornerSpeed);

    // ---------- steering: pure pursuit ----------
    // Shorten the lookahead through twisty bits so the line doesn't cut
    // across the apex and run wide on exit.
    const twist = clamp(aheadCurv * 42, 0, 1);
    const look = clamp(AI.lookaheadMin + Math.abs(k.speed) * AI.lookaheadSpeedFactor,
      AI.lookaheadMin, AI.lookaheadMax) * (1 - 0.42 * twist);
    const lookIdx = (k.progressCont + look / sp.segLength) % sp.count;
    const target = sp.pointAt(lookIdx);

    // lane offset + curvature cut (hug the inside of turns) — but when
    // offroad, aim straight for the centerline instead
    const curv = sp.curvature(Math.floor(lookIdx));
    const info = track.roadInfo(k.pos, Math.round(k.progressCont));
    if (info.onRoad) {
      const left = sp.left(Math.floor(lookIdx));
      const cut = clamp(curv * 42, -0.42, 0.42);   // inside = +curv side
      const laneF = clamp(this.lineOffset * 0.7 + cut, -0.48, 0.48);
      target.x += left.x * laneF * track.halfW;
      target.z += left.z * laneF * track.halfW;
    }

    // hazard avoidance: dodge bananas/shells lying ahead
    this._avoidHazards(target, track);

    const desired = Math.atan2(target.x - k.pos.x, target.z - k.pos.z);
    let err = angleDiff(desired, k.heading);

    // wobble (mistakes) scaled down with skill
    err += Math.sin(time * 1.3 + this.wobbleSeed) * AI.mistakeRate * (1 - this.skill) * 0.25;

    c.steer = clamp(err * 2.2, -1, 1);

    // ---------- throttle: chase targetSpeed (corner-aware) ----------
    // Per-driver launch stagger: reaction time after GO, scaled by skill.
    if (ctx.raceState !== 'countdown' && this._goDelay == null) this._goDelay = this._startDelay;
    if (this._goDelay != null && this._goDelay > 0) this._goDelay -= dt;
    const startOK = ctx.raceState !== 'countdown' && (this._goDelay == null || this._goDelay <= 0);
    c.accel = startOK && k.speed < targetSpeed;
    c.brake = false;
    // brake when carrying too much speed into a bend (harder on ice)
    const brakeThresh = targetSpeed * (1.12 + 0.1 * track.grip);
    if (startOK && k.speed > brakeThresh && k.speed > 14) {
      c.brake = true; c.accel = false;
    }

    // ---------- recovery when stuck / facing wrong way ----------
    if (Math.abs(k.speed) < 3 && ctx.raceState === 'running' && !k.controlLock && !k.isStunned) {
      this._stuckT += dt;
    } else this._stuckT = Math.max(0, this._stuckT - dt);
    if (this._reverseT > 0) {
      this._reverseT -= dt;
      c.accel = false; c.brake = true; c.steer = -c.steer;
    } else if (this._stuckT > 1.6) {
      this._reverseT = 0.8; this._stuckT = 0;
    }

    // ---------- drifting ----------
    this._driftLogic(dt, ctx, curv);

    // ---------- items ----------
    this._itemLogic(dt, ctx);
    return c;
  }

  _driftLogic(dt, ctx, curvNear) {
    const c = this.controls, k = this.kart;
    const sp = ctx.track.spline;
    this._driftCooldown = Math.max(0, this._driftCooldown - dt);
    if (this.skill < 0.45) return; // rookies don't drift

    if (k.driftState === 'hop') {
      // committed to the hop: keep the button and steer held so the
      // drift actually starts on landing
      c.hop = true;
      if (Math.abs(c.steer) < 0.35) c.steer = Math.sign(this._driftIntent || 1) * 0.6;
      return;
    }

    if (k.driftState === 'drift') {
      this._driftHold += dt;
      c.hop = true;
      // steer into the drift, keep charging until the curve ends
      const aheadCurv = sp.curvature(Math.floor((k.progressCont + 10 / sp.segLength) % sp.count));
      const stillCurving = Math.sign(aheadCurv) === k.driftDir && Math.abs(aheadCurv) > 0.004;
      const ranWide = !ctx.track.roadInfo(k.pos, Math.round(k.progressCont)).onRoad;
      const wantRelease = (k.driftCharge > AI.driftMinCharge * (0.8 + this.skill) && !stillCurving) || ranWide;
      if (wantRelease || k.driftCharge > PHYS.driftChargeTiers[2] + 0.6) {
        c.hop = false; // release => mini-turbo
        this._driftHold = 0;
        this._driftCooldown = 1.4;
      }
      return;
    }
    c.hop = false;

    // consider starting a drift: sustained curvature ahead & enough speed
    if (k.grounded && this._driftCooldown <= 0 && Math.abs(k.speed) > PHYS.minDriftSpeed + 3) {
      let sum = 0;
      for (let d = 6; d <= 26; d += 5) {
        sum += sp.curvature(Math.floor((k.progressCont + d / sp.segLength) % sp.count));
      }
      if (Math.abs(sum) > 0.028 && Math.random() < this.skill) {
        this._driftIntent = Math.sign(sum);
        c.hopPressed = true;
        c.hop = true;
        c.steer = clamp(c.steer + Math.sign(sum) * 0.6, -1, 1);
      } else if (Math.abs(sum) <= 0.028) {
        this._driftCooldown = 0.35; // re-check soon, not every frame
      }
    }
  }

  _avoidHazards(target, track) {
    const k = this.kart;
    const its = this.itemSystem;
    if (!its) return;
    const scan = (pos) => {
      const dx = pos.x - k.pos.x, dz = pos.z - k.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 26 || dist < 1) return;
      const ang = Math.atan2(dx, dz);
      const rel = angleDiff(ang, k.travel);
      if (Math.abs(rel) < 0.32) {
        // dodge sideways, more urgently when close
        const side = rel > 0 ? -1 : 1;
        const urgency = (1 - dist / 26) * 6;
        target.x += Math.cos(k.travel) * side * urgency;
        target.z += -Math.sin(k.travel) * side * urgency;
      }
    };
    for (const h of its.hazards) scan(h.pos);
    for (const p of its.projectiles) if (p.owner !== k && p.type !== 'spiny') scan(p.pos);
  }

  _itemLogic(dt, ctx) {
    const c = this.controls, k = this.kart;
    if (k.finished) return; // no sniping the pack from the victory lap
    if (!k.item || k.roulette) { this._itemTimer = rand(AI.itemDelayMin, AI.itemDelayMax); return; }
    this._itemTimer -= dt;
    if (this._itemTimer > 0) return;

    const its = this.itemSystem;
    switch (k.item) {
      case 'green': {
        // fire when a kart is roughly ahead
        const t = this._opponentInCone(0.25, 42);
        if (t) this._tap(c);
        else if (Math.random() < 0.02) this._tap(c); // eventually just yeet it
        break;
      }
      case 'red': {
        const ahead = its && its._kartAhead(k);
        if (ahead && (ahead.progressDist - k.progressDist) * ctx.track.spline.segLength < 70) this._tap(c);
        // leading with a red: no target exists — eventually fire it as a
        // straight shot so the slot isn't blocked for the rest of the race
        else if (!ahead && Math.random() < 0.02) this._tap(c);
        break;
      }
      case 'banana': {
        // drop when someone is close behind, or randomly
        const behind = this._opponentInCone(0.5, 14, true);
        if (behind || Math.random() < 0.015) this._tap(c);
        break;
      }
      case 'mush': case 'mush3': {
        // burn on straights
        const sp = ctx.track.spline;
        const curv = Math.abs(sp.curvature(Math.floor((k.progressCont + 10 / sp.segLength) % sp.count)));
        if (curv < 0.004 || k.rank >= 6) this._tap(c);
        break;
      }
      case 'golden': {
        if (k.goldenTimer > 0 || Math.random() < 0.5) this._tap(c);
        break;
      }
      default:
        this._tap(c); // star / lightning / spiny / rocket / coin: fire away
    }
  }

  _tap(c) {
    c.itemPressed = true;
    c.itemReleased = true;   // press+release same frame = instant use / quick throw
    c.brake = false;         // items.js reads brake as "throw backwards" — don't
                             // let a braking frame silently reverse the throw
    this._itemTimer = rand(AI.itemDelayMin, AI.itemDelayMax);
  }

  _opponentInCone(halfAngle, range, behind = false) {
    const k = this.kart;
    for (const other of (this.itemSystem ? this.itemSystem.karts : [])) {
      if (other === k || other.finished || other.eliminated) continue;
      const dx = other.pos.x - k.pos.x, dz = other.pos.z - k.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > range) continue;
      let rel = angleDiff(Math.atan2(dx, dz), k.heading);
      if (behind) rel = wrapAngle(rel + Math.PI);
      if (Math.abs(rel) < halfAngle) return other;
    }
    return null;
  }

  // ----------------------------------------------------------
  // Battle mode brain: grab boxes, chase nearest victim.
  // ----------------------------------------------------------
  _computeBattle(dt, ctx) {
    const c = this.controls, k = this.kart;
    c.hop = false;

    // drop targets that stopped being valid (KO'd kart, collected box)
    const bt = this._battleTarget;
    if (bt && ((bt.kart && bt.kart.eliminated) || (bt.box && !bt.box.active))) {
      this._battleTarget = null;
    }

    this._battleRetarget -= dt;
    if (!this._battleTarget || this._battleRetarget <= 0) {
      this._battleRetarget = 2.5;
      if (!k.item && this.itemSystem) {
        // nearest active box
        let best = null, bd = Infinity;
        for (const b of this.itemSystem.boxes) {
          if (!b.active) continue;
          const d = b.pos.distanceToSquared(k.pos);
          if (d < bd) { bd = d; best = { box: b }; }
        }
        this._battleTarget = best;
      } else {
        const t = this.itemSystem && this.itemSystem._nearestOpponent(k);
        this._battleTarget = t ? { kart: t } : null;
      }
    }

    const t2 = this._battleTarget;
    if (t2) {
      const tp = t2.kart ? t2.kart.pos : t2.box.pos;
      const desired = Math.atan2(tp.x - k.pos.x, tp.z - k.pos.z);
      const err = angleDiff(desired, k.heading);
      c.steer = clamp(err * 2.2, -1, 1);
    } else {
      c.steer = 0.35;  // no target right now: circle gently until one appears
    }
    c.accel = ctx.raceState === 'running';
    c.brake = false;

    // fire items at close targets
    if (k.item && !k.roulette) {
      this._itemTimer -= dt;
      if (this._itemTimer <= 0) {
        const victim = this._opponentInCone(0.4, 30);
        if (victim || ['star', 'mush', 'mush3'].includes(k.item) || Math.random() < 0.01) this._tap(c);
      }
    } else {
      this._itemTimer = rand(0.4, 1.6);
    }
    return c;
  }
}
