// ============================================================
// HUD: DOM overlay — position, lap, item roulette, coins,
// speed, timer, countdown, messages, minimap, screen flash.
// ============================================================
import { ITEMS, ITEM_ORDER } from './config.js';
import { fmtTime, posSuffix, clamp } from './utils.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.el = {
      lap: document.getElementById('hudLap'),
      timer: document.getElementById('hudTimer'),
      coins: document.getElementById('hudCoins'),
      item: document.getElementById('hudItem'),
      itemIcon: document.getElementById('hudItemIcon'),
      itemCount: document.getElementById('hudItemCount'),
      itemHint: document.getElementById('hudItemHint'),
      pos: document.getElementById('hudPos'),
      speed: document.getElementById('hudSpeed'),
      center: document.getElementById('hudCenter'),
      msg: document.getElementById('hudMsg'),
      wrongWay: document.getElementById('hudWrongWay'),
      minimap: document.getElementById('minimap'),
      flash: document.getElementById('flash'),
    };
    this.ctx = this.el.minimap.getContext('2d');
    this._msgT = 0;
    this._flashT = 0;
    this._rouletteTick = 0;
    this._rouletteTime = 0;
    this._mapCache = null;
    this._hintShown = 0;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() {
    this.root.classList.add('hidden');
    this.el.center.textContent = '';
    this.el.msg.textContent = '';
    this.el.timer.textContent = '';   // don't leak a stale TT/battle timer into the next mode
    this.el.coins.textContent = '';
    this._mapCache = null;
  }

  setLap(lap, total) { this.el.lap.textContent = `LAP ${lap}/${total}`; }

  setPos(rank, of) {
    const el = this.el.pos;
    el.innerHTML = `${rank}<span class="suffix">${posSuffix(rank)}</span>`;
    el.className = 'hud-pos' + (rank <= 3 ? ` p${rank}` : '');
  }

  setCoins(coins) { this.el.coins.textContent = coins > 0 ? `🪙 ${coins}` : ''; }

  setTimer(t, ghostTime) {
    this.el.timer.textContent = fmtTime(t) + (ghostTime ? `   (best ${fmtTime(ghostTime)})` : '');
  }

  setBattle(timer, balloons, score) {
    this.el.lap.textContent = '🎈'.repeat(Math.max(0, balloons)) || '💀';
    this.el.timer.textContent = fmtTime(Math.max(0, timer));
    this.el.coins.textContent = score > 0 ? `KOs: ${score}` : '';
    this.el.pos.innerHTML = '';
  }

  setSpeed(kmh) {
    this.el.speed.innerHTML = `${Math.round(kmh)}<span class="unit"> km/h</span>`;
  }

  setItem(kart, dt = 1/60) {
    const el = this.el.item;
    if (kart.roulette) {
      el.classList.remove('hidden');
      el.classList.add('rolling');
      this._rouletteTime += dt;
      if (this._rouletteTime >= 0.065) {
        this._rouletteTime = 0;
        const id = ITEM_ORDER[Math.floor(Math.random() * ITEM_ORDER.length)];
        this.el.itemIcon.textContent = ITEMS[id].icon;
      }
      this.el.itemCount.classList.add('hidden');
      return;
    }
    el.classList.remove('rolling');
    if (!kart.item) {
      el.classList.add('hidden');
      this.el.itemHint.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    this.el.itemIcon.textContent = ITEMS[kart.item].icon;
    const showCount = kart.itemCount > 1;
    this.el.itemCount.classList.toggle('hidden', !showCount);
    if (showCount) this.el.itemCount.textContent = kart.itemCount;
    el.style.filter = kart.dragging ? 'brightness(0.55)' : '';
    // show the controls hint the first few times an item is held
    if (this._hintShown < 3 && kart.isPlayer) {
      this.el.itemHint.classList.remove('hidden');
    }
  }

  noteItemUsed() {
    this._hintShown++;
    if (this._hintShown >= 3) this.el.itemHint.classList.add('hidden');
  }

  countdown(text) {
    this.el.center.textContent = text;
    this.el.center.style.color = text === 'GO!' ? '#7cff6b' : '#ffd23f';
  }

  msg(text, dur = 2) {
    this.el.msg.textContent = text;
    this._msgT = dur;
  }

  wrongWay(on) { this.el.wrongWay.classList.toggle('hidden', !on); }

  flash(strength = 0.5) {
    this.el.flash.style.opacity = strength;
    this._flashT = 0.15;
  }

  update(dt) {
    if (this._msgT > 0) {
      this._msgT -= dt;
      if (this._msgT <= 0) this.el.msg.textContent = '';
    }
    if (this._flashT > 0) {
      this._flashT -= dt;
      if (this._flashT <= 0) this.el.flash.style.opacity = 0;
    }
  }

  // ----------------------------------------------------------
  // Minimap: cache the track path, redraw kart dots per frame.
  // ----------------------------------------------------------
  drawMinimap(track, karts, player) {
    const c = this.el.minimap, ctx = this.ctx;
    const W = c.width, H = c.height;

    if (!this._mapCache || this._mapCache.trackId !== track.def.id) {
      this._mapCache = this._buildMapCache(track, W, H);
    }
    const m = this._mapCache;

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(m.canvas, 0, 0);

    // karts
    for (const k of karts) {
      if (k.eliminated) continue;
      const [x, y] = m.project(k.pos.x, k.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, k === player ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = '#' + k.character.color.toString(16).padStart(6, '0');
      ctx.fill();
      if (k === player) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      }
    }
  }

  _buildMapCache(track, W, H) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const pts = [];
    if (track.isArena) {
      minX = -track.arenaRadius; maxX = track.arenaRadius;
      minZ = -track.arenaRadius; maxZ = track.arenaRadius;
    } else {
      for (let i = 0; i < track.spline.count; i += 3) {
        const p = track.spline.point(i);
        pts.push(p);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
    }
    const pad = 26;
    const sx = (W - pad * 2) / Math.max(maxX - minX, 1);
    const sz = (H - pad * 2) / Math.max(maxZ - minZ, 1);
    const s = Math.min(sx, sz);
    const ox = (W - (maxX - minX) * s) / 2;
    const oz = (H - (maxZ - minZ) * s) / 2;
    const project = (x, z) => [ox + (x - minX) * s, oz + (z - minZ) * s];

    if (track.isArena) {
      const [cx, cy] = project(0, 0);
      ctx.beginPath();
      ctx.arc(cx, cy, track.arenaRadius * s, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 10;
      ctx.stroke();
    } else {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const [x, y] = project(p.x, p.z);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 16;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 10;
      ctx.stroke();
      // start line notch
      const p0 = track.spline.point(0);
      const [x0, y0] = project(p0.x, p0.z);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x0 - 5, y0 - 5, 10, 10);
    }
    return { canvas, project, trackId: track.def.id };
  }
}
