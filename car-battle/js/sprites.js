// ===== 全部图形用 Canvas 矢量手绘,无外部素材 =====

// 通用车顶视绘制:车轮 + 车身 + 车窗,车头朝上
function carBody(ctx, w, h, colors) {
  // 车轮
  ctx.fillStyle = '#16181d';
  const wy = h * 0.28;
  ctx.fillRect(-w / 2 - 2, -wy - 7, 5, 13);
  ctx.fillRect(w / 2 - 3, -wy - 7, 5, 13);
  ctx.fillRect(-w / 2 - 2, wy - 6, 5, 13);
  ctx.fillRect(w / 2 - 3, wy - 6, 5, 13);
  // 车身
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, colors.top);
  g.addColorStop(0.5, colors.mid);
  g.addColorStop(1, colors.bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 3, -h / 2 + 6);
  ctx.quadraticCurveTo(0, -h / 2 - 2, w / 2 - 3, -h / 2 + 6);
  ctx.lineTo(w / 2, h / 2 - 8);
  ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 4, h / 2);
  ctx.lineTo(-w / 2 + 4, h / 2);
  ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 8);
  ctx.closePath();
  ctx.fill();
  // 挡风玻璃与后窗
  ctx.fillStyle = 'rgba(20,28,40,0.9)';
  ctx.fillRect(-w / 2 + 5, -h / 2 + h * 0.24, w - 10, h * 0.13);
  ctx.fillRect(-w / 2 + 6, h / 2 - h * 0.26, w - 12, h * 0.09);
}

// 受击白闪
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
  // 玩家跑车:红色运动款,带尾翼与条纹
  player(ctx, p, frame) {
    ctx.save();
    ctx.translate(p.x, p.y);
    carBody(ctx, p.w, p.h, { top: '#ff7a6e', mid: '#d93a2e', bottom: '#8e1f18' });
    // 中央条纹
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-3.5, -p.h / 2 + 4, 3, p.h - 10);
    ctx.fillRect(0.5, -p.h / 2 + 4, 3, p.h - 10);
    // 尾翼
    ctx.fillStyle = '#7a160f';
    ctx.fillRect(-p.w / 2 - 1, p.h / 2 - 8, p.w + 2, 5);
    if (p.flash > 0) flashOverlay(ctx, p.w, p.h);
    ctx.restore();
  },

  enemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'civil') {
      const colors = [
        { top: '#7fb2f0', mid: '#3f7fd4', bottom: '#26508e' },
        { top: '#f0d97f', mid: '#d4b83f', bottom: '#8e7a26' },
      ][e.colorIdx];
      carBody(ctx, e.w, e.h, colors);
    } else if (e.type === 'chaser') {
      carBody(ctx, e.w, e.h, { top: '#5a6068', mid: '#2c3036', bottom: '#14161a' });
      // 红色侧条,凶相
      ctx.fillStyle = '#d93a2e';
      ctx.fillRect(-e.w / 2 + 2, -e.h / 4, 3, e.h / 2);
      ctx.fillRect(e.w / 2 - 5, -e.h / 4, 3, e.h / 2);
    } else if (e.type === 'gunner') {
      carBody(ctx, e.w, e.h, { top: '#c05a8e', mid: '#8e2f63', bottom: '#57173a' });
      // 尾部双炮管(朝后=朝下)
      ctx.fillStyle = '#22262e';
      ctx.fillRect(-9, e.h / 2 - 4, 5, 12);
      ctx.fillRect(4, e.h / 2 - 4, 5, 12);
    } else {
      // 装甲卡车:长车身 + 铆接装甲块
      carBody(ctx, e.w, e.h, { top: '#8a9464', mid: '#5c6440', bottom: '#363b26' });
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = -1; i <= 1; i++) ctx.fillRect(-e.w / 2 + 4, i * 22 - 5, e.w - 8, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-e.w / 2 + 3.5, -e.h / 2 + 3.5, e.w - 7, e.h - 7);
    }
    if (e.flash > 0) flashOverlay(ctx, e.w, e.h);
    ctx.restore();
  },

  // 机炮子弹:黄色曳光
  bulletPlayer(ctx, b, frame) {
    if (b.kind === 'missile') { this.missile(ctx, b, frame); return; }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(255,210,90,0.45)';
    ctx.fillRect(-2.5, -7, 5, 14);
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(-1, -5, 2, 10);
    ctx.restore();
  },

  // 导弹:银弹体 + 尾焰,朝速度方向
  missile(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
    const flame = 4 + (frame % 3) * 2;
    ctx.fillStyle = 'rgba(255,150,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(-2, 7);
    ctx.lineTo(2, 7);
    ctx.lineTo(0, 7 + flame + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8dde6';
    ctx.fillRect(-2.5, -6, 5, 13);
    ctx.fillStyle = '#e05555';
    ctx.beginPath();
    ctx.moveTo(-2.5, -6);
    ctx.lineTo(2.5, -6);
    ctx.lineTo(0, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a93a6';
    ctx.fillRect(-5, 3, 10, 2.5);
    ctx.restore();
  },

  // 敌弹:橙红火球
  bulletEnemy(ctx, b, frame) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const r = b.r + Math.sin(frame / 5) * 0.5;
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

  // 道具:missile 导弹 / repair 修理 / shield 护盾
  powerup(ctx, u, frame) {
    ctx.save();
    ctx.translate(u.x, u.y);
    const pulse = 1 + Math.sin(frame / 8) * 0.08;
    ctx.scale(pulse, pulse);
    const colors = { missile: '#c07838', repair: '#3f9e5c', shield: '#3f8ed4' };
    ctx.fillStyle = colors[u.kind];
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    if (u.kind === 'repair') {
      // 十字(维修包)
      ctx.fillRect(-2.2, -7, 4.4, 14);
      ctx.fillRect(-7, -2.2, 14, 4.4);
    } else if (u.kind === 'shield') {
      // 盾形
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.quadraticCurveTo(6, 4, 0, 8);
      ctx.quadraticCurveTo(-6, 4, -6, -4);
      ctx.closePath();
      ctx.fill();
    } else {
      // 小火箭
      ctx.save();
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-2, -6, 4, 10);
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.lineTo(2, -6);
      ctx.lineTo(0, -10);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-4.5, 2, 2.5, 4);
      ctx.fillRect(2, 2, 2.5, 4);
      ctx.restore();
    }
    ctx.restore();
  },

  // 护盾光环
  shieldRing(ctx, p, frame) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = `rgba(120,200,255,${0.55 + Math.sin(frame / 4) * 0.25})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.w / 2 + 8, p.h / 2 + 8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // HUD 命数小车图标
  miniCar(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.32, 0.32);
    carBody(ctx, 38, 64, { top: '#ff7a6e', mid: '#d93a2e', bottom: '#8e1f18' });
    ctx.restore();
  },

  // HUD 导弹小图标
  miniMissile(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d8dde6';
    ctx.fillRect(-2, -7, 4, 11);
    ctx.fillStyle = '#e05555';
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.lineTo(2, -7);
    ctx.lineTo(0, -11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
};
