import * as THREE from 'three';
import { BOUNDS, RIVER, riverX, riverWaterHw, STREETS, MAIN_ROAD, RING_N, RING_S, GROUND_HOLES } from '../core/layout.js';
import { M, T, surfaceMat } from '../core/mats.js';
import { Batcher, rng, railing, makeLabel } from '../core/geo.js';
import { waterMat, waterVolMat } from '../core/water.js';

const { x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, depth: BD } = BOUNDS;

export const CITY_ROAD_X = [...STREETS, -40];

/** 城区内的建设用地（街区），供 city.js 使用 */
export function cityBlocks() {
  const xs = [[BX0 + 1, STREETS[0] - 6], [STREETS[0] + 6, STREETS[1] - 6], [STREETS[1] + 6, STREETS[2] - 6], [STREETS[2] + 6, -46]];
  const zs = [[7, RING_N - 6], [RING_S + 6, -7]];
  const out = [];
  for (const [a, b] of xs) for (const [c, d] of zs) out.push({ x0: a, x1: b, z0: c, z1: d });
  return out;
}

export function buildTerrain(scene, ctx) {
  const root = new THREE.Group(); root.name = 'terrain'; scene.add(root);

  // ── 地表（扣除河道）──
  const grass = surfaceMat(new THREE.MeshStandardMaterial({ color: 0xffffff, map: T.grass, roughness: 1 }));
  const zs = []; for (let z = BZ0; z <= BZ1 + 1e-6; z += 2) zs.push(z);
  const west = new THREE.Shape();
  west.moveTo(BX0, -BZ0);
  for (const z of zs) west.lineTo(riverX(z) - RIVER.hw, -z);
  west.lineTo(BX0, -BZ1);
  for (const [a, b, c, d] of GROUND_HOLES) {
    const h = new THREE.Path();
    h.moveTo(a, -c); h.lineTo(a, -d); h.lineTo(b, -d); h.lineTo(b, -c); h.lineTo(a, -c);
    west.holes.push(h);
  }
  const east = new THREE.Shape();
  east.moveTo(BX1, -BZ0);
  east.lineTo(BX1, -BZ1);
  for (const z of [...zs].reverse()) east.lineTo(riverX(z) + RIVER.hw, -z);
  for (const sh of [west, east]) {
    const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, grass); m.receiveShadow = true; m.renderOrder = 5; root.add(m);
  }

  // ── 剖面侧壁（土层）──
  const soil = new THREE.MeshStandardMaterial({ map: T.soil, roughness: 1, side: THREE.DoubleSide });
  const face = (profile, transform) => {
    const sh = new THREE.Shape();
    sh.moveTo(profile[0][0], BD); sh.lineTo(profile[profile.length - 1][0], BD);
    for (let i = profile.length - 1; i >= 0; i--) sh.lineTo(profile[i][0], profile[i][1]);
    const g = new THREE.ShapeGeometry(sh); transform(g);
    const m = new THREE.Mesh(g, soil); m.receiveShadow = true; root.add(m);
  };
  // 河道横断面（u 为沿剖面方向坐标，sign=-1 时镜像）
  const riverProfile = (z, sign) => {
    const rx = riverX(z);
    return [[rx - RIVER.hw, 0], [rx - RIVER.bedHw, RIVER.bedY], [rx + RIVER.bedHw, RIVER.bedY], [rx + RIVER.hw, 0]]
      .map(([u, y]) => [u * sign, y]).sort((p, q) => p[0] - q[0]);
  };
  // 前（z=BZ1, 法线 +z）
  face([[BX0, 0], ...riverProfile(BZ1, 1), [BX1, 0]], (g) => g.translate(0, 0, BZ1));
  // 后（z=BZ0, 法线 -z）
  face([[-BX1, 0], ...riverProfile(BZ0, -1), [-BX0, 0]], (g) => { g.rotateY(Math.PI); g.translate(0, 0, BZ0); });
  face([[BZ0, 0], [BZ1, 0]], (g) => { g.rotateY(-Math.PI / 2); g.translate(BX0, 0, 0); });
  face([[-BZ1, 0], [-BZ0, 0]], (g) => { g.rotateY(Math.PI / 2); g.translate(BX1, 0, 0); });
  // 底板
  const base = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0 + 2, 1.2, BZ1 - BZ0 + 2), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 }));
  base.position.set((BX0 + BX1) / 2, BD - 0.6, (BZ0 + BZ1) / 2); root.add(base);
  // 底部深度网格
  const grid = new THREE.GridHelper(Math.max(BX1 - BX0, BZ1 - BZ0), 43, 0x6d655c, 0x544d46);
  grid.position.set((BX0 + BX1) / 2, BD + 0.02, (BZ0 + BZ1) / 2); grid.material.transparent = true; grid.material.opacity = 0.35;
  root.add(grid);

  // ── 河道 ──
  buildRiver(root);

  // ── 道路 ──
  buildRoads(root, ctx);

  // ── 树木 ──
  buildTrees(root);

  return root;
}

