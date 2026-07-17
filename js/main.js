// ===== 入口：键盘输入 + 主循环 =====
const canvas = document.getElementById('game');
const game = new Game(canvas);

const KEY_DIRS = {
  ArrowUp: DIR_UP,    KeyW: DIR_UP,
  ArrowRight: DIR_RIGHT, KeyD: DIR_RIGHT,
  ArrowDown: DIR_DOWN,  KeyS: DIR_DOWN,
  ArrowLeft: DIR_LEFT,  KeyA: DIR_LEFT,
};
const heldDirs = new Set();   // 按插入顺序保存，后按下的方向优先

window.addEventListener('keydown', (e) => {
  Sound.ensure();
  if (e.code in KEY_DIRS) {
    heldDirs.delete(KEY_DIRS[e.code]);   // 重新放到队尾，保证"最后按下"优先
    heldDirs.add(KEY_DIRS[e.code]);
    game.input.dir = KEY_DIRS[e.code];
    e.preventDefault();
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.shootHeld = true;
    e.preventDefault();
  } else if (e.code === 'Enter') {
    if (game.state === 'title' || game.state === 'gameover') game.startGame();
  } else if (e.code === 'KeyP') {
    if (game.state === 'play') game.state = 'pause';
    else if (game.state === 'pause') game.state = 'play';
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code in KEY_DIRS) {
    heldDirs.delete(KEY_DIRS[e.code]);
    const rest = [...heldDirs];
    game.input.dir = rest.length ? rest[rest.length - 1] : -1;
  } else if (e.code === 'Space' || e.code === 'KeyJ') {
    game.input.shootHeld = false;
  }
});

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
