// 水流路径（管道几何与粒子水流共用同一套坐标）
// 点属性：q 清洁度(0 污水 → 1 饮用水)，s 横向扩散半径，flat 是否为水面流动，k 速度系数，st 进入的工艺阶段
import {
  STREETS, collX, supX, collectorY, yT, TRUNK, SUPPLY, riverX,
} from '../core/layout.js';

export const P = (x, y, z, o = {}) => ({ x, y, z, ...o });
export const XC = STREETS.map(collX);
export const XS = STREETS.map(supX);
const F = { flat: 1 };

/** 拼接多段点列，去除首尾重复点 */
export function cat(...lists) {
  const out = [];
  for (const l of lists) for (const p of l) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) + Math.abs(last.y - p.y) + Math.abs(last.z - p.z) < 1e-3) { Object.assign(last, p); continue; }
    out.push({ ...p });
  }
  return out;
}
const pieces = (arr) => cat(...arr.map((a) => a.pts));

// ───────────────────── 示范住宅：用水与排水 ─────────────────────
export const STACK = { x: -122.6, z: 17.45 };
const DRAIN_BUILDING = [
  P(STACK.x, -1.0, STACK.z), P(STACK.x, -1.0, 20), P(-112, -1.35, 20),
  P(XC[1], collectorY(XC[1], 20) + 0.15, 20, { q: 0.02, s: 0.2 }),
];
export const H = {
  kitchenDrain: [P(-126, 0.78, 17.6), P(-123.1, 0.6, STACK.z), P(STACK.x, 0.6, STACK.z)],
  buildingDrain: DRAIN_BUILDING,
  toilet: [P(-125.8, 3.75, 18.1, { q: 0.0, s: 0.12, k: 0.5 }), P(-125.8, 2.95, 18.1, { s: 0.04, k: 1 }), P(-123.0, 2.9, STACK.z), P(STACK.x, 2.9, STACK.z)],
  basin: [P(-123.3, 4.15, 17.75, { q: 0.1, s: 0.08, k: 0.5 }), P(-123.3, 3.0, 17.6, { s: 0.03, k: 1 }), P(-122.95, 3.0, STACK.z)],
  bath: [P(-127.9, 3.5, 23, { q: 0.12, s: 0.1, k: 0.5 }), P(-127.9, 2.8, 23, { s: 0.03, k: 1 }), P(-127.9, 2.8, 17.75), P(-122.9, 2.8, 17.75), P(STACK.x, 2.8, STACK.z)],
  washer: [P(-118, 1.0, 18.55, { q: 0.08, s: 0.05 }), P(-118, 0.45, 17.6), P(STACK.x, 0.45, STACK.z)],
  supplyIn: [
    P(XS[1], SUPPLY.y, 24, { q: 1 }), P(-112, -1.2, 24), P(-115.6, -1.2, 24, { st: 'house' }),
    P(-115.6, -1.2, 17.65), P(-115.6, 1.75, 17.65), P(-126, 1.75, 17.65), P(-126, 1.75, 17.86), P(-126, 1.56, 17.86),
  ],
  supplyUp: [P(-115.6, 1.75, 17.65), P(-115.6, 4.5, 17.65), P(-125.8, 4.5, 17.65), P(-125.8, 4.5, 17.82), P(-125.8, 4.25, 17.82)],
  supplyBasin: [P(-123.3, 4.5, 17.65), P(-123.3, 4.4, 17.7)],
  supplyWasher: [P(-115.6, 1.25, 17.65), P(-118, 1.25, 17.65), P(-118, 1.25, 18.05)],
};
// 水龙头 → 洗菜池 → 存水弯 → 立管 → 出户管 → 支管
export const H_DRAIN = cat(
  [P(-126, 1.56, 17.86, { q: 0.99, s: 0.01, k: 0.6, st: 'house' }), P(-126, 1.06, 17.86, { q: 0.4, s: 0.12, k: 0.5 })],
  H.kitchenDrain.map((p, i) => (i === 0 ? { ...p, q: 0.05, s: 0.03, k: 1 } : p)),
  [P(STACK.x, -1.0, STACK.z)],
  DRAIN_BUILDING,
);
const viaStack = (pts, y) => cat(pts, [P(STACK.x, y, STACK.z), P(STACK.x, -1.0, STACK.z)], DRAIN_BUILDING);

