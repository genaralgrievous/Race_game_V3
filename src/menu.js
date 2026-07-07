// ============================================================
// Menu: DOM screens — title, mode select, cup/track select,
// class select, character select, pause, results, GP standings.
// Mouse + keyboard navigable.
// ============================================================
import { CHARACTERS, CLASSES } from './config.js';
import { TRACKS, CUPS } from './tracks.js';
import { Spline, fmtTime, posSuffix } from './utils.js';
import { bestTime } from './ghost.js';

export class Menu {
  constructor(audio) {
    this.root = document.getElementById('menu');
    this.audio = audio;
    this.onStart = null;       // ({mode, trackId?, cupId?, classId, charId}) => void
    this._keyHandler = null;
    this._buttons = [];
    this._sel = 0;
    window.addEventListener('keydown', (e) => this._onKey(e));
  }

  _onKey(e) {
    if (this.root.classList.contains('hidden')) return;
    if (!this._buttons.length) {
      if (this._anyKey) { this._anyKey(); }
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD') {
      this._sel = (this._sel + 1) % this._buttons.length;
      this._highlight(); this.audio.play('ui_move');
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this._sel = (this._sel - 1 + this._buttons.length) % this._buttons.length;
      this._highlight(); this.audio.play('ui_move');
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      e.preventDefault();
      this._buttons[this._sel]?.click();
    } else if (e.code === 'Escape' && this._backFn) {
      this._backFn();
    }
  }

