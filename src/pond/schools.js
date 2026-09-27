
/* 散鱼比例 —— **模块作用域**(不是工厂内部的常量),这样 types.js 能直接 import 它,
 * 保证"散鱼份额"只有一个来源(工厂返回值里也有同名字段,那是给 behavior/koi-fish 用的)。
 * 0.25 → 0.40(2026-09-27,用户反馈"鱼基本都在固定地方"):群员只是跟着群的轨迹走,
 * 真正全池漫游的是散鱼(它们有独立的"记忆式巡游偏向"),所以把散鱼的份额提上来。 */
export const SOLO_RATIO = 0.40;

export function createSchools({ viewport, config }) {
const TRAIL_STEP = 7;
const TRAIL_MAX = 1250;
const QUEUE_LEN = 900;
const SCHOOL_COUNT  = 3;

const SCHOOL_HOMES = [[0.20, 0.31], [0.80, 0.31], [0.50, 0.70]];

/* ★ home 缓慢漂移(2026-09-27,用户选定方案 A)
 *
 * 问题:三个群的 home 是写死的,而"避边"这一支是【朝 home 转】而不是沿墙走 ——
 * 实测(80 条鱼 / 150 秒 / 1280×800):群0 的质心离 home 只有 15px、活动半径仅池宽 14%,
 * 单条鱼一生只走过 29% 的网格;整池 97% 的覆盖全靠那 24% 的散鱼。观感就是"鱼都在固定地方"。
 *
 * 做法:让 home 绕池心缓慢公转(在归一化坐标里转,屏幕上因此是椭圆轨道)。
 * 保住"三群各占一块"的构图,同时几分钟内把整池走一遍。
 * 速率:一整圈约 15 分钟(≈0.4°/s)—— 太快像行军,太慢看不出变化;
 * 三群转速略有差(1.0/1.15/0.85),相对位置会慢慢演化,不会永远是一张定格构图。
 *
 * 刻意不用 Math.random:漂移要可复现(便于改前改后测量对比);
 * 指纹工具只覆盖"鱼的构造数学",不该被巡游参数搅动。
 */
const HOME_DRIFT_RATE = (Math.PI * 2) / 900;   // rad/s:15 分钟一整圈
const HOME_DRIFT_MUL  = [1.0, 1.15, 0.85];     // 每群的转速倍率

/** 活 home:把写死的 home 偏移绕池心旋转 homePhase。 */
function liveHome(s) {
    const p = s.homePhase || 0;
    const c = Math.cos(p), sn = Math.sin(p);
    const ox = s.homeX - 0.5, oy = s.homeY - 0.5;
    return {
        x: (0.5 + ox * c - oy * sn) * viewport.width,
        y: (0.5 + ox * sn + oy * c) * viewport.height
    };
}

const SCHOOL_PERCEIVE_K   = 0.9;    // 感知半径 = (自身长 + 对方长) * K
const SCHOOL_PERCEIVE_MIN = 70;     // 下限,太小的鱼也要能看见身边的同类
const SEP_W     = 1.8;              // murmur tight-schooling-fish 的三个权重
const ALIGN_W   = 1.4;
const COH_W     = 1.6;
const MAX_STEER = 1.4;              // 整体上限(murmur 是 maxForce 0.15,按本项目的力纲换算)

// (编队跟随取代了"群心锚",LEADER_* 三个常量已不再需要)
// (编队跟随取代了"跟随距离"的做法,这两个常量已不再需要)
const schools = [];
let schoolAssignCounter = 0;   // 轮转分配群号,避免随机分配导致 25/15/21 这种不均衡
function buildSchools() {
    schools.length = 0;
    for (let i = 0; i < SCHOOL_COUNT; i++) {
        // 起点均分在池心周围三个方向,出发朝向沿切线 → 开局就是三群各走各的
        const h = SCHOOL_HOMES[i % SCHOOL_HOMES.length];
        schools.push({
            homeX: h[0], homeY: h[1],
            x: viewport.width * h[0], y: viewport.height * h[1],
            heading: Math.random() * Math.PI * 2,

            formHeading: 0,
            // 正对墙时两个切向等价,用每群固定的一侧来定方向,否则会随机抖
            side: Math.random() < 0.5 ? 1 : -1,

            speed: 0.24 + Math.random() * 0.13,
            turnBias: 0,
            biasTimer: 2 + Math.random() * 3,

            homePhase: 0,                                        // 漂移相位(弧度)
            homeDriftMul: HOME_DRIFT_MUL[i % HOME_DRIFT_MUL.length]
        });
        const s0 = schools[schools.length - 1];

        s0.formHeading = s0.heading;
        s0.trail = [{ x: s0.x, y: s0.y, a: 0 }];   // 路径历史(循迹队列的基础)
        s0.arc = 0;
        s0.arcLive = 0;
        s0.curSpeed = s0.speed;
    }
}

const EDGE_MARGIN = 178;
function edgeUrgency(px, py) {
    const d = Math.min(px, py, viewport.width - px, viewport.height - py);
    if (d >= EDGE_MARGIN) return 0;
    return Math.min(1, (EDGE_MARGIN - d) / EDGE_MARGIN);
}

function edgeNormal(x, y) {
    const dl = x, dr = viewport.width - x, dt2 = y, db = viewport.height - y;
    const m = Math.min(dl, dr, dt2, db);
    if (m > EDGE_MARGIN * 1.5) return null;
    if (m === dl) return { x: 1, y: 0 };
    if (m === dr) return { x: -1, y: 0 };
    if (m === dt2) return { x: 0, y: 1 };
    return { x: 0, y: -1 };
}

function trailPoint(s, back) {
    const T = s.trail;
    const n = T ? T.length : 0;
    if (n < 2) return null;
    const want = (s.arcLive !== undefined ? s.arcLive : s.arc) - back;
    if (want <= T[0].a) {
        const dx = T[1].x - T[0].x, dy = T[1].y - T[0].y;
        const m = Math.hypot(dx, dy) || 1;
        return { x: T[0].x, y: T[0].y, tx: dx / m, ty: dy / m, ok: false };
    }
    for (let i = n - 1; i > 0; i--) {
        if (T[i - 1].a <= want && want <= T[i].a) {
            const seg = Math.max(1e-6, T[i].a - T[i - 1].a);
            const t = (want - T[i - 1].a) / seg;
            const dx = T[i].x - T[i - 1].x, dy = T[i].y - T[i - 1].y;
            const m = Math.hypot(dx, dy) || 1;
            return { x: T[i - 1].x + dx * t, y: T[i - 1].y + dy * t,
                     tx: dx / m, ty: dy / m, ok: true };
        }
    }
    return null;
}

function updateSchools(dt) {
    const dtMult = dt * 60;
    for (let i = 0; i < schools.length; i++) {
        const s = schools[i];
        // home 缓慢公转(见文件头的 HOME_DRIFT_* 注释)
        s.homePhase = (s.homePhase || 0) + HOME_DRIFT_RATE * s.homeDriftMul * dt;
        // 有记忆的巡游偏向:让领头鱼走弧线而不是直线
        s.biasTimer -= dt;
        if (s.biasTimer <= 0) {

            s.turnBias = (Math.random() - 0.5) * 0.0012;
            s.biasTimer = 4 + Math.random() * 7;
        }

        const look = 240 + s.speed * 140;
        const px = s.x + Math.cos(s.heading) * look;
        const py = s.y + Math.sin(s.heading) * look;
        let turn = s.turnBias;
        let turnLimit = 0.012;                      // 正常巡游:保守,走弧线
        const urgent = edgeUrgency(px, py);

        if (urgent <= 0 && s.escapeLock) { s.escapeLock = false; s.side = -s.side; }
        if (urgent > 0) {
            s.escapeLock = true;
            const n = edgeNormal(s.x, s.y);
            if (n) {

                const h = liveHome(s);
                const toH = Math.atan2(h.y - s.y, h.x - s.x);
                const want = toH + s.side * 0.85;
                const delta = Math.atan2(Math.sin(want - s.heading), Math.cos(want - s.heading));
                turn += delta * (0.75 + urgent * 0.85);
                // 只有避边时才放开转向速度,否则平常会转得太贼
                turnLimit = 0.012 + urgent * 0.046;
            }
        }

        s.heading += Math.max(-turnLimit, Math.min(turnLimit, turn));
        // 平滑跟随的队形朝向:头鱼急转时整群跟的是它的路径,不是瞬时朝向
        s.formHeading += Math.atan2(Math.sin(s.heading - s.formHeading), Math.cos(s.heading - s.formHeading)) * Math.min(1, dt * 1.25);

        s.surgePhase = (s.surgePhase || 0) + dt * 0.45;
        const surge = 0.84 + 0.30 * (0.5 + 0.5 * Math.sin(s.surgePhase));
        s.x += Math.cos(s.heading) * s.speed * surge * dtMult;
        s.y += Math.sin(s.heading) * s.speed * surge * dtMult;
        s.curSpeed = s.speed * surge;      // 领头鱼的【实际】速度,群员前馈要用它
        // 记录路径历史:按弧长采样,并裁掉太老的点
        if (!s.trail) { s.trail = [{ x: s.x, y: s.y, a: 0 }]; s.arc = 0; }

        let tail = s.trail[s.trail.length - 1];
        let mv = Math.hypot(s.x - tail.x, s.y - tail.y);
        s.arcLive = tail.a + mv;
        if (mv >= TRAIL_STEP) {
            s.arc += mv;
            s.trail.push({ x: s.x, y: s.y, a: s.arc });
            while (s.trail.length > 2 && s.arc - s.trail[0].a > TRAIL_MAX) s.trail.shift();
            s.arcLive = s.arc;
        }
        s.x = Math.max(20, Math.min(viewport.width  - 20, s.x));
        s.y = Math.max(20, Math.min(viewport.height - 20, s.y));
    }
}

return { schools, buildSchools, updateSchools, trailPoint, QUEUE_LEN, SOLO_RATIO, SCHOOL_COUNT, SCHOOL_PERCEIVE_K, SCHOOL_PERCEIVE_MIN, SEP_W, ALIGN_W, COH_W, MAX_STEER, nextSchool: () => schoolAssignCounter++ % SCHOOL_COUNT };
}
