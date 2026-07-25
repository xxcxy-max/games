// ===== 纯逻辑:不引用 THREE/document/window,可在 Node vm 中直接跑 =====
let _eid = 1;   // 实体自增 id(渲染层按 id 增量同步 mesh)

// 圆形碰撞:玩家与障碍/道具都是圆
function circleHit(ax, az, ar, bx, bz, br) {
  const dx = ax - bx, dz = az - bz, rr = ar + br;
  return dx * dx + dz * dz < rr * rr;
}

class Player {
  constructor() { this.reset(); }
  reset() {
    this.x = 0;
    this.speed = BASE_CRUISE;
    this.steerVis = 0;      // 平滑后的转向量(渲染层倾斜用)
    this.invincible = 0;
    this.boostTimer = 0;
    this.y = 0;             // 离地高度(跳台腾空)
    this.vy = 0;
    this.airborne = false;
    this.airDist = 0;       // 本次腾空的水平飞行距离
    this.justLanded = 0;    // 落地帧的飞行距离(世界层结算加分,随后清零)
  }
  launch() {
    // 车速越快跳得越高
    this.airborne = true;
    this.vy = JUMP_VY * (0.7 + 0.6 * this.speed / MAX_SPEED);
    this.airDist = 0;
  }
  update(dt, input, cruise) {
    // ----- 转向 -----
    const steer = Math.max(-1, Math.min(1, input.steer || 0));
    this.x += steer * STEER_SPEED * dt;
    this.x = Math.max(-SLOPE_HALF_W, Math.min(SLOPE_HALF_W, this.x));
    this.steerVis += (steer - this.steerVis) * Math.min(1, dt * 10);

    // ----- 速度:刹车 > 油门 > 自动巡航;加速带短暂抬目标速 -----
    const target = this.boostTimer > 0 ? Math.min(MAX_SPEED, cruise * BOOST_MULT) : cruise;
    if (input.brake) this.speed -= 14 * dt;
    else if (input.boost) this.speed += 6 * dt;
    else this.speed += (target - this.speed) * Math.min(1, dt * 0.8);
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.speed += 3 * dt;
    }
    this.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, this.speed));

    // ----- 跳台腾空:抛物线飞行,落地记飞行距离 -----
    this.justLanded = 0;
    if (this.airborne) {
      this.y += this.vy * dt;
      this.vy -= GRAVITY * dt;
      this.airDist += this.speed * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.airborne = false;
        this.justLanded = this.airDist;
      }
    }

    if (this.invincible > 0) this.invincible -= dt;
  }
}

// 松树/岩石障碍
class Obstacle {
  constructor(kind, x, z) {
    this.id = _eid++;
    this.type = 'obstacle';
    this.kind = kind;             // 'tree' | 'rock'
    this.x = x;
    this.z = z;
    this.r = kind === 'tree' ? 0.9 : 1.1;
    this.hit = false;             // 已撞过(不再重复扣命)
  }
}

// 旗门:成对的杆,从中间穿过 +50
class Gate {
  constructor(x, z) {
    this.id = _eid++;
    this.type = 'gate';
    this.x = x;                   // 门的中心
    this.z = z;
    this.halfGap = GATE_HALF_GAP;
    this.passed = false;
    this.missed = false;
  }
}

// 道具:星星 +100 / 加速带短暂提速
class Item {
  constructor(kind, x, z) {
    this.id = _eid++;
    this.type = 'item';
    this.kind = kind;             // 'star' | 'boost'
    this.x = x;
    this.z = z;
    this.r = kind === 'star' ? 1.0 : 1.6;
    this.taken = false;
  }
}

// 跳台:压上去起跳,腾空时可飞越障碍,落地按飞行距离加分
class Jump {
  constructor(x, z) {
    this.id = _eid++;
    this.type = 'jump';
    this.x = x;
    this.z = z;
    this.r = 2.0;
    this.used = false;
  }
}

// 无尽下坡世界:推进、刷物、碰撞、计分、损命
class SkiWorld {
  constructor() {
    this.noSpawn = false;         // 测试钩子:关闭随机刷物
    this.reset();
  }

  reset() {
    this.player = new Player();
    this.entities = [];
    this.events = [];             // 本帧事件:crash/gate/star/boost/gameover(音效层消费)
    this.dist = 0;                // 里程(米)
    this.bonus = 0;               // 奖励分(旗门/星星)
    this.lives = PLAYER_LIVES;
    this.time = 0;
    this.spawnTimer = 1.2;
    this.over = false;
  }

