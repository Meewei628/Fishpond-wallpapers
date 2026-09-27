
// 碰撞 —— 只认实例上的 `collision` 描述符,不再假设对方是 12 节锦鲤(2026-09-26 第二轮)
//   胶囊(脊柱一段 + 身体半宽):鱼这类长条身体
//   圆:乌龟/螺/漂浮物这类小生物或道具
//   不声明 collision:不参与碰撞(荷花、蜻蜓这种不该被推开的)
// 锦鲤之间的计算与第一轮**逐行一致**(同一套 segSegDist + 8 轮松弛 + 按体量分摊)。
import { capsuleEnds, bodyCenter } from './shape.js';

export function createCollisions({ kois, config }) {
function segSegDist(ax, ay, bx, by, cx, cy, dx, dy) {
    const ux = bx - ax, uy = by - ay;
    const vx = dx - cx, vy = dy - cy;
    const wx = ax - cx, wy = ay - cy;
    const a = ux * ux + uy * uy, b = ux * vx + uy * vy, c = vx * vx + vy * vy;
    const d = ux * wx + uy * wy, e = vx * wx + vy * wy;
    const D = a * c - b * b;
    let sc, tc;
    if (D < 1e-9) { sc = 0; tc = c > 1e-9 ? e / c : 0; }
    else { sc = (b * e - c * d) / D; tc = (a * e - b * d) / D; }
    sc = Math.max(0, Math.min(1, sc));
    tc = Math.max(0, Math.min(1, tc));
    tc = c > 1e-9 ? Math.max(0, Math.min(1, (b * sc + e) / c)) : 0;
    sc = a > 1e-9 ? Math.max(0, Math.min(1, (b * tc - d) / a)) : 0;
    const px = ax + ux * sc, py = ay + uy * sc;
    const qx = cx + vx * tc, qy = cy + vy * tc;
    return { d: Math.hypot(px - qx, py - qy), nx: px - qx, ny: py - qy };
}

/** 点到线段的最近距离(圆 ↔ 胶囊用) */
function pointSegDist(px, py, ax, ay, bx, by) {
    const ux = bx - ax, uy = by - ay;
    const L = ux * ux + uy * uy;
    let t = L > 1e-9 ? ((px - ax) * ux + (py - ay) * uy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + ux * t, qy = ay + uy * t;
    return { d: Math.hypot(px - qx, py - qy), nx: px - qx, ny: py - qy };
}

const COLLIDE_RELAX = 14;      // 收敛速率(1/s)

/**
 * 一对生物的最近距离与法线;任一形状不支持就返回 null。
 * 法线约定:nx/ny 指向 A(与第一轮一致 —— 由 px-qx 得出)。
 */
function contact(A, B) {
    const ca = A.collision, cb = B.collision;
    if (!ca || !cb) return null;
    const ea = capsuleEnds(A), eb = capsuleEnds(B);
    if (ca.shape === 'capsule' && cb.shape === 'capsule') {
        if (!ea || !eb) return null;
        return segSegDist(...ea, ...eb);
    }
    if (ca.shape === 'capsule' && cb.shape === 'circle') {
        if (!ea) return null;
        return pointSegDist(B.x, B.y, ...ea);
    }
    if (ca.shape === 'circle' && cb.shape === 'capsule') {
        if (!eb) return null;
        const r = pointSegDist(A.x, A.y, ...eb);
        return { d: r.d, nx: -r.nx, ny: -r.ny };   // 反过来,法线仍指向 A
    }
    if (ca.shape === 'circle' && cb.shape === 'circle') {
        return { d: Math.hypot(A.x - B.x, A.y - B.y), nx: A.x - B.x, ny: A.y - B.y };
    }
    return null;
}

function resolveFishCollisions(dt) {
    if (kois.length < 2) return;

    const relax = Math.min(1, 1 - Math.exp(-COLLIDE_RELAX * dt));
    // 迭代 8 轮:成对松弛会把 A 推给 C,密集处需要多轮级联才收敛
    for (let iter = 0; iter < 8; iter++)
    for (let i = 0; i < kois.length; i++) {
        const A = kois[i];
        const ca = A.collision;
        if (!ca) continue;
        const ra = ca.r, halfA = ca.half || 0;
        for (let j = i + 1; j < kois.length; j++) {
            const B = kois[j];
            const cb = B.collision;
            if (!cb) continue;

            const reach = (halfA + (cb.half || 0)) * 2 + ra + cb.r;
            const hx = A.x - B.x, hy = A.y - B.y;
            if (hx * hx + hy * hy > reach * reach) continue;

            const res = contact(A, B);
            if (!res) continue;
            let dMin = res.d, nx, ny;
            if (dMin > 1e-4) {
                nx = res.nx / dMin; ny = res.ny / dMin;
            } else {
                // 完全重合:沿双方身体轴线(没有脊柱就用中心点)分开
                const [ax, ay] = bodyCenter(A);
                const [bx, by] = bodyCenter(B);
                let ex = ax - bx, ey = ay - by;
                let el = Math.hypot(ex, ey);
                if (el < 1e-4) { ex = -Math.sin(A.heading || 0); ey = Math.cos(A.heading || 0); el = 1; }
                nx = ex / el; ny = ey / el;
                dMin = 0;
            }
            const overlap = ra + cb.r - dMin;
            if (overlap <= 0) continue;
            const corr = overlap * relax;
            // 按体量分摊:大鱼少动、小鱼多让
            const mA = A.sizeMul, mB = B.sizeMul, ms = mA + mB;
            const wA = mB / ms, wB = mA / ms;

            A.translate( nx * corr * wA,  ny * corr * wA);
            B.translate(-nx * corr * wB, -ny * corr * wB);
        }
    }
}

return { resolveFishCollisions };
}
