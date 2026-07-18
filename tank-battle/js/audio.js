// 极简音效：WebAudio 合成，无需任何音频文件
const Sound = {
  ctx: null,

  // 需要在用户手势(按键)之后调用，浏览器才允许出声
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  beep(freq, dur, type = 'square', vol = 0.05) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
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

  shoot() { this.beep(500, 0.07, 'square', 0.035); },
  hitBrick() { this.beep(180, 0.05, 'square', 0.05); },
  hitSteel() { this.beep(120, 0.04, 'square', 0.03); },

  explode() {
    if (!this.ctx) return;
    const dur = 0.3;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 0.15;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  },
};
