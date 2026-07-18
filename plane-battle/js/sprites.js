// ===== 全部图形用 Canvas 矢量手绘,无外部素材 =====

// 五角星路径(以原点为中心)
function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// 受击白闪:在机体上叠一层椭圆白光
function flashOverlay(ctx, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const Sprites = {
  // 玩家战机统一入口:按机型分发,(x,y) 为中心,frame 用于动效
  playerPlane(ctx, type, x, y, frame) {
    if (type === 'apache') this.apache(ctx, x, y, frame);
    else if (type === 'phantom') this.phantom(ctx, x, y, frame);
    else this.falcon(ctx, x, y, frame);
  },

  // 猎鹰:青色喷气式(朝上)
  falcon(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    // 尾焰
    const flame = 8 + (frame % 4) * 2;
    const fg = ctx.createLinearGradient(0, 14, 0, 14 + flame + 8);
    fg.addColorStop(0, 'rgba(130,205,255,0.95)');
    fg.addColorStop(1, 'rgba(130,205,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 14);
    ctx.lineTo(5, 14);
    ctx.lineTo(0, 14 + flame + 8);
    ctx.closePath();
    ctx.fill();
    // 机翼
    ctx.fillStyle = '#1d6fa8';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-21, 12);
    ctx.lineTo(-21, 18);
    ctx.lineTo(-6, 14);
    ctx.lineTo(0, 10);
    ctx.lineTo(6, 14);
    ctx.lineTo(21, 18);
    ctx.lineTo(21, 12);
    ctx.closePath();
    ctx.fill();
    // 机身
    const bg = ctx.createLinearGradient(0, -22, 0, 16);
    bg.addColorStop(0, '#8fe3ff');
    bg.addColorStop(0.5, '#35a8e0');
    bg.addColorStop(1, '#1668a0');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.quadraticCurveTo(7, -6, 6, 16);
    ctx.lineTo(-6, 16);
    ctx.quadraticCurveTo(-7, -6, 0, -22);
    ctx.fill();
    // 座舱
    ctx.fillStyle = 'rgba(235,250,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(0, -6, 2.8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 阿帕奇:军绿武装直升机(朝上),旋翼随帧转动
  apache(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    // 尾梁与尾翼(机尾朝下)
    ctx.fillStyle = '#3d5230';
    ctx.fillRect(-2.5, 4, 5, 18);
    ctx.fillRect(-8, 17, 16, 3);
    // 尾桨
    ctx.save();
    ctx.translate(4, 21);
    ctx.rotate(frame * 0.9);
    ctx.strokeStyle = 'rgba(220,230,220,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
    ctx.moveTo(0, -4); ctx.lineTo(0, 4);
    ctx.stroke();
    ctx.restore();
    // 短翼与武器挂架
    ctx.fillStyle = '#4a6339';
    ctx.fillRect(-19, -2, 38, 5);
    ctx.fillStyle = '#2c3d22';
    ctx.fillRect(-16, 3, 7, 6);
    ctx.fillRect(9, 3, 7, 6);
    // 机身
    const bg = ctx.createLinearGradient(0, -18, 0, 10);
    bg.addColorStop(0, '#6d8a54');
    bg.addColorStop(0.5, '#4a6339');
    bg.addColorStop(1, '#32451f');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(8, -12, 7, 6);
    ctx.lineTo(-7, 6);
    ctx.quadraticCurveTo(-8, -12, 0, -18);
    ctx.fill();
    // 座舱玻璃
    ctx.fillStyle = 'rgba(210,235,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, -9, 3.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 机腹机炮
    ctx.fillStyle = '#222a1a';
    ctx.fillRect(-1.5, -2, 3, 9);
    // 主旋翼(旋转残影)
    ctx.fillStyle = '#2c3d22';
    ctx.fillRect(-1.5, -24, 3, 8); // 旋翼桅杆
    ctx.save();
    ctx.translate(0, -24);
    ctx.rotate(frame * 0.7);
    ctx.strokeStyle = 'rgba(225,235,225,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-23, 0); ctx.lineTo(23, 0);
    ctx.moveTo(0, -23); ctx.lineTo(0, 23);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  },

  // 幻影:紫色飞翼(朝上),引擎辉光呼吸
  phantom(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    // 飞翼
    const wg = ctx.createLinearGradient(0, -14, 0, 15);
    wg.addColorStop(0, '#7b4fc0');
    wg.addColorStop(0.6, '#5b3a8e');
    wg.addColorStop(1, '#3a2360');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-23, 13);
    ctx.lineTo(-12, 13);
    ctx.lineTo(-7, 9);
    ctx.lineTo(0, 13);
    ctx.lineTo(7, 9);
    ctx.lineTo(12, 13);
    ctx.lineTo(23, 13);
    ctx.closePath();
    ctx.fill();
    // 中央脊
    ctx.fillStyle = '#8f63d8';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(5, -4, 4, 10);
    ctx.lineTo(-4, 10);
    ctx.quadraticCurveTo(-5, -4, 0, -16);
    ctx.fill();
    // 座舱
    ctx.fillStyle = 'rgba(240,220,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(0, -5, 2.4, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 引擎辉光
    ctx.fillStyle = `rgba(200,130,255,${0.55 + Math.sin(frame / 3) * 0.25})`;
    ctx.fillRect(-11, 12.5, 7, 2.5);
    ctx.fillRect(4, 12.5, 7, 2.5);
    ctx.restore();
  },

  // 敌机(朝下),(x,y) 为中心;e 需含 type/w/h/flash
  enemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'small') this._enemySmall(ctx);
    else if (e.type === 'medium') this._enemyMedium(ctx);
    else this._enemyBig(ctx);
    if (e.flash > 0) flashOverlay(ctx, e.w, e.h);
    ctx.restore();
  },

  // 小型机:红色梭镖
  _enemySmall(ctx) {
    ctx.fillStyle = '#a83232';
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(-15, -8);
    ctx.lineTo(-15, -12);
    ctx.lineTo(-4, -8);
    ctx.lineTo(0, -11);
    ctx.lineTo(4, -8);
    ctx.lineTo(15, -12);
    ctx.lineTo(15, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e06565';
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.quadraticCurveTo(5, 2, 3, -10);
    ctx.lineTo(-3, -10);
    ctx.quadraticCurveTo(-5, 2, 0, 13);
    ctx.fill();
    ctx.fillStyle = '#ffd9d9';
    ctx.beginPath();
    ctx.ellipse(0, 2, 2.2, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // 中型机:紫色宽体
  _enemyMedium(ctx) {
    ctx.fillStyle = '#7a3aa8';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(-21, 2);
    ctx.lineTo(-21, -6);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-8, -14);
    ctx.lineTo(8, -14);
    ctx.lineTo(8, -4);
    ctx.lineTo(21, -6);
    ctx.lineTo(21, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b06ee0';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(7, 4, 5, -14);
    ctx.lineTo(-5, -14);
    ctx.quadraticCurveTo(-7, 4, 0, 18);
    ctx.fill();
    ctx.fillStyle = '#f0dcff';
    ctx.beginPath();
    ctx.ellipse(0, 3, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // 大型机:墨绿重型,双引擎
  _enemyBig(ctx) {
    ctx.fillStyle = '#2f6e3e';
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(-29, 8);
    ctx.lineTo(-29, -4);
    ctx.lineTo(-12, -8);
    ctx.lineTo(-12, -20);
    ctx.lineTo(12, -20);
    ctx.lineTo(12, -8);
    ctx.lineTo(29, -4);
    ctx.lineTo(29, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a9e5c';
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.quadraticCurveTo(9, 6, 8, -20);
    ctx.lineTo(-8, -20);
    ctx.quadraticCurveTo(-9, 6, 0, 25);
    ctx.fill();
    // 双引擎喷口
    ctx.fillStyle = '#1d4a28';
    ctx.fillRect(-16, -22, 7, 8);
    ctx.fillRect(9, -22, 7, 8);
    ctx.fillStyle = '#dcf5e2';
    ctx.beginPath();
    ctx.ellipse(0, 4, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Boss:重型炮艇
  boss(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    // 引擎光晕
    ctx.fillStyle = `rgba(255,${120 + (frame % 8) * 8},60,0.5)`;
    ctx.fillRect(-52, -46, 12, 8);
    ctx.fillRect(40, -46, 12, 8);
    // 侧舱
    ctx.fillStyle = '#5c2430';
    ctx.fillRect(-65, -20, 26, 44);
    ctx.fillRect(39, -20, 26, 44);
    // 主舰体
    const hg = ctx.createLinearGradient(0, -42, 0, 42);
    hg.addColorStop(0, '#8a3040');
    hg.addColorStop(0.5, '#6e2432');
    hg.addColorStop(1, '#42161f');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(0, 42);
    ctx.lineTo(-40, 22);
    ctx.lineTo(-40, -30);
    ctx.lineTo(-16, -42);
    ctx.lineTo(16, -42);
    ctx.lineTo(40, -30);
    ctx.lineTo(40, 22);
    ctx.closePath();
    ctx.fill();
    // 红色饰条
    ctx.fillStyle = '#d94f4f';
    ctx.fillRect(-40, -6, 80, 5);
    // 指挥塔
    ctx.fillStyle = '#a8465a';
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.quadraticCurveTo(10, 0, 8, -28);
    ctx.lineTo(-8, -28);
    ctx.quadraticCurveTo(-10, 0, 0, 30);
    ctx.fill();
    ctx.fillStyle = '#ffe3e3';
    ctx.beginPath();
    ctx.ellipse(0, 4, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (b.flash > 0) flashOverlay(ctx, b.w, b.h);
    ctx.restore();
  },

  // 玩家子弹:按弹种分发
  bulletPlayer(ctx, b, frame) {
    if (b.kind === 'missile') this._missile(ctx, b, frame);
    else if (b.kind === 'wave') this._wave(ctx, b, frame);
    else if (b.kind === 'tracer') this._tracer(ctx, b);
    else this._bolt(ctx, b);
  },

  // 猎鹰光弹:青色
  _bolt(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(110,225,255,0.35)';
    ctx.fillRect(-3, -8, 6, 16);
    ctx.fillStyle = '#bdf3ff';
    ctx.fillRect(-1.5, -6, 3, 12);
    ctx.restore();
  },

  // 阿帕奇机炮:黄色曳光短弹
  _tracer(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(255,210,90,0.4)';
    ctx.fillRect(-2.5, -6, 5, 12);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-1, -4, 2, 8);
    ctx.restore();
  },

  // 追踪导弹:银色弹体 + 尾焰,朝速度方向旋转
  _missile(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    // 尾焰
    const flame = 4 + (frame % 3) * 2;
    ctx.fillStyle = 'rgba(255,150,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(-2, 7);
    ctx.lineTo(2, 7);
    ctx.lineTo(0, 7 + flame + 3);
    ctx.closePath();
    ctx.fill();
    // 弹体
    ctx.fillStyle = '#d8dde6';
    ctx.fillRect(-2.5, -6, 5, 13);
    ctx.fillStyle = '#e05555';
    ctx.beginPath();
    ctx.moveTo(-2.5, -6);
    ctx.lineTo(2.5, -6);
    ctx.lineTo(0, -11);
    ctx.closePath();
    ctx.fill();
    // 弹翼
    ctx.fillStyle = '#8a93a6';
    ctx.fillRect(-5, 3, 10, 2.5);
    ctx.restore();
  },

  // 幻影波弹:紫色脉动光环
  _wave(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const r = b.r + Math.sin(frame / 4) * 0.8;
    ctx.fillStyle = 'rgba(170,95,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.75, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d0a0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.5, r * 1.05, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // 敌方子弹:橙红火球
  bulletEnemy(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const r = b.r + Math.sin(frame / 5) * 0.6;
    ctx.fillStyle = '#ff7a2a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9c9';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 道具:star 武器 / bomb 雷 / life 命
  powerup(ctx, u, frame) {
    ctx.save();
    ctx.translate(u.x, u.y);
    const pulse = 1 + Math.sin(frame / 8) * 0.08;
    ctx.scale(pulse, pulse);
    const colors = { star: '#d9a92e', bomb: '#55606e', life: '#d94f6e' };
    ctx.fillStyle = colors[u.kind];
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    if (u.kind === 'star') {
      ctx.fillStyle = '#fff';
      starPath(ctx, 6.5);
      ctx.fill();
    } else if (u.kind === 'life') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(-7, -1, -4, -7, 0, -3.5);
      ctx.bezierCurveTo(4, -7, 7, -1, 0, 5);
      ctx.fill();
    } else {
      // 小炸弹:深色圆体 + 引线火花
      ctx.fillStyle = '#20242c';
      ctx.beginPath();
      ctx.arc(0, 1.5, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(3, -3);
      ctx.quadraticCurveTo(6, -7, 4, -9);
      ctx.stroke();
      ctx.fillStyle = '#ffd76e';
      ctx.save();
      ctx.translate(4, -9);
      starPath(ctx, 2.2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // 玩家无敌保护罩
  shield(ctx, x, y, frame) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(120,220,255,${0.5 + Math.sin(frame / 4) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -frame;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // HUD 命数小图标(跟随当前机型)
  miniPlane(ctx, x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.42, 0.42);
    this.playerPlane(ctx, type, 0, 0, 0);
    ctx.restore();
  },

  // HUD 雷数小图标
  miniBomb(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(0, 1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8892a0';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#c8cdd6';
    ctx.beginPath();
    ctx.moveTo(4, -5);
    ctx.quadraticCurveTo(8, -9, 6, -12);
    ctx.stroke();
    ctx.fillStyle = '#ffd76e';
    ctx.save();
    ctx.translate(6, -12);
    starPath(ctx, 2.6);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  },
};
