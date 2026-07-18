// ===== 实体:玩家机 / 敌机 / Boss / 子弹 / 道具 / 粒子 =====

// 圆与矩形碰撞(子弹/道具是圆,飞机用矩形近似)
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

// 圆与圆碰撞
function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

const ENEMY_TYPES = {
  small:  { w: 30, h: 26, hp: 1,  speed: 2.6, score: 100, fire: 0,   color: '#e06565' },
  medium: { w: 42, h: 36, hp: 4,  speed: 1.7, score: 300, fire: 120, color: '#b06ee0' },
  big:    { w: 58, h: 50, hp: 10, speed: 1.1, score: 800, fire: 95,  color: '#4a9e5c' },
};

class Bullet {
  constructor(x, y, vx, vy, fromPlayer) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.fromPlayer = fromPlayer;
    this.r = fromPlayer ? 3 : 4.5;
    this.alive = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.y < -20 || this.y > FIELD_H + 20 || this.x < -20 || this.x > FIELD_W + 20) {
      this.alive = false;
    }
  }
}

class PlayerPlane {
  constructor() {
    this.w = 36; this.h = 44;
    this.speed = 4.6;
    this.reset();
  }
  reset() {
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 90;
    this.alive = true;
    this.weapon = 1;          // 1 单发 / 2 双发 / 3 三向
    this.invincible = 150;    // 出生保护
    this.fireTimer = 0;
  }
  get hitR() { return 7; }    // 受击判定是小圆(弹幕游戏惯例)

  // 键盘:按单位向量移动
  move(dx, dy) {
    if (!this.alive) return;
    this.x += dx * this.speed;
    this.y += dy * this.speed;
    this._clamp();
  }
  // 触屏:直接拖到目标点
  moveTo(x, y) {
    if (!this.alive) return;
    this.x = x;
    this.y = y;
    this._clamp();
  }
  _clamp() {
    this.x = Math.max(this.w / 2, Math.min(FIELD_W - this.w / 2, this.x));
    this.y = Math.max(this.h / 2, Math.min(FIELD_H - this.h / 2, this.y));
  }

  fire(game) {
    const y = this.y - 22;
    if (this.weapon === 1) {
      game.playerBullets.push(new Bullet(this.x, y, 0, -9.5, true));
    } else if (this.weapon === 2) {
      game.playerBullets.push(new Bullet(this.x - 9, y, 0, -9.5, true));
      game.playerBullets.push(new Bullet(this.x + 9, y, 0, -9.5, true));
    } else {
      game.playerBullets.push(new Bullet(this.x, y, 0, -9.5, true));
      game.playerBullets.push(new Bullet(this.x - 9, y + 3, -2.4, -9, true));
      game.playerBullets.push(new Bullet(this.x + 9, y + 3, 2.4, -9, true));
    }
  }
}

class Enemy {
  constructor(x, type, speedMul) {
    const t = ENEMY_TYPES[type];
    this.type = type;
    this.w = t.w; this.h = t.h;
    this.hp = t.hp;
    this.speed = t.speed * speedMul;
    this.score = t.score;
    this.fireInterval = t.fire;
    this.x = x;
    this.y = -this.h;
    this.vx = type === 'small' ? Math.random() * 1.2 - 0.6 : 0;
    this.fireTimer = this.fireInterval ? 50 + Math.floor(Math.random() * this.fireInterval) : 0;
    this.alive = true;
    this.flash = 0;           // 受击白闪帧数
  }
  update(game) {
    this.y += this.speed;
    this.x += this.vx;
    if (this.x < this.w / 2 || this.x > FIELD_W - this.w / 2) this.vx *= -1;
    if (this.y > FIELD_H + this.h) { this.alive = false; return; }
    if (this.flash > 0) this.flash--;
    // 中/大型发射直线下行弹,进入画面上半后才开火
    if (this.fireInterval && --this.fireTimer <= 0) {
      this.fireTimer = this.fireInterval;
      if (this.y > 10 && this.y < FIELD_H * 0.65) {
        if (this.type === 'big') {
          game.enemyBullets.push(new Bullet(this.x - 11, this.y + this.h / 2, -0.8, 3.4, false));
          game.enemyBullets.push(new Bullet(this.x + 11, this.y + this.h / 2, 0.8, 3.4, false));
        } else {
          game.enemyBullets.push(new Bullet(this.x, this.y + this.h / 2, 0, 3.6, false));
        }
      }
    }
  }
}

class Boss {
  constructor() {
    this.w = 130; this.h = 84;
    this.hp = BOSS_HP;
    this.maxHp = BOSS_HP;
    this.x = FIELD_W / 2;
    this.y = -this.h;
    this.t = 0;
    this.fireTimer = 100;
    this.alive = true;
    this.flash = 0;
  }
  update(game) {
    this.t++;
    if (this.y < 100) {
      this.y += 1.6;          // 入场下潜
    } else {
      // 顶部左右正弦巡游
      this.x = FIELD_W / 2 + Math.sin(this.t / 75) * (FIELD_W / 2 - this.w / 2 - 14);
    }
    if (this.flash > 0) this.flash--;
    if (this.y > 20 && --this.fireTimer <= 0) {
      this.fireTimer = 72;
      // 扇形三连发
      for (const a of [-0.32, 0, 0.32]) {
        game.enemyBullets.push(new Bullet(
          this.x, this.y + this.h / 2 - 8,
          Math.sin(a) * 3.4, Math.cos(a) * 3.4, false
        ));
      }
    }
  }
}

class PowerUp {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;         // 'star' 武器 / 'bomb' 雷 / 'life' 命
    this.r = 13;
    this.t = Math.random() * 60;
    this.alive = true;
  }
  update() {
    this.t++;
    this.y += 1.5;
    this.x += Math.sin(this.t / 30) * 0.6;
    if (this.y > FIELD_H + 20) this.alive = false;
  }
}

class Particle {
  constructor(x, y, color) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 3.2;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.life = this.maxLife = 24 + Math.random() * 22;
    this.size = 1.5 + Math.random() * 3;
    this.color = color;
    this.alive = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    if (--this.life <= 0) this.alive = false;
  }
}
