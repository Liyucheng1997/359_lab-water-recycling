// 全局布局常量（单位：米）。所有建模与水流路径共享这些坐标，保证管道与水流严格对齐。

export const BOUNDS = { x0: -195, x1: 235, z0: -140, z1: 80, depth: -22 };

// 河流（自北 z+ 向南 z- 流动）
export const RIVER = { base: 200, amp: 8, freq: 0.03, hw: 11, bedHw: 8, bedY: -4, waterY: -1.0 };
export const riverX = (z) => RIVER.base + RIVER.amp * Math.sin(z * RIVER.freq);
export const riverWaterHw = RIVER.hw - (RIVER.hw - RIVER.bedHw) * (-RIVER.waterY / -RIVER.bedY);

// 城市路网
export const STREETS = [-150, -105, -60];          // 南北向支路中心 x
export const MAIN_ROAD = { z: 0, w: 10, x0: -195, x1: -36 };
export const RING_N = 56, RING_S = -48;             // 南北环路中心 z
export const CITY_X1 = -40;

// 污水干管（沿主路 z=-2，自西向东坡降）
export const TRUNK = { z: -2, x0: -193, x1: -31, r: 0.9 };
export const yT = (x) => -4 - 3 * (x - TRUNK.x0) / (TRUNK.x1 - TRUNK.x0);

// 污水支管（沿南北向支路，位于路中心 -1.5m）
export const COLL = { dx: -1.5, r: 0.45, y0: -2.4, zN: 50, zS: -46 };
export const collX = (sx) => sx + COLL.dx;
export function collectorY(xc, z) {
  const north = z > TRUNK.z;
  const z0 = north ? COLL.zN : COLL.zS;
  const f = (z - z0) / (TRUNK.z - z0);
  return COLL.y0 + (yT(xc) + 0.45 - COLL.y0) * f;
}

// 给水管网（沿主路 z=3，埋深 1.5m）
export const SUPPLY = { y: -1.5, z: 3, dx: 1.5, r: 0.3, xMain: -37.4 };
export const supX = (sx) => sx + SUPPLY.dx;

// 剖切示范住宅
export const HOUSE = { x0: -129, x1: -115, z0: 17, z1: 27, cx: -122, cz: 22 };

// 水塔
export const TOWER = { x: -34, z: -78, shaftR: 2.5, tankY0: 26 };

// 地表开孔（半地下构筑物，避免地表遮挡）：[x0, x1, z0, z1]
export const GROUND_HOLES = [
  [-31, -21, -7, 3],      // 污水泵站集水井
  [168, 178, -84, -72],   // 取水泵房吸水井
  [10, 44, -92, -64],     // 清水池
];
