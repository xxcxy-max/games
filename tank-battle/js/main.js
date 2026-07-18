// ===== 入口:键盘 + 触屏摇杆输入 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

const KEY_DIRS = {
  ArrowUp: DIR_UP,    KeyW: DIR_UP,
  ArrowRight: DIR_RIGHT, KeyD: DIR_RIGHT,
  ArrowDown: DIR_DOWN,  KeyS: DIR_DOWN,
  ArrowLeft: DIR_LEFT,  KeyA: DIR_LEFT,
};
const heldDirs = new Set();   // 键盘:按插入顺序保存,后按下的方向优先
let joyDir = -1;              // 摇杆方向(-1 = 回中),优先于键盘

function syncDir() {
  if (joyDir !== -1) { game.input.dir = joyDir; return; }
  const rest = [...heldDirs];
  game.input.dir = rest.length ? rest[rest.length - 1] : -1;
}

function pressDir(d) {
  heldDirs.delete(d);         // 重新放到队尾,保证"最后按下"优先
  heldDirs.add(d);
  syncDir();
}

function releaseDir(d) {
  heldDirs.delete(d);
  syncDir();
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

// ===== 触屏(平板/手机):圆盘虚拟摇杆 + 开火/暂停按钮 =====
// 绑定"按住生效"类按钮,touch 优先;同时兼容鼠标按下,方便桌面调试
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

bindHold(document.getElementById('btnFire'),
  () => { game.input.shootHeld = true; },
  () => { game.input.shootHeld = false; });

// 暂停是点按切换而非按住,单独绑定;touchstart 上 preventDefault 后不会再触发 click,不会重复切换
document.getElementById('btnPause').addEventListener('touchstart', (e) => {
  e.preventDefault();
  Sound.ensure();
  togglePause();
}, { passive: false });
document.getElementById('btnPause').addEventListener('click', togglePause);

// ----- 圆盘虚拟摇杆:拖动弹头,按偏移主轴映射到四方向 -----
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const STICK_RANGE = 34;     // 摇杆头最大偏移(px)
const DIR_THRESHOLD = 12;   // 超过该偏移才触发方向(防抖)
let joyPointerId = null;

function joyUpdate(e) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(len, STICK_RANGE);
  dx = (dx / len) * clamped;
  dy = (dy / len) * clamped;
  stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  let d = -1;
  if (clamped >= DIR_THRESHOLD) {
    d = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? DIR_RIGHT : DIR_LEFT)
      : (dy > 0 ? DIR_DOWN : DIR_UP);
  }
  if (d !== joyDir) { joyDir = d; syncDir(); }
}

function joyReset(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyDir = -1;
  syncDir();
  stick.style.transform = 'translate(-50%, -50%)';
}

joystick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.ensure();
  joyPointerId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  joyUpdate(e);
});
joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointerId) joyUpdate(e); });
joystick.addEventListener('pointerup', joyReset);
joystick.addEventListener('pointercancel', joyReset);

// 标题 / 结束界面轻点画面即开始
canvas.addEventListener('pointerdown', () => {
  Sound.ensure();
  tryStart();
});

// ?touch=1 强制显示触屏控制(桌面调试/截图用)
if (new URLSearchParams(location.search).has('touch')) {
  document.body.classList.add('force-touch');
}

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
