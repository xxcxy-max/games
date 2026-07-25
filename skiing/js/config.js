// ===== 常量 + 难度曲线 =====
// 世界坐标:玩家固定在 z=0,障碍/道具从远处(负 z)向玩家移动,x 为横向(米)
const SLOPE_HALF_W = 14;     // 雪道半宽(米)
const SPAWN_Z = -130;        // 远处刷出位置
const DESPAWN_Z = 12;        // 越过身后回收位置

const BASE_CRUISE = 10;      // 起步巡航速度(m/s)
const MAX_SPEED = 34;        // 速度上限(m/s)
const MIN_SPEED = 4;         // 刹车到底的最低速度
const STEER_SPEED = 13;      // 横向移动速度(m/s)
const PLAYER_R = 0.7;        // 玩家碰撞半径
const PLAYER_LIVES = 3;

const INVINCIBLE_TIME = 2;   // 撞后无敌秒数
const BOOST_TIME = 3;        // 加速带提速持续秒数
const BOOST_MULT = 1.45;     // 加速带速度倍率

const GATE_SCORE = 50;       // 过旗门得分
const STAR_SCORE = 100;      // 拾取星星得分
const GATE_HALF_GAP = 2.2;   // 旗门半宽(两杆间距的一半)

const JUMP_VY = 6.5;         // 跳台起跳初速度(m/s,随车速加成)
const GRAVITY = 16;          // 空中重力加速度(m/s²)

const Difficulty = {
  // 巡航速度(m/s):随里程(米)提升,10 -> 34
  cruiseSpeed(dist) {
    return Math.min(MAX_SPEED, BASE_CRUISE + dist / 250);
  },
  // 刷物间隔(秒):随里程缩短,1.3 -> 0.5
  spawnInterval(dist) {
    return Math.max(0.5, 1.3 - dist / 4000);
  },
  // 刷出类型权重:里程越长岩石越多
  pickKind(dist) {
    const km = dist / 1000;
    const pBoost = Math.min(0.06, 0.03 + km * 0.01);
    const pStar = 0.10;
    const pGate = 0.16;
    const pJump = dist > 100 ? 0.10 : 0;   // 100m 后开始出现跳台
    const r = Math.random();
    if (r < pBoost) return 'boost';
    if (r < pBoost + pStar) return 'star';
    if (r < pBoost + pStar + pGate) return 'gate';
    if (r < pBoost + pStar + pGate + pJump) return 'jump';
    return Math.random() < Math.min(0.45, 0.25 + km * 0.05) ? 'rock' : 'tree';
  },
};
