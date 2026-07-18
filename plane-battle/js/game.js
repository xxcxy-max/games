// ===== 游戏状态机 + 碰撞 + 计分 + 绘制 =====
const STATE_TITLE = 'title';
const STATE_PLAY = 'play';
const STATE_PAUSE = 'pause';
const STATE_OVER = 'gameover';

// 最高分存取(localStorage 可能不可用,如 Node 测试环境)
function loadHiScore() {
  try { return Number(localStorage.getItem('plane-battle-hi')) || 0; } catch (e) { return 0; }
}
function saveHiScore(v) {
  try { localStorage.setItem('plane-battle-hi', String(v)); } catch (e) {}
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = STATE_TITLE;
    this.input = { dx: 0, dy: 0 };   // 键盘移动单位向量
    this.hiScore = loadHiScore();
    this.noSpawn = false;            // 测试钩子:关闭随机刷怪
    this.frame = 0;
    // 三层视差星空
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: Math.random() * FIELD_W, y: Math.random() * FIELD_H, layer: i % 3 });
    }
    this.resetWorld();
  }

  resetWorld() {
    this.player = new PlayerPlane();
    this.enemies = [];
    this.boss = null;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.score = 0;
    this.lives = 3;
    this.bombs = 2;
    this.elapsed = 0;               // 存活帧数,难度依据
    this.spawnTimer = 40;
    this.bossTimer = 0;
    this.bossWarn = 0;
    this.bombFlash = 0;
    this.shake = 0;
    this.respawnTimer = 0;
  }

  startGame() {
    this.resetWorld();
    this.state = STATE_PLAY;
  }

  // ================= 逻辑 =================

  update() {
    this.frame++;
    // 星空常滚
    for (const s of this.stars) {
      s.y += [0.4, 0.9, 1.6][s.layer];
      if (s.y > FIELD_H) { s.y -= FIELD_H; s.x = Math.random() * FIELD_W; }
    }
    if (this.state !== STATE_PLAY) { this.updateParticles(); return; }

    this.elapsed++;
    if (this.shake > 0) this.shake--;
    if (this.bossWarn > 0) this.bossWarn--;
    if (this.bombFlash > 0) this.bombFlash--;

    // 玩家
    const p = this.player;
    if (p.alive) {
      p.move(this.input.dx, this.input.dy);
      if (p.invincible > 0) p.invincible--;
      // 自动开火
      if (--p.fireTimer <= 0) {
        p.fireTimer = 8;
        p.fire(this);
        if (this.frame % 2 === 0) Sound.shoot(); // 射速快,隔次出声避免刺耳
      }
    } else if (this.lives > 0 && --this.respawnTimer <= 0) {
      p.reset();
    }

    // 出怪:Boss 在场时暂停普通刷怪
    if (!this.boss) {
      this.bossTimer++;
      if (this.bossTimer >= BOSS_INTERVAL) {
        this.bossTimer = 0;
        this.boss = new Boss();
        this.bossWarn = 120;
        Sound.warn();
      } else if (!this.noSpawn && --this.spawnTimer <= 0) {
        this.spawnTimer = Difficulty.spawnInterval(this.elapsed);
        const type = Difficulty.pickType(this.elapsed);
        const w = ENEMY_TYPES[type].w;
        const x = w / 2 + 8 + Math.random() * (FIELD_W - w - 16);
        this.enemies.push(new Enemy(x, type, Difficulty.speedMul(this.elapsed)));
      }
    }

    // 实体推进
    for (const e of this.enemies) e.update(this);
    if (this.boss) this.boss.update(this);
    for (const b of this.playerBullets) b.update();
    for (const b of this.enemyBullets) b.update();
    for (const u of this.powerups) u.update();
    this.updateParticles();

    this.collide();

    // 清理由场外/阵亡实体
    this.enemies = this.enemies.filter(e => e.alive);
    this.playerBullets = this.playerBullets.filter(b => b.alive);
    this.enemyBullets = this.enemyBullets.filter(b => b.alive);
    this.powerups = this.powerups.filter(u => u.alive);
    this.particles = this.particles.filter(pt => pt.alive);
  }

  updateParticles() {
    for (const pt of this.particles) pt.update();
    this.particles = this.particles.filter(pt => pt.alive);
  }

  collide() {
    const p = this.player;

    // 玩家子弹 vs 敌机 / Boss
    for (const b of this.playerBullets) {
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (circleRect(b.x, b.y, b.r, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
          b.alive = false;
          this.damageEnemy(e, 1);
          break;
        }
      }
      if (b.alive && this.boss &&
          circleRect(b.x, b.y, b.r, this.boss.x - this.boss.w / 2, this.boss.y - this.boss.h / 2, this.boss.w, this.boss.h)) {
        b.alive = false;
        this.damageBoss(1);
      }
    }

    // 敌弹 / 敌机 / Boss vs 玩家
    if (p.alive && p.invincible <= 0) {
      for (const b of this.enemyBullets) {
        if (b.alive && circleCircle(b.x, b.y, b.r, p.x, p.y, p.hitR)) {
          b.alive = false;
          this.killPlayer();
          break;
        }
      }
      if (p.alive) {
        for (const e of this.enemies) {
          if (e.alive && circleRect(p.x, p.y, p.hitR, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
            this.damageEnemy(e, 999);   // 撞毁敌机,自己也阵亡
            this.killPlayer();
            break;
          }
        }
      }
      if (p.alive && this.boss &&
          circleRect(p.x, p.y, p.hitR, this.boss.x - this.boss.w / 2, this.boss.y - this.boss.h / 2, this.boss.w, this.boss.h)) {
        this.damageBoss(30);
        this.killPlayer();
      }
    }

    // 道具拾取
    if (p.alive) {
      for (const u of this.powerups) {
        if (u.alive && circleCircle(u.x, u.y, u.r, p.x, p.y, Math.max(p.w, p.h) / 2)) {
          u.alive = false;
          this.applyPowerUp(u.kind);
        }
      }
    }
  }

  damageEnemy(e, dmg) {
    if (!e.alive) return;
    e.hp -= dmg;
    e.flash = 3;
    if (e.hp <= 0) {
      e.alive = false;
      this.score += e.score;
      this.explode(e.x, e.y, ENEMY_TYPES[e.type].color, e.type === 'big' ? 26 : 14);
      Sound.enemyDown();
      if (e.type === 'big') this.dropPowerUp(e.x, e.y);
    }
  }

  damageBoss(dmg) {
    const b = this.boss;
    if (!b) return;
    b.hp -= dmg;
    b.flash = 3;
    if (b.hp <= 0) {
      this.score += BOSS_SCORE;
      this.explode(b.x, b.y, '#d94f4f', 60);
      Sound.playerDown();
      this.dropPowerUp(b.x - 24, b.y);
      this.dropPowerUp(b.x + 24, b.y);
      this.boss = null;
      this.bossTimer = 0;           // 重新计时下一个 Boss
    }
  }

  dropPowerUp(x, y) {
    const r = Math.random();
    const kind = r < 0.55 ? 'star' : r < 0.85 ? 'bomb' : 'life';
    this.powerups.push(new PowerUp(x, y, kind));
  }

  applyPowerUp(kind) {
    const p = this.player;
    if (kind === 'star') {
      if (p.weapon < 3) p.weapon++;
      else this.score += 500;       // 武器已满级,折算分数
    } else if (kind === 'bomb') {
      if (this.bombs < 5) this.bombs++;
      else this.score += 500;
    } else {
      if (this.lives < 5) this.lives++;
      else this.score += 1000;
    }
    Sound.powerup();
  }

  killPlayer() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    this.lives--;
    this.shake = 20;
    this.explode(p.x, p.y, '#6fd3ff', 30);
    Sound.playerDown();
    if (this.lives <= 0) {
      this.state = STATE_OVER;
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        saveHiScore(this.hiScore);
      }
      Sound.gameover();
    } else {
      this.respawnTimer = 70;
    }
  }

  // 放雷:清空敌弹 + 全屏伤害
  useBomb() {
    if (this.state !== STATE_PLAY || this.bombs <= 0 || this.bombFlash > 0) return;
    this.bombs--;
    this.bombFlash = 24;
    this.shake = 16;
    Sound.bomb();
    for (const b of this.enemyBullets) b.alive = false;
    for (const e of this.enemies) this.damageEnemy(e, 25);
    if (this.boss) this.damageBoss(25);
  }

  explode(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }

  // ================= 绘制 =================

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

    // 深空背景
    const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
    bg.addColorStop(0, '#070b1a');
    bg.addColorStop(1, '#101a33');
    ctx.fillStyle = bg;
    ctx.fillRect(-8, -8, FIELD_W + 16, FIELD_H + 16);

    // 星空
    for (const s of this.stars) {
      const conf = [[0.35, 1], [0.6, 1.4], [0.95, 1.8]][s.layer];
      ctx.globalAlpha = conf[0];
      ctx.fillStyle = '#cfe4ff';
      ctx.fillRect(s.x, s.y, conf[1], conf[1]);
    }
    ctx.globalAlpha = 1;

    // 道具
    for (const u of this.powerups) Sprites.powerup(ctx, u, this.frame);
    // 敌机 / Boss
    for (const e of this.enemies) Sprites.enemy(ctx, e);
    if (this.boss) Sprites.boss(ctx, this.boss, this.frame);
    // 子弹
    for (const b of this.playerBullets) Sprites.bulletPlayer(ctx, b);
    for (const b of this.enemyBullets) Sprites.bulletEnemy(ctx, b, this.frame);
    // 玩家(无敌时闪烁 + 保护罩)
    const p = this.player;
    if (p.alive) {
      if (p.invincible <= 0 || (this.frame >> 2) % 2 === 0) Sprites.player(ctx, p.x, p.y, this.frame);
      if (p.invincible > 0) Sprites.shield(ctx, p.x, p.y, this.frame);
    }
    // 爆炸粒子
    for (const pt of this.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // 放雷白闪
    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(this.bombFlash / 24) * 0.55})`;
      ctx.fillRect(-8, -8, FIELD_W + 16, FIELD_H + 16);
    }
    ctx.restore();

    this.drawHud(ctx);

    // Boss 登场警告
    if (this.bossWarn > 0 && (this.frame >> 3) % 2 === 0) {
      ctx.fillStyle = '#ff4040';
      ctx.font = 'bold 34px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!! WARNING !!', FIELD_W / 2, FIELD_H / 2 - 40);
    }

    if (this.state === STATE_TITLE) this.drawTitle(ctx);
    else if (this.state === STATE_PAUSE) this.drawPause(ctx);
    else if (this.state === STATE_OVER) this.drawOver(ctx);
  }

  drawHud(ctx) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(`分数 ${this.score}`, 12, 24);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9fb2d8';
    ctx.fillText(`最高 ${Math.max(this.hiScore, this.score)}`, FIELD_W - 12, 24);

    // Boss 血条
    if (this.boss) {
      const bw = 220;
      const x = (FIELD_W - bw) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, 34, bw, 7);
      ctx.fillStyle = '#e04040';
      ctx.fillRect(x, 34, bw * Math.max(0, this.boss.hp / this.boss.maxHp), 7);
    }

    // 命数图标(左下)与武器等级
    for (let i = 0; i < this.lives; i++) Sprites.miniPlane(ctx, 22 + i * 24, FIELD_H - 22);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(`Lv.${this.player.weapon}`, 12, FIELD_H - 44);

    // 雷数图标(右下)
    for (let i = 0; i < this.bombs; i++) Sprites.miniBomb(ctx, FIELD_W - 20 - i * 22, FIELD_H - 22);
  }

  _dim(ctx, alpha) {
    ctx.fillStyle = `rgba(5,8,18,${alpha})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  drawTitle(ctx) {
    this._dim(ctx, 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fe3ff';
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.fillText('飞机大战', FIELD_W / 2, 200);
    ctx.fillStyle = '#3f7fae';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('P L A N E   B A T T L E', FIELD_W / 2, 238);
    Sprites.player(ctx, FIELD_W / 2, 330, this.frame);
    ctx.fillStyle = '#c8d6f0';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('方向键 / WASD / 拖动 移动 · 自动开火', FIELD_W / 2, 430);
    ctx.fillText('B 放雷 · P 暂停', FIELD_W / 2, 456);
    if (this.hiScore > 0) {
      ctx.fillStyle = '#ffd76e';
      ctx.fillText(`最高分 ${this.hiScore}`, FIELD_W / 2, 496);
    }
    if ((this.frame >> 4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('按 Enter 或点击画面开始', FIELD_W / 2, 560);
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
