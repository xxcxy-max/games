// ===== 实体:球 / 挡板 / 砖块 / 激光 / 道具 / 粒子 =====

// 圆与矩形碰撞
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

class Ball {
  constructor(x, y, speed) {
    this.r = 6;
    this.x = x; this.y = y;
    this.speed = speed;
    this.stuck = true;        // 粘在挡板上待发射
    this.vx = 0;
    this.vy = -speed;
    this.alive = true;
  }
  launch() {
    if (!this.stuck) return;
    this.stuck = false;
    const a = Math.random() * 0.5 - 0.25;   // 略微随机的发射角
    this.vx = this.speed * Math.sin(a);
    this.vy = -this.speed * Math.cos(a);
  }
  update() {
    if (this.stuck) return;
    this.x += this.vx;
    this.y += this.vy;
    // 左右墙与顶部反弹(掉出底部由 game 判定扣命)
    if (this.x < this.r) { this.x = this.r; this.vx = Math.abs(this.vx); Sound.wall(); }
    if (this.x > FIELD_W - this.r) { this.x = FIELD_W - this.r; this.vx = -Math.abs(this.vx); Sound.wall(); }
    if (this.y < this.r) { this.y = this.r; this.vy = Math.abs(this.vy); Sound.wall(); }
  }
}

class Paddle {
  constructor() {
    this.baseW = 80;
    this.wideW = 124;
    this.w = this.baseW;
    this.h = 12;
    this.x = FIELD_W / 2;     // 中心 x
    this.y = FIELD_H - 34;    // 中心 y(固定)
    this.speed = 6.5;
    this.laserTimer = 0;      // 激光模式剩余帧
    this.wideTimer = 0;       // 变长剩余帧
    this.cooldown = 0;        // 激光发射冷却
  }
  get hasLaser() { return this.laserTimer > 0; }

  move(dir) { this.moveTo(this.x + dir * this.speed); }
  moveTo(x) {
    this.x = Math.max(this.w / 2, Math.min(FIELD_W - this.w / 2, x));
  }
  update() {
    if (this.laserTimer > 0) this.laserTimer--;
    if (this.wideTimer > 0 && --this.wideTimer === 0) this.w = this.baseW;
    if (this.cooldown > 0) this.cooldown--;
  }
  widen() {
    this.w = this.wideW;
    this.wideTimer = 720;     // 12 秒
    this.moveTo(this.x);      // 变宽后重新夹取,防止探出边界
  }
  enableLaser() { this.laserTimer = 600; } // 10 秒
}

class Brick {
  constructor(col, row, hp) {
    this.x = BRICK_X0 + col * (BRICK_W + BRICK_GAP);
    this.y = BRICK_Y0 + row * (BRICK_H + BRICK_GAP);
    this.w = BRICK_W;
    this.h = BRICK_H;
    this.hp = hp;
    this.maxHp = hp;
    this.flash = 0;           // 受击白闪帧数
    this.alive = true;
  }
  get score() { return this.maxHp * 50; }
  // 颜色随当前耐久变化(掉血变色)
  get color() { return ['#3fb2e0', '#e0b13f', '#e05a5a'][Math.max(0, this.hp - 1)]; }
}

class Laser {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vy = -9;
    this.h = 12;
    this.alive = true;
  }
  update() {
    this.y += this.vy;
    if (this.y < -this.h) this.alive = false;
  }
}

class PowerUp {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;         // 'multi' 多球 / 'laser' 激光 / 'wide' 变长板
    this.r = 12;
    this.alive = true;
  }
  update() {
    this.y += 2;
    if (this.y > FIELD_H + 20) this.alive = false;
  }
}

class Particle {
  constructor(x, y, color) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 3;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.life = this.maxLife = 20 + Math.random() * 18;
    this.size = 1.5 + Math.random() * 2.5;
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
