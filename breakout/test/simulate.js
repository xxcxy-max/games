// 无头冒烟测试:在 Node 里加载游戏逻辑(不含 main.js),跑几千帧模拟,捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['audio.js', 'levels.js', 'sprites.js', 'entities.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, Ball, Paddle, Brick, Laser, PowerUp, Particle,
  FIELD_W, FIELD_H, LEVELS, levelInfo,
  BRICK_COLS, BRICK_W, BRICK_H, BRICK_GAP, BRICK_X0, BRICK_Y0,
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
function liveBricks(game) { return game.bricks.filter(b => b.alive); }

// 1. 启动游戏
console.log('[1] 启动');
{
  const game = new X.Game(canvasStub);
  assert(game.state === 'title', '初始为标题界面');
  game.draw();
  game.startGame();
  assert(game.state === 'play' && game.lives === 3 && game.score === 0,
    '开始游戏进入 play 状态(3 命 / 0 分)');
  assert(liveBricks(game).length === 60, `第 1 关共 60 块砖(${liveBricks(game).length})`);
  assert(game.balls.length === 1 && game.balls[0].stuck, '开局一球粘在挡板上');
}

// 2. 发球与墙壁反弹
console.log('[2] 发球与反弹');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  const b = game.balls[0];
  game.action(); // 发球
  assert(!b.stuck && b.vy < 0, '空格/点击发球,球向上飞出');
  b.x = 2; b.vx = -5; // 贴左墙继续向左
  game.update();
  assert(b.vx > 0, '左墙反弹翻转 vx');
  b.y = 2; b.vy = -5;
  game.update();
  assert(b.vy > 0, '顶墙反弹翻转 vy');
  game.draw();
}

// 3. 挡板反弹:中心直上直下,边缘带角度
console.log('[3] 挡板反弹');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  const p = game.paddle;
  const b = game.balls[0];
  b.stuck = false;
  b.x = p.x; b.y = p.y - 20; b.vx = 0; b.vy = b.speed;
  for (let i = 0; i < 8 && b.vy > 0; i++) game.update();
  assert(b.vy < 0, '球击中挡板后向上反弹');
  assert(Math.abs(b.vx) < 0.01, '正中挡板球直上直下');
  b.x = p.x + p.w / 2 - 2; b.y = p.y - 20; b.vx = 0; b.vy = b.speed; // 砸在右缘
  for (let i = 0; i < 8 && b.vy > 0; i++) game.update();
  assert(b.vy < 0 && b.vx > b.speed * 0.7, `挡板边缘反弹带大角度(vx=${b.vx.toFixed(2)})`);
}

// 4. 球打砖块:1 耐久砖直接击碎得分,多耐久砖掉血变色
console.log('[4] 球与砖块');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.noDrop = true;
  const brick = liveBricks(game).find(br => br.hp === 1);
  const b = game.balls[0];
  b.stuck = false;
  b.x = brick.x + brick.w / 2;
  b.y = brick.y + brick.h + b.r + 2;
  b.vx = 0; b.vy = -b.speed;
  for (let i = 0; i < 4 && brick.alive; i++) game.update();
  assert(!brick.alive && game.score === 50, `击碎 1 耐久砖 +50(得分 ${game.score})`);
  assert(b.vy > 0, '从下方击中砖块后 vy 翻转');
  const hard = liveBricks(game).find(br => br.hp === 3);
  game.damageBrick(hard, 1);
  assert(hard.alive && hard.hp === 2 && hard.flash > 0, '3 耐久砖受击掉血不碎');
}

// 5. 掉球扣命 -> 重新发球;全灭 -> 游戏结束
console.log('[5] 掉球与全灭');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  const b = game.balls[0];
  b.stuck = false;
  b.vy = 5; // 正在下落
  b.y = X.FIELD_H + 10;
  game.update();
  assert(game.lives === 2 && game.balls.length === 1 && game.balls[0].stuck,
    `掉球扣 1 命并重新待发(剩 ${game.lives})`);
  game.lives = 1;
  const b2 = game.balls[0];
  b2.stuck = false;
  b2.vy = 5;
  b2.y = X.FIELD_H + 10;
  game.update();
  game.draw();
  assert(game.state === 'gameover', '最后一球落地游戏结束');
}

// 6. 道具:多球 / 变长板 / 激光
console.log('[6] 道具');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.applyPowerUp('multi');
  assert(game.balls.length === 2, `多球:1 球变 ${game.balls.length} 球`);
  game.applyPowerUp('multi');
  game.applyPowerUp('multi');
  game.applyPowerUp('multi');
  game.applyPowerUp('multi');
  assert(game.balls.length <= 6, `多球总数封顶 6(当前 ${game.balls.length})`);

  const baseW = game.paddle.baseW;
  game.applyPowerUp('wide');
  assert(game.paddle.w === game.paddle.wideW, '变长板:挡板变宽');
  for (let i = 0; i < 725; i++) game.update();
  assert(game.paddle.w === baseW, '变长结束后恢复原宽');

  game.applyPowerUp('laser');
  assert(game.paddle.hasLaser, '激光:挡板进入激光模式');
  const stuck = game.balls.find(b => b.stuck);
  if (stuck) stuck.launch();
  game.action();
  assert(game.lasers.length === 2, `激光开火打出双发(${game.lasers.length})`);
  game.draw();
}

// 7. 过关 -> 载入下一关;关卡循环加速
console.log('[7] 过关与循环');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  game.bricks.forEach(br => { if (liveBricks(game).length > 1) br.alive = false; });
  game.damageBrick(liveBricks(game)[0], 99);
  game.update();
  game.draw();
  assert(game.state === 'levelclear', '清空全部砖块进入过关横幅');
  for (let i = 0; i < 110; i++) game.update();
  assert(game.state === 'play' && game.level === 2 && liveBricks(game).length === 30,
    `进入第 2 关(30 块砖,当前 ${liveBricks(game).length})`);
  const l4 = X.levelInfo(4);
  assert(l4.speed > X.levelInfo(1).speed && l4.layout === X.levelInfo(1).layout,
    '第 4 关循环第 1 关布局且球速更快');
}

// 8. 5000 帧随机模拟不崩溃(含发球/道具/激光/过关/重开)
console.log('[8] 随机模拟');
{
  const game = new X.Game(canvasStub);
  game.startGame();
  let restarts = 0, maxBalls = 1;
  for (let i = 0; i < 5000; i++) {
    game.input.dir = [-1, 0, 1][Math.floor(Math.random() * 3)];
    if (Math.random() < 0.04) game.action();
    game.update();
    game.draw();
    maxBalls = Math.max(maxBalls, game.balls.length);
    if (game.state === 'gameover') { restarts++; game.startGame(); }
  }
  assert(['play', 'levelclear', 'gameover', 'pause'].includes(game.state),
    `5000 帧随机模拟无崩溃(重开 ${restarts} 次,最多同屏 ${maxBalls} 球,结束状态: ${game.state})`);
}

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
