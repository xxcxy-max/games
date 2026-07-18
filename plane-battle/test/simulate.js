// 无头冒烟测试:在 Node 里加载游戏逻辑(不含 main.js),跑几千帧模拟,捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['audio.js', 'waves.js', 'sprites.js', 'entities.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, Bullet, Enemy, Boss, PowerUp, Particle, PlayerPlane,
  ENEMY_TYPES, FIELD_W, FIELD_H, BOSS_INTERVAL, BOSS_HP, BOSS_SCORE, Difficulty,
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

// 5. 道具:武器升级 / 满级折分 / 雷 +1
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
  assert(p.weapon === 3, '再吃 ⭐ 武器升到 3 级');
  game.powerups.push(new X.PowerUp(p.x, p.y, 'star'));
  game.update();
  assert(p.weapon === 3 && game.score === 500, '满级后 ⭐ 折算 500 分');
  game.powerups.push(new X.PowerUp(p.x, p.y, 'bomb'));
  game.update();
  assert(game.bombs === 3, '吃 💣 雷数 +1');
  const lives = game.lives;
  game.powerups.push(new X.PowerUp(p.x, p.y, 'life'));
  game.update();
  assert(game.lives === lives + 1, '吃 ❤️ 命数 +1');
}

// 6. 放雷:清空敌弹 + 全屏伤害
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
  game.draw(); // 触发白闪绘制
  assert(game.bombs === 1, '雷数 -1');
  assert(game.enemyBullets.length === 0, '敌弹被清空');
  assert(game.enemies.length === 0 && game.score - scoreBefore === 400,
    `全屏敌机被摧毁(得分 +${game.score - scoreBefore})`);
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

// 9. 5000 帧随机模拟不崩溃(含真实刷怪/撞击/重生/重开)
console.log('[9] 随机模拟');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  let maxEnemies = 0;
  let restarts = 0;
  for (let i = 0; i < 5000; i++) {
    game.input.dx = [-1, 0, 1][Math.floor(Math.random() * 3)];
    game.input.dy = [-1, 0, 1][Math.floor(Math.random() * 3)];
    if (Math.random() < 0.005) game.useBomb();
    game.update();
    game.draw();
    maxEnemies = Math.max(maxEnemies, game.enemies.length);
    if (game.state === 'gameover') { restarts++; game.startGame(); }
  }
  assert(maxEnemies > 0, `敌人正常出场(最多同屏 ${maxEnemies} 个)`);
  assert(['play', 'pause', 'gameover'].includes(game.state),
    `5000 帧随机模拟无崩溃(重开 ${restarts} 次,结束状态: ${game.state})`);
}

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
