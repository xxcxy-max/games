// ===== 入口：键盘 + 触屏输入 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

const KEY_DIRS = {
  ArrowUp: DIR_UP,    KeyW: DIR_UP,
  ArrowRight: DIR_RIGHT, KeyD: DIR_RIGHT,
  ArrowDown: DIR_DOWN,  KeyS: DIR_DOWN,
  ArrowLeft: DIR_LEFT,  KeyA: DIR_LEFT,
};
const heldDirs = new Set();   // 按插入顺序保存，后按下的方向优先

function pressDir(d) {
  heldDirs.delete(d);         // 重新放到队尾，保证"最后按下"优先
  heldDirs.add(d);
  game.input.dir = d;
}

function releaseDir(d) {
  heldDirs.delete(d);
  const rest = [...heldDirs];
  game.input.dir = rest.length ? rest[rest.length - 1] : -1;
}

function togglePause() {
  if (game.state === 'play') game.state = 'pause';
  else if (game.state === 'pause') game.state = 'play';
}

function tryStart() {
  if (game.state === 'title' || game.state === 'gameover') game.startGame();
}

// ===== 键盘 =====
window.addEventListener('keydown', (e) => {
  Sound.ensure();
  if (e.code in KEY_DIRS) {
    pressDir(KEY_DIRS[e.code]);
    e.preventDefault();
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.shootHeld = true;
    e.preventDefault();
  } else if (e.code === 'Enter') {
    tryStart();
  } else if (e.code === 'KeyP') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in KEY_DIRS) {
    releaseDir(KEY_DIRS[e.code]);
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.shootHeld = false;
  }
});

// ===== 触屏(平板/手机)：虚拟十字键 + 开火/暂停按钮 =====
// 绑定"按住生效"类按钮，touch 优先；同时兼容鼠标按下，方便桌面调试
function bindHold(el, on, off) {
  const start = (e) => { e.preventDefault(); Sound.ensure(); on(); };
  const end = (e) => { e.preventDefault(); off(); };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', end, { passive: false });
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', end);
  el.addEventListener('mouseleave', end);
}

document.querySelectorAll('.dpad .tbtn').forEach((el) => {
  const d = Number(el.dataset.dir);
  bindHold(el, () => pressDir(d), () => releaseDir(d));
});

bindHold(document.getElementById('btnFire'),
  () => { game.input.shootHeld = true; },
  () => { game.input.shootHeld = false; });

// 暂停是点按切换而非按住，单独绑定；touchstart 上 preventDefault 后不会再触发 click，不会重复切换
document.getElementById('btnPause').addEventListener('touchstart', (e) => {
  e.preventDefault();
  Sound.ensure();
  togglePause();
}, { passive: false });
document.getElementById('btnPause').addEventListener('click', togglePause);

// 标题 / 结束界面轻点画面即开始
canvas.addEventListener('pointerdown', () => {
  Sound.ensure();
  tryStart();
});

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
