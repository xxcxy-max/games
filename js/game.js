// ===== 游戏主体 =====
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'title';   // title | play | pause | levelclear | gameover
    this.frame = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.input = { dir: -1, shootHeld: false };
    this.map = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.explosions = [];
    this.spawnFx = [];
    this.enemiesLeft = 0;   // 尚未出场的敌人数量
    this.spawnTimer = 0;
    this.spawnedCount = 0;
    this.speedBonus = 0;
    this.baseAlive = true;
    this.respawnTimer = 0;
    this.clearTimer = 0;
  }

  tanks() {
    const all = this.enemies.slice();
    if (this.player && this.player.alive) all.push(this.player);
    return all;
  }

  addExplosion(x, y, big) {
    this.explosions.push(new Explosion(x, y, big));
  }

  addSpark(x, y) {
    this.explosions.push(new Explosion(x, y, false));
  }

  startGame() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.startLevel();
    this.state = 'play';
  }

  startLevel() {
    this.map = buildMap(this.level);
    this.player = new PlayerTank(PLAYER_SPAWN[0], PLAYER_SPAWN[1]);
    this.player.shield = 120;
    this.enemies = [];
    this.bullets = [];
    this.explosions = [];
    this.spawnFx = [];
    const cfg = LEVELS[(this.level - 1) % LEVELS.length];
    const cycle = Math.floor((this.level - 1) / LEVELS.length);
    this.enemiesLeft = cfg.enemies + cycle * 2;
    this.speedBonus = Math.min(0.8, 0.1 * (this.level - 1));
    this.spawnTimer = 60;
    this.spawnedCount = 0;
    this.baseAlive = true;
  }

  gameOver() {
    this.state = 'gameover';
  }

  // ---------- 更新 ----------
  update() {
    this.frame++;
    if (this.state === 'play') {
      this.updatePlay();
    } else if (this.state === 'levelclear') {
      if (--this.clearTimer <= 0) {
        this.level++;
        this.startLevel();
        this.state = 'play';
      }
    }
  }

  updatePlay() {
    // 玩家
    if (this.player.alive) {
      this.player.update(this, this.input);
    } else if (this.lives > 0 && --this.respawnTimer <= 0) {
      this.tryRespawn();
    }
    // 敌人
    for (const e of this.enemies) e.update(this);
    // 敌人出场
    this.updateSpawns();
    // 子弹
    for (const b of this.bullets) if (!b.dead) b.update(this);
    this.handleBulletHits();
    this.bullets = this.bullets.filter(b => !b.dead);
    // 特效
    for (const ex of this.explosions) ex.update();
    this.explosions = this.explosions.filter(e => !e.done);
    for (const s of this.spawnFx) s.update();
    // 过关判定
    if (this.state === 'play' &&
        this.enemiesLeft === 0 && this.enemies.length === 0 && this.spawnFx.length === 0) {
      this.state = 'levelclear';
      this.clearTimer = 150;
    }
  }

  tryRespawn() {
    const r = { x: PLAYER_SPAWN[0], y: PLAYER_SPAWN[1], w: 32, h: 32 };
    if (this.tanks().some(t => rectsOverlap(r, t.rect()))) {
      this.respawnTimer = 30;   // 出生点被堵，稍后再试
      return;
    }
    this.player = new PlayerTank(PLAYER_SPAWN[0], PLAYER_SPAWN[1]);
    this.player.shield = 150;
  }

  updateSpawns() {
    // 出场动画结束 -> 坦克正式登场；出生点被堵则退回队列稍后重试
    for (const s of this.spawnFx) {
      if (s.done) {
        const r = { x: s.x, y: s.y, w: 32, h: 32 };
        if (this.tanks().some(t => rectsOverlap(r, t.rect()))) {
          this.enemiesLeft++;
        } else {
          const type = ENEMY_TYPES[this.spawnedCount % ENEMY_TYPES.length];
          this.spawnedCount++;
          this.enemies.push(new EnemyTank(s.x, s.y, type, this.speedBonus));
        }
      }
    }
    this.spawnFx = this.spawnFx.filter(s => !s.done);
    // 同屏最多 4 个敌人
    const pending = this.enemies.length + this.spawnFx.length;
    if (this.enemiesLeft > 0 && pending < 4 && --this.spawnTimer <= 0) {
      this.spawnTimer = 150;
      const pts = ENEMY_SPAWNS.slice().sort(() => Math.random() - 0.5);
      for (const [x, y] of pts) {
        const r = { x, y, w: 32, h: 32 };
        const busy = this.tanks().some(t => rectsOverlap(r, t.rect())) ||
                     this.spawnFx.some(s => s.x === x && s.y === y);
        if (!busy) {
          this.spawnFx.push(new SpawnFx(x, y));
          this.enemiesLeft--;
          break;
        }
      }
    }
  }

  handleBulletHits() {
    // 子弹 vs 基地
    if (this.baseAlive) {
      for (const b of this.bullets) {
        if (!b.dead && rectsOverlap(b.rect(), BASE_RECT)) {
          b.dead = true;
          this.baseAlive = false;
          this.addExplosion(BASE_RECT.x + 16, BASE_RECT.y + 16, true);
          Sound.explode();
          this.gameOver();
        }
      }
    }
    // 玩家子弹 vs 敌人
    for (const b of this.bullets) {
      if (b.dead || !b.fromPlayer) continue;
      for (const e of this.enemies) {
        if (e.alive && rectsOverlap(b.rect(), e.rect())) {
          e.alive = false;
          b.dead = true;
          this.score += e.score;
          this.addExplosion(e.x + 16, e.y + 16, true);
          Sound.explode();
          break;
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive);
    // 敌方子弹 vs 玩家
    if (this.player.alive) {
      for (const b of this.bullets) {
        if (b.dead || b.fromPlayer) continue;
        if (rectsOverlap(b.rect(), this.player.rect())) {
          b.dead = true;
          if (this.player.shield <= 0) {
            this.player.alive = false;
            this.addExplosion(this.player.x + 16, this.player.y + 16, true);
            Sound.explode();
            this.lives--;
            if (this.lives > 0) this.respawnTimer = 90;
            else this.gameOver();
          }
        }
      }
    }
    // 子弹对撞(玩家子弹可以打掉敌方子弹)
    for (const pb of this.bullets) {
      if (pb.dead || !pb.fromPlayer) continue;
      for (const eb of this.bullets) {
        if (eb.dead || eb.fromPlayer) continue;
        if (rectsOverlap(pb.rect(), eb.rect())) {
          pb.dead = true;
          eb.dead = true;
          this.addSpark((pb.x + eb.x) / 2, (pb.y + eb.y) / 2);
          break;
        }
      }
    }
  }

  // ---------- 绘制 ----------
  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.state === 'title') {
      this.drawTitle(ctx);
      return;
    }
    this.drawField(ctx);
    this.drawHud(ctx);
    if (this.state === 'pause') {
      this.drawCenterText(ctx, '已暂停', '按 P 继续');
    } else if (this.state === 'levelclear') {
      this.drawCenterText(ctx, `第 ${this.level} 关通过！`, '准备进入下一关…');
    } else if (this.state === 'gameover') {
      this.drawGameOver(ctx);
    }
  }

  drawField(ctx) {
    const phase = (this.frame >> 4) & 1;
    // 地形(砖/钢/水)
    for (let r = 0; r < MAP_TILES; r++) {
      for (let c = 0; c < MAP_TILES; c++) {
        const t = this.map[r][c];
        if (t === TILE_BRICK) drawBrickTile(ctx, c * TILE, r * TILE);
        else if (t === TILE_STEEL) drawSteelTile(ctx, c * TILE, r * TILE);
        else if (t === TILE_WATER) drawWaterTile(ctx, c * TILE, r * TILE, phase);
      }
    }
    drawBase(ctx, BASE_RECT.x, BASE_RECT.y, this.baseAlive);
    for (const s of this.spawnFx) drawSpawnFx(ctx, s);
    // 坦克
    if (this.player.alive) {
      drawTankSprite(ctx, this.player.x, this.player.y, this.player.dir,
                     PLAYER_COLORS, this.player.animFrame);
      if (this.player.shield > 0) drawShield(ctx, this.player, (this.frame >> 2) & 1);
    }
    for (const e of this.enemies) {
      drawTankSprite(ctx, e.x, e.y, e.dir, e.type, e.animFrame);
    }
    // 子弹
    for (const b of this.bullets) drawBullet(ctx, b);
    // 树林画在坦克之上，起遮挡作用
    for (let r = 0; r < MAP_TILES; r++) {
      for (let c = 0; c < MAP_TILES; c++) {
        if (this.map[r][c] === TILE_TREE) drawTreeTile(ctx, c * TILE, r * TILE);
      }
    }
    // 爆炸
    for (const ex of this.explosions) drawExplosion(ctx, ex);
  }

  drawHud(ctx) {
    const x0 = HUD_X;
    ctx.fillStyle = '#585858';
    ctx.fillRect(x0, 0, this.canvas.width - x0, this.canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('1P', x0 + 24, 30);
    ctx.fillStyle = '#f8d84c';
    ctx.fillText(String(this.score).padStart(6, '0'), x0 + 10, 50);
    // 剩余敌人
    ctx.fillStyle = '#000';
    ctx.fillText('敌方', x0 + 24, 84);
    const total = this.enemiesLeft + this.enemies.length + this.spawnFx.length;
    for (let i = 0; i < total; i++) {
      const ix = x0 + 14 + (i % 2) * 22;
      const iy = 96 + Math.floor(i / 2) * 18;
      ctx.fillStyle = '#c03828';
      ctx.fillRect(ix, iy, 14, 14);
      ctx.fillStyle = '#581008';
      ctx.fillRect(ix + 5, iy + 5, 4, 4);
    }
    // 生命
    ctx.fillStyle = '#000';
    ctx.fillText('生命', x0 + 24, 330);
    drawTankSprite(ctx, x0 + 12, 340, DIR_UP, PLAYER_COLORS, 0);
    ctx.fillText('×' + Math.max(0, this.lives), x0 + 52, 362);
    // 关卡
    ctx.fillText('关卡', x0 + 24, 396);
    ctx.fillStyle = '#f8d84c';
    ctx.fillText(String(this.level), x0 + 62, 396);
  }

  drawTitle(ctx) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8d84c';
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.fillText('坦克大战', 256, 130);
    ctx.fillStyle = '#e03020';
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText('TANK  BATTLE', 256, 168);
    drawTankSprite(ctx, 240, 195, DIR_UP, PLAYER_COLORS, (this.frame >> 4) & 1);
    ctx.fillStyle = '#fff';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('方向键 / WASD 移动    空格 射击', 256, 268);
    ctx.fillText('消灭所有敌方坦克，保护好你的基地！', 256, 296);
    if ((this.frame >> 5) & 1) {
      ctx.fillStyle = '#f8d84c';
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText('按 Enter 开始游戏', 256, 345);
    }
    ctx.textAlign = 'left';
  }

  drawCenterText(ctx, line1, line2) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 150, FIELD, 110);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8d84c';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(line1, FIELD / 2, 200);
    if (line2) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText(line2, FIELD / 2, 232);
    }
    ctx.textAlign = 'left';
  }

  drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, FIELD, FIELD);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e03020';
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillText('GAME OVER', FIELD / 2, 160);
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(`最终得分  ${this.score}`, FIELD / 2, 210);
    ctx.fillText(`到达关卡  ${this.level}`, FIELD / 2, 238);
    if ((this.frame >> 5) & 1) {
      ctx.fillStyle = '#f8d84c';
      ctx.fillText('按 Enter 重新开始', FIELD / 2, 290);
    }
    ctx.textAlign = 'left';
  }
}
