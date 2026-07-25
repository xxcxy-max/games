// ===== 极简音效:WebAudio 合成,无需任何音频文件 =====
const Sound = {
  ctx: null,
  windNodes: null,   // 滑行风声 { src, filter, g }

  // 需要在用户手势(按键/触摸)之后调用,浏览器才允许出声
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  beep(freq, dur, type = 'square', vol = 0.05, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  },

  noise(dur, vol = 0.15) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  },

  // 滑行风声:循环白噪声 + 低通,音量/音色随速度;游戏中每帧调用
  wind(ratio) {
    if (!this.ctx) return;
    if (!this.windNodes) {
      const len = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(filter).connect(g).connect(this.ctx.destination);
      src.start();
      this.windNodes = { src, filter, g };
    }
    const t = this.ctx.currentTime;
    this.windNodes.g.gain.setTargetAtTime(0.015 + ratio * 0.07, t, 0.2);
    this.windNodes.filter.frequency.setTargetAtTime(300 + ratio * 1200, t, 0.2);
  },

  windStop() {
    if (this.windNodes) {
      try { this.windNodes.src.stop(); } catch (e) {}
      this.windNodes = null;
    }
  },

  start() { [440, 660].forEach((f, i) => this.beep(f, 0.1, 'triangle', 0.06, i * 0.09)); },
  gate() { this.beep(880, 0.08, 'triangle', 0.06); this.beep(1320, 0.12, 'triangle', 0.05, 0.08); },
  star() { this.beep(660, 0.07, 'square', 0.05); this.beep(990, 0.1, 'square', 0.05, 0.07); },
  boost() { this.noise(0.25, 0.08); this.beep(520, 0.2, 'sawtooth', 0.05); },
  jump() { this.noise(0.3, 0.06); this.beep(330, 0.25, 'sine', 0.06); this.beep(495, 0.2, 'sine', 0.05, 0.12); },
  land() { this.noise(0.15, 0.1); this.beep(180, 0.12, 'sine', 0.07); },
  crash() { this.noise(0.25, 0.2); this.beep(110, 0.2, 'sawtooth', 0.09); },
  gameover() { [440, 330, 220, 110].forEach((f, i) => this.beep(f, 0.25, 'triangle', 0.08, i * 0.25)); },
};
