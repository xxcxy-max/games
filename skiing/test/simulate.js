// 无头冒烟测试:在 Node 里加载游戏逻辑(config/logic/game,不含 THREE/DOM),跑几千帧模拟,捕捉运行时错误
// 运行: node test/simulate.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['config.js', 'logic.js', 'game.js'];
let src = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += `\nglobalThis.__x = {
  Game, Player, Obstacle, Gate, Item, Jump, SkiWorld,
  SLOPE_HALF_W, SPAWN_Z, MAX_SPEED, MIN_SPEED, BASE_CRUISE, STEER_SPEED,
  PLAYER_LIVES, INVINCIBLE_TIME, BOOST_TIME, GATE_SCORE, STAR_SCORE, GATE_HALF_GAP,
  JUMP_VY, GRAVITY,
  Difficulty, circleHit,
};`;

// 浏览器环境桩(game.js 的 localStorage/HUD 均已做环境探测,这里只给最小上下文)
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const X = sandbox.__x;

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failures++; console.error('  ✗ ' + msg); }
}

const DT = 1 / 60;

// 1. 启动游戏
console.log('[1] 启动');
{
  const game = new X.Game();
  assert(game.state === 'title', '初始为标题界面');
  game.startGame();
  assert(game.state === 'play' && game.world.lives === X.PLAYER_LIVES && game.score === 0,
    '开始游戏进入 play 状态(3 命 / 0 分)');
  game.update(DT);
  assert(game.world.dist > 0, `update 后里程累积(${game.world.dist.toFixed(2)} m)`);
}

// 2. 转向与雪道边界
console.log('[2] 转向与边界');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  game.input.steer = 1;
  for (let i = 0; i < 300; i++) game.update(DT);
  assert(game.world.player.x <= X.SLOPE_HALF_W + 1e-9,
    `右转向不冲出雪道右缘(x=${game.world.player.x.toFixed(1)})`);
  const rx = game.world.player.x;
  assert(rx > 0, `持续右转向右移动(x=${rx.toFixed(1)})`);
  game.input.steer = -1;
  for (let i = 0; i < 600; i++) game.update(DT);
  assert(game.world.player.x >= -X.SLOPE_HALF_W - 1e-9 && game.world.player.x < rx,
    `左转向不冲出雪道左缘(x=${game.world.player.x.toFixed(1)})`);
  game.input.steer = 0;
}

// 3. 速度:自动巡航 / 加速 / 刹车
console.log('[3] 速度控制');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  for (let i = 0; i < 300; i++) game.update(DT);
  const cruise = X.Difficulty.cruiseSpeed(game.world.dist);
  assert(Math.abs(game.world.player.speed - cruise) < 1.5,
    `松开按键自动巡航到 ${cruise.toFixed(1)}(${game.world.player.speed.toFixed(1)} m/s)`);
  game.input.brake = true;
  const before = game.world.player.speed;
  for (let i = 0; i < 30; i++) game.update(DT);
  assert(game.world.player.speed < before - 4,
    `刹车快速减速(${before.toFixed(1)} -> ${game.world.player.speed.toFixed(1)})`);
  assert(game.world.player.speed >= X.MIN_SPEED, '速度不低于下限');
  game.input.brake = false;
  game.input.boost = true;
  const cruise2 = X.Difficulty.cruiseSpeed(game.world.dist);
  for (let i = 0; i < 300; i++) game.update(DT);
  assert(game.world.player.speed > cruise2 + 2,
    `按住加速超过巡航(${game.world.player.speed.toFixed(1)} m/s)`);
  assert(game.world.player.speed <= X.MAX_SPEED, '速度不超过上限');
  game.input.boost = false;
}

// 4. 撞障碍:损 1 命 + 短暂无敌;无敌期再撞不掉命
console.log('[4] 撞障碍损命');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  const w = game.world;
  w.entities.push(new X.Obstacle('tree', w.player.x, 0));
  game.update(DT);
  assert(w.lives === X.PLAYER_LIVES - 1, `撞树损 1 命(剩 ${w.lives})`);
  assert(w.player.invincible > 0, '撞后短暂无敌');
  assert(w.player.speed < X.BASE_CRUISE, '撞后被减速');
  w.entities.push(new X.Obstacle('rock', w.player.x, 0));
  game.update(DT);
  assert(w.lives === X.PLAYER_LIVES - 1, '无敌期再撞不掉命');
  // 同一条障碍不会重复扣命
  for (let i = 0; i < 30; i++) game.update(DT);
  assert(w.lives === X.PLAYER_LIVES - 1, '被撞障碍滚过身后不重复扣命');
}

