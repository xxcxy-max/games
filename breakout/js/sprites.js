// ===== 全部图形用 Canvas 矢量手绘,无外部素材 =====

// 圆角矩形路径
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const Sprites = {
  // 砖块:圆角 + 顶部高光,受击白闪
  brick(ctx, b) {
    ctx.save();
    ctx.fillStyle = b.color;
    rr(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(ctx, b.x + 2, b.y + 2, b.w - 4, 5, 2.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    rr(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4);
    ctx.stroke();
    if (b.flash > 0) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#fff';
      rr(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
    }
    ctx.restore();
  },

  // 挡板:蓝色圆角板;激光模式下两端长出炮管
  paddle(ctx, p, frame) {
    ctx.save();
    const x = p.x - p.w / 2, y = p.y - p.h / 2;
    // 变长时的能量辉光
    if (p.wideTimer > 0) {
      ctx.fillStyle = `rgba(90,180,255,${0.16 + Math.sin(frame / 5) * 0.06})`;
      rr(ctx, x - 5, y - 5, p.w + 10, p.h + 10, 9);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, y, 0, y + p.h);
    g.addColorStop(0, '#8fd3ff');
    g.addColorStop(0.5, '#3a9de0');
    g.addColorStop(1, '#1668a0');
    ctx.fillStyle = g;
    rr(ctx, x, y, p.w, p.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    rr(ctx, x + 0.5, y + 0.5, p.w - 1, p.h - 1, 6);
    ctx.stroke();
    // 激光炮管
    if (p.hasLaser) {
      ctx.fillStyle = '#39424f';
      ctx.fillRect(x + 3, y - 8, 7, 10);
      ctx.fillRect(x + p.w - 10, y - 8, 7, 10);
      ctx.fillStyle = `rgba(255,80,80,${0.6 + Math.sin(frame / 4) * 0.3})`;
      ctx.fillRect(x + 4.5, y - 10, 4, 3);
      ctx.fillRect(x + p.w - 8.5, y - 10, 4, 3);
    }
    ctx.restore();
  },

  // 球:白色光球
  ball(ctx, b) {
    ctx.save();
    ctx.fillStyle = 'rgba(120,210,255,0.25)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 3.5, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(b.x - 2, b.y - 2, 0.5, b.x, b.y, b.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#7ecbf5');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // 激光弹:黄色光柱
  laser(ctx, l) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,220,90,0.4)';
    ctx.fillRect(l.x - 3, l.y - l.h / 2, 6, l.h);
    ctx.fillStyle = '#fff0b0';
    ctx.fillRect(l.x - 1.2, l.y - l.h / 2, 2.4, l.h);
    ctx.restore();
  },

  // 道具:multi 多球 / laser 激光 / wide 变长板
  powerup(ctx, u, frame) {
    ctx.save();
    ctx.translate(u.x, u.y);
    const pulse = 1 + Math.sin(frame / 8) * 0.08;
    ctx.scale(pulse, pulse);
    const colors = { multi: '#4a9e5c', laser: '#d94f4f', wide: '#3fb2e0' };
    ctx.fillStyle = colors[u.kind];
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    if (u.kind === 'multi') {
      // 三颗小球
      for (const [dx, dy] of [[-4, 2.5], [4, 2.5], [0, -4]]) {
        ctx.beginPath();
        ctx.arc(dx, dy, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (u.kind === 'laser') {
      // 闪电形光弹
      ctx.beginPath();
      ctx.moveTo(1.5, -7);
      ctx.lineTo(-3.5, 1);
      ctx.lineTo(-0.5, 1);
      ctx.lineTo(-1.5, 7);
      ctx.lineTo(3.5, -1);
      ctx.lineTo(0.5, -1);
      ctx.closePath();
      ctx.fill();
    } else {
      // 双向箭头
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-2.5, -4);
      ctx.lineTo(-2.5, 4);
      ctx.closePath();
      ctx.moveTo(7, 0);
      ctx.lineTo(2.5, -4);
      ctx.lineTo(2.5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-3.5, -1.4, 7, 2.8);
    }
    ctx.restore();
  },

  // HUD 命数小球图标
  miniBall(ctx, x, y) {
    ctx.save();
    const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#7ecbf5');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};
