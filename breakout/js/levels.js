// ===== 常量 + 关卡砖块布局 =====
const FIELD_W = 480;
const FIELD_H = 640;

const BRICK_COLS = 10;
const BRICK_W = 42;
const BRICK_H = 20;
const BRICK_GAP = 4;
const BRICK_X0 = 12;   // (480 - 10*42 - 9*4) / 2,居中
const BRICK_Y0 = 76;

// 关卡布局:每行 10 个字符,'.' = 空,'1'/'2'/'3' = 砖块耐久
const LEVELS = [
  {
    speed: 5.2,
    layout: [
      '3333333333',
      '3333333333',
      '2222222222',
      '2222222222',
      '1111111111',
      '1111111111',
    ],
  },
  {
    speed: 5.6,
    layout: [
      '2.1.2.1.2.',
      '1.3.1.3.1.',
      '3.2.3.2.3.',
      '.1.2.1.2.1',
      '2.3.2.3.2.',
      '1.2.1.2.1.',
    ],
  },
  {
    speed: 6.0,
    layout: [
      '3333333333',
      '3........3',
      '32.2222.23',
      '32.1111.23',
      '32.2222.23',
      '3........3',
    ],
  },
];

// 第 N 关:3 个布局循环,每循环一圈球速 +0.4
function levelInfo(n) {
  const idx = (n - 1) % LEVELS.length;
  const cycle = Math.floor((n - 1) / LEVELS.length);
  return {
    name: `第 ${n} 关`,
    speed: LEVELS[idx].speed + cycle * 0.4,
    layout: LEVELS[idx].layout,
  };
}
