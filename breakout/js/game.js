// ===== 游戏状态机 + 碰撞 + 计分 + 绘制 =====
const STATE_TITLE = 'title';
const STATE_PLAY = 'play';
const STATE_PAUSE = 'pause';
const STATE_CLEAR = 'levelclear';
const STATE_OVER = 'gameover';

// 最高分存取(localStorage 可能不可用,如 Node 测试环境)
function loadHiScore() {
  try { return Number(localStorage.getItem('breakout-hi')) || 0; } catch (e) { return 0; }
}
function saveHiScore(v) {
  try { localStorage.setItem('breakout-hi', String(v)); } catch (e) {}
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = STATE_TITLE;
    this.input = { dir: 0 };         // 键盘挡板方向 -1/0/1
    this.hiScore = loadHiScore();
    this.noDrop = false;             // 测试钩子:关闭砖块掉落道具
    this.frame = 0;
    this.score = 0;
    this.lives = 3;
    this.loadLevel(1);               // 标题界面背景也摆第一关
  }

  // 载入第 N 关:重建砖块、挡板与待发球
  loadLevel(n) {
    this.level = n;
    const info = levelInfo(n);
    this.levelName = info.name;
    this.ballSpeed = info.speed;
    this.bricks = [];
    info.layout.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch !== '.') this.bricks.push(new Brick(c, r, Number(ch)));
      });
    });
    this.paddle = new Paddle();
    this.balls = [new Ball(this.paddle.x, this.paddle.y - this.paddle.h / 2 - 7, this.ballSpeed)];
    this.lasers = [];
    this.powerups = [];
    this.particles = [];
    this.clearTimer = 0;
  }

  startGame() {
    this.score = 0;
    this.lives = 3;
    this.loadLevel(1);
    this.state = STATE_PLAY;
  }

  // 空格 / 点击:发球优先,其次激光开火
  action() {
    if (this.state !== STATE_PLAY) return;
    const stuck = this.balls.find(b => b.stuck);
    if (stuck) { stuck.launch(); return; }
    if (this.paddle.hasLaser) this.fireLasers();
  }

  fireLasers() {
    const p = this.paddle;
    if (p.cooldown > 0) return;
    p.cooldown = 14;
    this.lasers.push(new Laser(p.x - p.w / 2 + 8, p.y - 12));
    this.lasers.push(new Laser(p.x + p.w / 2 - 8, p.y - 12));
    Sound.laser();
  }

  // ================= 逻辑 =================

  update() {
    this.frame++;
    // 过关横幅:停帧展示后进入下一关
    if (this.state === STATE_CLEAR) {
      this.updateParticles();
      if (--this.clearTimer <= 0) {
        this.loadLevel(this.level + 1);
        this.state = STATE_PLAY;
      }
      return;
    }
    if (this.state !== STATE_PLAY) { this.updateParticles(); return; }

    this.paddle.update();
    if (this.input.dir) this.paddle.move(this.input.dir);

    // 粘球跟随挡板
    const p = this.paddle;
    for (const b of this.balls) {
      if (b.stuck) { b.x = p.x; b.y = p.y - p.h / 2 - b.r - 1; }
    }

    for (const b of this.balls) b.update();

    // 球 vs 挡板:按击中位置改变反弹角(最大 60°)
    for (const b of this.balls) {
      if (b.stuck || b.vy <= 0) continue;
      if (circleRect(b.x, b.y, b.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        const rel = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
        const ang = rel * (Math.PI / 3);
        b.vx = b.speed * Math.sin(ang);
        b.vy = -b.speed * Math.cos(ang);
        b.y = p.y - p.h / 2 - b.r - 0.5;
        Sound.paddle();
      }
    }

    // 球 vs 砖块:按穿透较小的一侧反弹
    for (const b of this.balls) {
      if (b.stuck) continue;
      for (const br of this.bricks) {
        if (!br.alive) continue;
        if (circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h)) {
          const ox = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
          const oy = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
          if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
          this.damageBrick(br, 1);
          break;
        }
      }
    }

    // 激光 vs 砖块
    for (const l of this.lasers) {
      l.update();
      if (!l.alive) continue;
      for (const br of this.bricks) {
        if (br.alive && l.x > br.x && l.x < br.x + br.w && l.y > br.y && l.y < br.y + br.h) {
          l.alive = false;
          this.damageBrick(br, 1);
          break;
        }
      }
    }

    // 道具:下落 + 挡板接住
    for (const u of this.powerups) {
      u.update();
      if (u.alive && circleRect(u.x, u.y, u.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        u.alive = false;
        this.applyPowerUp(u.kind);
      }
    }

    this.updateParticles();
    for (const br of this.bricks) if (br.flash > 0) br.flash--;

    // 掉球:全部出界才扣命
    for (const b of this.balls) {
      if (!b.stuck && b.y - b.r > FIELD_H) b.alive = false;
    }
    this.balls = this.balls.filter(b => b.alive);
    if (this.balls.length === 0) this.loseBall();

    // 过关
    if (this.bricks.every(br => !br.alive)) {
      this.state = STATE_CLEAR;
      this.clearTimer = 100;
      Sound.clear();
    }

    // 清理
    this.lasers = this.lasers.filter(l => l.alive);
    this.powerups = this.powerups.filter(u => u.alive);
    this.particles = this.particles.filter(pt => pt.alive);
  }

  updateParticles() {
    for (const pt of this.particles) pt.update();
    this.particles = this.particles.filter(pt => pt.alive);
  }

  damageBrick(br, dmg) {
    if (!br.alive) return;
    br.hp -= dmg;
    br.flash = 4;
    if (br.hp <= 0) {
      br.alive = false;
      this.score += br.score;
      this.explode(br.x + br.w / 2, br.y + br.h / 2, br.color, 12);
      Sound.brickBreak();
      if (!this.noDrop && Math.random() < 0.22) this.dropPowerUp(br.x + br.w / 2, br.y + br.h / 2);
    } else {
      Sound.brick(br.hp);
    }
  }

  dropPowerUp(x, y) {
    const r = Math.random();
    const kind = r < 0.4 ? 'multi' : r < 0.75 ? 'laser' : 'wide';
    this.powerups.push(new PowerUp(x, y, kind));
  }

  applyPowerUp(kind) {
    if (kind === 'wide') {
      this.paddle.widen();
    } else if (kind === 'laser') {
      this.paddle.enableLaser();
    } else {
      // 多球:每个现存球分裂 1 个,总数上限 6
      const src = [...this.balls];
      for (const b of src) {
        if (this.balls.length >= 6) break;
        const nb = new Ball(b.x, b.y, b.speed);
        nb.stuck = false;
        if (b.stuck) {
          // 源球还粘着:新球以 ±65° 直接弹出
          const dir = Math.random() < 0.5 ? -1 : 1;
          nb.vx = dir * b.speed * Math.sin(Math.PI * 65 / 180);
          nb.vy = -b.speed * Math.cos(Math.PI * 65 / 180);
        } else {
          // 源球速度偏转 ±30°
          const a = Math.atan2(b.vy, b.vx) + (Math.random() < 0.5 ? 0.5 : -0.5);
          nb.vx = b.speed * Math.cos(a);
          nb.vy = b.speed * Math.sin(a);
        }
        this.balls.push(nb);
      }
    }
    Sound.powerup();
  }

  loseBall() {
    this.lives--;
    Sound.lose();
    if (this.lives <= 0) {
      this.state = STATE_OVER;
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        saveHiScore(this.hiScore);
      }
      Sound.gameover();
    } else {
      this.balls.push(new Ball(this.paddle.x, this.paddle.y - this.paddle.h / 2 - 7, this.ballSpeed));
    }
  }

  explode(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }

  // ================= 绘制 =================

  draw() {
    const ctx = this.ctx;
    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    bg.addColorStop(0, '#0b1026');
    bg.addColorStop(1, '#1a1440');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);

    for (const br of this.bricks) if (br.alive) Sprites.brick(ctx, br);
    for (const u of this.powerups) Sprites.powerup(ctx, u, this.frame);
    for (const l of this.lasers) Sprites.laser(ctx, l);
    Sprites.paddle(ctx, this.paddle, this.frame);
    for (const b of this.balls) Sprites.ball(ctx, b);

    for (const pt of this.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.drawHud(ctx);

    if (this.state === STATE_CLEAR) this.drawClear(ctx);
    else if (this.state === STATE_TITLE) this.drawTitle(ctx);
    else if (this.state === STATE_PAUSE) this.drawPause(ctx);
    else if (this.state === STATE_OVER) this.drawOver(ctx);
  }

  drawHud(ctx) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`分数 ${this.score}`, 12, 24);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb2d8';
    ctx.fillText(this.levelName, FIELD_W / 2, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`最高 ${Math.max(this.hiScore, this.score)}`, FIELD_W - 12, 24);
    // 命数小球(左下)
    for (let i = 0; i < this.lives; i++) Sprites.miniBall(ctx, 18 + i * 16, FIELD_H - 14);
  }

  _dim(ctx, alpha) {
    ctx.fillStyle = `rgba(5,8,18,${alpha})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  drawTitle(ctx) {
    this._dim(ctx, 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fd3ff';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText('打砖块', FIELD_W / 2, 220);
    ctx.fillStyle = '#4a7fae';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('B R E A K O U T', FIELD_W / 2, 258);
    ctx.fillStyle = '#c8d6f0';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('← → / 鼠标 / 拖动 移动挡板', FIELD_W / 2, 350);
    ctx.fillText('空格 / 点击 发球 · 接住道具变强', FIELD_W / 2, 376);
    ctx.fillText('P 暂停', FIELD_W / 2, 402);
    if (this.hiScore > 0) {
      ctx.fillStyle = '#ffd76e';
      ctx.fillText(`最高分 ${this.hiScore}`, FIELD_W / 2, 446);
    }
    if ((this.frame >> 4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('按 Enter 或点击画面开始', FIELD_W / 2, 520);
    }
  }

  drawPause(ctx) {
    this._dim(ctx, 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText('已暂停', FIELD_W / 2, FIELD_H / 2 - 10);
    ctx.font = '15px "Courier New", monospace';
    ctx.fillStyle = '#c8d6f0';
    ctx.fillText('按 P 继续', FIELD_W / 2, FIELD_H / 2 + 28);
  }

  drawClear(ctx) {
    this._dim(ctx, 0.35);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7fe8a8';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.fillText(`${this.levelName} 完成!`, FIELD_W / 2, FIELD_H / 2 - 8);
    ctx.fillStyle = '#c8d6f0';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('准备进入下一关…', FIELD_W / 2, FIELD_H / 2 + 30);
  }

  drawOver(ctx) {
    this._dim(ctx, 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText('游戏结束', FIELD_W / 2, 250);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(`得分 ${this.score}`, FIELD_W / 2, 310);
    ctx.fillStyle = '#ffd76e';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(`最高分 ${this.hiScore}`, FIELD_W / 2, 344);
    if ((this.frame >> 4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Courier New", monospace';
      ctx.fillText('按 Enter 或点击画面重新开始', FIELD_W / 2, 430);
    }
  }
}
