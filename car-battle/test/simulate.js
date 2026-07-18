// 无头冒烟测试:在 Node 里加载游戏逻辑(不含 main.js),跑几千帧模拟,捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['audio.js', 'levels.js', 'sprites.js', 'entities.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, PlayerCar, EnemyCar, Bullet, PowerUp, Particle,
  FIELD_W, FIELD_H, ROAD_X, ROAD_W, ROAD_RX, LANE_COUNT, LANE_W,
  MAX_SPEED, CRUISE_SPEED, KMH_TO_PX, PLAYER_HP, ENEMY_TYPES, Difficulty,
  circleRect, rectsOverlap,
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
  assert(game.state === 'play' && game.lives === 3 && game.score === 0 && game.player.hp === 100,
    '开始游戏进入 play 状态(3 命 / 满耐久 / 0 分)');
}

// 2. 车速:自动巡航 / 加速 / 刹车
console.log('[2] 车速控制');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  for (let i = 0; i < 400; i++) game.update();
  assert(Math.abs(game.player.speed - X.CRUISE_SPEED) < 2, `松油门自动巡航到 ${X.CRUISE_SPEED}(${game.player.speed.toFixed(0)})`);
  game.input.boost = true;
  for (let i = 0; i < 200; i++) game.update();
  assert(game.player.speed > X.CRUISE_SPEED + 20, `按住油门继续提速(${game.player.speed.toFixed(0)} km/h)`);
  game.input.boost = false;
  game.input.brake = true;
  const before = game.player.speed;
  for (let i = 0; i < 30; i++) game.update();
  assert(game.player.speed < before - 40, `刹车快速减速(${before.toFixed(0)} -> ${game.player.speed.toFixed(0)})`);
  game.input.brake = false;
  game.draw();
}

// 3. 转向与护栏边界
console.log('[3] 转向与边界');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  game.player.speed = 150;
  game.input.steer = 1;
  for (let i = 0; i < 200; i++) game.update();
  assert(game.player.x <= X.ROAD_RX + 16, `右转向不冲出右护栏(x=${game.player.x.toFixed(0)})`);
  const rx = game.player.x;
  game.input.steer = -1;
  for (let i = 0; i < 400; i++) game.update();
  assert(game.player.x >= X.ROAD_X - 16 && game.player.x < rx, `左转向不冲出左护栏(x=${game.player.x.toFixed(0)})`);
  game.input.steer = 0;
}

// 4. 机炮击爆敌车得分
console.log('[4] 机炮与击杀');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.speed = 0;
  const e = new X.EnemyCar(p.x, p.y - 150, 'chaser', 0);
  e.speed = 0; // 静止靶
  game.enemies.push(e);
  game.input.fireHeld = true;
  let frames = 0;
  while (game.enemies.length > 0 && frames < 200) { game.update(); frames++; }
  game.input.fireHeld = false;
  assert(game.score === 200, `机炮击爆追击车 +200(${frames} 帧,得分 ${game.score})`);
  game.draw();
}

// 5. 撞车:掉耐久 + 敌车失控;中弹掉耐久
console.log('[5] 碰撞伤害');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.speed = 120;
  p.invincible = 0;
  const e = new X.EnemyCar(p.x + 4, p.y - 30, 'civil', 120);
  game.enemies.push(e);
  const hpBefore = p.hp;
  game.update();
  assert(p.hp < hpBefore && p.hp >= hpBefore - 35, `撞民用车掉耐久(${hpBefore} -> ${p.hp})`);
  assert(p.speed < 120, '撞车后被减速');
  assert(e.spin > 0 || !e.alive, '被撞民用车失控滑出/损毁');
  game.enemyBullets.push(new X.Bullet(p.x, p.y, 0, 5, false));
  const hp2 = p.hp;
  game.update();
  assert(p.hp === hp2 - 10, `中弹 -10 耐久(${hp2} -> ${p.hp})`);
}

// 6. 耐久 0 损命重生;全灭游戏结束
console.log('[6] 损命与全灭');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.invincible = 0;
  game.hurtPlayer(200);
  assert(game.lives === 2 && !p.alive, `耐久归零损 1 命(剩 ${game.lives})`);
  for (let i = 0; i < 100 && !p.alive; i++) game.update();
  assert(p.alive && p.hp === X.PLAYER_HP && p.invincible > 0, '满耐久带无敌重生');
  game.lives = 1;
  p.invincible = 0;
  game.hurtPlayer(200);
  game.draw();
  assert(game.state === 'gameover', '最后一命损毁游戏结束');
}