// ───────────────────── 市政排水管网 ─────────────────────
export const TRUNK_PTS = [TRUNK.x0, XC[0], XC[1], XC[2], TRUNK.x1].map((x) => P(x, yT(x), TRUNK.z));
export const COLLECTORS = XC.flatMap((xc, i) => [
  { id: 'N' + i, pts: i === 1
    ? [P(xc, collectorY(xc, 50), 50), P(xc, collectorY(xc, 20), 20), P(xc, yT(xc) + 0.45, TRUNK.z)]
    : [P(xc, collectorY(xc, 50), 50), P(xc, yT(xc) + 0.45, TRUNK.z)] },
  { id: 'S' + i, pts: [P(xc, collectorY(xc, -46), -46), P(xc, yT(xc) + 0.45, TRUNK.z)] },
]);

// ───────────────────── 主线 A：泵站 → 污水厂 → 湿地 → 河流 ─────────────────────
export const A = {
  wetwell: { pts: [P(TRUNK.x1, yT(TRUNK.x1), -2, { st: 'pump', s: 0.55 }), P(-29.8, -7.0, -2, { s: 0.4 }), P(-29.0, -8.4, -2, { ...F, s: 1.5, k: 0.4 }), P(-26.4, -8.4, -2, { ...F, s: 2.5, k: 0.4 }), P(-25.5, -9.9, -2, { s: 0.3, k: 1 }), P(-25.5, -10.4, -2, { s: 0.15 })] },
  riser: { pts: [P(-25.5, -10.4, -2), P(-24.2, -10.4, -2), P(-24.2, -1.8, -2)] },
  forceMain: { pts: [P(-24.2, -1.8, -2), P(8, -1.8, -2), P(8, -1.8, 10), P(8, 3.0, 10)], pipe: { r: 0.5, kind: 'sewer' } },
  headworks: { pts: [P(8, 3.0, 10, { st: 'headworks', s: 0.4 }), P(8.6, 3.65, 10, { ...F, s: 1.4, k: 0.45 }), P(10.6, 3.65, 10, { ...F, s: 1.2 }), P(21.6, 3.65, 10, { ...F, s: 1.2 }), P(22.8, 3.65, 10, { ...F, s: 2.4 }), P(37.4, 3.65, 10, { ...F, s: 2.4 }), P(38.5, 3.4, 10, { s: 0.3, k: 1 })] },
  toPrimary: { pts: [P(38.5, 3.4, 10), P(40.5, 3.4, 10, { st: 'primary' }), P(40.5, -1, 10), P(56, -1, 10), P(56, 3.6, 10)], pipe: { r: 0.45, kind: 'sewer' } },
  primary: { pts: [P(56, 3.6, 10), P(56, 4.05, 10, { ...F, s: 0.8, k: 0.3 }), P(61, 4.05, 10, { ...F, s: 6 }), P(66.2, 4.05, 10, { ...F, s: 3.5 }), P(67.0, 3.85, 10, { s: 0.4 }), P(68.4, 3.5, 10, { s: 0.3, k: 1 })] },
  toBio: { pts: [P(68.4, 3.5, 10), P(71, 3.5, 10), P(71, 3.5, 2), P(74.4, 3.5, 2)], pipe: { r: 0.45, kind: 'sewer', supports: true } },
  bio: { pts: [P(74.4, 3.5, 2), P(74.8, 5.05, 2, { st: 'bio', ...F, s: 2.5, k: 0.32 }), P(105, 5.05, 2, { ...F, s: 3 }), P(105, 5.05, 10, { ...F, s: 2.5 }), P(75, 5.05, 10, { ...F, s: 3 }), P(75, 5.05, 18, { ...F, s: 2.5 }), P(105.2, 5.05, 18, { ...F, s: 3 }), P(105.8, 4.6, 18, { s: 0.3, k: 1 })] },
  toSecondary: { pts: [P(105.8, 4.6, 18), P(108.5, 4.6, 18), P(108.5, -1, 18), P(124, -1, 18), P(124, -1, 10, { st: 'secondary' }), P(124, 3.6, 10)], pipe: { r: 0.45, kind: 'sewer' } },
  secondary: { pts: [P(124, 3.6, 10), P(124, 4.05, 10, { ...F, s: 0.8, k: 0.3 }), P(129, 4.05, 10, { ...F, s: 6 }), P(134.2, 4.05, 10, { ...F, s: 3.5 }), P(135.0, 3.85, 10, { s: 0.4 }), P(136.4, 3.5, 10, { s: 0.3, k: 1 })] },
  toTertiary: { pts: [P(136.4, 3.5, 10), P(139, 3.5, 10, { st: 'tertiary' }), P(141.2, 2.4, 10)], pipe: { r: 0.42, kind: 'raw', supports: true } },
  membrane: { pts: [P(141.2, 2.4, 10), P(141.8, 2.9, 10, { ...F, s: 4, k: 0.32 }), P(154.2, 2.9, 10, { ...F, s: 4.5 }), P(154.8, 2.4, 10, { s: 0.2, k: 1 })] },
  permeate: { pts: [P(154.8, 2.4, 10), P(157.6, 2.4, 10)], pipe: { r: 0.3, kind: 'reclaim' } },
  uv: { pts: [P(157.6, 2.4, 10), P(157.9, 2.25, 10, { st: 'uv', ...F, s: 1.2, k: 0.5 }), P(171.2, 2.25, 10, { ...F, s: 1.2 }), P(172.4, 1.9, 10, { s: 0.25, k: 1 })] },
  toWetland: { pts: [P(172.4, 1.9, 10), P(176, 1.9, 10), P(176, -0.6, 10), P(176, -0.6, 27), P(160, -0.6, 27), P(160, 0.0, 30.4)], pipe: { r: 0.45, kind: 'reclaim' } },
  wetland: { pts: [P(160, 0.0, 30.4), P(160, 0.42, 31.6, { st: 'wetland', ...F, s: 3, k: 0.28 }), P(160, 0.42, 44, { ...F, s: 16 }), P(160, 0.42, 57.5, { ...F, s: 8 }), P(176, 0.42, 59.8, { ...F, s: 1.5 }), P(179, 0.2, 60.5, { s: 0.3, k: 1 })] },
  outfall: { pts: [P(179, 0.2, 60.5), P(180.5, -0.7, 60.5), P(197.6, -0.7, 60.5)], pipe: { r: 0.5, kind: 'reclaim' } },
  cascade: { pts: [P(197.6, -0.7, 60.5), P(198.9, -0.95, 60, { st: 'river', ...F, s: 1.5, k: 0.6 })] },
};
// 水质沿程（关键节点清洁度）
const QA = { wetwell: 0.03, headworks: 0.06, toPrimary: 0.14, primary: 0.2, bio: 0.3, toSecondary: 0.48, secondary: 0.52, toTertiary: 0.58, membrane: 0.6, uv: 0.68, toWetland: 0.72, wetland: 0.72, outfall: 0.76, cascade: 0.76 };
for (const [k, v] of Object.entries(QA)) A[k].pts[0].q = v;
A.cascade.pts[1].q = 0.74;
export const A_PTS = pieces(Object.values(A));

