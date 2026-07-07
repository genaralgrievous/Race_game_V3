// ============================================================
// AudioSys — procedural WebAudio: engine loop, SFX, chiptune music.
//
// Public API (contract):
//   unlock()                      — create/resume AudioContext (call on user gesture; safe to call repeatedly)
//   setEngine(norm, boosting, drifting)
//       norm: 0..1 player speed fraction; boosting/drifting: bool
//       Continuous engine hum whose pitch follows norm.
//   play(name)                    — fire-and-forget one-shot SFX:
//       'countBeep','countGo','hop','land','driftTier1','driftTier2',
//       'driftTier3','boost','item_get','shoot','hit','spin','coin',
//       'box','star','lightning','bullet','explosion','finish','lap',
//       'ui_move','ui_select','trick','fall','respawn','balloon','bump'
//   setMusic(mode)                — looping chiptune: 'menu'|'race'|
//       'final'|'results'|'battle'|null (null stops music)
//   stopAll()                     — silence everything (pause)
//   setMuted(bool) / muted        — global mute toggle
//
// All sound is synthesized with oscillators/noise — no audio files.
// Every method is a safe no-op before unlock() and never throws.
// ============================================================

const MASTER_VOL = 0.5, MUSIC_VOL = 0.35, SFX_VOL = 0.8, ENGINE_VOL = 0.25;