  _highlight() {
    this._buttons.forEach((b, i) => b.classList.toggle('selected', i === this._sel));
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); this._clear(); }

  _clear() {
    this.root.innerHTML = '';
    this._buttons = [];
    this._sel = 0;
    this._anyKey = null;
    this._backFn = null;
  }

  _screen(headingHTML, footer = 'W/S or ↑/↓ — navigate • Enter — select • Esc — back') {
    this._clear();
    const div = document.createElement('div');
    div.className = 'menu-screen';
    div.innerHTML = headingHTML;
    const foot = document.createElement('div');
    foot.className = 'menu-footer';
    foot.textContent = footer;
    div.appendChild(foot);
    this.root.appendChild(div);
    return div;
  }

  _btn(parent, label, fn, cls = '') {
    const b = document.createElement('button');
    b.className = 'menu-btn ' + cls;
    b.innerHTML = label;
    b.onclick = () => { this.audio.unlock(); this.audio.play('ui_select'); fn(); };
    b.onmouseenter = () => {
      this._sel = this._buttons.indexOf(b);
      this._highlight();
    };
    parent.appendChild(b);
    this._buttons.push(b);
    return b;
  }

  // ----------------------------------------------------------
  title() {
    const s = this._screen(`
      <div class="menu-title">☄️ COMET KARTS</div>
      <div class="menu-sub">an arcade kart racer built from scratch</div>
    `, 'Press any key');
    const hint = document.createElement('div');
    hint.style.cssText = 'color:#ffd23f;font-size:22px;font-weight:800;font-style:italic;animation:blink 1s infinite alternate';
    hint.textContent = 'PRESS ANY KEY';
    s.insertBefore(hint, s.lastChild);
    const go = () => { this.audio.unlock(); this.audio.setMusic('menu'); this.main(); };
    this._anyKey = go;
    s.onclick = go;
  }

  main() {
    const s = this._screen(`<div class="menu-title">☄️ COMET KARTS</div>`);
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    s.insertBefore(col, s.lastChild);
    this._btn(col, '🏆 Grand Prix', () => this.cupSelect({ mode: 'gp' }));
    this._btn(col, '🏁 Single Race', () => this.trackSelect({ mode: 'race' }));
    this._btn(col, '⏱️ Time Trial', () => this.trackSelect({ mode: 'tt', classId: '150cc' }));
    this._btn(col, '🎈 Balloon Battle', () => this.charSelect({ mode: 'battle', classId: '150cc' }));
    this._btn(col, '🎮 Controls', () => this.controls());
    this._sel = 0; this._highlight();
    this._backFn = null;
  }

  controls() {
    const s = this._screen(`
      <div class="menu-heading">Controls</div>
      <div style="color:#dfe8ff;font-size:19px;line-height:2;text-align:left;background:rgba(0,0,0,.35);padding:22px 38px;border-radius:14px">
        <b style="color:#ffd23f">W / ↑</b> — accelerate<br>
        <b style="color:#ffd23f">S / ↓</b> — brake / reverse / back-throw modifier<br>
        <b style="color:#ffd23f">A D / ← →</b> — steer<br>
        <b style="color:#ffd23f">SPACE or SHIFT</b> — hop; hold + steer to <b>drift</b> (sparks = mini-turbo!)<br>
        <b style="color:#ffd23f">E / Q / ENTER</b> — use item (hold to drag as a shield)<br>
        <b style="color:#ffd23f">ESC / P</b> — pause<br>
        <b style="color:#ffd23f">Gamepad</b> — stick steer, A gas, B brake, RB drift, LB item<br>
        <span style="color:#9fb4e8">Pro tips: hold gas during "1" for a rocket start. Hop off ramp
        crests for a trick boost. Tailgate rivals for a slipstream.</span>
      </div>`);
    const back = document.createElement('div');
    s.insertBefore(back, s.lastChild);
    this._btn(back, 'Back', () => this.main(), 'small');
    this._backFn = () => this.main();
  }

  trackSelect(cfg) {
    const s = this._screen(`<div class="menu-heading">${cfg.mode === 'tt' ? 'Time Trial — ' : ''}Choose a Track</div>`);
    const row = document.createElement('div');
    row.className = 'menu-row';
    s.insertBefore(row, s.lastChild);
    for (const t of TRACKS) {
      const card = document.createElement('button');
      card.className = 'card menu-btn';
      card.style.minWidth = '0';
      const mini = this._trackThumb(t);
      const best = cfg.mode === 'tt' ? bestTime(t.id) : null;
      card.innerHTML = `<h3>${t.name}</h3>
        <div class="desc">${t.laps} laps${t.grip < 0.8 ? ' • slippery!' : ''}${t.floating ? ' • don’t fall!' : ''}
        ${best ? `<br>best: ${fmtTime(best)}` : ''}</div>`;
      card.prepend(mini);
      card.onclick = () => {
        this.audio.play('ui_select');
        cfg.trackId = t.id;
        cfg.mode === 'tt' ? this.charSelect(cfg) : this.classSelect(cfg);
      };
      card.onmouseenter = () => { this._sel = this._buttons.indexOf(card); this._highlight(); };
      row.appendChild(card);
      this._buttons.push(card);
    }
    this._sel = 0; this._highlight();
    this._backFn = () => this.main();
  }

  cupSelect(cfg) {
    const s = this._screen(`<div class="menu-heading">Choose a Cup</div>`);
    const row = document.createElement('div');
    row.className = 'menu-row';
    s.insertBefore(row, s.lastChild);
    for (const cup of CUPS) {
      const card = document.createElement('button');
      card.className = 'card menu-btn';
      card.style.minWidth = '0';
      card.style.width = '260px';
      const names = cup.tracks
        .map(id => TRACKS.find(t => t.id === id))
        .filter(Boolean);
      card.innerHTML = `<h3>🏆 ${cup.name}</h3>
        <div class="desc" style="line-height:1.7">${names.map(t => t.name).join('<br>')}</div>`;
      if (names[0]) card.prepend(this._trackThumb(names[0]));
      card.onclick = () => {
        this.audio.play('ui_select');
        cfg.cupId = cup.id;
        this.classSelect(cfg);
      };
      card.onmouseenter = () => { this._sel = this._buttons.indexOf(card); this._highlight(); };
      row.appendChild(card);
      this._buttons.push(card);
    }
    this._sel = 0; this._highlight();
    this._backFn = () => this.main();
  }

  _trackThumb(def) {
    const c = document.createElement('canvas');
    c.width = 180; c.height = 110;
    const ctx = c.getContext('2d');
    const sp = new Spline(def.controlPoints, 8);
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const p of sp.samples) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const s = Math.min(160 / (maxX - minX), 90 / (maxZ - minZ));
    ctx.strokeStyle = '#8fa8ff'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath();
    sp.samples.forEach((p, i) => {
      const x = 90 + (p.x - (minX + maxX) / 2) * s;
      const y = 55 + (p.z - (minZ + maxZ) / 2) * s;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.stroke();
    return c;
  }

  classSelect(cfg) {
    const s = this._screen(`<div class="menu-heading">Engine Class</div>`);
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    s.insertBefore(col, s.lastChild);
    for (const [id, c] of Object.entries(CLASSES)) {
      this._btn(col, `${c.label} <span style="font-size:15px;opacity:.7">— ${c.unlockNote}</span>`, () => {
        cfg.classId = id;
        this.charSelect(cfg);
      });
    }
    this._sel = 2; this._highlight(); // default 150cc
    this._backFn = () => cfg.mode === 'gp' ? this.cupSelect(cfg) : this.trackSelect(cfg);
  }

  charSelect(cfg) {
    const s = this._screen(`<div class="menu-heading">Choose Your Racer</div>`);
    const row = document.createElement('div');
    row.className = 'menu-row';
    s.insertBefore(row, s.lastChild);
    for (const ch of CHARACTERS) {
      const card = document.createElement('button');
      card.className = 'card menu-btn';
      card.style.minWidth = '0';
      card.style.width = '190px';
      const hex = '#' + ch.color.toString(16).padStart(6, '0');
      const bar = (v) => `<div class="bar"><i style="width:${Math.round((v - 0.7) / 0.6 * 100)}%"></i></div>`;
      card.innerHTML = `
        <div class="char-swatch" style="background:${hex}"></div>
        <h3>${ch.name}</h3>
        <div class="desc">${ch.desc}</div>
        <div class="stat-bars">
          speed ${bar(ch.speed)} accel ${bar(ch.accel)} handling ${bar(ch.handling)} weight ${bar(ch.weight)}
        </div>`;
      card.onclick = () => {
        this.audio.play('ui_select');
        cfg.charId = ch.id;
        this.hide();
        this.onStart && this.onStart(cfg);
      };
      card.onmouseenter = () => { this._sel = this._buttons.indexOf(card); this._highlight(); };
      row.appendChild(card);
      this._buttons.push(card);
    }
    this._sel = 0; this._highlight();
    this._backFn = () => {
      if (cfg.mode === 'tt') this.trackSelect(cfg);
      else if (cfg.mode === 'battle') this.main();
      else this.classSelect(cfg);
    };
  }

  // ----------------------------------------------------------
  pause(onResume, onRestart, onQuit) {
    this.show();
    const s = this._screen(`<div class="menu-heading">Paused</div>`, '');
    s.style.background = 'rgba(8,10,24,.72)';
    const col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    s.insertBefore(col, s.lastChild);
    this._btn(col, 'Resume', onResume);
    this._btn(col, 'Restart', onRestart);
    this._btn(col, 'Quit to Menu', onQuit);
    this._sel = 0; this._highlight();
    this._backFn = onResume;
  }

  // ----------------------------------------------------------
  raceResults(results, opts) {
    // opts: {title, points?, onContinue}
    this.show();
    const s = this._screen('', '');
    s.style.background = 'rgba(8,10,24,.55)';
    const box = document.createElement('div');
    box.className = 'results-table';
    const rows = results.map((r) => `
      <tr class="${r.isPlayer ? 'player' : ''}">
        <td>${r.rank}${posSuffix(r.rank)}</td>
        <td>${r.isPlayer ? '👤 ' : ''}${r.name}</td>
        <td>${r.time != null ? fmtTime(r.time) : (r.balloons != null ? '🎈'.repeat(r.balloons) : '—')}</td>
        ${opts.points ? `<td class="pts">+${opts.points[r.rank - 1] ?? 0}</td>` : (r.score != null ? `<td class="pts">${r.score} KO</td>` : '')}
      </tr>`).join('');
    box.innerHTML = `<h2>${opts.title}</h2><table>${rows}</table>`;
    s.insertBefore(box, s.lastChild);
    const cont = document.createElement('div');
    cont.style.marginTop = '14px';
    s.insertBefore(cont, s.lastChild);
    this._btn(cont, opts.continueLabel || 'Continue', opts.onContinue);
    this._sel = 0; this._highlight();
    this._backFn = opts.onContinue;
  }

  ttResults({ time, best, newRecord }, onContinue) {
    this.show();
    const s = this._screen('', '');
    s.style.background = 'rgba(8,10,24,.55)';
    const box = document.createElement('div');
    box.className = 'results-table';
    box.innerHTML = `<h2>${newRecord ? '🏆 NEW RECORD!' : 'Time Trial'}</h2>
      <table>
        <tr class="player"><td>Your time</td><td>${fmtTime(time)}</td></tr>
        <tr><td>Best</td><td>${fmtTime(best)}</td></tr>
      </table>
      <div style="color:#9fb4e8;font-size:14px;margin-top:10px;text-align:center">
        ${newRecord ? 'Your ghost was saved — race it next time!' : 'Race your ghost again to beat it!'}
      </div>`;
    s.insertBefore(box, s.lastChild);
    const cont = document.createElement('div');
    cont.style.marginTop = '14px';
    s.insertBefore(cont, s.lastChild);
    this._btn(cont, 'Continue', onContinue);
    this._sel = 0; this._highlight();
    this._backFn = onContinue;
  }

  gpStandings(standings, raceNum, totalRaces, onContinue, champion = false) {
    this.show();
    const s = this._screen('', '');
    s.style.background = 'rgba(8,10,24,.55)';
    const box = document.createElement('div');
    box.className = 'results-table';
    const rows = standings.map((r, i) => `
      <tr class="${r.isPlayer ? 'player' : ''}">
        <td>${i + 1}${posSuffix(i + 1)}</td>
        <td>${i === 0 && champion ? '👑 ' : ''}${r.isPlayer ? '👤 ' : ''}${r.name}</td>
        <td class="pts">${r.points} pts</td>
      </tr>`).join('');
    box.innerHTML = `<h2>${champion ? '🏆 FINAL STANDINGS' : `Standings — Race ${raceNum}/${totalRaces}`}</h2><table>${rows}</table>`;
    s.insertBefore(box, s.lastChild);
    const cont = document.createElement('div');
    cont.style.marginTop = '14px';
    s.insertBefore(cont, s.lastChild);
    this._btn(cont, champion ? 'Finish' : 'Next Race', onContinue);
    this._sel = 0; this._highlight();
    this._backFn = onContinue;
  }
}