function buildRiver(root) {
  const zs = []; for (let z = BZ0; z <= BZ1 + 1e-6; z += 2) zs.push(z);
  // 河岸/河床带状网格
  const pos = [], col = [], idx = [];
  const cBank = new THREE.Color(0x857a66), cBed = new THREE.Color(0x5a4f3e), cTop = new THREE.Color(0x6f8a4a);
  zs.forEach((z, i) => {
    const rx = riverX(z);
    const row = [[rx - RIVER.hw, 0, cTop], [rx - RIVER.hw + 1.2, -1.3, cBank], [rx - RIVER.bedHw, RIVER.bedY, cBed], [rx + RIVER.bedHw, RIVER.bedY, cBed], [rx + RIVER.hw - 1.2, -1.3, cBank], [rx + RIVER.hw, 0, cTop]];
    for (const [x, y, c] of row) { pos.push(x, y, z); col.push(c.r, c.g, c.b); }
    if (i > 0) {
      const a = (i - 1) * 6, b = i * 6;
      for (let k = 0; k < 5; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const bank = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  bank.receiveShadow = true; root.add(bank);

  // 水面
  const wp = [], wi = [];
  zs.forEach((z, i) => {
    const rx = riverX(z);
    for (let k = 0; k <= 4; k++) wp.push(rx - riverWaterHw + (2 * riverWaterHw) * (k / 4), RIVER.waterY, z);
    if (i > 0) { const a = (i - 1) * 5, b = i * 5; for (let k = 0; k < 4; k++) wi.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1); }
  });
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setIndex(wi);
  const water = new THREE.Mesh(wg, waterMat(0x4f9fb8, { deep: 0x1f5a6e, flow: [0, -1.2], opacity: 0.82, chop: 1.2 }));
  water.renderOrder = 3; root.add(water);

  // 剖面处的水体截面
  const vol = waterVolMat(0x3d8fb0, 0.55); vol.side = THREE.DoubleSide;
  for (const [z, s] of [[BZ1, 1], [BZ0, -1]]) {
    const rx = riverX(z);
    const sh = new THREE.Shape();
    sh.moveTo(rx - riverWaterHw, RIVER.waterY); sh.lineTo(rx + riverWaterHw, RIVER.waterY);
    sh.lineTo(rx + RIVER.bedHw, RIVER.bedY); sh.lineTo(rx - RIVER.bedHw, RIVER.bedY);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), vol); m.position.z = z + s * 0.05; root.add(m);
  }

  // 岸边块石
  const r = rng(77);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const n = 420;
  const rocks = new THREE.InstancedMesh(rockGeo, M.rock, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const z = BZ0 + 2 + r() * (BZ1 - BZ0 - 4);
    const side = r() < 0.5 ? -1 : 1;
    const t = r();
    const off = RIVER.hw - 0.3 - t * 2.4;
    const x = riverX(z) + side * off;
    const y = -(t * 2.4) * (4 / 3) * 0.55;
    const s = 0.35 + r() * 0.75;
    e.set(r() * 3, r() * 3, r() * 3); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * 0.6, s));
    rocks.setMatrixAt(i, m4);
  }
  rocks.castShadow = true; rocks.receiveShadow = true; root.add(rocks);

  // 人行桥
  const B = new Batcher();
  const bz = -22, bx = riverX(bz);
  const deckY = 1.4;
  B.boxB(30, 0.35, 3, M.wood, bx, deckY, bz);
  for (const dx of [-15.5, 15.5]) B.boxB(3, deckY, 4, M.concreteDark, bx + dx, 0, bz);
  for (const dx of [-5, 5]) B.boxB(1.2, deckY + 4.5, 1.6, M.concreteDark, bx + dx, -4.5, bz);
  for (const s of [-1.35, 1.35]) railing(B, [[bx - 15, deckY + 0.35, bz + s], [bx + 15, deckY + 0.35, bz + s]], M.steel, { spacing: 1.5 });
  B.flush(root);
}

