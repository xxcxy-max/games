// ===== 像素风绘制函数(全部用色块手绘，无需图片素材) =====

function drawBrickTile(ctx, x, y) {
  ctx.fillStyle = '#8a3a14';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#c86a3a';
  ctx.fillRect(x, y, TILE, 6);
  ctx.fillRect(x, y + 8, TILE, 6);
  ctx.fillStyle = '#3a1404';
  ctx.fillRect(x, y + 6, TILE, 2);
  ctx.fillRect(x, y + 14, TILE, 2);
  ctx.fillRect(x + 7, y, 2, 6);
  ctx.fillRect(x + 3, y + 8, 2, 6);
  ctx.fillRect(x + 11, y + 8, 2, 6);
}

function drawSteelTile(ctx, x, y) {
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#e8ecf0';
  ctx.fillRect(x, y, TILE, 2);
  ctx.fillRect(x, y, 2, TILE);
  ctx.fillStyle = '#3c4048';
  ctx.fillRect(x, y + 14, TILE, 2);
  ctx.fillRect(x + 14, y, 2, TILE);
  ctx.fillStyle = '#6a7078';
  ctx.fillRect(x + 5, y + 5, 6, 6);
}

function drawWaterTile(ctx, x, y, phase) {
  ctx.fillStyle = '#1c4cd8';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#7ca8ff';
  const o = phase ? 4 : 0;
  ctx.fillRect(x + 2 + o, y + 4, 6, 2);
  ctx.fillRect(x + 8 - o, y + 10, 6, 2);
}

function drawTreeTile(ctx, x, y) {
  ctx.fillStyle = '#0a5014';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#18a028';
  ctx.fillRect(x + 2, y + 2, 5, 5);
  ctx.fillRect(x + 9, y + 2, 5, 5);
  ctx.fillRect(x + 2, y + 9, 5, 5);
  ctx.fillRect(x + 9, y + 9, 5, 5);
}

// colors: { body, track, trackLine, turret }
function drawTankSprite(ctx, x, y, dir, colors, frame) {
  ctx.save();
  ctx.translate(x + 16, y + 16);
  ctx.rotate(dir * Math.PI / 2);
  // 履带
  ctx.fillStyle = colors.track;
  ctx.fillRect(-16, -14, 7, 28);
  ctx.fillRect(9, -14, 7, 28);
  ctx.fillStyle = colors.trackLine;
  for (let i = -14; i < 14; i += 4) {
    const yy = i + (frame ? 2 : 0);
    if (yy <= 12) {
      ctx.fillRect(-16, yy, 7, 2);
      ctx.fillRect(9, yy, 7, 2);
    }
  }
  // 车身
  ctx.fillStyle = colors.body;
  ctx.fillRect(-8, -12, 16, 24);
  // 炮塔
  ctx.fillStyle = colors.turret;
  ctx.fillRect(-5, -5, 10, 10);
  // 炮管(朝上绘制，靠旋转指向各方向)
  ctx.fillRect(-2, -16, 4, 12);
  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.fillStyle = b.fromPlayer ? '#f8f8f8' : '#ff8090';
  ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
}

function drawBase(ctx, x, y, alive) {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, 32, 32);
  if (alive) {
    // 简易老鹰造型
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(x + 14, y + 4, 4, 6);
    ctx.fillRect(x + 10, y + 8, 12, 4);
    ctx.fillRect(x + 6, y + 12, 20, 6);
    ctx.fillRect(x + 10, y + 18, 12, 4);
    ctx.fillRect(x + 12, y + 22, 8, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 15, y + 6, 2, 2);
  } else {
    // 残骸
    ctx.fillStyle = '#585858';
    ctx.fillRect(x + 6, y + 18, 8, 8);
    ctx.fillRect(x + 16, y + 14, 10, 12);
    ctx.fillRect(x + 4, y + 24, 22, 4);
  }
}

function drawExplosion(ctx, e) {
  const p = e.t / e.max;
  const r = 4 + p * (e.big ? 26 : 12);
  ctx.fillStyle = p < 0.35 ? '#ffffff' : (p < 0.7 ? '#f8c020' : '#f05010');
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.fill();
  if (e.big) {
    ctx.fillStyle = '#f88020';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 敌人出场时的闪烁星形动画
function drawSpawnFx(ctx, s) {
  const r = 6 + (s.t % 16) / 16 * 10;
  ctx.save();
  ctx.translate(s.x + 16, s.y + 16);
  ctx.rotate(Math.PI / 4 * ((s.t >> 2) % 2));
  ctx.fillStyle = ['#ffffff', '#7cd8f8', '#f8d84c'][(s.t >> 3) % 3];
  ctx.fillRect(-r, -2, r * 2, 4);
  ctx.fillRect(-2, -r, 4, r * 2);
  ctx.restore();
}

// 出生无敌保护罩(闪烁边框)
function drawShield(ctx, t, frame) {
  ctx.strokeStyle = frame ? '#ffffff' : '#58c8f8';
  ctx.lineWidth = 2;
  ctx.strokeRect(t.x - 1, t.y - 1, t.size + 2, t.size + 2);
}