const midi2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ------------------------------------------------------------
// Chiptune loops. Steps are 8th notes; 0 = rest; values are MIDI
// notes. mel = square lead, bass = triangle, hat = noise tick
// (hat indexes with modulo so it can be shorter than mel/bass).
// ------------------------------------------------------------
const SONGS = {
  menu: { // bouncy, laid-back C major
    bpm: 104,
    mel: [76, 0, 79, 0, 76, 74, 72, 0, 74, 0, 77, 0, 74, 0, 72, 0,
          76, 0, 79, 0, 81, 79, 77, 76, 74, 0, 71, 0, 72, 0, 0, 0],
    bass: [48, 0, 52, 0, 55, 0, 52, 0, 50, 0, 53, 0, 57, 0, 53, 0,
           45, 0, 48, 0, 52, 0, 48, 0, 43, 0, 47, 0, 48, 0, 48, 0],
    hat: [0, 1, 0, 1, 0, 1, 1, 0],
  },
  race: { // driving, upbeat A minor
    bpm: 128,
    mel: [69, 0, 69, 71, 72, 0, 71, 72, 74, 0, 72, 71, 69, 0, 67, 69,
          71, 0, 71, 72, 74, 0, 76, 74, 72, 0, 71, 69, 67, 0, 69, 0],
    bass: [45, 45, 52, 45, 45, 45, 52, 45, 41, 41, 48, 41, 41, 41, 48, 41,
           43, 43, 50, 43, 43, 43, 50, 43, 40, 40, 47, 40, 43, 43, 47, 43],
    hat: [1, 0, 1, 1, 1, 0, 1, 1],
  },
  results: { // short victorious loop
    bpm: 112,
    mel: [72, 0, 76, 0, 79, 0, 84, 0, 83, 81, 79, 81, 84, 0, 0, 0],
    bass: [48, 0, 52, 0, 55, 0, 52, 0, 53, 0, 55, 0, 48, 0, 55, 0],
    hat: [1, 0, 1, 0],
  },
  battle: { // tense minor with chromatic pull
    bpm: 120,
    mel: [69, 0, 0, 69, 68, 0, 69, 0, 72, 0, 69, 0, 68, 0, 65, 0,
          69, 0, 0, 69, 68, 0, 69, 0, 75, 0, 74, 0, 72, 0, 68, 0],
    bass: [45, 45, 45, 45, 45, 45, 44, 44, 45, 45, 45, 45, 41, 41, 44, 44,
           45, 45, 45, 45, 45, 45, 44, 44, 47, 47, 47, 47, 44, 44, 44, 44],
    hat: [1, 1, 0, 1, 1, 0, 1, 1],
  },
};
// final lap = race theme, faster and up 2 semitones
SONGS.final = { ...SONGS.race, bpm: 140, transpose: 2 };

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._musicMode = null;  // remembered even pre-unlock; started on unlock
    this._timer = null;      // music lookahead interval
    this._song = null;
    this._srcs = null;       // live music source nodes (for hard stop)
    this._runGain = null;    // per-music-run gain (fade-out on stop)
  }

  // ---------------------------------------------------------- lifecycle
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._buildGraph();
        if (this._musicMode) this._startMusic(this._musicMode);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { /* never throw */ }
  }

  _buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOL;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = MUSIC_VOL;
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = SFX_VOL;
    this.engineBus = ctx.createGain(); this.engineBus.gain.value = ENGINE_VOL;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.engineBus.connect(this.master);

    // shared 1s white-noise buffer for all noise sounds
    const n = ctx.sampleRate;
    this._noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;

    this._buildEngine();
  }

  // ---------------------------------------------------------- engine loop
  _buildEngine() {
    const ctx = this.ctx;
    // 2 detuned saws -> gentle lowpass -> gain (0 until setEngine runs)
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 350;
    this.engFilter.Q.value = 1;
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.engineBus);
    this._engOsc = [];
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      o.detune.value = det;
      o.connect(this.engFilter);
      o.start();
      this._engOsc.push(o);
    }
    // drift scrape: looping noise -> bandpass -> gain (0 unless drifting)
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf; src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    this.scrapeGain = ctx.createGain(); this.scrapeGain.gain.value = 0;
    src.connect(bp); bp.connect(this.scrapeGain);
    this.scrapeGain.connect(this.engineBus);
    src.start();
  }

  setEngine(norm, boosting, drifting) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      norm = Math.min(Math.max(norm || 0, 0), 1);
      let f = 55 + norm * 135;               // 55..190 Hz
      if (boosting) f *= 1.3;                // brighter + higher when boosting
      for (const o of this._engOsc) o.frequency.setTargetAtTime(f, t, 0.05);
      this.engFilter.frequency.setTargetAtTime((boosting ? 900 : 300) + norm * 900, t, 0.08);
      this.engGain.gain.setTargetAtTime(0.5 + norm * 0.5, t, 0.1);
      this.scrapeGain.gain.setTargetAtTime(drifting ? 0.18 : 0, t, 0.08);
    } catch { /* never throw */ }
  }

  // ---------------------------------------------------------- SFX helpers
  // Oscillator blip with exponential envelope and optional pitch slide.
  _tone(f0, f1, dur, { type = 'square', vol = 0.4, delay = 0, attack = 0.005 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // Filtered noise burst with optional filter sweep.
  _noise(dur, { type = 'lowpass', f0 = 1000, f1 = 0, Q = 1, vol = 0.4, delay = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this._noiseBuf; s.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = Q;
    flt.frequency.setValueAtTime(Math.max(f0, 20), t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random() * 0.9);
    s.stop(t + dur + 0.03);
  }

  play(name) {
    if (!this.ctx) return;
    try { this._fx(name); } catch { /* never throw */ }
  }

  _fx(name) {
    const T = (f0, f1, dur, o) => this._tone(f0, f1, dur, o);
    const N = (dur, o) => this._noise(dur, o);
    switch (name) {
      case 'countBeep': T(880, 0, 0.12, { vol: 0.45 }); break;
      case 'countGo': // rising C major stack
        T(523, 0, 0.3, { vol: 0.32 }); T(659, 0, 0.3, { delay: 0.05, vol: 0.32 });
        T(784, 0, 0.35, { delay: 0.1, vol: 0.32 }); T(1047, 0, 0.4, { delay: 0.15, vol: 0.3 }); break;
      case 'hop': T(320, 520, 0.09, { vol: 0.3 }); break;
      case 'land': T(150, 90, 0.08, { type: 'triangle', vol: 0.35 }); N(0.06, { f0: 400, vol: 0.2 }); break;
      case 'driftTier1': T(400, 800, 0.12, { type: 'sawtooth', vol: 0.3 }); break;
      case 'driftTier2': T(550, 1100, 0.12, { type: 'sawtooth', vol: 0.32 }); break;
      case 'driftTier3': T(700, 1500, 0.14, { type: 'sawtooth', vol: 0.34 }); break;
      case 'boost': T(180, 1200, 0.28, { type: 'sawtooth', vol: 0.4 });
        N(0.25, { type: 'highpass', f0: 600, f1: 3000, vol: 0.2 }); break;
      case 'item_get': T(660, 0, 0.08, { vol: 0.3 }); T(880, 0, 0.08, { delay: 0.06, vol: 0.3 });
        T(1175, 0, 0.12, { delay: 0.12, vol: 0.3 }); break;
      case 'shoot': T(700, 250, 0.1, { vol: 0.35 }); N(0.06, { type: 'highpass', f0: 2000, vol: 0.15 }); break;
      case 'hit': N(0.22, { f0: 1200, f1: 200, vol: 0.5 }); T(300, 80, 0.2, { type: 'sawtooth', vol: 0.35 }); break;
      case 'spin': // wobble: alternate two pitches
        T(380, 0, 0.08, { vol: 0.3 }); T(300, 0, 0.08, { delay: 0.08, vol: 0.3 });
        T(380, 0, 0.08, { delay: 0.16, vol: 0.3 }); T(300, 0, 0.08, { delay: 0.24, vol: 0.3 }); break;
      case 'coin': T(988, 0, 0.07, { vol: 0.3 }); T(1319, 0, 0.22, { delay: 0.07, vol: 0.3 }); break;
      case 'box': N(0.07, { type: 'bandpass', f0: 1400, Q: 2, vol: 0.3 }); T(500, 700, 0.1, { delay: 0.03, vol: 0.3 }); break;
      case 'star': [784, 988, 1319, 1568, 1319, 1976]
        .forEach((f, i) => T(f, 0, 0.07, { delay: i * 0.06, vol: 0.25 })); break;
      case 'lightning': T(1400, 90, 0.35, { type: 'sawtooth', vol: 0.4 }); N(0.5, { f0: 200, vol: 0.4 }); break;
      case 'bullet': N(0.45, { type: 'bandpass', f0: 300, f1: 1800, Q: 1.5, vol: 0.45 }); break;
      case 'explosion': N(0.5, { f0: 1000, f1: 60, vol: 0.6 }); T(160, 40, 0.45, { type: 'sawtooth', vol: 0.4 }); break;
      case 'finish': [523, 659, 784, 1047]
        .forEach((f, i) => T(f, 0, i === 3 ? 0.4 : 0.15, { delay: i * 0.11, vol: 0.35 })); break;
      case 'lap': T(880, 0, 0.12, { type: 'triangle', vol: 0.35 });
        T(1175, 0, 0.2, { delay: 0.11, type: 'triangle', vol: 0.35 }); break;
      case 'ui_move': T(600, 0, 0.05, { vol: 0.2 }); break;
      case 'ui_select': T(700, 0, 0.06, { vol: 0.25 }); T(1000, 0, 0.08, { delay: 0.06, vol: 0.25 }); break;
      case 'trick': T(600, 1300, 0.12, { vol: 0.32 }); break;
      case 'fall': T(600, 100, 0.5, { type: 'sawtooth', vol: 0.3 }); break;
      case 'respawn': T(300, 500, 0.15, { type: 'sine', vol: 0.3, attack: 0.03 }); break;
      case 'balloon': N(0.07, { type: 'bandpass', f0: 1600, Q: 1.2, vol: 0.5 }); T(260, 140, 0.08, { vol: 0.3 }); break;
      case 'bump': T(100, 60, 0.09, { type: 'triangle', vol: 0.45 }); N(0.07, { f0: 250, vol: 0.3 }); break;
    }
  }

  // ---------------------------------------------------------- music
  setMusic(mode) {
    try {
      if (mode === this._musicMode) return;   // same mode: no-op
      this._stopMusic();
      this._musicMode = mode;
      if (mode && this.ctx) this._startMusic(mode);
      // if ctx is null, mode is remembered and started in unlock()
    } catch { /* never throw */ }
  }

  _startMusic(mode) {
    const song = SONGS[mode];
    if (!song || this._timer) return;
    this._song = song;
    this._srcs = new Set();
    this._runGain = this.ctx.createGain();
    this._runGain.gain.value = 1;
    this._runGain.connect(this.musicBus);
    this._step = 0;
    this._nextT = this.ctx.currentTime + 0.05;
    // lookahead scheduler: tick every 100ms, schedule 0.2s ahead of ctx clock
    this._timer = setInterval(() => this._tickMusic(), 100);
    this._tickMusic();
  }

  _tickMusic() {
    const song = this._song;
    if (!song || !this.ctx) return;
    try {
      const stepDur = 60 / song.bpm / 2; // 8th notes
      while (this._nextT < this.ctx.currentTime + 0.2) {
        this._scheduleStep(song, this._step, this._nextT, stepDur);
        this._step = (this._step + 1) % song.mel.length;
        this._nextT += stepDur;
      }
    } catch { /* keep the interval alive but silent */ }
  }

  _scheduleStep(song, step, t, stepDur) {
    const tr = song.transpose || 0;
    const m = song.mel[step];
    if (m) this._mNote(midi2f(m + tr), t, stepDur * 0.85, 'square', 0.16);
    const b = song.bass[step % song.bass.length];
    if (b) this._mNote(midi2f(b + tr), t, stepDur * 0.95, 'triangle', 0.22);
    if (song.hat[step % song.hat.length]) this._mHat(t);
  }

  _mNote(freq, t, dur, type, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this._runGain);
    o.start(t); o.stop(t + dur + 0.03);
    this._trackSrc(o);
  }

  _mHat(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this._noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(hp); hp.connect(g); g.connect(this._runGain);
    s.start(t, Math.random() * 0.9); s.stop(t + 0.05);
    this._trackSrc(s);
  }

  _trackSrc(node) {
    const set = this._srcs;
    if (!set) return;
    set.add(node);
    node.onended = () => set.delete(node);
  }

  _stopMusic() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._runGain && this.ctx) {
      const g = this._runGain, t = this.ctx.currentTime;
      g.gain.setTargetAtTime(0, t, 0.03);           // quick fade, no click
      if (this._srcs) {
        for (const s of this._srcs) { try { s.stop(t + 0.15); } catch { /* already stopped */ } }
      }
      setTimeout(() => { try { g.disconnect(); } catch { /* fine */ } }, 400);
    }
    this._runGain = null; this._srcs = null; this._song = null;
  }

  // Silence just the engine/scrape loop (music keeps playing).
  // Used when a race ends or is torn down.
  engineOff() {
    try {
      if (this.ctx && this.engGain) {
        const t = this.ctx.currentTime;
        this.engGain.gain.setTargetAtTime(0, t, 0.08);
        this.scrapeGain.gain.setTargetAtTime(0, t, 0.08);
      }
    } catch { /* never throw */ }
  }

  // ---------------------------------------------------------- global
  stopAll() {
    try {
      this._stopMusic();
      this._musicMode = null;
      if (this.ctx) {
        const t = this.ctx.currentTime;
        this.engGain.gain.setTargetAtTime(0, t, 0.05);
        this.scrapeGain.gain.setTargetAtTime(0, t, 0.05);
      }
    } catch { /* never throw */ }
  }

  setMuted(m) {
    try {
      this.muted = !!m;
      if (this.ctx && this.master) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOL, this.ctx.currentTime, 0.02);
      }
    } catch { /* never throw */ }
  }

  // Current looping music mode (null if stopped). Lets the pause
  // screen capture what to restore on resume.
  get musicMode() { return this._musicMode; }
}
