// ===== 常量 + 难度曲线 =====
const FIELD_W = 480;
const FIELD_H = 640;

// 公路几何:中央路面 + 两侧草地
const ROAD_X = 60;               // 路面左缘
const ROAD_W = 360;              // 路面宽
const ROAD_RX = ROAD_X + ROAD_W; // 路面右缘
const LANE_COUNT = 4;
const LANE_W = ROAD_W / LANE_COUNT;

const MAX_SPEED = 220;      // km/h
const CRUISE_SPEED = 160;   // 松油门自动巡航速度
const KMH_TO_PX = 0.045;    // km/h -> 每帧滚动像素(220 时约 10px/帧)

const PLAYER_HP = 100;
const PLAYER_LIVES = 3;

// 方向常量(触屏摇杆用)
const DIR_UP = 0;
const DIR_RIGHT = 1;
const DIR_DOWN = 2;
const DIR_LEFT = 3;

// 敌车类型(speed 为基准时速 km/h;chaser/gunner 动态调速)
const ENEMY_TYPES = {
  civil:  { w: 34, h: 56, hp: 1,  score: 0,   speed: 80 },
  chaser: { w: 36, h: 60, hp: 3,  score: 200, speed: 0 },
  gunner: { w: 36, h: 60, hp: 4,  score: 300, speed: 0 },
  truck:  { w: 44, h: 88, hp: 12, score: 800, speed: 75 },
};

const Difficulty = {
  // 刷车间隔(帧):随里程(米)缩短,105 -> 48
  spawnInterval(dist) {
    return Math.max(48, 105 - Math.floor(dist / 400));
  },
  // 敌车类型权重:里程越长战斗车越多
  pickType(dist) {
    const km = dist / 1000;
    const pTruck = 0.10;
    const pGunner = Math.min(0.18, km * 0.06);
    const pChaser = Math.min(0.22, 0.08 + km * 0.05);
    const r = Math.random();
    if (r < pTruck) return 'truck';
    if (r < pTruck + pGunner) return 'gunner';
    if (r < pTruck + pGunner + pChaser) return 'chaser';
    return 'civil';
  },
};
