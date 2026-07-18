// 无头冒烟测试:在 Node 里加载游戏逻辑(不含 main.js),跑几千帧模拟,捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['audio.js', 'waves.js', 'sprites.js', 'entities.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, Bullet, Enemy, Boss, PowerUp, Particle, PlayerPlane,
  ENEMY_TYPES, PLANE_TYPES, FIELD_W, FIELD_H, BOSS_INTERVAL, BOSS_HP, BOSS_SCORE, Difficulty,
  circleRect, circleCircle,
};`;

// 浏览器环境桩
const gradientStub = { addColorStop() {} };
const canvasStub = { width: 480, height: 640, getContext: () => ctxStub };
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'canvas') return canvasStub;
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradientStub;
    if (p === 'measureText') return () => ({ width: 0 });
    return () => {};
  },
  set() { return true; },
});

const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const X = sandbox.__x;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.error('  ✗ ' + msg); }
}

// 1. 启动游戏
console.log('[1] 启动');
{
  const game = new X.Game(canvasStub);
  assert(game.state === 'title', '初始为标题界面');
  game.draw();
  game.startGame();
  assert(game.state === 'play' && game.lives === 3 && game.score === 0 && game.bombs === 2,
    '开始游戏进入 play 状态(3 命 / 2 雷 / 0 分)');
}

// 2. 自动开火击落小型机得分
console.log('[2] 自动开火与击落');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  game.enemies.push(new X.Enemy(p.x, 'small', 1));
  const e = game.enemies[0];
  e.y = p.y - 120; // 正好在弹道上
  let frames = 0;
  while (game.score === 0 && frames < 90) { game.update(); game.draw(); frames++; }
  assert(game.score === 100 && game.enemies.length === 0, `击落小型机 +100(${frames} 帧,得分 ${game.score})`);
  for (let i = 0; i < 8 && game.playerBullets.length === 0; i++) game.update();
  assert(game.playerBullets.length > 0, '自动开火持续产生子弹');
}

// 3. 敌弹命中 -> 扣命并带无敌重生
console.log('[3] 玩家中弹与重生');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.invincible = 0;
  game.enemyBullets.push(new X.Bullet(p.x, p.y - 20, 0, 3.6, false));
  for (let i = 0; i < 10 && p.alive; i++) game.update();
  assert(game.lives === 2 && !p.alive, `玩家被击中后生命 -1(剩 ${game.lives})`);
  for (let i = 0; i < 120 && !p.alive; i++) game.update();
  game.draw();
  assert(p.alive && p.invincible > 0 && game.state === 'play', '玩家在出生点带无敌重生');
}

// 4. 最后一命被打掉 -> 游戏结束
console.log('[4] 玩家全灭');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  game.lives = 1;
  game.player.invincible = 0;
  const p = game.player;
  game.enemyBullets.push(new X.Bullet(p.x, p.y - 20, 0, 3.6, false));
  for (let i = 0; i < 10 && game.state === 'play'; i++) game.update();
  game.draw();
  assert(game.state === 'gameover', '最后一条命被打掉后游戏结束');
}

// 5. 道具:武器升到 Lv4 / 满级折分 / 雷 +1 / 命 +1
console.log('[5] 道具');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  game.powerups.push(new X.PowerUp(p.x, p.y, 'star'));
  game.update();
  assert(p.weapon === 2, '吃 ⭐ 武器升到 2 级');
  game.powerups.push(new X.PowerUp(p.x, p.y, 'star'));
  game.update();
  game.powerups.push(new X.PowerUp(p.x, p.y, 'star'));
  game.update();
  assert(p.weapon === 4, '再吃两颗 ⭐ 武器升到 4 级(满级)');
  game.powerups.push(new X.PowerUp(p.x, p.y, 'star'));
  game.update();
  assert(p.weapon === 4 && game.score === 500, '满级后 ⭐ 折算 500 分');
  game.powerups.push(new X.PowerUp(p.x, p.y, 'bomb'));
  game.update();
  assert(game.bombs === 3, '吃 💣 雷数 +1');
  const lives = game.lives;
  game.powerups.push(new X.PowerUp(p.x, p.y, 'life'));
  game.update();
  assert(game.lives === lives + 1, '吃 ❤️ 命数 +1');
}

// 6. 放雷:清空敌弹 + 全屏伤害 + 冲击波特效
console.log('[6] 放雷');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  game.player.invincible = 99999;
  game.enemies.push(new X.Enemy(100, 'small', 1));
  game.enemies.push(new X.Enemy(300, 'medium', 1));
  for (const e of game.enemies) e.y = 200;
  game.enemyBullets.push(new X.Bullet(240, 300, 0, 3, false));
  const scoreBefore = game.score;
  game.useBomb();
  game.update();
  game.draw(); // 触发冲击波与白闪绘制
  assert(game.bombs === 1, '雷数 -1');
  assert(game.enemyBullets.length === 0, '敌弹被清空');
  assert(game.enemies.length === 0 && game.score - scoreBefore === 400,
    `全屏敌机被摧毁(得分 +${game.score - scoreBefore})`);
  assert(game.bombWave && game.bombWave.t > 0, '放雷产生扩散冲击波');
  for (let i = 0; i < 40; i++) game.update();
  assert(game.bombWave === null, '冲击波播放完毕后消失');
}

// 7. Boss:到点登场、在场时暂停普通刷怪、击杀得分掉道具
console.log('[7] Boss');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.bossTimer = X.BOSS_INTERVAL - 1;
  game.update();
  assert(game.boss && game.bossWarn > 0, 'Boss 到点登场并播放警告');
  for (let i = 0; i < 200; i++) game.update(); // Boss 下潜到位(约 115 帧)后才开始计开火间隔
  assert(game.enemies.length === 0, 'Boss 在场时暂停普通刷怪');
  assert(game.enemyBullets.length > 0, 'Boss 开火产生敌弹');
  game.player.invincible = 99999;
  const scoreBefore = game.score;
  game.boss.hp = 1;
  game.playerBullets.push(new X.Bullet(game.boss.x, game.boss.y, 0, -9.5, true));
  game.update();
  game.draw();
  assert(game.boss === null && game.score - scoreBefore === X.BOSS_SCORE,
    `击杀 Boss +${X.BOSS_SCORE} 分`);
  assert(game.powerups.length >= 2, 'Boss 掉落 2 个道具');
}

// 8. 难度曲线
console.log('[8] 难度曲线');
{
  assert(X.Difficulty.spawnInterval(0) === 75, '开局刷怪间隔 75 帧');
  assert(X.Difficulty.spawnInterval(999999) === 26, '刷怪间隔下限 26 帧');
  assert(X.Difficulty.speedMul(0) === 1, '开局速度倍率 1.0');
  assert(X.Difficulty.speedMul(999999) <= 1.8 + 1e-9, '速度倍率封顶 1.8');
  const types = new Set();
  for (let i = 0; i < 200; i++) types.add(X.Difficulty.pickType(999999));
  assert(types.has('small') && types.has('medium') && types.has('big'), '后期三种敌机都会刷出');
}

// 9. 战机选择与切换
console.log('[9] 战机选择');
{
  const game = new X.Game(canvasStub);
  assert(game.planeType === 'falcon' && game.player.type === 'falcon', '默认战机为猎鹰');
  game.cyclePlane(1);
  assert(game.planeType === 'apache' && game.player.type === 'apache', '标题界面右切到阿帕奇');
  game.cyclePlane(1);
  assert(game.planeType === 'phantom', '再右切到幻影');
  game.cyclePlane(1);
  assert(game.planeType === 'falcon', '循环切回猎鹰');
  game.cyclePlane(-1);
  assert(game.planeType === 'phantom', '左切反向循环到幻影');
  const T = X.PLANE_TYPES;
  assert(T.apache.speed < T.falcon.speed && T.phantom.speed > T.falcon.speed,
    '三种战机移速有差异(阿帕奇慢 / 幻影快)');
  game.startGame();
  assert(game.player.type === 'phantom', '以所选战机开局');
  game.draw(); // 覆盖标题界面选机绘制
}

// 10. 各机型弹种:阿帕奇追踪导弹 / 幻影穿透波弹 / 猎鹰 Lv4 五向
console.log('[10] 弹种形态');
{
  // 阿帕奇:周期性发射追踪导弹
  const g1 = new X.Game(canvasStub);
  g1.planeType = 'apache';
  g1.startGame();
  g1.noSpawn = true;
  g1.enemies.push(new X.Enemy(g1.player.x + 60, 'small', 1));
  g1.enemies[0].y = 150;
  g1.player.weapon = 2;
  let hasMissile = false;
  for (let i = 0; i < 40 && !hasMissile; i++) {
    g1.update();
    hasMissile = g1.playerBullets.some(b => b.kind === 'missile' && b.homing && b.damage === 4);
  }
  assert(hasMissile, '阿帕奇 Lv2 起每 3 轮齐射挂追踪导弹');
  g1.draw();

  // 幻影:一枚波弹穿透击落两架敌机
  const g2 = new X.Game(canvasStub);
  g2.planeType = 'phantom';
  g2.startGame();
  g2.noSpawn = true;
  const p2 = g2.player;
  p2.fireTimer = 99999; // 关掉自动开火,手动控制
  for (const dy of [-80, -140]) {
    const e = new X.Enemy(p2.x, 'small', 0);
    e.y = p2.y + dy;
    e.vx = 0;
    g2.enemies.push(e);
  }
  const wave = new X.Bullet(p2.x, p2.y - 30, 0, -8.5, true, { kind: 'wave', pierce: true, r: 5 });
  g2.playerBullets.push(wave);
  for (let i = 0; i < 30; i++) g2.update();
  assert(g2.score === 200 && g2.enemies.length === 0,
    `一枚波弹穿透击落两架敌机(得分 ${g2.score})`);
  assert(wave.hits.size === 2, '穿透弹对每个目标只结算一次伤害');
  g2.draw();

  // 猎鹰:Lv4 一次齐射 5 发
  const g3 = new X.Game(canvasStub);
  g3.startGame();
  g3.noSpawn = true;
  g3.player.weapon = 4;
  g3.playerBullets = [];
  g3.player.fire(g3);
  assert(g3.playerBullets.length === 5, `猎鹰 Lv4 五向齐射(${g3.playerBullets.length} 发)`);
}

// 11. 5000 帧随机模拟不崩溃(含真实刷怪/撞击/重生/重开/放雷/三种战机)
console.log('[11] 随机模拟');
{
  let maxEnemies = 0;
  let restarts = 0;
  const game = new X.Game(canvasStub);
  for (const plane of ['falcon', 'apache', 'phantom']) {
    game.planeType = plane;
    game.startGame();
    for (let i = 0; i < 1700; i++) {
      game.input.dx = [-1, 0, 1][Math.floor(Math.random() * 3)];
      game.input.dy = [-1, 0, 1][Math.floor(Math.random() * 3)];
      if (Math.random() < 0.005) game.useBomb();
      game.update();
      game.draw();
      maxEnemies = Math.max(maxEnemies, game.enemies.length);
      if (game.state === 'gameover') { restarts++; game.startGame(); }
    }
  }
  assert(maxEnemies > 0, `敌人正常出场(最多同屏 ${maxEnemies} 个)`);
  assert(['play', 'pause', 'gameover'].includes(game.state),
    `三种战机共 5100 帧随机模拟无崩溃(重开 ${restarts} 次,结束状态: ${game.state})`);
}

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
