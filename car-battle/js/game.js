// ===== 游戏状态机 + 相对速度模型 + 碰撞 + 计分 + 绘制 =====
const STATE_TITLE = 'title';
const STATE_PLAY = 'play';
const STATE_PAUSE = 'pause';
const STATE_OVER = 'gameover';

// 最高分存取(localStorage 可能不可用,如 Node 测试环境)
function loadHiScore() {
  try { return Number(localStorage.getItem('car-battle-hi')) || 0; } catch (e) { return 0; }
}
function saveHiScore(v) {
  try { localStorage.setItem('car-battle-hi', String(v)); } catch (e) {}
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = STATE_TITLE;
    this.input = { steer: 0, boost: false, brake: false, fireHeld: false };
    this.hiScore = loadHiScore();
    this.noSpawn = false;            // 测试钩子:关闭随机刷车
    this.frame = 0;
    this.resetWorld();
  }

  resetWorld() {
    this.player = new PlayerCar();
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.score = 0;
    this.lives = PLAYER_LIVES;
    this.scrollOffset = 0;          // 路面滚动相位
    this.distPx = 0;                // 里程(像素)
    this.mileAcc = 0;               // 里程分累加器(每 120px 得 1 分)
    this.spawnTimer = 60;
    this.respawnTimer = 0;
    this.offRoad = false;
  }

  startGame() {
    this.resetWorld();
    this.state = STATE_PLAY;
  }

  get dist() { return Math.floor(this.distPx * 0.5); } // 里程(米)

  // 导弹目标:最近的存活敌车
  nearestFoe(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.spin > 0) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  fireMissile() {
    const p = this.player;
    if (this.state !== STATE_PLAY || !p.alive || p.missiles <= 0) return;
    p.missiles--;
    this.playerBullets.push(new Bullet(p.x, p.y - p.h / 2, 0, -6, true,
      { kind: 'missile', damage: 6, homing: true, r: 5 }));
    Sound.missile();
  }

  // ================= 逻辑 =================

  update() {
    this.frame++;
    if (this.state !== STATE_PLAY) { this.updateParticles(); return; }

    const p = this.player;

    // ----- 车速控制 -----
    if (p.alive) {
      if (this.input.brake) p.speed -= 2.5;
      else if (this.input.boost) p.speed += 0.8;
      else if (p.speed < CRUISE_SPEED) p.speed += 0.5;   // 自动巡航
      else p.speed -= 0.15;                              // 松油门超速回落
      if (this.offRoad) p.speed -= 1.4;                  // 冲出路面强减速
      p.speed = Math.max(0, Math.min(MAX_SPEED, p.speed));

      // ----- 转向(低速效果弱,模拟真实手感) -----
      const steerPow = 3.4 * (0.35 + 0.65 * (p.speed / MAX_SPEED));
      p.x += this.input.steer * steerPow;
      p.x = Math.max(ROAD_X - 16, Math.min(ROAD_RX + 16, p.x));
      this.offRoad = (p.x - p.w / 2 < ROAD_X + 4) || (p.x + p.w / 2 > ROAD_RX - 4);

      if (p.invincible > 0) p.invincible--;
      if (p.shield > 0) p.shield--;
      if (p.flash > 0) p.flash--;

      // 刮擦路肩:掉耐久 + 音效
      if (this.offRoad && p.invincible <= 0 && this.frame % 22 === 0) {
        this.hurtPlayer(2);
        Sound.scrape();
      }

      // ----- 机炮 -----
      if (p.fireTimer > 0) p.fireTimer--;
      if (this.input.fireHeld && p.fireTimer <= 0) {
        p.fireTimer = 12;
        this.playerBullets.push(new Bullet(p.x - 8, p.y - p.h / 2, 0, -11, true));
        this.playerBullets.push(new Bullet(p.x + 8, p.y - p.h / 2, 0, -11, true));
        Sound.shoot();
      }
    } else {
      p.speed = Math.max(0, p.speed - 2);   // 阵亡后车辆滑行减速
      if (this.lives > 0 && --this.respawnTimer <= 0) p.reset();
    }

    // 引擎音随速
    Sound.engine(p.speed / MAX_SPEED);

    // ----- 路面滚动 + 里程分 -----
    const scrollPx = p.speed * KMH_TO_PX;
    this.scrollOffset += scrollPx;
    this.distPx += scrollPx;
    this.mileAcc += scrollPx;
    while (this.mileAcc >= 120) { this.mileAcc -= 120; this.score += 1; }

    // ----- 刷车 -----
    if (!this.noSpawn && --this.spawnTimer <= 0) {
      this.spawnTimer = Difficulty.spawnInterval(this.dist);
      this.spawnEnemy();
    }

    // ----- 实体推进 -----
    for (const e of this.enemies) e.update(this);
    for (const b of this.playerBullets) b.update(this);
    for (const b of this.enemyBullets) b.update(this);
    for (const u of this.powerups) u.update(this);
    this.updateParticles();

    this.collide();

    // ----- 清理 -----
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

  // 慢车从上方进入,追击车从后方出现
  spawnEnemy() {
    const type = Difficulty.pickType(this.dist);
    const t = ENEMY_TYPES[type];
    if (type === 'chaser') {
      const x = ROAD_X + t.w + Math.random() * (ROAD_W - t.w * 2);
      this.enemies.push(new EnemyCar(x, FIELD_H + 70, type, this.player.speed));
      return;
    }
    // 上方进入:选一条不与现有车辆重叠的车道
    for (let tries = 0; tries < 4; tries++) {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const x = ROAD_X + LANE_W * lane + LANE_W / 2;
      const blocked = this.enemies.some(e =>
        e.y < 140 && Math.abs(e.x - x) < (e.w + t.w) / 2 + 8);
      if (!blocked) {
        this.enemies.push(new EnemyCar(x, -t.h - Math.random() * 60, type, this.player.speed));
        return;
      }
    }
  }

  collide() {
    const p = this.player;

    // 玩家子弹/导弹 vs 敌车
    for (const b of this.playerBullets) {
      if (!b.alive) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (circleRect(b.x, b.y, b.r, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
          b.alive = false;
          this.damageEnemy(e, b.damage);
          break;
        }
      }
    }

    if (p.alive) {
      // 敌弹 vs 玩家
      for (const b of this.enemyBullets) {
        if (b.alive && circleRect(b.x, b.y, b.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
          b.alive = false;
          this.hurtPlayer(10);
        }
      }
      // 玩家 vs 敌车相撞
      for (const e of this.enemies) {
        if (!e.alive || e.spin > 0) continue;
        if (rectsOverlap(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h,
                         e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
          this.crashInto(e);
        }
      }
      // 车压道具
      for (const u of this.powerups) {
        if (u.alive && circleRect(u.x, u.y, u.r, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
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
    if (e.hp <= 0) this.killEnemy(e);
    else Sound.hit();
  }

  killEnemy(e) {
    e.alive = false;
    this.score += e.score;
    this.explode(e.x, e.y, '#ff9a3c', e.type === 'truck' ? 34 : 18);
    Sound.explode();
    if (e.type === 'truck') this.dropPowerUp(e.x, e.y);
  }

  // 撞车:双方受损,敌车失控滑出
  crashInto(e) {
    const p = this.player;
    const rel = Math.abs(p.speed - e.speed);
    if (p.shield > 0 || p.invincible > 0) {
      this.damageEnemy(e, 3);
    } else {
      const dmg = Math.round(Math.max(10, Math.min(35, 10 + rel * 0.12)));
      this.hurtPlayer(dmg);
    }
    if (e.alive) {
      e.hp -= 2;
      e.flash = 4;
      if (e.hp <= 0) this.killEnemy(e);
      else { e.spin = 40; e.vx = (e.x < p.x ? -1 : 1) * (2 + Math.random()); }
    }
    p.speed *= 0.72;
    Sound.crash();
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (!p.alive || p.shield > 0 || p.invincible > 0) return;
    p.hp -= dmg;
    p.flash = 8;
    if (p.hp <= 0) this.killPlayer();
  }

  killPlayer() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    this.lives--;
    this.explode(p.x, p.y, '#ff6e5a', 40);
    Sound.explode();
    Sound.lose();
    if (this.lives <= 0) {
      this.state = STATE_OVER;
      Sound.engineStop();
      if (this.score > this.hiScore) {
        this.hiScore = this.score;
        saveHiScore(this.hiScore);
      }
      Sound.gameover();
    } else {
      this.respawnTimer = 80;
    }
  }

  dropPowerUp(x, y) {
    const r = Math.random();
    const kind = r < 0.4 ? 'missile' : r < 0.75 ? 'repair' : 'shield';
    this.powerups.push(new PowerUp(x, y, kind));
  }

  applyPowerUp(kind) {
    const p = this.player;
    if (kind === 'missile') {
      p.missiles = Math.min(6, p.missiles + 3);
    } else if (kind === 'repair') {
      p.hp = Math.min(PLAYER_HP, p.hp + 40);
    } else {
      p.shield = 480;   // 8 秒
    }
    Sound.powerup();
  }

  explode(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }

  // ================= 绘制 =================

  draw() {
    const ctx = this.ctx;
    const off = this.scrollOffset;

    // 草地(横向条纹随滚动)
    ctx.fillStyle = '#26532c';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const bandH = 48;
    for (let y = -bandH + (off % (bandH * 2)); y < FIELD_H; y += bandH * 2) {
      ctx.fillRect(0, y, FIELD_W, bandH);
    }

    // 路面
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(ROAD_X, 0, ROAD_W, FIELD_H);
    // 路缘白线
    ctx.fillStyle = '#c8ccd4';
    ctx.fillRect(ROAD_X + 5, 0, 4, FIELD_H);
    ctx.fillRect(ROAD_RX - 9, 0, 4, FIELD_H);
    // 车道虚线(滚动)
    ctx.fillStyle = '#e8e8e8';
    const dashH = 36, dashGap = 28;
    for (let i = 1; i < LANE_COUNT; i++) {
      const x = ROAD_X + LANE_W * i - 2;
      for (let y = -dashH + (off % (dashH + dashGap)); y < FIELD_H; y += dashH + dashGap) {
        ctx.fillRect(x, y, 4, dashH);
      }
    }

    // 道具
    for (const u of this.powerups) Sprites.powerup(ctx, u, this.frame);
    // 敌车
    for (const e of this.enemies) Sprites.enemy(ctx, e);
    // 子弹
    for (const b of this.playerBullets) Sprites.bulletPlayer(ctx, b, this.frame);
    for (const b of this.enemyBullets) Sprites.bulletEnemy(ctx, b, this.frame);
    // 玩家(无敌闪烁 + 护盾光环)
    const p = this.player;
    if (p.alive) {
      if (p.invincible <= 0 || (this.frame >> 2) % 2 === 0) Sprites.player(ctx, p, this.frame);
      if (p.shield > 0) Sprites.shieldRing(ctx, p, this.frame);
    }
    // 粒子
    for (const pt of this.particles) {
      ctx.globalAlpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    this.drawHud(ctx);

    if (this.state === STATE_TITLE) this.drawTitle(ctx);
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
    ctx.fillText(`${(this.dist / 1000).toFixed(2)} km`, FIELD_W / 2, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`最高 ${Math.max(this.hiScore, this.score)}`, FIELD_W - 12, 24);

    // 时速表(右下,大字号)
    ctx.fillStyle = '#ffd76e';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(`${Math.round(this.player.speed)}`, FIELD_W - 52, FIELD_H - 20);
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('km/h', FIELD_W - 12, FIELD_H - 20);

    // 耐久条(左下)
    const p = this.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('耐久', 12, FIELD_H - 50);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(12, FIELD_H - 42, 110, 9);
    ctx.fillStyle = p.hp > 40 ? '#5ad97a' : '#e05a4a';
    ctx.fillRect(12, FIELD_H - 42, 110 * Math.max(0, p.hp / PLAYER_HP), 9);
    // 命数小车图标
    for (let i = 0; i < this.lives; i++) Sprites.miniCar(ctx, 20 + i * 18, FIELD_H - 12);
    // 导弹存量
    if (p.missiles > 0) {
      for (let i = 0; i < p.missiles; i++) Sprites.miniMissile(ctx, FIELD_W - 16 - i * 14, FIELD_H - 52);
    }
  }

  _dim(ctx, alpha) {
    ctx.fillStyle = `rgba(8,10,16,${alpha})`;
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  }

  drawTitle(ctx) {
    this._dim(ctx, 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff9a6e';
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillText('公路战车', FIELD_W / 2, 200);
    ctx.fillStyle = '#ae5a3f';
    ctx.font = 'bold 19px "Courier New", monospace';
    ctx.fillText('C A R   B A T T L E', FIELD_W / 2, 236);
    ctx.fillStyle = '#c8d6f0';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('← → 转向 · ↑ 加速 · ↓ 刹车', FIELD_W / 2, 330);
    ctx.fillText('空格 机炮 · X 导弹 · P 暂停', FIELD_W / 2, 356);
    ctx.fillText('打爆敌车得分,别撞民用车!', FIELD_W / 2, 396);
    if (this.hiScore > 0) {
      ctx.fillStyle = '#ffd76e';
      ctx.fillText(`最高分 ${this.hiScore}`, FIELD_W / 2, 440);
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

  drawOver(ctx) {
    this._dim(ctx, 0.65);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6060';
    ctx.font = 'bold 40px "Courier New", monospace';
    ctx.fillText('游戏结束', FIELD_W / 2, 230);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(`得分 ${this.score}`, FIELD_W / 2, 292);
    ctx.fillStyle = '#9fb2d8';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(`里程 ${(this.dist / 1000).toFixed(2)} km`, FIELD_W / 2, 324);
    ctx.fillStyle = '#ffd76e';
    ctx.fillText(`最高分 ${this.hiScore}`, FIELD_W / 2, 356);
    if ((this.frame >> 4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Courier New", monospace';
      ctx.fillText('按 Enter 或点击画面重新开始', FIELD_W / 2, 430);
    }
  }
}
