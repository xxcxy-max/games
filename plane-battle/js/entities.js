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

// 可选战机:不同移速、射速与专属弹种
const PLANE_TYPES = {
  falcon:  { name: '猎鹰',   desc: '均衡型 · 直射光弹',        speed: 4.6, fireInterval: 8 },
  apache:  { name: '阿帕奇', desc: '火力型 · 机炮+追踪导弹',   speed: 4.2, fireInterval: 9 },
  phantom: { name: '幻影',   desc: '速度型 · 穿透波弹',        speed: 5.0, fireInterval: 9 },
};

class Bullet {
  // opts: { kind, damage, pierce, homing, r }
  constructor(x, y, vx, vy, fromPlayer, opts) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.fromPlayer = fromPlayer;
    const o = opts || {};
    this.kind = o.kind || (fromPlayer ? 'bolt' : 'orb');
    this.damage = o.damage || 1;
    this.pierce = !!o.pierce;   // 穿透:命中后不消失
    this.homing = !!o.homing;   // 追踪:缓慢转向最近目标
    this.r = o.r || (fromPlayer ? 3 : 4.5);
    this.hits = new Set();      // 穿透弹已命中过的目标,避免重复结算
    this.alive = true;
  }
  update(game) {
    // 追踪弹:以有限转角朝最近敌机/Boss 修正方向
    if (this.homing && game) {
      const t = game.nearestFoe(this.x, this.y);
      if (t) {
        const sp = Math.hypot(this.vx, this.vy);
        const want = Math.atan2(t.y - this.y, t.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const a = cur + Math.max(-0.09, Math.min(0.09, d));
        this.vx = Math.cos(a) * sp;
        this.vy = Math.sin(a) * sp;
      }
    }
    this.x += this.vx;
    this.y += this.vy;
    if (this.y < -20 || this.y > FIELD_H + 20 || this.x < -20 || this.x > FIELD_W + 20) {
      this.alive = false;
    }
  }
}

class PlayerPlane {
  constructor(type) {
    this.type = PLANE_TYPES[type] ? type : 'falcon';
    this.w = 36; this.h = 44;
    const t = PLANE_TYPES[this.type];
    this.speed = t.speed;
    this.fireInterval = t.fireInterval;
    this.reset();
  }
  reset() {
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 90;
    this.alive = true;
    this.weapon = 1;          // 武器等级 1~4,形态因战机而异
    this.invincible = 150;    // 出生保护
    this.fireTimer = 0;
    this.shotCount = 0;       // 齐射计数(阿帕奇导弹节奏用)
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
    this.shotCount++;
    if (this.type === 'apache') this._fireApache(game, y);
    else if (this.type === 'phantom') this._firePhantom(game, y);
    else this._fireFalcon(game, y);
  }

  // 猎鹰:直射光弹,Lv4 五向
  _fireFalcon(game, y) {
    const B = (x, vx, vy) => game.playerBullets.push(new Bullet(x, y, vx, vy, true));
    if (this.weapon === 1) {
      B(this.x, 0, -9.5);
    } else if (this.weapon === 2) {
      B(this.x - 9, 0, -9.5); B(this.x + 9, 0, -9.5);
    } else if (this.weapon === 3) {
      B(this.x, 0, -9.5); B(this.x - 9, -2.4, -9); B(this.x + 9, 2.4, -9);
    } else {
      B(this.x, 0, -9.6);
      B(this.x - 7, -2.2, -9.3); B(this.x + 7, 2.2, -9.3);
      B(this.x - 13, -4.4, -8.5); B(this.x + 13, 4.4, -8.5);
    }
  }

  // 阿帕奇:机炮曳光弹;Lv2 起每 3 轮齐射挂追踪导弹,Lv3 起双联
  _fireApache(game, y) {
    const B = (x, vx, vy) => game.playerBullets.push(new Bullet(x, y, vx, vy, true, { kind: 'tracer', r: 2.5 }));
    if (this.weapon === 1) {
      B(this.x, 0, -10);
    } else if (this.weapon <= 3) {
      B(this.x - 7, 0, -10); B(this.x + 7, 0, -10);
    } else {
      B(this.x, 0, -10); B(this.x - 8, -2.2, -9.6); B(this.x + 8, 2.2, -9.6);
    }
    if (this.weapon >= 2 && this.shotCount % 3 === 0) {
      const M = (x) => game.playerBullets.push(new Bullet(x, this.y - 6, 0, -5.5, true,
        { kind: 'missile', damage: 4, homing: true, r: 5 }));
      if (this.weapon === 2) M(this.x);
      else { M(this.x - 14); M(this.x + 14); }
      Sound.missile();
    }
  }

  // 幻影:穿透波弹,Lv4 强化(更大、2 倍伤害)
  _firePhantom(game, y) {
    const strong = this.weapon >= 4;
    const sp = strong ? -9 : -8.5;
    const B = (x, vx, vy) => game.playerBullets.push(new Bullet(x, y, vx, vy, true, {
      kind: 'wave', pierce: true, r: strong ? 6 : 5, damage: strong ? 2 : 1,
    }));
    if (this.weapon === 1) {
      B(this.x, 0, sp);
    } else if (this.weapon === 2) {
      B(this.x - 8, 0, sp); B(this.x + 8, 0, sp);
    } else {
      B(this.x, 0, sp); B(this.x - 9, -2.0, sp + 0.4); B(this.x + 9, 2.0, sp + 0.4);
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