// 5. 全灭游戏结束 + 最高分保存(localStorage 缺失时静默)
console.log('[5] 全灭结束');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  game.world.lives = 1;
  game.world.entities.push(new X.Obstacle('rock', game.world.player.x, 0));
  game.update(DT);
  assert(game.world.over === true, '最后一命撞毁,世界标记结束');
  assert(game.state === 'gameover', '游戏进入结束状态');
  const s = game.score;
  game.update(DT);
  assert(game.score === s, '结束后分数不再增长');
  game.startGame();
  assert(game.state === 'play' && game.world.lives === X.PLAYER_LIVES && game.score === 0,
    '结束后可重新开始');
}

// 6. 旗门:穿过 +50,漏过无惩罚
console.log('[6] 旗门');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  const w = game.world;
  w.entities.push(new X.Gate(w.player.x, -1));   // 正对玩家
  const bonusBefore = w.bonus;
  for (let i = 0; i < 30 && w.bonus === bonusBefore; i++) game.update(DT);
  assert(w.bonus === bonusBefore + X.GATE_SCORE, `穿过旗门 +${X.GATE_SCORE}`);
  assert(w.entities[0] && w.entities[0].passed, '旗门标记已穿过');
  // 漏过
  const game2 = new X.Game();
  game2.startGame();
  game2.noSpawn = true;
  const w2 = game2.world;
  w2.entities.push(new X.Gate(X.SLOPE_HALF_W - X.GATE_HALF_GAP - 1, -1));
  for (let i = 0; i < 30; i++) game2.update(DT);
  assert(w2.bonus === 0, '漏过旗门不得分不惩罚');
}

// 7. 道具:星星 +100,加速带短暂提速
console.log('[7] 道具');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  const w = game.world;
  w.entities.push(new X.Item('star', w.player.x, 0));
  game.update(DT);
  assert(w.bonus === X.STAR_SCORE, `拾取星星 +${X.STAR_SCORE}`);
  assert(w.entities.length === 0, '星星拾取后即移除');
  w.entities.push(new X.Item('boost', w.player.x, 0));
  game.update(DT);
  assert(w.player.boostTimer > 0, '踩加速带进入提速状态');
  const cruise = X.Difficulty.cruiseSpeed(w.dist);
  for (let i = 0; i < 90; i++) game.update(DT);
  assert(w.player.speed > cruise + 1,
    `加速带期间速度超过巡航(${w.player.speed.toFixed(1)} > ${cruise.toFixed(1)})`);
}

// 8. 计分 = 里程(米) + 奖励分
console.log('[8] 计分');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  for (let i = 0; i < 600; i++) game.update(DT);
  assert(game.world.dist > 50, `里程随滑行累积(${game.world.dist.toFixed(0)} m)`);
  assert(game.score === Math.floor(game.world.dist) + game.world.bonus, '分数 = 里程 + 奖励分');
}

// 9. 难度曲线
console.log('[9] 难度曲线');
{
  assert(X.Difficulty.cruiseSpeed(0) === X.BASE_CRUISE, `开局巡航 ${X.BASE_CRUISE} m/s`);
  assert(X.Difficulty.cruiseSpeed(999999) === X.MAX_SPEED, `巡航上限 ${X.MAX_SPEED} m/s`);
  assert(X.Difficulty.cruiseSpeed(2000) > X.Difficulty.cruiseSpeed(500), '巡航速度随里程提升');
  assert(X.Difficulty.spawnInterval(0) === 1.3, '开局刷物间隔 1.3 秒');
  assert(X.Difficulty.spawnInterval(999999) === 0.5, '刷物间隔下限 0.5 秒');
  const kinds = new Set();
  for (let i = 0; i < 400; i++) kinds.add(X.Difficulty.pickKind(999999));
  assert(kinds.has('tree') && kinds.has('rock') && kinds.has('gate') && kinds.has('star') && kinds.has('boost') && kinds.has('jump'),
    '后期六种刷出类型都会出现');
  const early = new Set();
  for (let i = 0; i < 400; i++) early.add(X.Difficulty.pickKind(0));
  assert(!early.has('jump'), '开局 100m 内不刷跳台');
}

