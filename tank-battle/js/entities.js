// ===== 工具 =====
function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ===== 子弹 =====
class Bullet {
  constructor(x, y, dir, speed, fromPlayer) {
    this.x = x;           // 中心点
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.fromPlayer = fromPlayer;
    this.dead = false;
  }

  rect() {
    return { x: this.x - 3, y: this.y - 3, w: 6, h: 6 };
  }

  update(game) {
    this.x += DX[this.dir] * this.speed;
    this.y += DY[this.dir] * this.speed;
    const r = this.rect();
    // 飞出战场
    if (r.x < 0 || r.y < 0 || r.x + r.w > FIELD || r.y + r.h > FIELD) {
      this.dead = true;
      game.addSpark(this.x, this.y);
      return;
    }
    // 撞地形
    const c0 = Math.max(0, Math.floor(r.x / TILE));
    const c1 = Math.min(MAP_TILES - 1, Math.floor((r.x + r.w - 1) / TILE));
    const r0 = Math.max(0, Math.floor(r.y / TILE));
    const r1 = Math.min(MAP_TILES - 1, Math.floor((r.y + r.h - 1) / TILE));
    const bricks = [];
    let steel = false;
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const t = game.map[rr][cc];
        if (t === TILE_BRICK) bricks.push([rr, cc]);
        else if (t === TILE_STEEL) steel = true;
      }
    }
    if (bricks.length || steel) {
      // 向垂直于弹道方向扩一格，打出经典的两格宽缺口
      const extra = [];
      for (const [rr, cc] of bricks) {
        if (this.dir === DIR_UP || this.dir === DIR_DOWN) {
          extra.push([rr, cc - 1], [rr, cc + 1]);
        } else {
          extra.push([rr - 1, cc], [rr + 1, cc]);
        }
      }
      for (const [rr, cc] of bricks.concat(extra)) {
        if (rr >= 0 && rr < MAP_TILES && cc >= 0 && cc < MAP_TILES &&
            game.map[rr][cc] === TILE_BRICK) {
          game.map[rr][cc] = TILE_EMPTY;
        }
      }
      this.dead = true;
      if (bricks.length) Sound.hitBrick();
      else Sound.hitSteel();
      game.addSpark(this.x, this.y);
    }
  }
}

// ===== 坦克基类 =====
class Tank {
  constructor(x, y, dir, speed) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.size = 32;
    this.alive = true;
    this.animFrame = 0;
    this.bullet = null;   // 同时在场最多一发
  }

  rect() {
    return { x: this.x, y: this.y, w: this.size, h: this.size };
  }

  hitsMap(x, y, map) {
    if (x < 0 || y < 0 || x + this.size > FIELD || y + this.size > FIELD) return true;
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + this.size - 1) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + this.size - 1) / TILE);
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const t = map[rr][cc];
        if (t === TILE_BRICK || t === TILE_STEEL || t === TILE_WATER) return true;
      }
    }
    return false;
  }

  hitsTanks(x, y, game) {
    const r = { x, y, w: this.size, h: this.size };
    return game.tanks().some(t => t !== this && t.alive && rectsOverlap(r, t.rect()));
  }

  // 沿当前方向前进一格速；被挡住返回 false
  tryMove(game) {
    const nx = this.x + DX[this.dir] * this.speed;
    const ny = this.y + DY[this.dir] * this.speed;
    if (!this.hitsMap(nx, ny, game.map) && !this.hitsTanks(nx, ny, game)) {
      this.x = nx;
      this.y = ny;
      this.animFrame ^= 1;
      return true;
    }
    return false;
  }

  // 转向时把横向坐标对齐到半格，还原经典手感
  snap() {
    if (this.dir === DIR_UP || this.dir === DIR_DOWN) {
      this.x = Math.round(this.x / TILE) * TILE;
    } else {
      this.y = Math.round(this.y / TILE) * TILE;
    }
  }

  // 带碰撞检测的转向；转过去会卡住则放弃
  turnTo(game, dir) {
    if (dir === this.dir) return;
    const ox = this.x, oy = this.y, od = this.dir;
    this.dir = dir;
    this.snap();
    if (this.hitsMap(this.x, this.y, game.map) || this.hitsTanks(this.x, this.y, game)) {
      this.x = ox;
      this.y = oy;
      this.dir = od;
    }
  }

  fire(game, speed, fromPlayer) {
    if (this.bullet && !this.bullet.dead) return;
    const bx = this.x + 16 + DX[this.dir] * 16;
    const by = this.y + 16 + DY[this.dir] * 16;
    this.bullet = new Bullet(bx, by, this.dir, speed, fromPlayer);
    game.bullets.push(this.bullet);
    Sound.shoot();
  }
}

// ===== 玩家 =====
const PLAYER_COLORS = { body: '#e8b820', track: '#8a6a10', trackLine: '#5a4a08', turret: '#f8dc60' };

class PlayerTank extends Tank {
  constructor(x, y) {
    super(x, y, DIR_UP, 2);
    this.shield = 0;      // 无敌剩余帧
  }

  update(game, input) {
    if (this.shield > 0) this.shield--;
    if (input.dir !== -1) {
      this.turnTo(game, input.dir);
      this.tryMove(game);
    }
    if (input.shootHeld) this.fire(game, 4, true);
  }
}

// ===== 敌方坦克 =====
const ENEMY_TYPES = [
  { name: 'basic', speed: 1.0, bulletSpeed: 2.5, score: 100,
    body: '#c8c8c8', track: '#787878', trackLine: '#484848', turret: '#e8e8e8' },
  { name: 'fast',  speed: 2.0, bulletSpeed: 3.0, score: 200,
    body: '#90d890', track: '#386838', trackLine: '#204820', turret: '#c0f0c0' },
  { name: 'power', speed: 1.4, bulletSpeed: 4.0, score: 300,
    body: '#e0a848', track: '#885818', trackLine: '#583808', turret: '#f8d080' },
];

class EnemyTank extends Tank {
  constructor(x, y, type, speedBonus) {
    super(x, y, DIR_DOWN, type.speed + speedBonus);
    this.type = type;
    this.bulletSpeed = type.bulletSpeed;
    this.score = type.score;
    this.turnTimer = randInt(30, 120);
    this.fireTimer = randInt(40, 140);
  }

  update(game) {
    if (--this.turnTimer <= 0) {
      this.turnTimer = randInt(40, 140);
      if (Math.random() < 0.7) this.turnRandom(game);
    }
    if (!this.tryMove(game)) {
      this.snap();
      this.turnRandom(game);
    }
    if (--this.fireTimer <= 0) {
      this.fireTimer = randInt(50, 160);
      this.fire(game, this.bulletSpeed, false);
    }
  }

  // 随机换方向，倾向朝下冲向基地
  turnRandom(game) {
    const dirs = [DIR_DOWN, DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP];
    this.turnTo(game, dirs[Math.floor(Math.random() * dirs.length)]);
  }
}

// ===== 特效 =====
class Explosion {
  constructor(x, y, big) {
    this.x = x;
    this.y = y;
    this.big = big;
    this.t = 0;
    this.max = big ? 30 : 12;
  }
  update() { this.t++; }
  get done() { return this.t >= this.max; }
}

class SpawnFx {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.max = 45;
  }
  update() { this.t++; }
  get done() { return this.t >= this.max; }
}
