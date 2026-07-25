// ===== 入口:WebGL 初始化 + 键盘/触屏输入 + 主循环 =====
const container = document.getElementById('glwrap');

// WebGL 初始化失败时给出友好提示
let scene3d = null;
try {
  if (!window.WebGLRenderingContext) throw new Error('WebGL not supported');
  scene3d = new SkiScene(container);
} catch (err) {
  document.getElementById('glError').hidden = false;
  document.getElementById('glError').style.display = 'flex';
  console.error('WebGL 初始化失败:', err);
}

const game = new Game();
game.bindHud({
  score: document.getElementById('hudScore'),
  hi: document.getElementById('hudHi'),
  speed: document.getElementById('hudSpeed'),
  lives: document.getElementById('hudLives'),
  ovTitle: document.getElementById('ovTitle'),
  ovPause: document.getElementById('ovPause'),
  ovOver: document.getElementById('ovOver'),
  titleHi: document.getElementById('titleHi'),
  overScore: document.getElementById('overScore'),
  overDist: document.getElementById('overDist'),
  overHi: document.getElementById('overHi'),
});

function tryStart() {
  if (game.state === STATE_TITLE || game.state === STATE_OVER) game.startGame();
}

// ===== 键盘 =====
const STEER_KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
const heldSteer = [];         // 后按下的方向优先
let dragSteer = 0;            // 触屏拖动转向,优先于键盘

function syncSteer() {
  if (dragSteer !== 0) { game.input.steer = dragSteer; return; }
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
  } else if (e.code === 'Enter') {
    tryStart();
  } else if (e.code === 'KeyP') {
    game.togglePause();
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
  }
});

// ===== 触屏:按住画面左右拖动转向(Pointer Events) =====
let dragId = null;
let dragX = 0;

container.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.ensure();
  if (game.state === STATE_TITLE || game.state === STATE_OVER) { tryStart(); return; }
  dragId = e.pointerId;
  dragX = e.clientX;
  container.setPointerCapture(e.pointerId);
});
container.addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId) return;
  // 拖动偏移映射为转向量(-1..1)
  dragSteer = Math.max(-1, Math.min(1, (e.clientX - dragX) / 60));
  game.input.steer = dragSteer;
});
function dragEnd(e) {
  if (e.pointerId !== dragId) return;
  dragId = null;
  dragSteer = 0;
  syncSteer();
}
container.addEventListener('pointerup', dragEnd);
container.addEventListener('pointercancel', dragEnd);

document.getElementById('btnPause').addEventListener('touchstart', (e) => {
  e.preventDefault();
  Sound.ensure();
  game.togglePause();
}, { passive: false });
document.getElementById('btnPause').addEventListener('click', () => game.togglePause());

// ?touch=1 强制显示触屏控制(桌面调试/截图用)
// ?demo=秒数 直接开局并快进(自动驾驶),用于预览截图/演示
const params = new URLSearchParams(location.search);
if (params.has('touch')) document.body.classList.add('force-touch');
const demoSec = params.get('demo');

// 自动驾驶:先躲最近的障碍,没威胁就去够旗门/星星,否则回中
function demoAI() {
  const w = game.world;
  const p = w.player;
  let steer = 0;
  let threat = null, td = Infinity;
  for (const e of w.entities) {
    if (e.type !== 'obstacle' || e.z > -1 || e.z < -34) continue;
    if (Math.abs(e.x - p.x) < 2.6 && -e.z < td) { td = -e.z; threat = e; }
  }
  if (threat) {
    steer = threat.x > p.x ? -1 : 1;
    if (Math.abs(p.x) > SLOPE_HALF_W - 2 && threat.x * p.x > 0) steer = -steer; // 别为躲障碍撞墙
  } else {
    let goal = null, gd = Infinity;
    for (const e of w.entities) {
      if (e.z > -3 || e.z < -34) continue;
      if (e.type === 'gate' || (e.type === 'item' && e.kind === 'star')) {
        if (-e.z < gd) { gd = -e.z; goal = e; }
      }
    }
    if (goal) steer = Math.abs(goal.x - p.x) < 0.5 ? 0 : (goal.x > p.x ? 1 : -1);
    else steer = Math.abs(p.x) < 1 ? 0 : (p.x > 0 ? -1 : 1);
  }
  game.input.steer = steer;
  game.input.boost = !threat && game.world.player.speed < game.world.cruise + 2;
}

if (demoSec !== null) {
  game.startGame();
  const ff = Math.max(0, Math.min(120, parseFloat(demoSec) || 0));
  for (let i = 0; i < ff * 60; i++) {
    demoAI();
    game.update(1 / 60);
    if (game.state !== STATE_PLAY) game.startGame(); // 阵亡就重开,保证画面好看
  }
  game.input.steer = 0;
}

// ===== 主循环(delta time,秒) =====
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (demoSec !== null && game.state === STATE_PLAY) demoAI();
  if (demoSec !== null && game.state === STATE_OVER) game.startGame();
  game.update(dt);
  if (scene3d) {
    scene3d.sync(game.world, dt);
    scene3d.render();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
