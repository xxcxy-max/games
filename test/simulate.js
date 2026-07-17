// 无头冒烟测试：在 Node 里加载游戏逻辑(不含 main.js)，跑几千帧模拟，捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['audio.js', 'levels.js', 'sprites.js', 'entities.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, Bullet, PlayerTank, EnemyTank, ENEMY_TYPES, PLAYER_COLORS,
  buildMap, LEVELS, PLAYER_SPAWN, BASE_RECT, ENEMY_SPAWNS,
  TILE_BRICK, TILE_EMPTY, TILE_STEEL, TILE_WATER, TILE_TREE,
  DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT, MAP_TILES, TILE, FIELD, rectsOverlap,
};`;

// 浏览器环境桩
const canvasStub = { width: 512, height: 416, getContext: () => ctxStub };
const ctxStub = new Proxy({}, {
  get(t, p) { if (p === 'canvas') return canvasStub; return () => {}; },
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
function countBricks(map) {
  let n = 0;
  for (const row of map) for (const t of row) if (t === X.TILE_BRICK) n++;
  return n;
}

// 1. 关卡数据与地图构建
console.log('[1] 地图构建');
for (const lv of X.LEVELS) {
  assert(lv.layout.length === 13 && lv.layout.every(r => r.length === 13),
    `关卡布局为 13x13 (${lv.enemies} 个敌人)`);
}
const map = X.buildMap(1);
assert(map.length === 26 && map.every(r => r.length === 26), '地图为 26x26');
assert(map[22][10] === X.TILE_BRICK && map[24][10] === X.TILE_BRICK, '基地周围有砖墙保护');
assert(map[24][12] === X.TILE_EMPTY && map[25][13] === X.TILE_EMPTY, '基地本体位置无地形');

// 2. 启动游戏
console.log('[2] 启动');
const game = new X.Game(canvasStub);
assert(game.state === 'title', '初始为标题界面');
game.startGame();
assert(game.state === 'play' && game.lives === 3 && game.score === 0, '开始游戏进入 play 状态');

// 3. 玩家朝上射击能逐步打掉砖墙
console.log('[3] 子弹破坏砖墙');
game.startGame();
game.enemiesLeft = 1;          // 防止触发过关判定
game.player.shield = 99999;
const bricksBefore = countBricks(game.map);
for (let i = 0; i < 60; i++) { // 60 帧内不会有敌人出场
  game.input.shootHeld = true;
  game.update();
  game.draw();
}
game.input.shootHeld = false;
assert(countBricks(game.map) < bricksBefore, `子弹打掉了砖墙(${bricksBefore} -> ${countBricks(game.map)})`);

// 4. 敌人出场 + 3000 帧随机移动不崩溃
// (不开火：随机开火可能打掉自家基地导致提前结束，干扰"敌人出场"断言)
console.log('[4] 随机模拟');
const g = new X.Game(canvasStub);
g.startGame();
let maxEnemies = 0;
for (let i = 0; i < 3000; i++) {
  g.input.dir = [-1, 0, 1, 2, 3][Math.floor(Math.random() * 5)];
  g.update();
  g.draw();
  maxEnemies = Math.max(maxEnemies, g.enemies.length);
  if (g.state === 'gameover' || g.state === 'levelclear') break;
}
assert(maxEnemies > 0, `敌人正常出场(最多同屏 ${maxEnemies} 个)`);
assert(['play', 'levelclear', 'gameover'].includes(g.state),
  `3000 帧随机模拟无崩溃(结束状态: ${g.state})`);

// 4b. 玩家击毙敌人得分
console.log('[4b] 击毙敌人');
const g5 = new X.Game(canvasStub);
g5.startGame();
g5.enemiesLeft = 1;
g5.spawnTimer = 99999;
g5.player.shield = 99999;
g5.enemies.push(new X.EnemyTank(g5.player.x, g5.player.y - 64, X.ENEMY_TYPES[0], 0));
g5.player.dir = X.DIR_UP;
g5.input.shootHeld = true;
for (let i = 0; i < 40 && g5.score === 0; i++) g5.update();
assert(g5.score === 100 && g5.enemies.length === 0, `击毙敌人得分(${g5.score})`);

// 5. 基地被摧毁 -> 游戏结束
console.log('[5] 基地摧毁');
const g2 = new X.Game(canvasStub);
g2.startGame();
g2.bullets.push(new X.Bullet(208, 390, X.DIR_DOWN, 4, false)); // 从保护墙内侧直接命中基地
for (let i = 0; i < 10; i++) g2.update();
g2.draw();
assert(!g2.baseAlive && g2.state === 'gameover', '基地中弹后游戏结束');

// 6. 玩家被击中 -> 扣命并重生
console.log('[6] 玩家阵亡与重生');
const g3 = new X.Game(canvasStub);
g3.startGame();
g3.enemiesLeft = 1;            // 防止触发过关判定
g3.spawnTimer = 99999;         // 防止敌人出场干扰
g3.player.shield = 0;
g3.bullets.push(new X.Bullet(g3.player.x + 16, g3.player.y + 8, X.DIR_DOWN, 4, false));
g3.update();
assert(g3.lives === 2 && !g3.player.alive, `玩家被击中后生命 -1(剩 ${g3.lives})`);
for (let i = 0; i < 200 && !g3.player.alive; i++) g3.update();
g3.draw();
assert(g3.player.alive && g3.player.shield > 0 && g3.state === 'play', '玩家在出生点带保护罩重生');

// 7. 玩家全灭 -> 游戏结束
console.log('[7] 玩家全灭');
const g4 = new X.Game(canvasStub);
g4.startGame();
g4.enemiesLeft = 1;
g4.spawnTimer = 99999;
g4.lives = 1;
g4.player.shield = 0;
g4.bullets.push(new X.Bullet(g4.player.x + 16, g4.player.y + 8, X.DIR_DOWN, 4, false));
for (let i = 0; i < 10; i++) g4.update();
assert(g4.state === 'gameover', '最后一条命被打掉后游戏结束');

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