// 7. 道具:修理 / 护盾 / 导弹(追踪命中)
console.log('[7] 道具');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.invincible = 0;
  p.hp = 50;
  game.applyPowerUp('repair');
  assert(p.hp === 90, `修理 +40 耐久(${p.hp})`);
  p.hp = 90;
  game.applyPowerUp('repair');
  assert(p.hp === 100, '修理不超过耐久上限');
  game.applyPowerUp('shield');
  assert(p.shield > 0, '护盾生效');
  game.hurtPlayer(50);
  assert(p.hp === 100, '护盾期间不掉耐久');
  game.applyPowerUp('missile');
  assert(p.missiles === 3, `导弹 +3(${p.missiles})`);
  // 导弹追踪击爆追击车
  p.shield = 0;
  const e = new X.EnemyCar(p.x + 60, p.y - 200, 'chaser', 0);
  e.speed = 0;
  game.enemies.push(e);
  const scoreBefore = game.score;
  game.fireMissile();
  assert(p.missiles === 2, '发射导弹消耗 1 枚');
  let frames = 0;
  while (game.enemies.length > 0 && frames < 300) { game.update(); frames++; }
  assert(game.score - scoreBefore === 200, `导弹追踪击爆敌车 +200(${frames} 帧)`);
  game.draw();
}

// 8. 里程累积得分
console.log('[8] 里程分');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  game.input.boost = true;
  for (let i = 0; i < 600; i++) game.update();
  assert(game.dist > 100, `里程随行驶累积(${(game.dist / 1000).toFixed(2)} km)`);
  assert(game.score > 0, `里程转化为分数(${game.score})`);
}

// 9. 难度曲线
console.log('[9] 难度曲线');
{
  assert(X.Difficulty.spawnInterval(0) === 105, '开局刷车间隔 105 帧');
  assert(X.Difficulty.spawnInterval(999999) === 48, '刷车间隔下限 48 帧');
  const types = new Set();
  for (let i = 0; i < 300; i++) types.add(X.Difficulty.pickType(999999));
  assert(types.has('civil') && types.has('chaser') && types.has('gunner') && types.has('truck'),
    '后期四种车都会出现');
}

// 10. 追击车从后方追上 / 炮车开火
console.log('[10] 敌车行为');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noSpawn = true;
  const p = game.player;
  p.speed = 150;
  const chaser = new X.EnemyCar(p.x, X.FIELD_H + 70, 'chaser', 150);
  game.enemies.push(chaser);
  const yBefore = chaser.y;
  for (let i = 0; i < 60; i++) game.update();
  assert(chaser.y < yBefore, '追击车从后方追上');
  const gunner = new X.EnemyCar(p.x, 200, 'gunner', 150);
  gunner.speed = 150; // 与玩家同速,停留在屏幕上
  game.enemies.push(gunner);
  let gunnerFired = false;
  for (let i = 0; i < 200; i++) {
    game.update();
    if (game.enemyBullets.length > 0) gunnerFired = true; // 敌弹可能已命中/出界,看到就算
  }
  assert(gunnerFired, '炮车向后射击产生敌弹');
  game.draw();
}

// 11. 5000 帧随机模拟不崩溃(含刷车/撞车/开火/导弹/重生/重开)
console.log('[11] 随机模拟');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  let restarts = 0, maxEnemies = 0, maxSpeed = 0;
  for (let i = 0; i < 5000; i++) {
    game.input.steer = [-1, 0, 1][Math.floor(Math.random() * 3)];
    game.input.boost = Math.random() < 0.6;
    game.input.brake = Math.random() < 0.1;
    game.input.fireHeld = Math.random() < 0.5;
    if (Math.random() < 0.01) game.fireMissile();
    game.update();
    game.draw();
    maxEnemies = Math.max(maxEnemies, game.enemies.length);
    maxSpeed = Math.max(maxSpeed, game.player.speed);
    if (game.state === 'gameover') { restarts++; game.startGame(); }
  }
  assert(maxEnemies > 0, `敌车正常出场(最多同屏 ${maxEnemies} 辆)`);
  assert(maxSpeed > 0 && maxSpeed <= X.MAX_SPEED, `车速始终合法(峰值 ${maxSpeed.toFixed(0)} km/h)`);
  assert(['play', 'pause', 'gameover'].includes(game.state),
    `5000 帧随机模拟无崩溃(重开 ${restarts} 次,结束状态: ${game.state})`);
}

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
