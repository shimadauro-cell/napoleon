// BGM・効果音を Web Audio でその場で合成する（音声ファイル不要）。最初の操作のあとに鳴り始める。
// BGM: 132BPM・Cメジャーの明るいポップ（C-G-Am-F / C-G-F-G）。メロディは温泉っぽいヨナ抜き音階のマリンバ。intensity 1=終盤（鉄琴の合いの手・ドラム増し）
'use strict';
(function () {
  const BPM = 132;
  const STEP = 60 / BPM / 4; // 16分
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // 8小節のコード（root=ベース, ch=裏拍で刻む和音）
  const CHORDS = [
    { root: 48, ch: [60, 64, 67] }, // C
    { root: 43, ch: [59, 62, 67] }, // G
    { root: 45, ch: [60, 64, 69] }, // Am
    { root: 41, ch: [60, 65, 69] }, // F
    { root: 48, ch: [60, 64, 67] }, // C
    { root: 43, ch: [59, 62, 67] }, // G
    { root: 41, ch: [60, 65, 69] }, // F
    { root: 43, ch: [59, 62, 67] }, // G
  ];
  // マリンバのメロディ（ヨナ抜き音階中心。-1は休符）
  const MELODY = [
    [76, -1, 79, -1, 81, -1, 79, 76, -1, 74, 76, -1, 72, -1, -1, -1],
    [74, -1, 79, -1, 74, -1, 72, 74, -1, 76, 74, -1, 67, -1, -1, -1],
    [72, -1, 76, -1, 81, -1, 79, 81, -1, 84, 81, -1, 79, -1, 76, -1],
    [81, -1, 79, -1, 77, -1, 76, -1, 74, -1, 72, -1, 74, -1, -1, -1],
    [76, -1, 79, -1, 81, -1, 79, 76, -1, 74, 76, -1, 72, -1, -1, -1],
    [79, -1, 81, -1, 79, -1, 76, 74, -1, 76, 79, -1, 74, -1, -1, -1],
    [81, -1, 84, -1, 81, -1, 79, 77, -1, 76, 77, -1, 79, -1, -1, -1],
    [74, -1, 76, 79, -1, 74, 72, -1, 74, -1, 79, -1, 84, -1, 86, -1],
  ];
  // 跳ねるベース（16分の位置 → ルートからの半音）
  const BASS = { 0: 0, 3: 12, 6: 0, 8: 7, 10: 12, 12: 0, 14: 12 };  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ } },
  };

  class Sound {
    constructor() {
      this.ctx = null;
      this.bgmOn = store.get('np.v1.bgm', true);
      this.seOn = store.get('np.v1.se', true);
      this.intensity = 0;
      this.playing = false;
      this.step = 0;
    }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const ctx = (this.ctx = new AC());
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ctx.destination);
        this.master = ctx.createGain(); this.master.gain.value = 0.85; this.master.connect(comp);
        this.bgmBus = ctx.createGain(); this.bgmBus.gain.value = 0.3; this.bgmBus.connect(this.master);
        this.seBus = ctx.createGain(); this.seBus.gain.value = 0.75; this.seBus.connect(this.master);
        // アルペジオ・パッド用のフィルター（終盤で開く）
        this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 4200; this.tone.Q.value = 1;
        this.tone.connect(this.bgmBus);
        // カットイン中に BGM を一瞬下げる
        this.duckGain = ctx.createGain(); this.duckGain.gain.value = 1;
        this.bgmBus.disconnect(); this.bgmBus.connect(this.duckGain); this.duckGain.connect(this.master);
        // 簡易リバーブ（減衰ノイズのインパルス）。演出音に広がりを足す
        this.verb = ctx.createConvolver();
        const ir = ctx.createBuffer(2, ctx.sampleRate * 1.6, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
        this.verb.buffer = ir;
        this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.35; this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // 音色用。ゲームの乱数とは無関係
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    setBgm(on) { this.bgmOn = on; store.set('np.v1.bgm', on); on ? this.startBgm() : this.stopBgm(); }
    setSe(on) { this.seOn = on; store.set('np.v1.se', on); }
    startBgm() {
      if (!this.bgmOn || this.playing || !this.ensure()) return;
      this.playing = true; this.step = 0;
      this.next = this.ctx.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    }
    stopBgm() { this.playing = false; clearInterval(this.timer); }
    setIntensity(n) {
      this.intensity = n;
      if (!this.ctx) return;
      this.tone.frequency.setTargetAtTime(n ? 7000 : 4200, this.ctx.currentTime, 0.4);
    }
    duck(sec = 1.2) {
      if (!this.ctx) return;
      const g = this.duckGain.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.25, t + 0.05); g.setValueAtTime(0.25, t + sec); g.linearRampToValueAtTime(1, t + sec + 0.5);
    }
    schedule() {
      while (this.next < this.ctx.currentTime + 0.12) { this.playStep(this.step, this.next); this.next += STEP; this.step++; }
    }
    playStep(step, t) {
      const s = step % 16, bar = Math.floor(step / 16) % 8;
      const ch = CHORDS[bar];
      const hot = this.intensity > 0;
      // 4つ打ちのキック＋2・4拍のクラップ
      if (s % 4 === 0) this.kick(t, s === 0 ? 0.6 : 0.45);
      if (s === 4 || s === 12) this.clap(t);
      if (hot && s === 14) this.clap(t, 0.12);
      // 裏拍のハイハット＋16分のシェイカー
      if (s % 4 === 2) this.hat(t, 0.05, 0.07); else if (hot || s % 2 === 1) this.hat(t, 0.02, 0.02);
      // 跳ねるベース
      if (BASS[s] != null) this.bass(t, ch.root + BASS[s]);
      // 裏拍で和音を「チャッ」と刻む（ウクレレ風）
      if (s % 4 === 2) this.strum(t, ch.ch);
      // マリンバのメロディ
      const m = MELODY[bar][s];
      if (m > 0) this.marimba(t, m, 0.11);
      // 終盤は鉄琴の合いの手（1オクターブ上で追いかける）
      if (hot) { const e = MELODY[bar][(s + 14) % 16]; if (e > 0 && s % 2 === 0) this.bell(t, e + 12, 0.035); }
      // 8小節の終わりにキラッと上がるグリッサンド
      if (bar === 7 && s === 12) [84, 86, 88, 91].forEach((n, i) => this.bell(t + i * STEP * 0.5, n, 0.05));
    }

    // ---------------------------------------------------------------- 音色
    osc(type, freq, t, dur, vol, dest, opts = {}) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.slide || dur));
      if (opts.detune) o.detune.value = opts.detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      if (opts.verb) g.connect(this.verb);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    noiseHit(t, dur, vol, type, freq, dest, q = 1, opts = {}) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(opts.attack ? 0.0001 : vol, t);
      if (opts.attack) g.gain.exponentialRampToValueAtTime(vol, t + opts.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(dest);
      if (opts.verb) g.connect(this.verb);
      src.start(t, (this.step % 7) * 0.05); src.stop(t + dur + 0.05);
      return f;
    }
    kick(t, v) { this.osc('sine', 140, t, 0.25, v, this.bgmBus, { to: 40, slide: 0.12 }); this.noiseHit(t, 0.02, 0.15, 'highpass', 3000, this.bgmBus); }
    snare(t) { this.noiseHit(t, 0.16, 0.22, 'bandpass', 1800, this.bgmBus, 0.7); this.osc('triangle', 190, t, 0.1, 0.18, this.bgmBus, { to: 140 }); }
    hat(t, dur, vol) { this.noiseHit(t, dur, vol, 'highpass', 9000, this.bgmBus); }
    bass(t, m) {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m - 12);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 8;
      f.frequency.setValueAtTime(this.intensity ? 1400 : 900, t); f.frequency.exponentialRampToValueAtTime(140, t + 0.14);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f); f.connect(g); g.connect(this.bgmBus); o.start(t); o.stop(t + 0.25);
    }
    pluck(t, m, vol) { this.osc('square', mtof(m), t, 0.09, vol, this.tone); }
    // マリンバ（基音＋4倍音が速く減衰）
    marimba(t, m, vol) { this.osc('sine', mtof(m), t, 0.35, vol, this.tone); this.osc('sine', mtof(m) * 4, t, 0.06, vol * 0.35, this.tone); this.osc('triangle', mtof(m - 12), t, 0.12, vol * 0.3, this.tone); }
    // 鉄琴（キラキラ）
    bell(t, m, vol) { this.osc('sine', mtof(m), t, 0.5, vol, this.tone, { verb: true }); this.osc('sine', mtof(m) * 2.76, t, 0.2, vol * 0.4, this.tone); }
    // 和音を短く刻む
    strum(t, notes) { notes.forEach((n, i) => this.osc('triangle', mtof(n), t + i * 0.008, 0.11, 0.05, this.tone)); }
    clap(t, v = 0.2) { for (const dt of [0, 0.011, 0.022]) this.noiseHit(t + dt, 0.1, v, 'bandpass', 1500, this.bgmBus, 0.9); }
    pad(t, notes, dur) { for (const n of notes) for (const det of [-12, 12]) this.osc('sawtooth', mtof(n), t, dur, 0.018, this.tone, { attack: 0.4, detune: det }); }
    lead(t, m) { this.osc('sawtooth', mtof(m), t, 0.2, 0.035, this.tone, { detune: 6 }); this.osc('square', mtof(m - 12), t, 0.2, 0.02, this.tone); }
    riser(t, dur, vol, dest) { this.noiseHit(t, dur, vol, 'bandpass', 300, dest, 4, { to: 8000, attack: dur * 0.9 }); }

    // シャッ（カードがすべる音）
    swish(t, vol = 0.4, dur = 0.09) { this.noiseHit(t, dur, vol, 'bandpass', 7000, this.seBus, 1.2, { to: 1800 }); }
    // ドンッ（低い衝撃）
    boom(t, vol = 0.9) { this.osc('sine', 110, t, 0.6, vol, this.seBus, { to: 32, slide: 0.35 }); this.noiseHit(t, 0.5, 0.45, 'lowpass', 1800, this.seBus, 0.7, { verb: true, to: 200 }); }
    // パワーコードの一撃（Aマイナー）
    stab(t, root = 57, vol = 0.07, dur = 0.5) {
      for (const n of [root, root + 7, root + 12, root + 15]) for (const det of [-10, 10]) this.osc('sawtooth', mtof(n), t, dur, vol, this.seBus, { detune: det, verb: true });
    }

    play(name) {
      if (!this.seOn || !this.ensure()) return;
      const t = this.ctx.currentTime + 0.01, B = this.seBus;
      const arp = (notes, gap, type = 'square', vol = 0.12, dur = 0.18, start = t) => notes.forEach((n, i) => this.osc(type, mtof(n), start + i * gap, dur, vol, B, { verb: true }));
      switch (name) {
        case 'click': this.osc('sine', 1200, t, 0.05, 0.15, B, { to: 1800, slide: 0.03 }); break;
        case 'select': this.swish(t, 0.18, 0.06); this.osc('triangle', mtof(88), t, 0.08, 0.12, B); break;
        // 札を出す：シャッ→パシッ＋低いアタック
        case 'card':
          this.swish(t, 0.45, 0.08);
          this.noiseHit(t + 0.06, 0.03, 0.7, 'highpass', 2500, B);
          this.osc('sine', 160, t + 0.06, 0.12, 0.55, B, { to: 60, slide: 0.1 });
          this.osc('triangle', 1900, t + 0.06, 0.04, 0.08, B);
          break;
        // 配札：リフルシャッフル風に10枚がシャシャシャッと飛ぶ
        case 'deal':
          for (let i = 0; i < 10; i++) this.swish(t + i * 0.045, 0.22 + (i % 2) * 0.08, 0.06);
          this.noiseHit(t + 0.46, 0.04, 0.5, 'highpass', 2500, B);
          this.osc('sine', 120, t + 0.46, 0.15, 0.5, B, { to: 50 });
          break;
        // 回収：まとめて引き寄せる
        case 'collect':
          this.noiseHit(t, 0.25, 0.3, 'bandpass', 1500, B, 2, { to: 6000, attack: 0.2 });
          this.noiseHit(t + 0.22, 0.03, 0.5, 'highpass', 3000, B);
          arp([81, 88], 0.06, 'triangle', 0.1, 0.2, t + 0.22);
          break;
        case 'bid': this.swish(t, 0.2, 0.06); arp([69, 76], 0.07, 'square', 0.09, 0.14); break;
        case 'pass': this.osc('triangle', mtof(57), t, 0.12, 0.12, B); break;
        case 'error': this.osc('square', 200, t, 0.14, 0.09, B, { to: 140 }); break;
        // 役札・逆転のカットイン：ためるライザー→衝撃→パワーコード
        case 'cutin':
          this.duck(1.1);
          this.riser(t, 0.22, 0.35, B);
          this.boom(t + 0.22, 0.85);
          this.noiseHit(t + 0.22, 0.9, 0.3, 'highpass', 5000, B, 0.5, { verb: true });
          this.stab(t + 0.22, 57, 0.06, 0.55);
          arp([81, 84, 88, 93], 0.035, 'square', 0.05, 0.2, t + 0.3);
          break;
        // 役札で勝った：さらに派手（2連の衝撃＋上昇ファンファーレ）
        case 'cutinWin':
          this.duck(1.6);
          this.riser(t, 0.25, 0.4, B);
          this.boom(t + 0.25, 1);
          this.stab(t + 0.25, 57, 0.065, 0.35);
          this.stab(t + 0.45, 60, 0.065, 0.35);
          this.stab(t + 0.65, 64, 0.075, 0.9);
          this.noiseHit(t + 0.65, 1.3, 0.35, 'highpass', 4000, B, 0.5, { verb: true });
          arp([76, 81, 84, 88, 93, 96], 0.05, 'square', 0.06, 0.3, t + 0.65);
          this.osc('sine', 55, t + 0.65, 0.8, 0.8, B, { to: 30 });
          break;
        // 負けが決まった：重い一撃のあと、トロンボーン風に「ワ・ワ・ワ・ワーン」と下がる
        case 'cutinLose': {
          this.duck(1.8);
          this.osc('sine', 90, t, 0.9, 0.8, B, { to: 35, slide: 0.6 });
          this.noiseHit(t, 0.6, 0.25, 'lowpass', 900, B, 0.7, { verb: true, to: 150 });
          [[63, 0.3], [62, 0.3], [61, 0.3], [60, 1.0]].forEach(([n, len], i) => {
            const st0 = t + 0.35 + i * 0.32;
            const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(mtof(n), st0);
            if (i === 3) { const lfo = this.ctx.createOscillator(); const lg = this.ctx.createGain(); lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency); lfo.start(st0); lfo.stop(st0 + len); o.frequency.linearRampToValueAtTime(mtof(n) * 0.94, st0 + len); }
            const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, st0); f.frequency.linearRampToValueAtTime(1400, st0 + 0.08); f.frequency.linearRampToValueAtTime(600, st0 + len);
            const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, st0); g.gain.linearRampToValueAtTime(0.16, st0 + 0.04); g.gain.setValueAtTime(0.16, st0 + len - 0.08); g.gain.linearRampToValueAtTime(0.0001, st0 + len);
            o.connect(f); f.connect(g); g.connect(B); g.connect(this.verb); o.start(st0); o.stop(st0 + len + 0.05);
          });
          break;
        }
        case 'reveal':
          this.duck(1.2);
          this.boom(t, 0.8);
          [[69, 72, 76], [71, 74, 77], [72, 76, 81]].forEach((c, i) => c.forEach((n) => this.osc('sawtooth', mtof(n), t + 0.1 + i * 0.12, 0.45, 0.04, B, { verb: true })));
          break;
        case 'win':
          this.stab(t, 57, 0.05, 0.25); this.stab(t + 0.18, 60, 0.05, 0.25); this.stab(t + 0.36, 64, 0.06, 0.9);
          arp([76, 81, 84, 88], 0.08, 'square', 0.08, 0.3, t + 0.36);
          this.boom(t + 0.36, 0.6);
          break;
        case 'lose': [64, 63, 62, 57].forEach((n, i) => this.osc('triangle', mtof(n), t + i * 0.18, 0.32, 0.15, B, { verb: true })); this.osc('sine', 80, t + 0.54, 0.6, 0.4, B, { to: 40 }); break;
        case 'stamp': this.boom(t, 0.6); this.noiseHit(t, 0.06, 0.4, 'highpass', 2500, B); break;
        // 自分の番：シュッ＋上がる2音
        case 'yourturn':
          this.swish(t, 0.3, 0.12);
          arp([76, 83, 88], 0.07, 'square', 0.08, 0.25, t + 0.05);
          this.osc('sine', mtof(88), t + 0.19, 0.5, 0.12, B, { verb: true });
          break;
        case 'special': this.riser(t, 0.2, 0.3, B); this.stab(t + 0.2, 57, 0.05, 0.3); break;
      }
    }
  }
  window.NP.Sound = new Sound();
})();
