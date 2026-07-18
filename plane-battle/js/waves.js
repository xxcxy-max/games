// ===== 常量 + 难度曲线 + 出怪表 =====
const FIELD_W = 480;
const FIELD_H = 640;

const BOSS_INTERVAL = 90 * 60;   // 每 90 秒登场一个 Boss(按 60fps 计帧)
const BOSS_HP = 150;
const BOSS_SCORE = 3000;

const Difficulty = {
  // 普通刷怪间隔(帧):75 -> 26,约 100 秒降到底
  spawnInterval(t) {
    return Math.max(26, 75 - Math.floor(t / 120));
  },
  // 敌机速度倍率:1.0 -> 1.8,约 75 秒封顶
  speedMul(t) {
    return 1 + Math.min(0.8, (t / 4500) * 0.8);
  },
  // 按存活时间抽取敌机类型,时间越长中/大型越多
  pickType(t) {
    const s = t / 3600; // 存活分钟数
    const pMed = Math.min(0.3, 0.06 + s * 0.16);
    const pBig = Math.min(0.12, s * 0.08);
    const r = Math.random();
    if (r < pBig) return 'big';
    if (r < pBig + pMed) return 'medium';
    return 'small';
  },
};
