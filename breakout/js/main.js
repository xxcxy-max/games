// ===== 入口:键盘 + 鼠标/触屏 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

function togglePause() {
  if (game.state === STATE_PLAY) game.state = STATE_PAUSE;
  else if (game.state === STATE_PAUSE) game.state = STATE_PLAY;
}

function tryStart() {
  if (game.state === STATE_TITLE || game.state === STATE_OVER) game.startGame();
}

// ===== 键盘:← → / AD 移动挡板(后按下的方向优先) =====
const KEY_DIRS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const held = [];
function pressDir(d) {
  const i = held.indexOf(d);
  if (i >= 0) held.splice(i, 1);
  held.push(d);
  game.input.dir = d;
}
function releaseDir(d) {
  const i = held.indexOf(d);
  if (i >= 0) held.splice(i, 1);
  game.input.dir = held.length ? held[held.length - 1] : 0;
}

window.addEventListener('keydown', (e) => {
  Sound.ensure();
  if (e.code in KEY_DIRS) {
    pressDir(KEY_DIRS[e.code]);
    e.preventDefault();
  } else if (e.code === 'Space') {
    game.action();
    e.preventDefault();
  } else if (e.code === 'Enter') {
    tryStart();
  } else if (e.code === 'KeyP') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in KEY_DIRS) releaseDir(KEY_DIRS[e.code]);
});

// ===== 鼠标/触屏:移动即控板(鼠标悬停、手指拖动),点击发球/开火 =====
function pointX(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX - rect.left) * (FIELD_W / rect.width);
}

canvas.addEventListener('pointermove', (e) => {
  if (game.state === STATE_PLAY) game.paddle.moveTo(pointX(e));
});
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.ensure();
  if (game.state === STATE_TITLE || game.state === STATE_OVER) { tryStart(); return; }
  game.paddle.moveTo(pointX(e));
  game.action();
});

// ?demo 直接开局,用于预览截图/演示;?demo=秒数 会先同步快进(挡板自动跟球)
const params = new URLSearchParams(location.search);
const demoSec = params.get('demo');
if (demoSec !== null) {
  game.startGame();
  const ff = Math.max(0, Math.min(120, parseFloat(demoSec) || 0));
  for (let i = 0; i < ff * 60; i++) {
    const b = game.balls.find(x => !x.stuck) || game.balls[0];
    if (b) {
      game.paddle.moveTo(b.x);
      if (b.stuck) b.launch();
    }
    if (game.paddle.hasLaser && i % 20 === 0) game.action();
    game.update();
    if (game.state !== STATE_PLAY) game.startGame(); // 过关/阵亡就重开,保证画面好看
  }
}

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
