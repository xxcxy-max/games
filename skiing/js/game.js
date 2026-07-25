// ===== 游戏状态机:title/play/pause/over + DOM HUD + 最高分 =====
const STATE_TITLE = 'title';
const STATE_PLAY = 'play';
const STATE_PAUSE = 'pause';
const STATE_OVER = 'gameover';

// 最高分存取(localStorage 可能不可用,如 Node 测试环境)
function loadHiScore() {
  try { return Number(localStorage.getItem('skiing-hi')) || 0; } catch (e) { return 0; }
}
function saveHiScore(v) {
  try { localStorage.setItem('skiing-hi', String(v)); } catch (e) {}
}

// 音效守卫:Node 测试环境没有 Sound 全局对象
function playSound(name, arg) {
  if (typeof Sound !== 'undefined' && Sound[name]) Sound[name](arg);
}

class Game {
  constructor() {
    this.state = STATE_TITLE;
    this.input = { steer: 0, boost: false, brake: false };
    this.world = new SkiWorld();
    this.hiScore = loadHiScore();
    this.noSpawn = false;         // 测试钩子:关闭随机刷物
    this.hud = null;              // DOM 元素集合,由 main.js 注入(Node 下为 null)
  }

  get score() { return this.world.score; }

  startGame() {
    this.world.reset();
    this.state = STATE_PLAY;
    playSound('start');
    this.syncHud();
  }

  togglePause() {
    if (this.state === STATE_PLAY) this.state = STATE_PAUSE;
    else if (this.state === STATE_PAUSE) this.state = STATE_PLAY;
    this.syncHud();
  }

  // ================= 逻辑 =================

  update(dt) {
    if (this.state !== STATE_PLAY) { playSound('wind', 0); return; }
    this.world.noSpawn = this.noSpawn;
    this.world.update(dt, this.input);

    // 消费逻辑层事件 -> 音效 / 结束处理
    for (const ev of this.world.events) {
      if (ev === 'crash') playSound('crash');
      else if (ev === 'gate') playSound('gate');
      else if (ev === 'star') playSound('star');
      else if (ev === 'boost') playSound('boost');
      else if (ev === 'gameover') this.onGameOver();
    }
    this.world.events.length = 0;

    // 风声随速
    playSound('wind', this.world.player.speed / MAX_SPEED);
    this.syncHud();
  }

  onGameOver() {
    this.state = STATE_OVER;
    playSound('windStop');
    playSound('gameover');
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      saveHiScore(this.hiScore);
    }
  }

  // ================= DOM HUD(可注入;Node 下 hud 为 null 直接跳过) =================

  bindHud(els) {
    this.hud = els;
    this.syncHud();
  }

  syncHud() {
    if (!this.hud || typeof document === 'undefined') return;
    const w = this.world;
    this.hud.score.textContent = `分数 ${this.score}`;
    this.hud.hi.textContent = `最高 ${Math.max(this.hiScore, this.score)}`;
    this.hud.speed.textContent = `${Math.round(w.player.speed * 3.6)}`;
    this.hud.lives.textContent = '♥'.repeat(Math.max(0, w.lives)) || '—';
    this.hud.ovTitle.style.display = this.state === STATE_TITLE ? 'flex' : 'none';
    this.hud.ovPause.style.display = this.state === STATE_PAUSE ? 'flex' : 'none';
    this.hud.ovOver.style.display = this.state === STATE_OVER ? 'flex' : 'none';
    if (this.state === STATE_TITLE) {
      this.hud.titleHi.textContent = this.hiScore > 0 ? `最高分 ${this.hiScore}` : '';
    }
    if (this.state === STATE_OVER) {
      this.hud.overScore.textContent = `得分 ${this.score}`;
      this.hud.overDist.textContent = `里程 ${(w.dist / 1000).toFixed(2)} km`;
      this.hud.overHi.textContent = `最高分 ${this.hiScore}`;
    }
  }
}