// ───────────────────── 河流 ─────────────────────
const riverPt = (z, o = {}) => P(riverX(z), -0.95, z, { ...F, s: 8.5, k: 0.5, q: 0.74, ...o });
export const RIVER_PTS = [];
for (let z = 78; z >= -138; z -= 4) RIVER_PTS.push(riverPt(z));
const RIVER_TRACE = [];
for (let z = 56; z >= -70; z -= 4) RIVER_TRACE.push(riverPt(z, { s: 0, k: 0.75 }));

// ───────────────────── 主线 B：取水 → 自来水厂 → 水塔 → 供水管网 ─────────────────────
export const B = {
  intake: { pts: [P(191, -0.95, -78, { st: 'river', ...F, s: 2, k: 0.5, q: 0.74 }), P(188.6, -0.95, -78, { ...F, s: 1.5 }), P(186.6, -1.6, -78, { s: 0.5, k: 1 })] },
  rawMain: { pts: [P(186.6, -1.6, -78), P(185, -2.8, -78), P(176.6, -2.8, -78)], pipe: { r: 0.6, kind: 'raw' } },
  wetwell: { pts: [P(176.6, -2.8, -78), P(173.6, -3.4, -78, { ...F, s: 1.5, k: 0.5 }), P(172, -3.6, -76, { s: 0.2, k: 1 })] },
  lift: { pts: [P(172, -3.6, -76), P(172, 1.2, -76), P(166, 1.2, -76), P(163.4, 1.2, -78), P(163.4, 5.3, -78), P(161.0, 5.3, -78), P(160.8, 4.7, -78)], pipe: { r: 0.4, kind: 'raw', supports: true } },
  coag: { pts: [P(160.8, 4.7, -78, { st: 'coag' }), P(160.5, 4.47, -78, { ...F, s: 1.4, k: 0.35 }), P(157, 4.47, -78, { ...F, s: 1.6 }), P(155, 4.47, -78, { ...F, s: 0.8 }), P(153.4, 4.47, -78, { ...F, s: 7 }), P(135, 4.47, -78, { ...F, s: 7 })] },
  sedi: { pts: [P(135, 4.47, -78), P(133, 4.47, -78, { st: 'sedi', ...F, s: 7.5, k: 0.3 }), P(106.8, 4.47, -78, { ...F, s: 7.5 }), P(105.2, 4.3, -78, { s: 0.6, k: 0.8 })] },
  filter: { pts: [P(105.2, 4.3, -78), P(103.2, 4.47, -78, { st: 'filter', ...F, s: 8, k: 0.35 }), P(97, 4.47, -73, { ...F, s: 4 }), P(97, 2.4, -73, { s: 3, k: 0.25 }), P(97, 0.9, -73, { s: 3 }), P(80, 0.55, -73, { s: 3, k: 0.6 }), P(76.6, 0.55, -73, { s: 0.3, k: 1 })] },
  toOzone: { pts: [P(76.6, 0.55, -73), P(74, 0.55, -73), P(74, 4.8, -73), P(72.6, 4.8, -73), P(72.2, 4.5, -73)], pipe: { r: 0.4, kind: 'raw' } },
  o3bac: { pts: [P(72.2, 4.5, -73, { st: 'o3bac' }), P(71.2, 4.47, -73, { ...F, s: 3, k: 0.32 }), P(67, 4.47, -82, { ...F, s: 3 }), P(63, 4.47, -78, { ...F, s: 3 }), P(61.5, 4.47, -78, { ...F, s: 2 }), P(58, 4.47, -78, { ...F, s: 6 }), P(54, 4.47, -78, { ...F, s: 6 }), P(54, 2.9, -78, { s: 5, k: 0.25 }), P(54, 1.0, -78, { s: 5 }), P(49, 0.55, -78, { s: 3, k: 0.6 }), P(48.6, 0.55, -78, { s: 0.3, k: 1 })] },
  toReservoir: { pts: [P(48.6, 0.55, -78), P(46, 0.55, -78), P(46, 0.55, -68.6), P(44.6, 1.2, -68.6)], pipe: { r: 0.45, kind: 'raw' } },
  reservoir: { pts: [P(44.6, 1.2, -68.6), P(43.4, 1.55, -68.6, { st: 'disinfect', ...F, s: 3.5, k: 0.4 }), P(12.2, 1.55, -68.6, { ...F, s: 3.5 }), P(12.2, 1.55, -78, { ...F, s: 3.5 }), P(41.8, 1.55, -78, { ...F, s: 3.5 }), P(41.8, 1.55, -87.4, { ...F, s: 3.5 }), P(11, 1.55, -87.4, { ...F, s: 3.5 }), P(10.6, 1.0, -87.4, { s: 0.3, k: 1 })] },
  toPumps: { pts: [P(10.6, 1.0, -87.4), P(8, 0.9, -87.4, { st: 'supply' }), P(8, 0.9, -78), P(4.6, 0.9, -78)], pipe: { r: 0.45, kind: 'supply' } },
  pump: { pts: [P(4.6, 0.9, -78), P(1.4, 0.9, -78), P(-1.4, 0.9, -78), P(-3.8, 1.6, -78)] },
  toTower: { pts: [P(-3.8, 1.6, -78), P(-9, 1.6, -78), P(-30.6, 1.6, -78), P(-30.6, 27.4, -78), P(-31.6, 28.4, -78)], pipe: { r: 0.5, kind: 'supply' } },
  tank: { pts: [P(-31.6, 28.4, -78), P(-34, 31.5, -78, { s: 3, k: 0.4 }), P(-36.4, 28.4, -78, { k: 1 })] },
  downcomer: { pts: [P(-36.4, 28.4, -78), P(-37.4, 27.4, -78), P(-37.4, SUPPLY.y, -78), P(SUPPLY.xMain, SUPPLY.y, SUPPLY.z)], pipe: { r: 0.5, kind: 'supply' } },
  main: { pts: [P(SUPPLY.xMain, SUPPLY.y, SUPPLY.z), P(XS[2], SUPPLY.y, SUPPLY.z), P(XS[1], SUPPLY.y, SUPPLY.z), P(XS[0], SUPPLY.y, SUPPLY.z), P(-193, SUPPLY.y, SUPPLY.z)], pipe: { r: 0.4, kind: 'supply' } },
};
const QB = { intake: 0.74, rawMain: 0.74, coag: 0.76, sedi: 0.8, filter: 0.85, toOzone: 0.88, o3bac: 0.89, toReservoir: 0.94, reservoir: 0.95, toPumps: 0.99, main: 1 };
for (const [k, v] of Object.entries(QB)) B[k].pts[0].q = v;
export const B_PTS = pieces(Object.values(B));