// 9.5 跳台:起跳腾空 -> 飞越障碍 -> 落地按飞行距离加分
console.log('[9.5] 跳台');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  const w = game.world;
  for (let i = 0; i < 120; i++) game.update(DT);   // 提速到巡航
  w.entities.push(new X.Jump(w.player.x, 0));
  game.update(DT);
  assert(w.player.airborne === true && w.player.vy > 0, '压上跳台起跳腾空');
  // 腾空期间撞树不掉命(直接飞越)
  let peakY = 0;
  for (let i = 0; i < 10 && w.player.airborne; i++) {
    game.update(DT);
    peakY = Math.max(peakY, w.player.y);
  }
  assert(peakY > 0.5, `腾空有明显高度(峰值 ${peakY.toFixed(1)} m)`);
  const livesBefore = w.lives;
  w.entities.push(new X.Obstacle('tree', w.player.x, 0));
  game.update(DT);
  assert(w.lives === livesBefore, '腾空飞越障碍不掉命');
  // 等落地
  const bonusBefore = w.bonus;
  for (let i = 0; i < 300 && w.player.airborne; i++) game.update(DT);
  assert(w.player.airborne === false && w.player.y === 0, '抛物线后落地');
  assert(w.bonus > bonusBefore, `落地按飞行距离加分(+${w.bonus - bonusBefore})`);
  // 已用过的跳台不会重复触发
  const game2 = new X.Game();
  game2.startGame();
  game2.noSpawn = true;
  const w2 = game2.world;
  const j = new X.Jump(w2.player.x, 0);
  w2.entities.push(j);
  game2.update(DT);
  assert(j.used === true, '跳台触发后标记已用');
  for (let i = 0; i < 600 && w2.player.airborne; i++) game2.update(DT);
}

// 10. 暂停
console.log('[10] 暂停');
{
  const game = new X.Game();
  game.startGame();
  game.noSpawn = true;
  for (let i = 0; i < 60; i++) game.update(DT);
  game.togglePause();
  assert(game.state === 'pause', 'P 暂停');
  const d = game.world.dist;
  for (let i = 0; i < 60; i++) game.update(DT);
  assert(game.world.dist === d, '暂停时里程不增长');
  game.togglePause();
  assert(game.state === 'play', '再按 P 继续');
}

// 11. 5000 帧随机模拟不崩溃(含刷物/撞树/过门/拾取/全灭/重开)
console.log('[11] 随机模拟');
{
  const game = new X.Game();
  game.startGame();
  let restarts = 0, maxEntities = 0, maxSpeed = 0, sawGate = false, sawItem = false, sawJump = false, sawAir = false;
  for (let i = 0; i < 5000; i++) {
    game.input.steer = [-1, 0, 1][Math.floor(Math.random() * 3)];
    game.input.boost = Math.random() < 0.5;
    game.input.brake = Math.random() < 0.1;
    game.update(DT);
    maxEntities = Math.max(maxEntities, game.world.entities.length);
    maxSpeed = Math.max(maxSpeed, game.world.player.speed);
    if (game.world.player.airborne) sawAir = true;
    for (const e of game.world.entities) {
      if (e.type === 'gate') sawGate = true;
      if (e.type === 'item') sawItem = true;
      if (e.type === 'jump') sawJump = true;
    }
    assert_speed_bounds: {
      const p = game.world.player;
      if (p.speed < X.MIN_SPEED - 1e-6 || p.speed > X.MAX_SPEED + 1e-6) {
        failures++;
        console.error(`  ✗ 速度越界 ${p.speed}`);
        break assert_speed_bounds;
      }
      if (Math.abs(p.x) > X.SLOPE_HALF_W + 1e-6) {
        failures++;
        console.error(`  ✗ 横向越界 ${p.x}`);
      }
    }
    if (game.state === 'gameover') { restarts++; game.startGame(); }
  }
  assert(maxEntities > 0, `障碍/道具正常刷出(最多同屏 ${maxEntities} 个)`);
  assert(sawGate && sawItem, '旗门和道具都会出现');
  assert(sawJump, '跳台会出现');
  assert(maxSpeed > X.BASE_CRUISE, `速度随难度提升(峰值 ${maxSpeed.toFixed(1)} m/s)`);
  assert(['play', 'pause', 'gameover'].includes(game.state),
    `5000 帧随机模拟无崩溃(重开 ${restarts} 次,结束状态: ${game.state})`);
}

console.log(failures ? `\n${failures} 项断言失败` : '\n全部断言通过');
process.exit(failures ? 1 : 0);