function buildRoads(root, ctx) {
  const asphalt = surfaceMat(M.asphalt), side = surfaceMat(M.sidewalk), mark = surfaceMat(M.marking);
  const B = new Batcher();
  const road = (x0, x1, z0, z1) => B.boxB(x1 - x0, 0.08, z1 - z0, asphalt, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  const walk = (x0, x1, z0, z1) => B.boxB(x1 - x0, 0.2, z1 - z0, side, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  const dashX = (x0, x1, z) => { for (let x = x0 + 1; x < x1 - 3; x += 6) B.boxB(3, 0.1, 0.18, mark, x + 1.5, 0, z); };
  const dashZ = (z0, z1, x) => { for (let z = z0 + 1; z < z1 - 3; z += 6) B.boxB(0.18, 0.1, 3, mark, x, 0, z + 1.5); };

  // 主路与环路
  road(MAIN_ROAD.x0, MAIN_ROAD.x1, -MAIN_ROAD.w / 2, MAIN_ROAD.w / 2);
  road(BX0, -36, RING_N - 4, RING_N + 4);
  road(BX0, -36, RING_S - 4, RING_S + 4);
  for (const x of CITY_ROAD_X) road(x - 4, x + 4, x === -40 ? -63 : RING_S - 4, RING_N + 4);
  // 厂区道路
  road(-11, -5, -63, -5);
  road(-5, 182, -11, -5);
  road(-36, 182, -63, -57);
  // 标线
  const xsegs = [[BX0, STREETS[0] - 4], [STREETS[0] + 4, STREETS[1] - 4], [STREETS[1] + 4, STREETS[2] - 4], [STREETS[2] + 4, -44]];
  for (const [a, b] of xsegs) { dashX(a, b, 0); dashX(a, b, RING_N); dashX(a, b, RING_S); }
  for (const x of CITY_ROAD_X) { dashZ(RING_S + 4, -5, x); dashZ(5, RING_N - 4, x); }
  dashX(-5, 180, -8); dashX(-36, 180, -60);
  // 人行横道
  for (const x of STREETS) for (const s of [-1, 1]) for (let k = -3.5; k <= 3.5; k += 1) B.boxB(0.5, 0.1, 2.6, mark, x + k, 0, s * 7.6);
  // 人行道
  const xw = [[BX0, STREETS[0] - 4], [STREETS[0] + 4, STREETS[1] - 4], [STREETS[1] + 4, STREETS[2] - 4], [STREETS[2] + 4, -44]];
  for (const [a, b] of xw) {
    walk(a, b, 5, 7); walk(a, b, -7, -5);
    walk(a, b, RING_N - 6, RING_N - 4); walk(a, b, RING_S + 4, RING_S + 6);
  }
  for (const x of CITY_ROAD_X) for (const [a, b] of [[7, RING_N - 6], [RING_S + 6, -7]]) {
    walk(x - 6, x - 4, a, b);
    walk(x + 4, x + 6, a, b);
  }
  B.flush(root, { cast: false });

  // 路灯
  const L = new Batcher();
  const lamp = (x, z, dir) => {
    L.cyl(0.12, 7, M.steelDark, x, 3.5, z, 8);
    L.bar([x, 7, z], [x + dir[0] * 1.8, 7.2, z + dir[1] * 1.8], 0.12, 0.12, M.steelDark);
    L.boxB(0.9, 0.2, 0.45, M.steelDark, x + dir[0] * 1.9, 6.9, z + dir[1] * 1.9);
    L.boxB(0.7, 0.06, 0.32, M.lampGlow, x + dir[0] * 1.9, 6.86, z + dir[1] * 1.9);
  };
  for (const [a, b] of xw) for (let x = a + 6; x < b - 2; x += 22) { lamp(x, 6.2, [0, -1]); lamp(x + 11, -6.2, [0, 1]); }
  L.flush(root);

  // 车辆（动画）
  const cars = [];
  const r = rng(5);
  const carBody = new THREE.BoxGeometry(4.2, 1.0, 1.9), cabin = new THREE.BoxGeometry(2.3, 0.8, 1.7), wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
  wheel.rotateX(Math.PI / 2);
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x1b2a38, roughness: 0.1, metalness: 0.6 });
  const lanes = [
    { z: -2.5, dir: 1, x0: BX0 + 2, x1: -38 }, { z: 2.5, dir: -1, x0: BX0 + 2, x1: -38 },
    { z: RING_N - 2, dir: 1, x0: BX0 + 2, x1: -40 }, { z: RING_N + 2, dir: -1, x0: BX0 + 2, x1: -40 },
  ];
  for (let i = 0; i < 14; i++) {
    const lane = lanes[i % lanes.length];
    const g = new THREE.Group();
    const paint = M.carPaint[Math.floor(r() * M.carPaint.length)];
    const b = new THREE.Mesh(carBody, paint); b.position.y = 0.75; b.castShadow = true; g.add(b);
    const c = new THREE.Mesh(cabin, glassDark); c.position.set(-0.2, 1.6, 0); c.castShadow = true; g.add(c);
    for (const [wx, wz] of [[1.3, 0.9], [-1.3, 0.9], [1.3, -0.9], [-1.3, -0.9]]) { const w = new THREE.Mesh(wheel, M.rubber); w.position.set(wx, 0.38, wz); g.add(w); }
    g.rotation.y = lane.dir > 0 ? 0 : Math.PI;
    root.add(g);
    cars.push({ g, lane, x: lane.x0 + r() * (lane.x1 - lane.x0), v: 7 + r() * 5 });
  }
  ctx.anim.push((t, dt) => {
    for (const c of cars) {
      c.x += c.v * dt * c.lane.dir;
      if (c.x > c.lane.x1) c.x = c.lane.x0; if (c.x < c.lane.x0) c.x = c.lane.x1;
      c.g.position.set(c.x, 0.08, c.lane.z);
    }
  });
}