export const BRANCHES = XS.flatMap((xs, i) => [
  { id: 'N' + i, pts: i === 1
    ? [P(xs, SUPPLY.y, SUPPLY.z), P(xs, SUPPLY.y, 24), P(xs, SUPPLY.y, 50)]
    : [P(xs, SUPPLY.y, SUPPLY.z), P(xs, SUPPLY.y, 50)] },
  { id: 'S' + i, pts: [P(xs, SUPPLY.y, SUPPLY.z), P(xs, SUPPLY.y, -46)] },
]);

// ───────────────────── 污泥 / 沼气 ─────────────────────
export const SL = {
  primarySludge: { pts: [P(57.3, 0.5, 10), P(57.3, -1.6, 10), P(57.3, -1.6, -14), P(40, -1.6, -14), P(40, -1.6, -28), P(40, 3.3, -28)], pipe: { r: 0.25, kind: 'sludge' } },
  thickener: { pts: [P(40, 3.3, -28), P(43.5, 3.55, -28, { ...F, s: 2.5, k: 0.3 }), P(44.5, 0.5, -28, { k: 0.6 })] },
  toDigester: { pts: [P(44.5, 0.5, -28), P(46, -1.6, -28), P(62, -1.6, -28), P(62, 1.6, -28)], pipe: { r: 0.25, kind: 'sludge' } },
  digester: { pts: [P(62, 1.6, -28), P(62, 10, -28, { k: 0.3 }), P(62, 2.2, -31.2, { k: 1 })] },
  toDewater: { pts: [P(62, 2.2, -31.2), P(62, -1.6, -34.5), P(122, -1.6, -34.5), P(122, -1.6, -28), P(122, 2.4, -28)], pipe: { r: 0.25, kind: 'sludge' } },
  dewater: { pts: [P(122, 2.4, -28), P(122, 3.6, -31.5, { k: 0.4 })] },
};
export const RAS = [P(125.4, 0.5, 10), P(125.4, -2.2, 10), P(125.4, -2.2, -6), P(72.6, -2.2, -6), P(72.6, -2.2, 2.6), P(72.6, 4.0, 2.6), P(74.6, 4.0, 2.6)];
export const WAS = [P(110, -2.2, -6), P(110, -2.2, -12), P(42, -2.2, -12), P(42, -2.2, -26), P(42, 3.0, -26)];
export const GAS = {
  collect: [P(62, 19.8, -28), P(62, 21.2, -28), P(80, 21.2, -28), P(89, 21.2, -28), P(89, 0.8, -28), P(91.5, 0.8, -30)],
  d2: [P(80, 19.8, -28), P(80, 21.2, -28)],
  toChp: [P(104.5, 0.8, -30), P(104.5, 0.8, -19), P(102, 0.8, -19)],
  toFlare: [P(104.5, 0.8, -30), P(110, 0.8, -30), P(110, 0.8, -36.5)],
};

