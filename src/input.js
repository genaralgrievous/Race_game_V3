// ============================================================
// Input: keyboard + gamepad + touch -> abstract per-frame controls.
//
//   steer  : float -1..1        (A/D, arrows, left stick, touch stick)
//   accel  : bool hold          (W / Up / gamepad A / touch A)
//   brake  : bool hold          (S / Down / gamepad B / touch B)
//   hop    : bool hold + edge   (Space or Shift / gamepad RB / touch HOP)
//   item   : bool hold + edges  (E or Enter / gamepad LB / touch ITEM)
//   pause  : edge               (Esc or P / gamepad Start / touch ⏸)
// ============================================================

export class Input {
  constructor() {
    this.keys = new Set();
    this.prev = {};
    this.state = {
      steer: 0, accel: false, brake: false,
      hop: false, hopPressed: false,
      handbrake: false,
      item: false, itemPressed: false, itemReleased: false,
      pause: false, pausePressed: false,
      anyPressed: false,
    };
    this._anyThisFrame = false;

    // --- touch state ---
    this._touch = {
      steer: 0, accel: false, brake: false,
      hop: false, item: false, pause: false,
    };
    this._touchActive = false;
    this._stickOrigin = null;
    this._stickTouchId = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._anyThisFrame = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      // swallow synthetic release edges (e.g. don't throw a dragged
      // shell just because the window lost focus mid-hold)
      this.prev = {};
    });

    this._setupTouch();
    this._setupMuteButton();
  }

  _key(...codes) { return codes.some(c => this.keys.has(c)); }

  // ----------------------------------------------------------
  // Touch controls setup
  // ----------------------------------------------------------
  _setupTouch() {
    const tc = document.getElementById('touchControls');
    if (!tc) return;

    // Detect touch device and show controls
    const showTouch = () => {
      this._touchActive = true;
      tc.classList.add('active');
    };
    window.addEventListener('touchstart', showTouch, { once: true });
    // Also check on load if it's likely a touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      // Defer to avoid layout thrash
      setTimeout(showTouch, 100);
    }

    // --- Virtual Joystick ---
    const stickZone = document.getElementById('touchStickZone');
    const knob = document.getElementById('touchStickKnob');
    if (stickZone && knob) {
      const stickRadius = 50; // max travel in pixels

      stickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._anyThisFrame = true;
        const touch = e.changedTouches[0];
        this._stickTouchId = touch.identifier;
        const rect = stickZone.getBoundingClientRect();
        this._stickOrigin = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }, { passive: false });

      stickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const touch of e.changedTouches) {
          if (touch.identifier !== this._stickTouchId) continue;
          if (!this._stickOrigin) break;
          const dx = touch.clientX - this._stickOrigin.x;
          const dist = Math.min(Math.abs(dx), stickRadius);
          this._touch.steer = Math.sign(dx) * (dist / stickRadius);
          // Move the knob visually
          knob.style.left = (60 + (this._touch.steer * stickRadius)) + 'px';
        }
      }, { passive: false });

      const stickEnd = (e) => {
        for (const touch of e.changedTouches) {
          if (touch.identifier === this._stickTouchId) {
            this._touch.steer = 0;
            this._stickTouchId = null;
            this._stickOrigin = null;
            knob.style.left = '60px';
          }
        }
      };
      stickZone.addEventListener('touchend', stickEnd);
      stickZone.addEventListener('touchcancel', stickEnd);
    }

    // --- Action Buttons ---
    this._touchBtn('touchGas', 'accel');
    this._touchBtn('touchBrake', 'brake');
    this._touchBtn('touchHop', 'hop');
    this._touchBtn('touchItem', 'item');
    this._touchBtn('touchPause', 'pause');
  }

  _touchBtn(id, field) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._touch[field] = true;
      this._anyThisFrame = true;
      el.classList.add('pressed');
    }, { passive: false });
    const end = (e) => {
      e.preventDefault();
      this._touch[field] = false;
      el.classList.remove('pressed');
    };
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end, { passive: false });
  }

  // ----------------------------------------------------------
  // Mute button
  // ----------------------------------------------------------
  _setupMuteButton() {
    const btn = document.getElementById('muteBtn');
    if (!btn) return;
    // Load saved preference (storage can be blocked — never let it
    // take the whole game down with it)
    let saved = null;
    try { saved = localStorage.getItem('cometkarts-muted'); } catch { /* blocked */ }
    this._muted = saved === 'true';
    this._muteBtn = btn;
    this._updateMuteUI();

    btn.addEventListener('click', () => {
      this._muted = !this._muted;
      try { localStorage.setItem('cometkarts-muted', this._muted); } catch { /* blocked */ }
      this._updateMuteUI();
      // The audio system will be notified via the getMuted() accessor
    });
  }

  _updateMuteUI() {
    if (!this._muteBtn) return;
    this._muteBtn.textContent = this._muted ? '🔇' : '🔊';
    this._muteBtn.classList.toggle('muted', this._muted);
  }

  getMuted() { return this._muted || false; }

  // Swallow the next frame's press/release edges. Called when a menu
  // consumes a key (Esc to resume, Enter/E on a button) so the same
  // keystroke doesn't leak into gameplay as pause/hop/item input.
  flushEdges() {
    this._suppressEdges = 2; // frames
  }

  update() {
    const s = this.state;
    const t = this._touch;

    // --- keyboard ---
    let steer = 0;
    if (this._key('KeyA', 'ArrowLeft')) steer -= 1;
    if (this._key('KeyD', 'ArrowRight')) steer += 1;
    let accel = this._key('KeyW', 'ArrowUp');
    let brake = this._key('KeyS', 'ArrowDown');
    let hop = this._key('Space', 'ShiftLeft', 'ShiftRight');
    let handbrake = this._key('KeyC', 'ControlLeft');
    let item = this._key('KeyE', 'Enter', 'KeyQ');
    let pause = this._key('Escape', 'KeyP');

    // --- gamepad (first connected) ---
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.18) steer += ax;
      const btn = (i) => pad.buttons[i] && pad.buttons[i].pressed;
      if (btn(0)) accel = true;                       // A / Cross
      if (btn(1)) brake = true;                       // B / Circle
      if (btn(2)) handbrake = true;                   // X / Square
      if (btn(5) || btn(7)) hop = true;               // RB / RT
      if (btn(4) || btn(6)) item = true;              // LB / LT
      if (btn(9)) pause = true;                       // Start
      if (pad.buttons.some(b => b.pressed)) this._anyThisFrame = true;
      break;
    }

    // --- touch ---
    if (this._touchActive) {
      if (Math.abs(t.steer) > 0.05) steer += t.steer;
      if (t.accel) accel = true;
      if (t.brake) brake = true;
      if (t.hop) hop = true;
      if (t.handbrake) handbrake = true;
      if (t.item) item = true;
      if (t.pause) pause = true;
    }

    // Physics convention: positive steer increases heading, which renders
    // as a LEFT turn on screen (AI steering is written in that convention).
    // Screen-right inputs (D, stick right) must therefore go negative.
    s.steer = -Math.max(-1, Math.min(1, steer));
    s.accel = accel;
    s.brake = brake;
    s.hopPressed = hop && !this.prev.hop;
    s.hop = hop;
    s.handbrake = handbrake;
    s.itemPressed = item && !this.prev.item;
    s.itemReleased = !item && this.prev.item;
    s.item = item;
    s.pausePressed = pause && !this.prev.pause;
    s.pause = pause;
    if (this._suppressEdges > 0) {
      this._suppressEdges--;
      s.hopPressed = s.itemPressed = s.itemReleased = s.pausePressed = false;
    }
    s.anyPressed = this._anyThisFrame;
    this._anyThisFrame = false;

    this.prev = { hop, item, pause };
    return s;
  }

  // Empty controls object for AI controllers to fill in.
  static emptyControls() {
    return {
      steer: 0, accel: false, brake: false,
      hop: false, hopPressed: false,
      item: false, itemPressed: false, itemReleased: false,
    };
  }
}
