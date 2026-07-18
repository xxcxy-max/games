// ===== 入口:键盘 + 触屏摇杆输入 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

function togglePause() {
  if (game.state === STATE_PLAY) game.state = STATE_PAUSE;
  else if (game.state === STATE_PAUSE) game.state = STATE_PLAY;
}

function tryStart() {
  if (game.state === STATE_TITLE || game.state === STATE_OVER) game.startGame();
}

// ===== 键盘 =====
const STEER_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const heldSteer = [];         // 后按下的方向优先
let joySteer = 0;             // 摇杆转向,优先于键盘

function syncSteer() {
  if (joySteer !== 0) { game.input.steer = joySteer; return; }
  game.input.steer = heldSteer.length ? heldSteer[heldSteer.length - 1] : 0;
}

window.addEventListener('keydown', (e) => {
  Sound.ensure();
  if (e.code in STEER_KEYS) {
    const d = STEER_KEYS[e.code];
    const i = heldSteer.indexOf(d);
    if (i >= 0) heldSteer.splice(i, 1);
    heldSteer.push(d);
    syncSteer();
    e.preventDefault();
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    game.input.boost = true;
    e.preventDefault();
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    game.input.brake = true;
    e.preventDefault();
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.fireHeld = true;
    e.preventDefault();
  } else if (e.code === 'KeyX' || e.code === 'KeyK') {
    game.fireMissile();
  } else if (e.code === 'Enter') {
    tryStart();
  } else if (e.code === 'KeyP') {
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in STEER_KEYS) {
    const i = heldSteer.indexOf(STEER_KEYS[e.code]);
    if (i >= 0) heldSteer.splice(i, 1);
    syncSteer();
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    game.input.boost = false;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    game.input.brake = false;
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.fireHeld = false;
  }
});

// ===== 触屏(平板/手机):圆盘摇杆 + 开火/导弹/暂停按钮 =====
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
  () => { game.input.fireHeld = true; },
  () => { game.input.fireHeld = false; });

document.getElementById('btnMissile').addEventListener('touchstart', (e) => {
  e.preventDefault();
  Sound.ensure();
  game.fireMissile();
}, { passive: false });
document.getElementById('btnMissile').addEventListener('click', () => game.fireMissile());

document.getElementById('btnPause').addEventListener('touchstart', (e) => {
  e.preventDefault();
  Sound.ensure();
  togglePause();
}, { passive: false });
document.getElementById('btnPause').addEventListener('click', togglePause);

// ----- 圆盘虚拟摇杆:左/右=转向,上=加速,下=刹车 -----
const joystick = document.getElementById('joystick');
const stick = document.getElementById('stick');
const STICK_RANGE = 34;
const DIR_THRESHOLD = 12;
let joyPointerId = null;
let joyDir = -1;

function joyApply(d) {
  joySteer = d === DIR_LEFT ? -1 : d === DIR_RIGHT ? 1 : 0;
  game.input.boost = d === DIR_UP;
  game.input.brake = d === DIR_DOWN;
  syncSteer();
}

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
  if (d !== joyDir) { joyDir = d; joyApply(d); }
}

function joyReset(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyDir = -1;
  joyApply(-1);
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
// ?demo=秒数 直接开局并快进(自动驾驶),用于预览截图/演示
const params = new URLSearchParams(location.search);
if (params.has('touch')) document.body.classList.add('force-touch');
const demoSec = params.get('demo');
if (demoSec !== null) {
  game.startGame();
  const ff = Math.max(0, Math.min(120, parseFloat(demoSec) || 0));
  for (let i = 0; i < ff * 60; i++) {
    const p = game.player;
    game.input.boost = true;
    game.input.fireHeld = true;
    // 自动驾驶:先保持在路面内,再躲最近的车,没威胁就往路中间靠
    let threat = null, td = Infinity;
    for (const e of game.enemies) {
      const d = Math.abs(e.y - p.y);
      if (d < td) { td = d; threat = e; }
    }
    if (p.x - p.w / 2 < ROAD_X + 10) game.input.steer = 1;
    else if (p.x + p.w / 2 > ROAD_RX - 10) game.input.steer = -1;
    else if (threat && td < 170) game.input.steer = threat.x > p.x ? -1 : 1;
    else game.input.steer = p.x > FIELD_W / 2 ? -1 : 1;
    if (i % 300 === 0) game.fireMissile();
    game.update();
    if (game.state !== STATE_PLAY) game.startGame(); // 阵亡就重开,保证画面好看
  }
  game.input.fireHeld = false;
  game.input.steer = 0;
}

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
