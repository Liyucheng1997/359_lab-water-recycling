import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function tex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noiseFill(ctx, w, h, base, amp, rnd, count = 9000, size = 2) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (rnd() - 0.5) * amp;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(rnd() * w, rnd() * h, size * rnd() + 0.5, size * rnd() + 0.5);
  }
}

export function makeTextures() {
  const T = {};

  // 混凝土
  {
    const [c, ctx] = canvas(256, 256); const r = seeded(7);
    noiseFill(ctx, 256, 256, '#bdbab2', 0.18, r, 14000, 2);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(90,80,70,${0.04 + r() * 0.05})`;
      ctx.beginPath(); ctx.arc(r() * 256, r() * 256, 6 + r() * 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, 255, 255);
    T.concrete = tex(c);
  }

  // 草地
  {
    const [c, ctx] = canvas(256, 256); const r = seeded(11);
    noiseFill(ctx, 256, 256, '#6f9a4a', 0.0, r, 0);
    for (let i = 0; i < 26000; i++) {
      const g = 110 + r() * 70, rr = 70 + r() * 50, b = 40 + r() * 30;
      ctx.fillStyle = `rgba(${rr},${g},${b},0.55)`;
      ctx.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${120 + r() * 40},${110 + r() * 30},60,0.10)`;
      ctx.beginPath(); ctx.arc(r() * 256, r() * 256, 10 + r() * 30, 0, Math.PI * 2); ctx.fill();
    }
    T.grass = tex(c, { repeat: [1 / 12, 1 / 12] });
  }

  // 土层剖面（v=0 对应 -22m，v=1 对应地表）
  {
    const [c, ctx] = canvas(256, 512); const r = seeded(3);
    const layers = [
      [0.00, 0.07, '#4b3826'],   // 耕植土
      [0.07, 0.30, '#8a6a45'],   // 粉质黏土
      [0.30, 0.36, '#a08259'],
      [0.36, 0.62, '#b59a6c'],   // 砂砾层
      [0.62, 1.00, '#6d6a66'],   // 风化岩
    ];
    for (const [a, b, col] of layers) { ctx.fillStyle = col; ctx.fillRect(0, a * 512, 256, (b - a) * 512 + 1); }
    for (let i = 0; i < 16000; i++) {
      const y = r() * 512;
      const v = (r() - 0.5) * 0.35;
      ctx.fillStyle = v > 0 ? `rgba(255,240,210,${v})` : `rgba(0,0,0,${-v})`;
      const s = y > 0.36 * 512 && y < 0.62 * 512 ? 3 + r() * 4 : 1 + r() * 2;
      ctx.fillRect(r() * 256, y, s, s * 0.7);
    }
    // 岩层裂隙
    ctx.strokeStyle = 'rgba(30,30,30,0.35)';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath(); let x = r() * 256, y = 330 + r() * 180; ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 20; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    const t = tex(c);
    t.repeat.set(1 / 40, 1 / 22); // shape uv: x(米), y(米, -22..0)
    t.offset.set(0, 1);
    t.flipY = true;
    T.soil = t;
  }

  // 建筑立面（每个纹理块 = 4m 宽 × 3m 层高）
  const facade = (wall, glass, frame, seed, balcony = false) => {
    const [c, ctx] = canvas(128, 96); const r = seeded(seed);
    noiseFill(ctx, 128, 96, wall, 0.08, r, 1500, 2);
    const g = ctx.createLinearGradient(0, 18, 0, 70);
    g.addColorStop(0, glass[0]); g.addColorStop(1, glass[1]);
    ctx.fillStyle = frame; ctx.fillRect(18, 16, 92, 58);
    ctx.fillStyle = g; ctx.fillRect(22, 20, 40, 50); ctx.fillRect(66, 20, 40, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(24, 22, 10, 46);
    if (balcony) { ctx.fillStyle = 'rgba(40,40,40,0.55)'; ctx.fillRect(14, 64, 100, 4); ctx.fillRect(14, 64, 2, 18); ctx.fillRect(112, 64, 2, 18); }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 92, 128, 4);
    return tex(c);
  };
  T.facades = [
    facade('#e9e2d4', ['#6a8fb0', '#2c4359'], '#d8d1c0', 21, true),
    facade('#c9d3da', ['#7fa6c7', '#2d4f6d'], '#b6c0c8', 22),
    facade('#d9b99a', ['#7895ad', '#33475a'], '#c49f7f', 23, true),
    facade('#f1f1ee', ['#86b3d4', '#2f5a7c'], '#9aa5ad', 24),
    facade('#b9a48c', ['#6c8aa4', '#283c4f'], '#9e8a73', 25),
  ];

  // 格栅板（alphaTest）
  {
    const [c, ctx] = canvas(64, 64);
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#9aa1a8';
    for (let i = 0; i < 64; i += 8) { ctx.fillRect(i, 0, 3, 64); }
    for (let i = 0; i < 64; i += 16) { ctx.fillRect(0, i, 64, 2); }
    T.grating = tex(c, { repeat: [3, 3] });
  }

  // 细网（转鼓格栅）
  {
    const [c, ctx] = canvas(64, 64);
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = '#c9d1d8'; ctx.lineWidth = 1.5;
    for (let i = 0; i <= 64; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(64, i); ctx.stroke(); }
    T.mesh = tex(c, { repeat: [8, 4] });
  }

  // 井盖
  {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = '#2d2f31'; ctx.beginPath(); ctx.arc(64, 64, 63, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4a4d50'; ctx.lineWidth = 3;
    for (let r = 14; r < 60; r += 12) { ctx.beginPath(); ctx.arc(64, 64, r, 0, Math.PI * 2); ctx.stroke(); }
    for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + Math.cos(a * Math.PI / 4) * 60, 64 + Math.sin(a * Math.PI / 4) * 60); ctx.stroke(); }
    ctx.fillStyle = '#5a5e62'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('污水', 64, 70);
    T.manhole = tex(c);
    const [c2, ctx2] = canvas(128, 128);
    ctx2.drawImage(c, 0, 0); ctx2.fillStyle = '#2d2f31'; ctx2.fillRect(34, 52, 60, 24); ctx2.fillStyle = '#4f6f8f'; ctx2.font = 'bold 18px sans-serif'; ctx2.textAlign = 'center'; ctx2.fillText('给水', 64, 70);
    T.valveCover = tex(c2);
  }

  // 沥青
  {
    const [c, ctx] = canvas(128, 128); const r = seeded(5);
    noiseFill(ctx, 128, 128, '#3d4044', 0.22, r, 9000, 1.5);
    T.asphalt = tex(c, { repeat: [1 / 6, 1 / 6] });
  }

  // 砾石/滤料
  {
    const [c, ctx] = canvas(128, 128); const r = seeded(9);
    noiseFill(ctx, 128, 128, '#cdb68a', 0.0, r, 0);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + r() * 80;
      ctx.fillStyle = `rgb(${v},${v * 0.86},${v * 0.62})`;
      ctx.beginPath(); ctx.arc(r() * 128, r() * 128, 0.8 + r() * 1.8, 0, Math.PI * 2); ctx.fill();
    }
    T.sand = tex(c, { repeat: [4, 1] });
  }

  return T;
}
