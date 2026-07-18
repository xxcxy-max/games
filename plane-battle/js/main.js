// ===== 入口:键盘 + 触屏拖动 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

function togglePause() {
  if (game.state === STATE_PLAY) game.state = STATE_PAUSE;
  else if (game.state === STATE_PAUSE) game.state = STATE_PLAY;
}

function tryStart() {
  if (game.state === STATE_TITLE || game.state === STATE_OVER) game.startGame();
}

// ===== 键盘:方向键/WASD 组合出 8 向移动向量 =====
const KEY_MAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const held = new Set();

function updateVector() {
  let dx = 0, dy = 0;
  if (held.has('left')) dx -= 1;
  if (held.has('right')) dx += 1;
  if (held.has('up')) dy -= 1;
  if (held.has('down')) dy += 1;
  if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; } // 斜向不超速
  game.input.dx = dx;
  game.input.dy = dy;
}

window.addEventListener('keydown', (e) => {
  Sound.ensure();
  if (e.code in KEY_MAP) {
    held.add(KEY_MAP[e.code]);
    updateVector();
    e.preventDefault();
  } else if (e.code === 'KeyB') {
    game.useBomb();
  } else if (e.code === 'Enter') {
    tryStart();
  } else if (e.code === 'KeyP') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in KEY_MAP) {
    held.delete(KEY_MAP[e.code]);
    updateVector();
  }
});

// ===== 触屏/鼠标:按住画面拖动飞机 =====
// 飞机定位在触点上方,避免被手指遮挡(shmup 标配手感)
let dragging = false;

function dragTo(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (FIELD_W / rect.width);
  const y = (e.clientY - rect.top) * (FIELD_H / rect.height);
  game.player.moveTo(x, y - 70);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.ensure();
  if (game.state === STATE_TITLE || game.state === STATE_OVER) { tryStart(); return; }
  dragging = true;
  canvas.setPointerCapture(e.pointerId);
  dragTo(e);
});
canvas.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

// 放雷按钮(触屏设备显示,见 style.css)
document.getElementById('btnBomb').addEventListener('click', () => {
  Sound.ensure();
  game.useBomb();
});

// ?demo 直接开局,用于预览截图/演示;?demo=秒数 会先同步快进相应时长
const demoSec = new URLSearchParams(location.search).get('demo');
if (demoSec !== null) {
  game.startGame();
  const ff = Math.max(0, Math.min(120, parseFloat(demoSec) || 0));
  for (let i = 0; i < ff * 60; i++) {
    game.input.dx = Math.sin(i / 50); // 左右摇摆走位,避免站着挨打
    game.update();
    if (game.state !== STATE_PLAY) { game.startGame(); } // 阵亡就重开,保证画面好看
  }
  game.input.dx = 0;
}

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
