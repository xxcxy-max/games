// ===== 实体:玩家跑车 / 敌车 / 子弹 / 道具 / 粒子 =====

// 圆与矩形碰撞
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

// 矩形与矩形碰撞(车与车、车压道具)
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

class PlayerCar {
  constructor() {
    this.w = 38; this.h = 64;
    this.reset();
  }
  reset() {
    this.x = FIELD_W / 2;
    this.y = FIELD_H - 130;
    this.speed = 0;           // km/h
    this.hp = PLAYER_HP;
    this.alive = true;
    this.invincible = 120;    // 出生/重生保护
    this.shield = 0;          // 护盾剩余帧
    this.missiles = 0;        // 导弹存量
    this.fireTimer = 0;
    this.flash = 0;           // 受击红闪
  }
}

class EnemyCar {
  constructor(x, y, type, playerSpeed) {
    const t = ENEMY_TYPES[type];
    this.type = type;
    this.w = t.w; this.h = t.h;
    this.hp = t.hp;
    this.score = t.score;
    this.x = x; this.y = y;
    this.vx = 0;
    if (type === 'chaser') this.speed = Math.min(245, playerSpeed + 40); // 从后方追上
    else if (type === 'gunner') this.speed = Math.max(40, playerSpeed - 30); // 先进入视野再控距
    else this.speed = t.speed + (Math.random() * 20 - 10);
    this.colorIdx = Math.floor(Math.random() * 2); // 民用车配色
    this.fireTimer = 80 + Math.random() * 60;
    this.spin = 0;            // 被撞失控滑出剩余帧
    this.flash = 0;
    this.alive = true;
  }
  update(game) {
    const p = game.player;
    if (this.flash > 0) this.flash--;
    if (this.spin > 0) {
      // 失控:向外滑出并逐渐下落出屏
      this.spin--;
      this.x += this.vx;
      this.y += 2;
      if (this.x < -60 || this.x > FIELD_W + 60 || this.y > FIELD_H + 110) this.alive = false;
      return;
    }
    if (this.type === 'chaser') {
      // 追上后匹配速度,并向玩家并线别车
      if (this.y < p.y + 30) this.speed = Math.max(p.speed, this.speed - 0.8);
      const want = p.x - this.x;
      this.x += Math.max(-2.2, Math.min(2.2, want * 0.045));
    } else if (this.type === 'gunner') {
      // 与玩家保持距离 180~260px,伺机向后射击
      if (this.y > 260) this.speed += 1.2;
      else if (this.y < 180) this.speed = Math.max(40, this.speed - 1.2);
      else this.speed += (p.speed - this.speed) * 0.05;
      this.x += Math.max(-1.2, Math.min(1.2, (p.x - this.x) * 0.012));
      if (--this.fireTimer <= 0 && this.y > 40 && this.y < p.y - 110) {
        this.fireTimer = 95;
        game.enemyBullets.push(new Bullet(this.x, this.y + this.h / 2, 0, 5, false));
        Sound.enemyShoot();
      }
    }
    // 纵向:相对速度 => 屏幕位移(正值下移 = 玩家超车)
    this.y += (p.speed - this.speed) * KMH_TO_PX;
    if (this.y > FIELD_H + 110 || this.y < -240) this.alive = false;
  }
}

class Bullet {
  // opts: { kind, damage, homing, r }
  constructor(x, y, vx, vy, fromPlayer, opts) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.fromPlayer = fromPlayer;
    const o = opts || {};
    this.kind = o.kind || 'bullet';
    this.damage = o.damage || 1;
    this.homing = !!o.homing;
    this.r = o.r || (fromPlayer ? 3 : 4);
    this.alive = true;
  }
  update(game) {
    // 导弹:有限转角追踪最近敌车
    if (this.homing && game) {
      const t = game.nearestFoe(this.x, this.y);
      if (t) {
        const sp = Math.hypot(this.vx, this.vy);
        const want = Math.atan2(t.y - this.y, t.x - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const a = cur + Math.max(-0.1, Math.min(0.1, d));
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

class PowerUp {
  constructor(x, y, kind) {
    this.x = x; this.y = y;
    this.kind = kind;         // 'missile' 导弹 / 'repair' 修理 / 'shield' 护盾
    this.r = 13;
    this.t = Math.random() * 60;
    this.alive = true;
  }
  // 道具静止在路面上,随路面一起向后滚动
  update(game) {
    this.t++;
    this.y += game.player.speed * KMH_TO_PX;
    if (this.y > FIELD_H + 30) this.alive = false;
  }
}

class Particle {
  constructor(x, y, color) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.8 + Math.random() * 3.4;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.life = this.maxLife = 22 + Math.random() * 20;
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