// ───────────────────── 粒子流注册 ─────────────────────
export const FLOWS = [];
export function addFlow(pts, o = {}) { FLOWS.push({ pts, ...o }); }

const sewerQ = (pts, q = 0.02) => pts.map((p, i) => (i === 0 ? { q, ...p } : p));

// 住宅内部
addFlow(H_DRAIN, { size: 0.09, density: 3, spread: 0.04 });
addFlow(viaStack(H.toilet, 2.9), { size: 0.09, density: 2.5, spread: 0.05 });
addFlow(viaStack(H.basin, 3.0), { size: 0.08, density: 2.5, spread: 0.04 });
addFlow(viaStack(H.bath, 2.8), { size: 0.08, density: 2.5, spread: 0.04 });
addFlow(viaStack(H.washer, 0.45), { size: 0.08, density: 2.5, spread: 0.04 });
addFlow(H.supplyIn, { size: 0.08, density: 3, spread: 0.03, q: 1 });
addFlow(cat([P(-115.6, 1.75, 17.65)], H.supplyUp), { size: 0.07, density: 3, spread: 0.02, q: 1 });
addFlow(H.supplyWasher, { size: 0.07, density: 3, spread: 0.02, q: 1 });
// 管网
for (const c of COLLECTORS) addFlow(sewerQ(c.pts), { size: 0.2, density: 1.2, spread: 0.28, q: 0.02 });
addFlow(sewerQ(TRUNK_PTS), { size: 0.28, density: 1.6, spread: 0.55, q: 0.03 });
addFlow(A_PTS, { size: 0.3, density: 1.1, spread: 0.3 });
addFlow(RIVER_PTS, { size: 0.32, density: 2.2, spread: 8.5, q: 0.74 });
addFlow(B_PTS, { size: 0.3, density: 1.1, spread: 0.3 });
for (const b of BRANCHES) addFlow(b.pts, { size: 0.17, density: 1.1, spread: 0.18, q: 1 });
// 污泥与沼气
addFlow(pieces(Object.values(SL)), { size: 0.22, density: 1.4, spread: 0.12, color: 0x3a2412 });
addFlow(RAS, { size: 0.2, density: 1.4, spread: 0.15, color: 0x6a4626 });
addFlow(WAS, { size: 0.16, density: 1.2, spread: 0.1, color: 0x5a3a1e });
addFlow(cat(GAS.collect, [P(98, 4, -30), P(104.5, 0.8, -30)], GAS.toChp), { size: 0.14, density: 1.6, spread: 0.08, color: 0xffd34d, speed: 1.6 });

// ───────────────────── 追踪水滴：完整闭环 ─────────────────────
const idx = (pts, pred) => pts.findIndex(pred);
const near = (a, b) => Math.abs(a - b) < 1e-6;
const N1 = COLLECTORS.find((c) => c.id === 'N1').pts;
const BN1 = BRANCHES.find((b) => b.id === 'N1').pts;
const bMainSlice = B_PTS.slice(0, idx(B_PTS, (p) => near(p.x, XS[1]) && near(p.z, SUPPLY.z)) + 1);
export const TRACER_PTS = cat(
  H_DRAIN,
  N1.slice(1),
  TRUNK_PTS.slice(idx(TRUNK_PTS, (p) => near(p.x, XC[1]))),
  A_PTS,
  RIVER_TRACE,
  bMainSlice,
  BN1.slice(0, 2),
  H.supplyIn,
);
TRACER_PTS[H_DRAIN.length].st = 'sewer';