/** 设施占地（树木避让） */
export const KEEP_OUT = [
  [BX0, -34, RING_S - 8, RING_N + 8],
  [-36, -12, -12, 18], [-14, 186, -14, 25], [136, 186, 25, 66], [74, 98, 22, 38], [12, 36, 26, 46],
  [28, 136, -45, -12], [-14, 194, -110, -52], [-46, -22, -90, -66], [-44, -32, -78, 6],
  [-12, -4, -66, -2], [-42, 186, -64, -55], [96, 140, 22, 62], [140, 176, -64, -40],
];
function free(x, z) {
  for (const [a, b, c, d] of KEEP_OUT) if (x > a && x < b && z > c && z < d) return false;
  const rx = riverX(z); if (Math.abs(x - rx) < RIVER.hw + 2.5) return false;
  if (x < BX0 + 2 || x > BX1 - 2 || z < BZ0 + 2 || z > BZ1 - 2) return false;
  return true;
}

export function buildTrees(root, extra = []) {
  const r = rng(99);
  const pts = [];
  let guard = 0;
  while (pts.length < 520 && guard++ < 20000) {
    // 聚簇分布
    const cx = BX0 + r() * (BX1 - BX0), cz = BZ0 + r() * (BZ1 - BZ0);
    const k = 1 + Math.floor(r() * 5);
    for (let i = 0; i < k; i++) {
      const x = cx + (r() - 0.5) * 14, z = cz + (r() - 0.5) * 14;
      if (free(x, z)) pts.push([x, z, r()]);
    }
  }
  // 城市行道树
  const xw = [[BX0, STREETS[0] - 4], [STREETS[0] + 4, STREETS[1] - 4], [STREETS[1] + 4, STREETS[2] - 4], [STREETS[2] + 4, -44]];
  for (const [a, b] of xw) for (let x = a + 3; x < b - 2; x += 8) { pts.push([x, 6.3, 0.2]); pts.push([x + 4, -6.3, 0.3]); }
  for (const x of CITY_ROAD_X) for (let z = 10; z < RING_N - 8; z += 9) { pts.push([x + 5.2, z, 0.4]); pts.push([x - 5.2, -z, 0.5]); }
  pts.push(...extra);

  const n = pts.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 1, 6), M.woodDark, n);
  const crownA = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), n);
  const crownB = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), n);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  let na = 0, nb = 0;
  pts.forEach(([x, z, v], i) => {
    const h = 3 + v * 4;
    m.makeScale(1, h * 0.5, 1).setPosition(x, h * 0.25, z); trunk.setMatrixAt(i, m);
    if (v < 0.72) {
      const s = 1.6 + v * 2.2;
      m.makeScale(s, s * 1.05, s).setPosition(x, h * 0.5 + s * 0.7, z); crownA.setMatrixAt(na, m);
      c.setHSL(0.22 + v * 0.1, 0.45, 0.28 + v * 0.12); crownA.setColorAt(na++, c);
    } else {
      const s = 1.4 + v; m.makeScale(s, h * 1.2, s).setPosition(x, h * 0.45 + h * 0.5, z); crownB.setMatrixAt(nb, m);
      c.setHSL(0.33, 0.4, 0.2 + v * 0.05); crownB.setColorAt(nb++, c);
    }
  });
  crownA.count = na; crownB.count = nb;
  for (const im of [trunk, crownA, crownB]) { im.castShadow = true; im.receiveShadow = true; root.add(im); }
}
