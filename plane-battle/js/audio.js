// 极简音效:WebAudio 合成,无需任何音频文件
const Sound = {
  ctx: null,

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

  shoot() { this.beep(720, 0.05, 'square', 0.018); },
  enemyDown() { this.noise(0.18, 0.1); },
  playerDown() { this.noise(0.5, 0.2); this.beep(160, 0.4, 'sawtooth', 0.08); },
  powerup() { this.beep(660, 0.08, 'square', 0.05); this.beep(990, 0.1, 'square', 0.05, 0.08); },
  bomb() { this.noise(0.7, 0.25); this.beep(90, 0.6, 'sawtooth', 0.12); },
  warn() { for (let i = 0; i < 3; i++) this.beep(220, 0.15, 'square', 0.06, i * 0.22); },
  gameover() { [440, 330, 220, 110].forEach((f, i) => this.beep(f, 0.25, 'triangle', 0.08, i * 0.25)); },
};
