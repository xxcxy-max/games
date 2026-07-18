// 极简音效:WebAudio 合成,无需任何音频文件
const Sound = {
  ctx: null,
  eng: null,   // 引擎持续音 { o, g }

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

  // 引擎:锯齿波持续音,音高随车速;游戏中每帧调用
  engine(ratio) {
    if (!this.ctx) return;
    if (!this.eng) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      g.gain.value = 0.02;
      o.connect(g).connect(this.ctx.destination);
      o.start();
      this.eng = { o, g };
    }
    this.eng.o.frequency.setTargetAtTime(45 + ratio * 105, this.ctx.currentTime, 0.1);
    this.eng.g.gain.setTargetAtTime(0.015 + ratio * 0.03, this.ctx.currentTime, 0.1);
  },

  engineStop() {
    if (this.eng) {
      try { this.eng.o.stop(); } catch (e) {}
      this.eng = null;
    }
  },

  shoot() { this.beep(800, 0.03, 'square', 0.02); },
  enemyShoot() { this.beep(500, 0.04, 'square', 0.025); },
  hit() { this.beep(300, 0.04, 'square', 0.04); },
  explode() { this.noise(0.35, 0.16); },
  crash() { this.noise(0.22, 0.18); this.beep(120, 0.15, 'sawtooth', 0.08); },
  scrape() { this.noise(0.06, 0.05); },
  missile() { this.noise(0.14, 0.06); },
  powerup() { this.beep(660, 0.08, 'square', 0.05); this.beep(990, 0.1, 'square', 0.05, 0.08); },
  lose() { [330, 220, 150].forEach((f, i) => this.beep(f, 0.18, 'triangle', 0.08, i * 0.15)); },
  gameover() { [440, 330, 220, 110].forEach((f, i) => this.beep(f, 0.25, 'triangle', 0.08, i * 0.25)); },
};