  get score() { return Math.floor(this.dist) + this.bonus; }
  get cruise() { return Difficulty.cruiseSpeed(this.dist); }

  update(dt, input) {
    if (this.over) return;
    dt = Math.min(dt, 0.1);       // 防大步长穿透碰撞
    this.time += dt;
    const p = this.player;
    p.update(dt, input, this.cruise);
    const dz = p.speed * dt;
    this.dist += dz;

    // 跳台落地:按飞行距离加分
    if (p.justLanded > 0) {
      this.bonus += Math.round(p.justLanded);
      this.events.push('land');
    }

    // ----- 刷障碍/旗门/道具 -----
    if (!this.noSpawn && (this.spawnTimer -= dt) <= 0) {
      this.spawnTimer = Difficulty.spawnInterval(this.dist);
      this.spawn();
    }

    // ----- 实体推进 + 判定 -----
    for (const e of this.entities) {
      const prevZ = e.z;
      e.z += dz;

      // 旗门:z 跨过 0 的瞬间判定
      if (e.type === 'gate' && !e.passed && !e.missed && prevZ < 0 && e.z >= 0) {
        if (Math.abs(p.x - e.x) <= e.halfGap - 0.4) {
          e.passed = true;
          this.bonus += GATE_SCORE;
          this.events.push('gate');
        } else {
          e.missed = true;        // 漏过无惩罚
        }
      }

      // 障碍:撞上损 1 命(无敌期免疫;腾空时直接飞越)
      if (e.type === 'obstacle' && !e.hit && !p.airborne && p.invincible <= 0 &&
          Math.abs(e.z) < 1.2 && circleHit(p.x, 0, PLAYER_R, e.x, e.z, e.r)) {
        e.hit = true;
        this.crash();
      }

      // 跳台:压上去起跳(已在空中不重复触发)
      if (e.type === 'jump' && !e.used && !p.airborne &&
          Math.abs(e.z) < 1.5 && circleHit(p.x, 0, PLAYER_R, e.x, e.z, e.r)) {
        e.used = true;
        p.launch();
        this.events.push('jump');
      }

      // 道具:星星加分 / 加速带提速
      if (e.type === 'item' && !e.taken &&
          Math.abs(e.z) < 1.2 && circleHit(p.x, 0, PLAYER_R, e.x, e.z, e.r)) {
        e.taken = true;
        if (e.kind === 'star') {
          this.bonus += STAR_SCORE;
          this.events.push('star');
        } else {
          p.boostTimer = BOOST_TIME;
          this.events.push('boost');
        }
      }
    }

    // ----- 清理:身后回收;被撞障碍滚过身后即删 -----
    this.entities = this.entities.filter(e =>
      e.z < DESPAWN_Z &&
      !(e.type === 'item' && e.taken) &&
      !(e.type === 'obstacle' && e.hit && e.z > 2));
  }

  crash() {
    const p = this.player;
    this.lives--;
    p.speed *= 0.5;
    this.events.push('crash');
    if (this.lives <= 0) {
      this.over = true;
      this.events.push('gameover');
    } else {
      p.invincible = INVINCIBLE_TIME;
    }
  }

  spawn() {
    const kind = Difficulty.pickKind(this.dist);
    if (kind === 'gate') {
      const x = (Math.random() * 2 - 1) * (SLOPE_HALF_W - GATE_HALF_GAP - 1);
      this.entities.push(new Gate(x, SPAWN_Z));
      return;
    }
    if (kind === 'jump') {
      const x = (Math.random() * 2 - 1) * (SLOPE_HALF_W - 3);
      this.entities.push(new Jump(x, SPAWN_Z));
      return;
    }
    if (kind === 'star' || kind === 'boost') {
      const x = (Math.random() * 2 - 1) * (SLOPE_HALF_W - 1.5);
      this.entities.push(new Item(kind, x, SPAWN_Z));
      return;
    }
    // 松树/岩石:1~3 个一组错落刷出
    const n = 1 + Math.floor(Math.random() * (this.dist > 800 ? 3 : 2));
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * (SLOPE_HALF_W - 1);
      const z = SPAWN_Z - i * 6 - Math.random() * 4;
      const blocked = this.entities.some(e =>
        Math.abs(e.x - x) < 2.5 && Math.abs(e.z - z) < 5);
      if (!blocked) this.entities.push(new Obstacle(kind, x, z));
    }
  }
}
