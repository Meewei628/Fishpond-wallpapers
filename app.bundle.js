(function () {
'use strict';
const __modules = Object.create(null);
__modules["src/app.js"] = function (exports, __require) {
// 组合根:只做装配,不实现任何玩法/生物(2026-09-26 第二轮重构)
//
// 装配顺序(有依赖关系,别调):
//   设置/视图/实体数组 → 注册表(生物/层/输入) → 内置生物与玩法(builtins.js)
//   → 种群(按鱼数补/裁库存鱼) → 模拟 → 宿主适配(浏览器输入/桌面桥/属性)
//   → 渲染器(自己的内建层)→ 帧循环
//
// 对外接口(旧宿主/测试用的就是这一层):
//   start/stop · registerFishType · spawnFish · registerInteraction · setInteraction
//   setFeature · dispose · inspect
const { createFishTypes } = __require("src/pond/types.js");
const { createSettings } = __require("src/core/settings.js");
const { createLoop } = __require("src/core/loop.js");
const { createLayerSet } = __require("src/core/layers.js");
const { createEnvironment } = __require("src/core/environment.js");
const { createFeatureRegistry } = __require("src/core/feature-registry.js");
const { createCreatureRegistry } = __require("src/pond/creature-registry.js");
const { createPopulation } = __require("src/pond/population.js");
const { createSchools } = __require("src/pond/schools.js");
const { createCollisions } = __require("src/pond/collisions.js");
const { createFood } = __require("src/pond/food.js");
const { createSimulation } = __require("src/pond/simulation.js");
const { createFishRenderer } = __require("src/render/fish-renderer.js");
const { createRenderer } = __require("src/render/renderer.js");
const { createRipples } = __require("src/render/ripples.js");
const { createRepository } = __require("src/storage/repository.js");
const { createInputRouter } = __require("src/input/input-router.js");
const { attachBrowserInput } = __require("src/input/browser-input.js");
const { registerBuiltins } = __require("src/builtins.js");
function createPondApp(canvas) {
    const config = createSettings();
    const types = createFishTypes();
    const viewport = { width: innerWidth, height: innerHeight };
    const time = { elapsed: 0 };
    const kois = [], foods = [];
    const mouse = { x: null, y: null, active: false };
    const repository = createRepository();
    const ripples = createRipples({ config, viewport });
    const { spawnRipple } = ripples;
    const schoolSystem = createSchools({ config, viewport });
    schoolSystem.buildSchools();
    for (let i = 0; i < 3600; i++) schoolSystem.updateSchools(1 / 60);
    const { drawFish } = createFishRenderer({ config });
    const { Food } = createFood({});

    // ---- 注册表 ----
    const creatures = createCreatureRegistry({ types });
    const layers = createLayerSet();
    // 环境状态(天气):状态机在这里,预设值在 theme.js,光/色罩由 renderer 每帧读它
    const environment = createEnvironment({ config });
    const router = createInputRouter(mouse);
    // 装配层只准备"能力",不点名任何具体生物/玩法(builtins.js 才是清单)
    const context = { config, viewport, time, kois, foods, mouse, spawnRipple, repository, Food,
        types, creatures, layers, input: router, schoolSystem, drawFish, environment };
    const features = createFeatureRegistry({ context, layers, input: router });
    registerBuiltins({ creatures, features, context });

    // ---- 种群:只有 origin='stock' 的实例受"鱼数"设置管理 ----
    const population = createPopulation({
        list: kois, registry: creatures, config,
        onAfterSync: () => features.get('customFish')?.syncCustomFish?.()
    });
    population.syncStock();
    features.get('fishDebugPanel')?.restoreSaved?.();
    features.get('customFish')?.loadCustomFishFromStore?.();

    const { resolveFishCollisions } = createCollisions({ kois, config });
    const simulation = createSimulation({ kois, foods, schoolSystem, resolveFishCollisions, extraUpdate: features.updater() });
    const cleanup = [attachBrowserInput(router, canvas)];
    const renderer = createRenderer({ canvas, viewport, config, time, kois, foods, ripples, layers, environment });
    const loop = createLoop({
        paused: () => !!window.__koiPaused,
        fpsLimit: () => config.fps,              // 宿主(WE)推来的帧率上限,0 = 不限
        update(dt) {
            time.elapsed += dt;
            simulation.update(dt);
            ripples.update(dt);
        },
        draw: renderer.draw
    });
    return {
        start: loop.start, stop: loop.stop,
        registerFishType: types.register,
        registerCreatureKind: creatures.register,
        spawnFish(typeId = 'koi', opts) { return population.spawn(typeId, opts); },
        registerInteraction: router.register,
        setInteraction: router.setMode,
        registerFeature: features.register,
        setFeature: (name, enabled) => features.setEnabled(name, enabled),
        /**
         * 切天气。config.weather 是**唯一真源**(宿主属性也写它),所以这里必须一并写回 —
         * 否则天气玩法每帧的同步会把直接改环境状态的那次调用覆盖掉(config 还是旧值)。
         */
        setWeather: v => { const i = environment.setWeather(v); config.weather = i; return i; },
        dispose() {
            loop.stop(); renderer.dispose(); features.dispose();
            router.dispose(); cleanup.forEach(fn => fn());
        },
        inspect: () => ({
            config, viewport, time, kois, foods, ripples: ripples.ripples,
            Koi: creatures.exports('koi-fish').Koi, router, schoolSystem, types,
            creatures, features, layers, population, environment,
            counts: population.counts()
        })
    };
}
const app = createPondApp(document.getElementById('wallpaper-canvas'));
const params = new URLSearchParams(location.search);
if (params.has('debug')) window.__pondDebug = app;
// 预览/联调用:index.html?weather=rain|clear —— 宿主里没有这个参数,
// 正式版不出现任何 UI(天气只由宿主属性 config.weather 控制)。它同时是"网页 demo 那一路"的入口。
// ⚠️ 参数写错(例如老的 ?weather=overcast)只警告,不能让整页挂掉 —— 顶部抛异常 = 白屏。
if (params.has('weather')) {
    const v = params.get('weather');
    try { app.setWeather(v); } catch (e) { console.warn('[koi] 未知的 weather 参数,已忽略:', v); }
}
app.start();

Object.assign(exports, { createPondApp, app });
};
__modules["src/pond/types.js"] = function (exports, __require) {
const { KOI_BREEDS } = __require("src/pond/breeds.js");
const { SOLO_RATIO } = __require("src/pond/schools.js");
// Fixed 12-point spine in this renderer. New skeletons require a new renderer/controller.
const KOI_TYPE = {
    id: 'koi', name: '中国淡水鱼', segmentSpacing: 5,
    shape: null, speedMultiplier: 1, turnRadius: 2.5,
    soloRatio: SOLO_RATIO, collisionRadius: 0.115, collisionEnd: 9,
    breeds: KOI_BREEDS
};
function createFishTypes() {
    const types = new Map();
    function register(definition) {
        const d = { ...KOI_TYPE, ...definition };
        if (!/^[a-z][a-z0-9-]*$/.test(d.id) || types.has(d.id)) throw new Error('Invalid or duplicate fish type: ' + d.id);
        for (const key of ['segmentSpacing', 'speedMultiplier', 'turnRadius', 'collisionRadius']) {
            if (!Number.isFinite(d[key]) || d[key] <= 0) throw new Error('Invalid fish parameter: ' + key);
        }
        if (!Number.isFinite(d.soloRatio) || d.soloRatio < 0 || d.soloRatio > 1) throw new Error('Invalid soloRatio');
        if (!Number.isInteger(d.collisionEnd) || d.collisionEnd < 1 || d.collisionEnd > 11) throw new Error('Invalid collisionEnd');
        if (!Array.isArray(d.breeds) || !d.breeds.length || d.breeds.some(b => !b.id || !(b.w > 0))) throw new Error('Invalid breeds');
        if (d.draw !== undefined && typeof d.draw !== 'function') throw new Error('Invalid fish renderer');
        d.shape = d.shape ? Object.freeze({ ...d.shape }) : null;
        d.breeds = Object.freeze(d.breeds.map(b => Object.freeze({ ...b })));
        types.set(d.id, Object.freeze(d));
    }
    register(KOI_TYPE);
    return {
        register,
        get(id) { if (!types.has(id)) throw new Error('Unknown fish type: ' + id); return types.get(id); },
        list: () => [...types.values()]
    };
}

Object.assign(exports, { createFishTypes, KOI_TYPE });
};
__modules["src/pond/breeds.js"] = function (exports, __require) {
// 中国常见淡水鱼。继续沿用既有 breeds 数据入口，避免另建一套生物系统。
// shape 是俯视轮廓倍率；patches 是沿脊柱分布的背部斑纹。
const KOI_BREEDS = [
    {
        id: 'grass-carp', name: '草鱼', w: 0.15, body: '#87906f', size: 1.08,
        net: 0.20, sheen: 0.05, outlineWidth: 0.10,
        shape: { bodyLen: 1.14, bodyH: 0.72, headW: 0.94, tailW: 0.88, tailFin: 0.86, fin: 0.82, eye: 0.82 },
        patches: []
    },
    {
        id: 'crucian-carp', name: '鲫鱼', w: 0.13, body: '#a9aa8b', size: 0.82,
        net: 0.15, sheen: 0.09, outlineWidth: 0.11,
        shape: { bodyLen: 0.90, bodyH: 1.24, headW: 0.88, tailW: 0.82, tailFin: 0.82, fin: 0.88, eye: 0.92 },
        patches: []
    },
    {
        id: 'common-carp', name: '鲤鱼', w: 0.13, body: '#a37b43', size: 1.00,
        net: 0.24, sheen: 0.10, outlineWidth: 0.12,
        shape: { bodyLen: 1.02, bodyH: 1.02, headW: 1.08, tailW: 0.94, tailFin: 0.96, fin: 1.00, eye: 0.86 },
        patches: []
    },
    {
        id: 'silver-carp', name: '鲢鱼', w: 0.11, body: '#c5c9bd', size: 1.04,
        net: 0.08, sheen: 0.15, outlineWidth: 0.08,
        shape: { bodyLen: 1.00, bodyH: 1.04, headW: 1.12, tailW: 0.82, tailFin: 0.88, fin: 0.92, eye: 0.72 },
        patches: []
    },
    {
        id: 'bighead-carp', name: '鳙鱼（花鲢）', w: 0.10, body: '#8e9182', size: 1.08,
        net: 0.06, sheen: 0.05, outlineWidth: 0.10,
        shape: { bodyLen: 0.98, bodyH: 1.12, headW: 1.42, tailW: 0.82, tailFin: 0.88, fin: 0.94, eye: 0.72 },
        patches: [
            { segs: [1, 2], color: '#62685d', pw: 0.42 },
            { segs: [4, 5], color: '#6d7065', pw: 0.56 },
            { segs: [7, 8], color: '#5b625a', pw: 0.38 }
        ]
    },
    {
        id: 'black-carp', name: '青鱼', w: 0.10, body: '#465b59', size: 1.12,
        net: 0.22, sheen: 0.07, outlineWidth: 0.10,
        shape: { bodyLen: 1.15, bodyH: 0.80, headW: 0.98, tailW: 0.92, tailFin: 0.88, fin: 0.84, eye: 0.78 },
        patches: []
    },
    {
        id: 'mandarin-fish', name: '鳜鱼', w: 0.08, body: '#9a8954', size: 0.88,
        net: 0.05, sheen: 0.03, outlineWidth: 0.14,
        shape: { bodyLen: 0.88, bodyH: 1.32, headW: 1.36, tailW: 0.82, tailFin: 1.02, fin: 1.18, eye: 1.12 },
        patches: [
            { segs: [1, 2], color: '#4b4938', pw: 0.62 },
            { segs: [4, 5], color: '#5a5034', pw: 0.52 },
            { segs: [7], color: '#403f34', pw: 0.46 }
        ]
    },
    {
        id: 'snakehead', name: '乌鳢（黑鱼）', w: 0.08, body: '#4c5542', size: 0.96,
        net: 0.03, sheen: 0.02, outlineWidth: 0.12,
        shape: { bodyLen: 1.22, bodyH: 0.62, headW: 1.22, tailW: 0.88, tailFin: 0.66, fin: 0.64, eye: 0.76 },
        patches: [
            { segs: [1], color: '#252d28', pw: 0.62 },
            { segs: [3], color: '#31362d', pw: 0.68 },
            { segs: [5], color: '#242c27', pw: 0.64 },
            { segs: [7], color: '#30372d', pw: 0.58 },
            { segs: [9], color: '#222a26', pw: 0.48 }
        ]
    },
    {
        id: 'yellow-catfish', name: '黄颡鱼', w: 0.06, body: '#b99a45', size: 0.75,
        net: 0, sheen: 0.04, outlineWidth: 0.13,
        shape: { bodyLen: 1.08, bodyH: 0.70, headW: 1.38, tailW: 0.72, tailFin: 0.74, fin: 1.18, eye: 0.86 },
        patches: [
            { segs: [1, 2], color: '#5f562f', pw: 0.58 },
            { segs: [5, 6], color: '#625833', pw: 0.50 }
        ]
    },
    {
        id: 'wuchang-bream', name: '武昌鱼（团头鲂）', w: 0.06, body: '#8f9b8d', size: 0.85,
        net: 0.12, sheen: 0.08, outlineWidth: 0.10,
        shape: { bodyLen: 0.78, bodyH: 1.58, headW: 0.78, tailW: 0.72, tailFin: 0.86, fin: 0.90, eye: 0.92 },
        patches: [
            { segs: [3], color: '#68766c', pw: 0.60 },
            { segs: [5], color: '#647268', pw: 0.62 },
            { segs: [7], color: '#607067', pw: 0.56 }
        ]
    }
];

Object.assign(exports, { KOI_BREEDS });
};
__modules["src/pond/schools.js"] = function (exports, __require) {

/* 散鱼比例 —— **模块作用域**(不是工厂内部的常量),这样 types.js 能直接 import 它,
 * 保证"散鱼份额"只有一个来源(工厂返回值里也有同名字段,那是给 behavior/koi-fish 用的)。
 * 0.25 → 0.40(2026-09-27,用户反馈"鱼基本都在固定地方"):群员只是跟着群的轨迹走,
 * 真正全池漫游的是散鱼(它们有独立的"记忆式巡游偏向"),所以把散鱼的份额提上来。 */
const SOLO_RATIO = 0.40;
function createSchools({ viewport, config }) {
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

Object.assign(exports, { createSchools, SOLO_RATIO });
};
__modules["src/core/settings.js"] = function (exports, __require) {
const DEFAULT_SETTINGS = {
    // 独立网页版使用这里的默认值。
    // 被改成 0 的那次,页面上就只剩一个空池塘(宿主会推值 ≠ 默认值可以随便设)。
    // 普通库存鱼保持关闭；首次打开程序时由“我的鱼”面板生成初始鱼。
    fishCount: 0,
    // 首次自动生成鱼时，复用已有颜色的概率(0~1)。
    initialSameColorProbability: 0.28,

    useGpuCaustics: true,
    useGpuRipples: true,
    waterHue: 195,
    fishSpeed: 1.5,
    // 平面运动调试参数：1.0 为原始运动表现。
    motionTurnRadius: 1.0,
    motionTurnResponse: 1.0,
    motionCruiseCurve: 1.0,

    enableCaustics: true,
    enableFeeding: true,
    shyFish: true,
    fishSize: 2.2,
    rippleStrength: 0.7,

    // 天气(2026-09-26):0=晴 1=雨(阴天已按用户决定摘掉)。**数字下标**——
    // WPE 的 combo 与 Lively 的 dropdown 都只给数字,不是字符串。
    // 默认 0 = 与今天逐帧一致(见 core/environment.js 的注释)。
    weather: 0,

    // 自持事件(2026-09-26):无人值守时的落叶与花瓣。默认开 ——
    // 它不影响任何既有行为(自己的随机流、自己的涟漪池),只往 weather 层多画几件东西。
    idleEvents: true,

    // 光的时段(2026-09-26):让天色/光向跟着现实时间走。**默认开**(用户定)——
    // 它和池里那行时钟自洽(时钟 22:07,水面就真是夜里的样子);不喜欢的人在宿主面板关掉即可。
    dayCycle: true,
    // 帧率上限(0 = 不限)。由宿主推来:WE 走 applyGeneralProperties({fps}),见 core/loop.js 与 platform/properties.js。
    fps: 0,
    // 夜间暗度倍率(0~1.3,1.0 = 现在这版观感)。夜里太暗是这功能最大的口味分歧点,给一根细旋钮。
    nightDim: 1.0
};
function createSettings() { return { ...DEFAULT_SETTINGS }; }

Object.assign(exports, { createSettings, DEFAULT_SETTINGS });
};
__modules["src/core/loop.js"] = function (exports, __require) {
/**
 * 帧循环。
 *
 * ★ fpsLimit:Wallpaper Engine 把**用户设的帧率上限**通过 `applyGeneralProperties` 推给壁纸,
 *   并要求【壁纸自己遵守】([官方 FPS Limiter](https://docs.wallpaperengine.io/en/web/performance/fps.html))。
 *   不遵守 = 按显示器刷新率全速跑 —— 耗电、GPU 占用都高,而且"宿主 30fps"这个结论根本不成立。
 *
 * 两个容易写错的点:
 *   ① **dt 必须按"距上一次真正绘制"的真实时间给模拟**:若按 rAF 间隔给,跳帧后鱼会走得比实际慢一半;
 *   ② 第一帧 last=0,若直接拿它算 elapsed=0 → 带上限时会永远跳过(第一帧必须直接画)。
 */
function createLoop({ update, draw, paused = () => false, fpsLimit = () => 0 }) {
    let request = null, last = 0, running = false;
    function tick(now) {
        if (!running) return;
        if (!last) {                                   // 第一帧:直接画
            last = now;
            if (!paused()) { update(0); draw(); }
            request = requestAnimationFrame(tick);
            return;
        }
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        const limit = Math.max(0, Number(fpsLimit()) || 0);
        if (limit > 0 && dt < 1 / limit) {             // 还没到下一帧:跳过绘制,但 last 不动(下次用累计时间)
            request = requestAnimationFrame(tick);
            return;
        }
        last = now;                                    // 只有"真的画了一帧"才推进基准
        if (!paused()) { update(dt); draw(); }
        if (running) request = requestAnimationFrame(tick);
    }
    return {
        start() { if (running) return; running = true; last = 0; request = requestAnimationFrame(tick); },
        stop() { running = false; if (request !== null) cancelAnimationFrame(request); request = null; last = 0; }
    };
}

Object.assign(exports, { createLoop });
};
__modules["src/core/layers.js"] = function (exports, __require) {
// 绘制层次表 —— 全项目**唯一**的绘制顺序定义(2026-09-26 第二轮重构)
//
// 为什么要有这张表:第一轮把渲染拆成了模块,但顺序还写死在 renderer.draw() 里:
//   池底 → 时钟 → 食物 → 鱼(按深度排序)→ 水面 → 光感 → 远场调色 → 涟漪 → 界面
// 于是"加一个新玩法"(雨、荷花、环境声可视化…)**必须去改 renderer.js**,顺序一改就可能
// 影响所有既有层。现在顺序在这张表里,玩法只能往已有的层里"投稿",不能自己插队。
//
// target:under = 画在 underCanvas 上(会经过水面位移/折射),main = 画在主画布上
//
// ⚠️ 层的**相对顺序**属于用户可见行为(曾经逐版调过),不要为了新功能随意调换;
//    真需要新层时,在表里挑一个语义位置加(并同步 docs/architecture.md)。
const LAYERS = Object.freeze([
    { id: 'floor',     target: 'under', desc: '池底与水底纹理' },
    { id: 'hud',       target: 'under', desc: '时钟/字幕这类"沉在水下"的界面层' },
    { id: 'food',      target: 'under', desc: '饲料' },
    { id: 'creatures', target: 'under', desc: '鱼与其他生物(按 depth 排序)' },
    { id: 'surface',   target: 'main',  desc: '水面位移与折射' },
    { id: 'light',     target: 'main',  desc: '焦散/光感' },
    { id: 'farTint',   target: 'main',  desc: '远场调色(把远处压暗)' },
    { id: 'weather',   target: 'main',  desc: '天气(雨/落叶/花瓣)这类前景粒子' },
    { id: 'ripples',   target: 'main',  desc: '鼠标涟漪' },
    { id: 'ui',        target: 'main',  desc: '界面覆盖层(名字、入口按钮)' }
]);

const LAYER_IDS = new Set(LAYERS.map(l => l.id));
const TARGETS = new Set(['under', 'main']);
function createLayerSet() {
    const lists = new Map(LAYERS.map(l => [l.id, []]));
    function add(layerId, draw) {
        if (!lists.has(layerId)) throw new Error('Unknown draw layer: ' + layerId);
        if (typeof draw !== 'function') throw new Error('Layer draw must be a function');
        lists.get(layerId).push(draw);
        return () => {
            const list = lists.get(layerId);
            const i = list.indexOf(draw);
            if (i >= 0) list.splice(i, 1);
        };
    }
    return {
        add,
        /** 按固定顺序遍历某一层(renderer 每帧调用) */
        draw(layerId, ctx) {
            const list = lists.get(layerId);
            if (!list) throw new Error('Unknown draw layer: ' + layerId);
            for (let i = 0; i < list.length; i++) list[i](ctx);
        },
        count: layerId => (lists.get(layerId) || []).length,
        layerIds: () => [...LAYER_IDS],
        /** 自检用:所有层都在表里、target 合法 */
        inspect: () => LAYERS.map(l => ({ ...l, contributors: lists.get(l.id).length }))
    };
}
function isLayerId(id) { return LAYER_IDS.has(id); }
function isLayerTarget(t) { return TARGETS.has(t); }

Object.assign(exports, { createLayerSet, isLayerId, isLayerTarget, LAYERS });
};
__modules["src/core/environment.js"] = function (exports, __require) {
const { THEME } = __require("src/shared/legacy-assets.js");
const { mixHex, mulberry32 } = __require("src/shared/math.js");
/**
 * 环境状态(2026-09-26):天气是**观感**,不是玩法。
 *
 * 分工:
 *   · 这里只管"当前环境是什么、正在怎么变过去"(状态 + 过渡 + 随机流)
 *   · 预设值在 theme.js(视觉唯一真源);光感与色罩的施加在 render/renderer.js;
 *     雨滴的生成与绘制在 features/weather.js(它向 weather 层投稿)
 *
 * 三条刻意的约束(都是"不要冲突"的落点):
 *   ① **默认晴 = 与今天逐帧一致**:clear 预设 causticAlpha 1、色罩 alpha 0;不开天气时
 *      这条链路等于没接(见 tools/test-modules.mjs 的 "天气默认不影响画面")。
 *   ② **过渡插值的是数值,不是下标**:在两个预设之间按秒 lerp(颜色按 RGB 混),
 *      所以以后加"大雨/雪"只加预设,不用改状态机;0→2 会自然经过 1(晴→阴→雨)。
 *   ③ **独立随机流**:天气绝不碰共享的 Math.random —— 否则开关一次天气,
 *      鱼的随机序列就会变(观感莫名不同、同种子指纹失去复现性)。这里用固定种子的
 *      mulberry32:连雨点的分布都是可复现的,截图/测试才有意义。
 */
function createEnvironment({ config, transition, seed = 0x9e3779b9 } = {}) {
    const T = THEME.weather || { order: ['clear'], transition: 3.5, rainFade: 1, clear: { causticAlpha: 1, grade: '#000000', gradeAlpha: 0, rain: null } };
    const order = T.order;
    const presetOf = i => T[order[Math.max(0, Math.min(order.length - 1, i))]] || T.clear;

    /* ---------- 时段通道(2026-09-26)----------
     * "光随时间走"由 features/day-cycle.js 每帧写进来。它存的全是**相对量**(乘数/压暗比例),
     * 由这里与天气合成后再提交给 renderer —— 于是【renderer 一行都不用改】,
     * 而且"夜里下雨"这类组合天然成立(两道 multiply 会精确合成成一道,见 composeGrade)。 */
    const NEUTRAL_DAY = Object.freeze({ causticMul: 1, dim: 0, grade: '#ffffff', lm: 1 });
    let day = NEUTRAL_DAY;
    function setDayPhase(next) {
        if (!next) { day = NEUTRAL_DAY; return day; }
        day = {
            causticMul: Number.isFinite(next.causticMul) ? next.causticMul : 1,
            dim: Number.isFinite(next.dim) ? next.dim : 0,
            grade: typeof next.grade === 'string' ? next.grade : '#ffffff',
            lm: Number.isFinite(next.lm) ? next.lm : 1
        };
        return day;
    }

    let index = Number(config?.weather) || 0;      // 当前(过渡中的)位置,可以是小数
    let target = index;                            // 目标下标(整数)
    let rainAmount = presetOf(target).rain ? 1 : 0; // 雨量 0~1(自己一条淡入淡出曲线)
    let clock = 0;

    /* 独立随机流:复用 shared/math 的 mulberry32 + 固定种子 → 雨点分布可复现 */
    const rng = mulberry32(seed);
    const range = (a, b) => a + rng() * (b - a);

    function setWeather(next) {
        let i = typeof next === 'string' ? order.indexOf(next) : Number(next);
        if (!Number.isFinite(i) || i < 0) i = 0;
        if (typeof next === 'string' && i < 0) throw new Error('Unknown weather: ' + next);
        target = Math.max(0, Math.min(order.length - 1, Math.round(i)));
        return target;
    }

    function update(dt) {
        if (!(dt > 0)) return;
        clock += dt;
        const trans = transition ?? T.transition ?? 3.5;
        const step = dt / Math.max(0.001, trans);
        if (index < target) index = Math.min(target, index + step);
        else if (index > target) index = Math.max(target, index - step);
        const wantRain = presetOf(target).rain ? 1 : 0;
        const rStep = dt / Math.max(0.001, T.rainFade ?? 1.1);
        if (rainAmount < wantRain) rainAmount = Math.min(wantRain, rainAmount + rStep);
        else if (rainAmount > wantRain) rainAmount = Math.max(wantRain, rainAmount - rStep);
    }

    /** 当前生效的数值(在两个预设之间插值) */
    function lerped() {
        const i0 = Math.floor(index), i1 = Math.min(order.length - 1, i0 + 1), f = index - i0;
        const a = presetOf(i0), b = presetOf(i1);
        return {
            causticAlpha: a.causticAlpha + (b.causticAlpha - a.causticAlpha) * f,
            grade: f <= 0 ? a.grade : mixHex(a.grade, b.grade, f),
            gradeAlpha: a.gradeAlpha + (b.gradeAlpha - a.gradeAlpha) * f,
            rain: presetOf(target).rain
        };
    }

    /* 两道 multiply 色罩合成成【一道】——renderer 只画一次,所以必须精确合成,不能各画一次
     * (各画一次 = 两次全屏合成;而且"谁把画面压暗了"就说不清了)。
     *   单道 multiply 的等效系数  f = (1-a) + a·c       (逐通道)
     *   两道叠加            ⇒ f = f_w × f_d
     *   反解一个 {color, alpha}:取 a' = 1-(1-a_w)(1-a_d)(两道的不透明度合成),
     *   则 c' = (f - (1-a')) / a'。
     * a_w=0(晴天)或 a_d=0(正午)时精确退化成另一道 ⇒ "晴 + 正午"与今天逐帧一致。 */
    const hex2rgb = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    const rgb2hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
    function composeGrade(aw, cw, ad, cd) {
        if (aw <= 0.001 && ad <= 0.001) return { color: '#ffffff', alpha: 0 };
        const A = hex2rgb(cw), D = hex2rgb(cd);
        const f = [0, 1, 2].map(i => ((1 - aw) + aw * A[i]) * ((1 - ad) + ad * D[i]));
        const a = 1 - (1 - aw) * (1 - ad);
        if (a <= 0.001) return { color: '#ffffff', alpha: 0 };
        const c = f.map(v => (v - (1 - a)) / a);
        return { color: rgb2hex(c), alpha: a };
    }

    /**
     * 返回"当前该有多少条雨丝在场"(不是"这一帧生成几个")——
     * 雨丝的生命由它自己的下落决定,所以维持数量比发射速率更好控:
     * perSec 在这里的含义是"满雨时的在场条数",由雨的淡入淡出按比例缩放。
     */
    function rainSpawnCount() {
        const r = presetOf(target).rain;
        if (!r || !r.streak || rainAmount <= 0) return 0;
        return Math.round((r.streak.perSec || 0) * rainAmount);
    }

    return {
        setWeather,
        update,
        get name() { return order[Math.round(target)]; },
        get index() { return index; },
        get targetIndex() { return target; },
        get settled() { return Math.abs(index - target) < 1e-3; },
        get rainAmount() { return rainAmount; },
        setDayPhase,
        /** 光感总量 = 天气衰减 × 时段光感乘数 × 时段整层乘数(三者都是"光还剩多少",合成成一次乘法) */
        get causticAlpha() { return lerped().causticAlpha * day.causticMul * day.lm; },
        /** 天气色罩 × 时段色罩 → 精确合成一道(见 composeGrade) */
        get grade() { return composeGrade(lerped().gradeAlpha, lerped().grade, day.dim, day.grade); },
        get dayPhase() { return day; },
        rainSpawnCount,
        rng, range,
        inspect: () => ({ name: order[Math.round(target)], index, target, rainAmount, settled: Math.abs(index - target) < 1e-3,
                          causticAlpha: lerped().causticAlpha * day.causticMul * day.lm,
                          grade: composeGrade(lerped().gradeAlpha, lerped().grade, day.dim, day.grade).color,
                          gradeAlpha: composeGrade(lerped().gradeAlpha, lerped().grade, day.dim, day.grade).alpha,
                          weatherCausticAlpha: lerped().causticAlpha,
                          day: { ...day },
                          clock, order: [...order] })
    };
}

Object.assign(exports, { createEnvironment });
};
__modules["src/shared/legacy-assets.js"] = function (exports, __require) {
const { THEME, KOI_SHAPE, WaterGL } = globalThis.KoiShared;

Object.assign(exports, { THEME, KOI_SHAPE, WaterGL });
};
__modules["src/shared/math.js"] = function (exports, __require) {
function smooth01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function shadeColor(hex, amt) {
    let n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}
function varyHexColor(hex, amt) {
    let n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    const part = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return '#' + part(r) + part(g) + part(b);
}
function hexRgba(hex, alpha) {
    let n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}
// 画面统一从左上打光。所有物体的明暗都要沿它,不能各自为政
// 视觉常量一律从 theme.js 取(唯一真源,见那里的注释)
function mixHex(a, b, t) {
    let na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    let r = Math.round(((na >> 16) & 255) + ((((nb >> 16) & 255) - ((na >> 16) & 255)) * t));
    let g = Math.round(((na >> 8) & 255) + ((((nb >> 8) & 255) - ((na >> 8) & 255)) * t));
    let bl = Math.round((na & 255) + (((nb & 255) - (na & 255)) * t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
function traceSmooth(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
        let mx = (pts[i][0] + pts[i + 1][0]) / 2;
        let my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    let last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
}
function distanceSq(a, b) {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return dx * dx + dy * dy;
}
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

Object.assign(exports, { smooth01, shadeColor, varyHexColor, hexRgba, mixHex, traceSmooth, distanceSq, mulberry32 });
};
__modules["src/core/feature-registry.js"] = function (exports, __require) {
// 玩法(特征)注册表 —— 让"加一个玩法"= 加一个文件 + 在 builtins 注册一行(2026-09-26 第二轮)
//
// 第一轮的 app.js 里,玩法是写死的 if/else:
//   setFeature(name){ if(name==='clock')… else if(name==='feeding')… else throw }
// 而且玩法要自己往 renderer 里塞回调(drawClock/drawOverlay)、自己往输入路由注册动作、
// 自己在 dispose 里被一个个点名 —— 加一个玩法要改四处(app/渲染器/销毁/文档)。
//
// 现在玩法声明自己需要什么,装配层照着接:
//
//   features.register({ id: 'rain', create(ctx) { return {
//       setEnabled(on) {},            // 可选:开关(不实现则只记录状态)
//       update(dt) {},                // 可选:每帧模拟(跑在碰撞之前)
//       layers: { weather: draw },    // 可选:往层表投稿(层 id 见 core/layers.js)
//       interactions: { dig: fn },    // 可选:占一个输入模式(由 input-router 管理)
//       dispose() {}                  // 可选:释放监听/定时器
//   };}});
//
// 约束(刻意的):
//   - 禁用特征**不会**注销它的层与输入模式(与第一轮语义一致:setFeature('feeding',false) 只是
//     让 feedAt 不撒料,不摘掉输入模式;要彻底摘掉用 register() 返回的注销函数)。
//   - 层与输入模式在 create 时一次性接好;玩法内部想动态开关,自己在 draw/回调里判断。
function createFeatureRegistry({ context, layers, input }) {
    const features = new Map();

    function register({ id, create, enabled = true, title }) {
        if (!/^[a-zA-Z][\w-]*$/.test(String(id || ''))) throw new Error('Invalid feature id: ' + id);
        if (features.has(id)) throw new Error('Duplicate feature: ' + id);
        if (typeof create !== 'function') throw new Error('Feature needs a create(ctx): ' + id);
        const instance = create(context) || {};
        const detach = [];
        if (instance.layers) {
            for (const [layerId, draw] of Object.entries(instance.layers)) detach.push(layers.add(layerId, draw));
        }
        if (instance.interactions) {
            for (const [name, handler] of Object.entries(instance.interactions)) detach.push(input.register(name, handler));
        }
        const entry = { id, title: title || id, instance, enabled: enabled !== false, detach };
        features.set(id, entry);
        if (typeof instance.setEnabled === 'function') instance.setEnabled(entry.enabled);
        return () => unregister(id);
    }

    function unregister(id) {
        const entry = features.get(id);
        if (!entry) return false;
        entry.detach.forEach(fn => fn());
        entry.instance.dispose?.();
        features.delete(id);
        return true;
    }

    function setEnabled(id, on) {
        const entry = features.get(id);
        if (!entry) throw new Error('Unknown feature: ' + id);
        entry.enabled = !!on;
        entry.instance.setEnabled?.(entry.enabled);
    }
    function get(id) { return features.get(id)?.instance; }
    function isEnabled(id) { const e = features.get(id); if (!e) return false; return e.enabled; }

    /**
     * 每帧模拟:返回**一个**函数,运行时才筛"启用且实现了 update"的特征
     * (注册顺序即执行顺序)。刻意不返回数组快照 —— 那样注册之后再 setEnabled 就失效了。
     */
    function updater() {
        return dt => {
            for (const e of features.values()) {
                // 启用中的玩法照常跑;禁用中的玩法若声明了 settleWhileDisabled,也要跑完收尾 ——
                // 否则"关掉天气"会把已经下出来的雨**冻在半空**(它有东西要落完/颜色要过渡回中性)
                const active = e.enabled || e.instance.settleWhileDisabled === true;
                if (active && typeof e.instance.update === 'function') e.instance.update(dt);
            }
        };
    }

    function dispose() { [...features.keys()].forEach(unregister); }

    return {
        register, unregister, setEnabled, get, isEnabled, updater, dispose,
        has: id => features.has(id),
        list: () => [...features.keys()],
        inspect: () => [...features.values()].map(e => ({ id: e.id, enabled: e.enabled }))
    };
}

Object.assign(exports, { createFeatureRegistry });
};
__modules["src/pond/creature-registry.js"] = function (exports, __require) {
// 生物注册表 —— 「鱼种(数据)」与「生物(实体类)」分开(2026-09-26 第二轮重构)
//
// 第一轮只有一种实体:`Koi` 类。`registerFishType()` 能注册的只是**同一套身体**的参数
// (骨架间距/体型倍率/速度/转向/碰撞半径/花纹),所以文档里只能写"乌龟/青蛙需要新实体或控制器,
// 不能仅靠数据实现" —— 也就是说"加一种新生物"必须去改 app.js / fish.js。
//
// 现在:鱼种用 `creature: '<kind>'` 声明自己用哪套**身体与控制器**(默认 'koi-fish'),
// 新生物 = 写一个自己的 kind 文件 + 在 builtins 里注册一行,核心文件一行不用改。
//
// 实例契约(注册时校验,见 docs/extending.md):
//   update(dt)          每帧推进(必需)
//   draw(ctx)           在 creatures 层画自己,按 depth 排序(必需)
//   depth               0~1,越大越靠前(必需)
//   translate(dx, dy)   被碰撞推开时整体位移(有碰撞就必须有)
//   collision           null | { shape:'capsule', half, r, end } | { shape:'circle', r }
//   dispose?()          释放自己的监听/定时器
function createCreatureRegistry({ types }) {
    const kinds = new Map();

    function register({ id, create, title, exports = {} }) {
        if (!/^[a-z][a-z0-9-]*$/.test(String(id || ''))) throw new Error('Invalid creature kind id: ' + id);
        if (kinds.has(id)) throw new Error('Duplicate creature kind: ' + id);
        if (typeof create !== 'function') throw new Error('Creature kind needs a create(): ' + id);
        kinds.set(id, Object.freeze({ id, title: title || id, create, exports: Object.freeze({ ...exports }) }));
        return () => kinds.delete(id);
    }

    /** 按鱼种生成一只生物:鱼种决定参数,kind 决定身体 */
    function spawn(typeId, opts = {}) {
        const type = types.get(typeId);
        const kindId = type.creature || 'koi-fish';
        const kind = kinds.get(kindId);
        if (!kind) throw new Error(`Fish type "${typeId}" needs creature kind "${kindId}" — register it first`);
        const creature = kind.create(type, opts);
        if (!creature || typeof creature.update !== 'function' || typeof creature.draw !== 'function') {
            throw new Error(`Creature kind "${kindId}" must return an object with update(dt) and draw(ctx)`);
        }
        if (!Number.isFinite(creature.depth)) throw new Error(`Creature kind "${kindId}" must set a numeric depth`);
        if (creature.collision && typeof creature.translate !== 'function') {
            throw new Error(`Creature kind "${kindId}" declares collision but has no translate(dx, dy)`);
        }
        return creature;
    }

    return {
        register,
        spawn,
        has: id => kinds.has(id),
        /** kind 带出来的额外导出(例如锦鲤把 Koi 类给"自定义鱼"继承用) */
        exports: id => kinds.get(id)?.exports || {},
        kindOf: typeId => types.get(typeId).creature || 'koi-fish',
        list: () => [...kinds.keys()]
    };
}

Object.assign(exports, { createCreatureRegistry });
};
__modules["src/pond/population.js"] = function (exports, __require) {
// 种群管理 —— 谁的鱼数受设置控制,谁的鱼不被动(2026-09-26 第二轮重构)
//
// 第一轮的 syncKois() 用 `!f.custom` 反推"这是库存锦鲤",于是:
//   ① 任何通过 spawnFish() 投放的新生物都会被当成库存,鱼数一调就被裁掉(静默消失)
//   ② 库存鱼永远是锦鲤 —— 想"默认一池里混几只别的生物"没有入口
// 现在用实例上的 `origin` 显式区分:
//   'stock'   受 config.fishCount 管理(数量不足就补、超了就裁)
//   'spawned' 手动投放的,种群系统不碰
//   'custom'  用户捏的鱼(由 features/custom-fish.js 自己管)
function createPopulation({ list, registry, config, stockTypeId = 'koi', onAfterSync = () => {} }) {
    function spawnStock() {
        const creature = registry.spawn(stockTypeId, { origin: 'stock' });
        creature.origin = 'stock';
        return creature;
    }
    function syncStock() {
        const stock = list.filter(e => e.origin === 'stock');
        while (stock.length < config.fishCount) stock.push(spawnStock());
        stock.length = Math.min(stock.length, config.fishCount);
        const others = list.filter(e => e.origin !== 'stock');
        list.splice(0, list.length, ...stock, ...others);
        onAfterSync();
    }
    /** 手动投放(不受鱼数设置影响;origin 默认 'spawned') */
    function spawn(typeId, opts = {}) {
        const creature = registry.spawn(typeId, { origin: opts.origin || 'spawned', ...opts });
        list.push(creature);
        return creature;
    }
    function countBy(origin) { return list.filter(e => e.origin === origin).length; }
    return { syncStock, spawn, countBy, counts: () => ({ stock: countBy('stock'), spawned: countBy('spawned'), custom: countBy('custom'), total: list.length }) };
}

Object.assign(exports, { createPopulation });
};
__modules["src/pond/collisions.js"] = function (exports, __require) {

// 碰撞 —— 只认实例上的 `collision` 描述符,不再假设对方是 12 节锦鲤(2026-09-26 第二轮)
//   胶囊(脊柱一段 + 身体半宽):鱼这类长条身体
//   圆:乌龟/螺/漂浮物这类小生物或道具
//   不声明 collision:不参与碰撞(荷花、蜻蜓这种不该被推开的)
// 锦鲤之间的计算与第一轮**逐行一致**(同一套 segSegDist + 8 轮松弛 + 按体量分摊)。
const { capsuleEnds, bodyCenter } = __require("src/pond/shape.js");
function createCollisions({ kois, config }) {
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

Object.assign(exports, { createCollisions });
};
__modules["src/pond/shape.js"] = function (exports, __require) {
// 形状工具 —— 生物的碰撞几何集中在这里(2026-09-26 第二轮)
// 生物实例只需要给出 `collision` 描述符;几何解释(脊柱取哪几节、圆在哪)由这里统一。

/**
 * 胶囊两端四点 [ax, ay, bx, by](脊柱第 0 节 → 第 collision.end 节)。
 * 不是胶囊、或没有对应的脊柱节点 → null(调用方负责跳过,不要在这里抛)。
 */
function capsuleEnds(c) {
    const col = c && c.collision;
    if (!col || col.shape !== 'capsule') return null;
    const S = c.segments;
    const end = col.end;
    if (!Array.isArray(S) || !S[0] || !S[end]) return null;
    return [S[0].x, S[0].y, S[end].x, S[end].y];
}

/** 生物中心(有脊柱取脊柱中点,否则取 x/y)—— 完全重合时的兜底分离方向要用 */
function bodyCenter(c) {
    const e = capsuleEnds(c);
    if (e) return [(e[0] + e[2]) * 0.5, (e[1] + e[3]) * 0.5];
    return [c.x, c.y];
}

Object.assign(exports, { capsuleEnds, bodyCenter });
};
__modules["src/pond/food.js"] = function (exports, __require) {
function createFood({  }) {
const PELLET_SPRITES = [];
(function buildPelletSprites() {
    const S = 32;
    for (let v = 0; v < 5; v++) {
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        // 四个角各自抖动 → 不规则四边形
        const pad = 5.5 + Math.random() * 3.5;
        const jit = () => (Math.random() - 0.5) * 7;
        const pts = [
            [pad + jit(), pad + jit()],
            [S - pad + jit(), pad + jit()],
            [S - pad + jit(), S - pad + jit()],
            [pad + jit(), S - pad + jit()]
        ];
        // 浅棕:左上来光 → 右下略暗
        const grd = g.createLinearGradient(0, 0, S, S);
        grd.addColorStop(0.00, '#cfb089');
        grd.addColorStop(0.55, '#b8946a');
        grd.addColorStop(1.00, '#9c7952');
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fillStyle = grd;
        g.fill();
        // 同色描一圈圆角:把四角的尖磨掉,读起来是"颗粒"而不是"色块"
        g.lineJoin = 'round';
        g.lineWidth = 3.4;
        g.strokeStyle = grd;
        g.stroke();
        // 一点高光,别太平
        g.beginPath();
        g.ellipse(S * 0.38, S * 0.33, S * 0.13, S * 0.085, -0.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(244,232,212,0.45)';
        g.fill();
        PELLET_SPRITES.push(c);
    }
})();

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1.9 + Math.random() * 1.4;   // 一小把里颗粒有大有小
        this.sprite = PELLET_SPRITES[(Math.random() * PELLET_SPRITES.length) | 0];
        this.spin = Math.random() * Math.PI * 2;   // 每粒自己的朝向
        this.life = 1000;
        this.pop = 1;                              // 落水弹一下

        this.sink = 0;
        this.sinkRate = 0.10 + Math.random() * 0.08;
        const a = Math.random() * Math.PI * 2;
        this.dvx = Math.cos(a) * (0.10 + Math.random() * 0.18);   // 各粒漂移方向不同
        this.dvy = Math.sin(a) * (0.06 + Math.random() * 0.12);
        this.swirl = Math.random() * Math.PI * 2;                 // 回旋相位
    }
    update(dt) {
        let dtMult = dt * 60;
        this.life -= 1 * dtMult;
        if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 4.5);
        if (this.sink < 1) {
            this.sink = Math.min(1, this.sink + dt * this.sinkRate);
            // 水流漂移 + 一点回旋,像悬浮在水里而不是钉在原地
            this.swirl += dt * 0.6;
            this.x += (this.dvx + Math.cos(this.swirl) * 0.06) * dtMult;
            this.y += (this.dvy + Math.sin(this.swirl * 0.8) * 0.05) * dtMult;
        }
    }
    draw(ctx) {
        // 快没了就缩一下,不要"啪"地消失
        let fade = this.life < 90 ? Math.max(0, this.life / 90) : 1;
        let deep = this.sink;

        let d = this.radius * 2.0 * (1 + this.pop * 0.55) * (0.55 + 0.45 * fade) * (1 - deep * 0.30);
        // 越沉越淡(水把它吸收掉了),但不至于消失 —— 沉到底的饵鱼也能看见
        ctx.save();
        ctx.globalAlpha = fade * (1 - deep * 0.55);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.drawImage(this.sprite, -d / 2, -d / 2, d, d);
        ctx.restore();
    }
}

return { Food };
}

Object.assign(exports, { createFood });
};
__modules["src/pond/simulation.js"] = function (exports, __require) {
// 模拟顺序 —— 群路径 → 食物 → 生物行为/运动 → 玩法 → 碰撞
// (2026-09-26 第二轮:顺序不变,只把"实体必须是锦鲤"换成"实体有 update(dt)";
//  玩法自己的每帧模拟通过 extraUpdaters 注入,排在碰撞之前 —— 与第一轮 fish.update 之后、
//  resolveFishCollisions 之前的位置一致。)
function createSimulation({ kois, foods, schoolSystem, resolveFishCollisions, extraUpdate = () => {} }) {
    return { update(dt) {
        schoolSystem.updateSchools(dt);
        for (let i = foods.length - 1; i >= 0; i--) {
            foods[i].update(dt);
            if (foods[i].life <= 0) foods.splice(i, 1);
        }
        for (const entity of kois) entity.update(dt);
        extraUpdate(dt);
        resolveFishCollisions(dt);
    } };
}

Object.assign(exports, { createSimulation });
};
__modules["src/render/fish-renderer.js"] = function (exports, __require) {
const { THEME, KOI_SHAPE } = __require("src/shared/legacy-assets.js");
const { shadeColor, varyHexColor, hexRgba, mixHex, traceSmooth } = __require("src/shared/math.js");
const { drawSkinOnBody } = __require("src/render/fish-skin.js");
/* ★ 光向【每帧现读】,不再在加载时解构。
 *   原来是 `const [lx(), ly()] = THEME.light.dir` —— 加载时固化,
 *   之后运行时光向转了也【完全不动】(影子/涟漪/时钟偏移全都不跟),典型的"改了没反应"。
 *   这是"光随时间走"(experiments/day-phase)的前提。
 *   ⚠️ THEME.light.dir 必须保持【单位向量】:多处拿它做投影与偏移量。 */
const lx = () => THEME.light.dir[0];
const ly = () => THEME.light.dir[1];
const WATER_TINT = THEME.water.tint;
const koiWidth = KOI_SHAPE.koiWidth;
const traceClosedSmooth = KOI_SHAPE.traceClosedSmooth;
function createFishRenderer({ config }) {
const FISH_SCALES = true;
function drawFish(ctx) {
        let dropAlpha = 1;

        if (this.drop) {
            const p = Math.min(1, this.drop.t / this.drop.dur);
            const sink = 1 - p * (2 - p);                 // easeOutQuad:越落越慢
            const c = this.segments[0];
            const sc = 1 + 0.85 * sink;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.scale(sc, sc);
            ctx.translate(-c.x, -c.y);
            dropAlpha = 0.30 + 0.70 * (1 - sink);
        } else {
            dropAlpha = 1;
        }
        let fs = config.fishSize * this.sizeMul;
        ctx.globalAlpha = (0.62 + this.depth * 0.38) * dropAlpha;   // 远的淡一点 = 水深

        let segs = this.segments;
        if (this.waveEnv > 0) {
            const NL = this.numSegments - 1;
            segs = new Array(this.numSegments);
            for (let i = 0; i < this.numSegments; i++) {
                segs[i] = { x: this.segments[i].x, y: this.segments[i].y };
            }
            // 法线先按【真实脊椎】统一算好,再施加位移(边改边算会污染后面几节的方向)
            const wnx = [], wny = [];
            for (let i = 1; i < this.numSegments; i++) {
                const dx = this.segments[i].x - this.segments[i - 1].x;
                const dy = this.segments[i].y - this.segments[i - 1].y;
                const d = Math.hypot(dx, dy) || 1;
                wnx[i] = -dy / d; wny[i] = dx / d;
            }
            for (let i = 1; i < this.numSegments; i++) {
                const u = i / NL;
                const off = Math.sin(this.swimCycle * this.waveFreq - u * this.waveLen)
                          * this.waveEnv * u * u;
                segs[i].x += wnx[i] * off;
                segs[i].y += wny[i] * off;
            }
        }
        // --- 按弧长采样脊柱:得到任意位置的点与切向/法向 ---
        let cum = [0], total = 0;
        for (let i = 1; i < segs.length; i++) {
            total += Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            cum.push(total);
        }
        if (total < 2) total = 2;
        const BODY_SPAN = 0.78 * (this.shape ? this.shape.bodyLen : 1);   // 身体占脊柱的比例
        // 脊柱只由真实头部轨迹决定。尾鳍在下方独立摆动；若这里再给整根脊柱
        // 叠正弦侧移，转弯时会和节段历史相加，看起来像身体绕头卷成 C。
        function at(u) {
            let d = u * total, i = 1;
            while (i < cum.length - 1 && cum[i] < d) i++;
            let segLen = Math.max(0.0001, cum[i] - cum[i - 1]);
            let t = (d - cum[i - 1]) / segLen;
            let a = segs[i - 1], b = segs[i];
            let tx = b.x - a.x, ty = b.y - a.y, m = Math.hypot(tx, ty) || 1;
            return {
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
                tx: tx / m, ty: ty / m,
                nx: -ty / m, ny: tx / m
            };
        }

        const W = this.shape
            ? (bw => KOI_SHAPE.shapeWidth(bw, this.shape))
            : KOI_SHAPE.koiWidth;

        let maxHalf = total * 0.78 * 0.168 * (this.shape ? this.shape.bodyH : 1);

        // --- 体轮廓 ---
        // 吻端必须**单独用一段半椭圆弧封口**。
        // 之前的做法是让左右两条边交于脊柱上的同一点(因为 W(0)=0),
        // 那个点永远是个尖顶 —— 轮廓表再圆也救不了。头要圆,就得有"前脸"。
        let N = 32, pts = [];
        const FRONT = 0.045;                  // 从吻端往后这个位置开始取体侧
        let nose = at(FRONT * BODY_SPAN);
        let noseW = W(FRONT) * maxHalf;
        let capDepth = noseW * 0.95;          // 封口往前伸多少(≈ 半圆)

        for (let i = 0; i <= N; i++) {        // 左侧:吻 → 尾
            let bw = FRONT + (1 - FRONT) * (i / N);
            let p = at(bw * BODY_SPAN), w = W(bw) * maxHalf;
            pts.push([p.x + p.nx * w, p.y + p.ny * w]);
        }
        for (let i = N; i >= 0; i--) {        // 右侧:尾 → 吻
            let bw = FRONT + (1 - FRONT) * (i / N);
            let p = at(bw * BODY_SPAN), w = W(bw) * maxHalf;
            pts.push([p.x - p.nx * w, p.y - p.ny * w]);
        }
        for (let j = 1; j <= 5; j++) {        // 吻端半椭圆:右前 → 正前 → 左前
            let a = -Math.PI / 2 + Math.PI * (j / 6);
            let lat = Math.sin(a) * noseW;
            let fwd = Math.cos(a) * capDepth;
            pts.push([nose.x + nose.nx * lat - nose.tx * fwd,
                      nose.y + nose.ny * lat - nose.ty * fwd]);
        }
        function bodyPath() {
            ctx.beginPath();
            traceClosedSmooth(ctx, pts);
        }

        // --- 塘底投影 ---
        // ★ 不要用体轮廓来做影子。硬边的"体形剪影"会被看成"鱼下面还压着一条鱼"
        //   —— 这一版之前就是这么错的。
        //   正确的做法是沿脊柱画一条【加粗圆头暗带】,叠三层递宽递淡冒充模糊;
        //   形状是模糊的一条,而不是另一条鱼。
        //   另外:沿全局光向的反方向偏移(光从左上来 → 影子往右下),越深的鱼影子越远越大越虚。

        let deep = 1 - this.depth;                       // 0=近水面, 1=贴底
        let off = maxHalf * (0.75 + (1 - deep) * 1.35);
        let shX = -lx() * off, shY = -ly() * off;
        let shBase = 0.24 * (0.78 + 0.22 * this.depth);

        ctx.save();
        ctx.translate(shX, shY);
        ctx.lineJoin = 'round';
        {
            // 沿身体弧长取剖面:逐点的左右偏移 = 该处身体的半宽
            const NSH = 11;
            const PX = [], PY = [], PNX = [], PNY = [], PW = [];

            for (let k = 0; k <= NSH; k++) {
                const bw = FRONT + (1 - FRONT) * (k / NSH);
                const p = at(bw * BODY_SPAN);
                PX.push(p.x); PY.push(p.y); PNX.push(p.nx); PNY.push(p.ny);
                PW.push(W(bw) * maxHalf);
            }
            const noseS = at(FRONT * BODY_SPAN);
            const noseW0 = W(FRONT) * maxHalf;
            // 三层:外圈是"半影"、内圈是"本影"。pad 越靠水面越大(越散)
            const PADS = [0.8, 4.2, 7.6];
            const AMPS = [0.90, 0.56, 0.28];
            for (let s2 = 0; s2 < 3; s2++) {
                const pad = PADS[s2] * (1.15 - deep * 0.28);
                ctx.beginPath();
                for (let k = 0; k <= NSH; k++) {
                    const w = PW[k] + pad;
                    const x = PX[k] - PNX[k] * w, y = PY[k] - PNY[k] * w;
                    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                for (let k = NSH; k >= 0; k--) {
                    const w = PW[k] + pad;
                    ctx.lineTo(PX[k] + PNX[k] * w, PY[k] + PNY[k] * w);
                }

                const nw = noseW0 + pad;
                const cd = nw * 0.95;
                for (let j = 1; j <= 5; j++) {
                    const a2 = Math.PI / 2 - Math.PI * (j / 6);   // 从 +n 侧扫到 -n 侧
                    ctx.lineTo(noseS.x + noseS.nx * Math.sin(a2) * nw - noseS.tx * Math.cos(a2) * cd,
                               noseS.y + noseS.ny * Math.sin(a2) * nw - noseS.ty * Math.cos(a2) * cd);
                }
                ctx.closePath();
                ctx.fillStyle = THEME.fish.shadow + (shBase * AMPS[s2]).toFixed(3) + ')';
                ctx.fill();
            }
            // 尾鳍:半透明薄膜,影子很淡。形状从尾柄的细端张开成一个小扇形,
            // 而不是一根等宽的棍子伸出去。
            const tp2 = at(BODY_SPAN);
            const pedW = W(1.0) * maxHalf;   // 尾柄半宽,尾叶从它张开
            ctx.beginPath();
            ctx.moveTo(tp2.x - tp2.nx * pedW, tp2.y - tp2.ny * pedW);
            ctx.lineTo(tp2.x + tp2.tx * maxHalf * 1.35 - tp2.nx * pedW * 1.5,
                       tp2.y + tp2.ty * maxHalf * 1.35 - tp2.ny * pedW * 1.5);
            ctx.lineTo(tp2.x + tp2.tx * maxHalf * 1.35 + tp2.nx * pedW * 1.5,
                       tp2.y + tp2.ty * maxHalf * 1.35 + tp2.ny * pedW * 1.5);
            ctx.closePath();
            ctx.fillStyle = THEME.fish.shadow + (shBase * 0.34).toFixed(3) + ')';
            ctx.fill();
        }
        ctx.restore();

        // --- 体色:沿全局光照方向做线性渐变。
        // 之前是平涂 + 一圈很宽的灰描边,结果整条鱼是一坨灰、没有体积。
        let lit = at(0.44 * BODY_SPAN);
        let gw = maxHalf * 1.15;
        // 深度吸收:水先吃掉红光,所以**颜色本身要变**。
        // 在鱼上面蒙一层青是"雾",把颜色压向水色才是"吸收" —— 两者观感完全不同。
        let ab = mixHex(this.color, WATER_TINT, (1 - this.depth) * 0.52);
        let con = 0.45 + 0.55 * this.depth;      // 越深,明暗对比越弱(距离雾)
        let bodyGrad = ctx.createLinearGradient(
            lit.x + lx() * gw, lit.y + ly() * gw,
            lit.x - lx() * gw, lit.y - ly() * gw);
        bodyGrad.addColorStop(0.00, shadeColor(ab, 0.34 * con));     // 迎光面
        bodyGrad.addColorStop(0.40, ab);
        bodyGrad.addColorStop(0.78, shadeColor(ab, -0.14 * con));
        bodyGrad.addColorStop(1.00, shadeColor(ab, -0.30 * con));    // 背光面
        bodyPath();
        if (this.skinReady && this.skin && (this.skin.naturalWidth || this.skin.width)) {

            ctx.save();
            ctx.clip();                       // bodyPath() 刚 beginPath,直接裁在体轮廓里

            const keepA = ctx.globalAlpha;
            ctx.globalAlpha = 1;
            // 整个剪影先铺一层鼻尖色打底(切片边缘的抗锯齿缝才不会透出背景色)
            bodyPath();
            ctx.fillStyle = this.noseColor || '#ffffff';
            ctx.fill();
            // 吻端封口 + 身体,都用纹理(见 drawSkinOnBody 里的注释)
            drawSkinOnBody(ctx, at, BODY_SPAN, W, maxHalf, this.skin, nose, noseW, capDepth);
            ctx.globalAlpha = keepA;
            ctx.restore();

            let lg = ctx.createLinearGradient(
                lit.x + lx() * gw, lit.y + ly() * gw,
                lit.x - lx() * gw, lit.y - ly() * gw);
            lg.addColorStop(0.00, 'rgba(255,253,240,' + (0.30 * con).toFixed(3) + ')');
            lg.addColorStop(0.42, 'rgba(255,253,240,0)');
            lg.addColorStop(0.80, 'rgba(10,30,28,' + (0.16 * con).toFixed(3) + ')');
            lg.addColorStop(1.00, 'rgba(10,30,28,' + (0.30 * con).toFixed(3) + ')');
            bodyPath();
            ctx.fillStyle = lg;
            ctx.fill();
            // 深水吸收:自定义鱼也要跟着水色走,否则一池鱼里它像贴上去的
            bodyPath();
            ctx.globalAlpha = (1 - this.depth) * 0.34;   // 补上"体色不再用 alpha 淡出"的那部分
            ctx.fillStyle = WATER_TINT;
            ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = bodyGrad;
            ctx.fill();
        }

        // --- 体内所有明暗和斑纹都裁在轮廓里 ---
        ctx.save();
        bodyPath();
        ctx.clip();

        // 轮廓只留很细的一圈。原来 lineWidth = maxHalf*1.10,把鱼糊成灰饼
        bodyPath();
        ctx.strokeStyle = THEME.fish.outline;
        ctx.lineWidth = maxHalf * (this.outlineWidth ?? 0.22);
        if (ctx.lineWidth > 0) ctx.stroke();

        // 斑纹:使用不规则的背部斑块，而非沿脊柱刷出的粗色条。
        // 红白锦鲤的红斑需留出白色肩部和尾柄，才会显得轻盈、真实。
        for (let k = 0; k < this.spotRanges.length; k++) {
            let rg = this.spotRanges[k];
            let u0 = rg[0], u1 = rg[1], mid = (u0 + u1) * 0.5;
            let steps = 18, left = [], right = [];
            for (let i = 0; i <= steps; i++) {
                let u = u0 + (u1 - u0) * (i / steps);
                let p = at(u), local = W(u / BODY_SPAN) * maxHalf;
                let taper = 0.50 + 0.50 * Math.sin(Math.PI * i / steps);
                // 原来是 i*2.7:12 个采样点里振荡 5 次 → 斑块边缘是齿轮
                let wobble = 0.90 + 0.10 * Math.sin(i * 0.85 + k * 1.9);
                // 斑块要窄(留出白肩和白尾柄),而且不居中于脊线,才不像贴了块红方块
                let half = local * Math.min(0.72, rg[3] || 0.5) * taper * wobble;
                let off = Math.sin(i * 0.34 + k * 2.4) * local * 0.13;   // 一个周期,才是单个斑块;两个周期会变成蝴蝶结
                let a1 = Math.max(-local * 0.94, Math.min(local * 0.94, off + half));
                let a2 = Math.max(-local * 0.94, Math.min(local * 0.94, off - half));
                left.push([p.x + p.nx * a1, p.y + p.ny * a1]);
                right.push([p.x + p.nx * a2, p.y + p.ny * a2]);
            }
            // 左右两侧都要平滑。原来右半边是一串 lineTo,红斑右边就是一条折线 = 几何感
            let spotPts = left.concat(right.slice().reverse());
            ctx.beginPath();
            traceSmooth(ctx, spotPts);
            ctx.closePath();
            ctx.fillStyle = rg[2];
            ctx.fill();
            // 斑块上仅留一条极淡的水彩提亮，不画生硬描边。
            let mp = at(mid);
            ctx.beginPath();
            ctx.arc(mp.x - mp.nx * maxHalf * 0.16, mp.y - mp.ny * maxHalf * 0.16, maxHalf * 0.23, 0, Math.PI * 2);
            ctx.fillStyle = THEME.fish.spotHi;
            ctx.fill();
        }

        // --- 鳞片(網目/松葉) ---
        // ★ 形态重写过。原来是【13 道横穿身体的弧 + 每侧 4 条纵线】—— 两组线正交
        //   就是一张【渔网】,用户一眼看出"不像鳞"。真锦鲤的鳞是【一列列错开的鳞片】:
        //   横向看得出"列",纵向只有鳞片彼此错开的短边,没有贯穿全身的长线。
        // ★ 鳞片还必须【跟着光走】:迎光那一侧的鳞缘提亮、背光侧压暗。
        //   原来一律白 + 一律深,所以像印上去的纹理,没有立体感。
        // ★ 头、腹、尾要淡出 —— 真鱼这几个部位是光的(腹部尤其)。

        // 小鱼不画独立鳞片，避免 80 条鱼时产生大量看不见的细碎描边。
        const SCALE_MIN_HALF = 9;
        if (FISH_SCALES && this.net > 0.012 && maxHalf >= SCALE_MIN_HALF) {
            const ROWS = 13;
            const rowGap = (BODY_SPAN / (ROWS + 1)) * total;       // 列间距(px)
            ctx.lineWidth = Math.max(0.4, maxHalf * 0.030);
            for (let ci = 1; ci <= ROWS; ci++) {
                const fr = ci / (ROWS + 1);
                const p = at(fr * BODY_SPAN), wv = W(fr) * maxHalf;
                if (wv < 1.5) continue;
                const m = Math.max(3, Math.round(wv / (maxHalf * 0.24)));   // 这一列几片
                const stagger = (ci % 2) ? 0.5 : 0;                          // 列间错开半片
                const headTail = Math.min(1, Math.min(ci, ROWS + 1 - ci) / 2.5);
                for (let sgn = -1; sgn <= 1; sgn += 2) {
                    for (let j = 0; j < m; j++) {
                        const f0 = (j + stagger) / m, f1 = (j + 1 + stagger) / m;
                        if (f1 > 1.06) continue;
                        const fm = (f0 + f1) * 0.5;
                        const ax = p.x + p.nx * wv * f0 * sgn, ay = p.y + p.ny * wv * f0 * sgn;
                        const bx = p.x + p.nx * wv * f1 * sgn, by = p.y + p.ny * wv * f1 * sgn;
                        const qx = p.x + p.nx * wv * fm * sgn - p.tx * rowGap * 0.38;
                        const qy = p.y + p.ny * wv * fm * sgn - p.ty * rowGap * 0.38;

                        const rel = ((ax + bx) * 0.5 - p.x) * lx() + ((ay + by) * 0.5 - p.y) * ly();
                        const lit = Math.max(0, Math.min(1, 0.5 + (rel / Math.max(1, wv)) * 1.1));
                        const a = this.net * headTail * (1 - fm * 0.55)
                                * (0.25 + 0.95 * lit) * (0.40 + 0.60 * this.depth);
                        if (a < 0.008) continue;
                        ctx.strokeStyle = 'rgba(' + (lit > 0.5 ? '255,252,244,' : '58,48,36,')
                                        + (lit > 0.5 ? a : a * 0.9).toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.moveTo(ax, ay);
                        ctx.quadraticCurveTo(qx, qy, bx, by);
                        ctx.stroke();
                    }
                }
            }
        }

        // --- 金属光泽:黄金/孔雀这类"亮皮" ---
        if (this.sheen > 0.012) {
            ctx.beginPath();
            for (let i2 = 0; i2 <= 22; i2++) {
                let u = (i2 / 22) * BODY_SPAN;
                let p = at(u), wv = W(i2 / 22) * maxHalf;
                let px = p.x + p.nx * wv * 0.30, py = p.y + p.ny * wv * 0.30;
                if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            // 光泽必须两端渐隐、中间一点高光。用等宽实心描边会变成一条"白腰带"
            let s0 = at(0.06 * BODY_SPAN), s1 = at(0.94 * BODY_SPAN);
            let sg = ctx.createLinearGradient(s0.x, s0.y, s1.x, s1.y);
            sg.addColorStop(0.00, THEME.fish.sheen + '0)');
            sg.addColorStop(0.30, THEME.fish.sheen + (this.sheen * 0.80).toFixed(3) + ')');
            sg.addColorStop(0.64, THEME.fish.sheen + (this.sheen * 0.92).toFixed(3) + ')');
            sg.addColorStop(1.00, THEME.fish.sheen + '0)');
            ctx.strokeStyle = sg;
            ctx.lineWidth = maxHalf * 0.24;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // --- 腹侧红边:浅黄的标志(蓝灰背 + 红腹缘) ---
        if (this.edge) {
            ctx.beginPath();
            for (let i2 = 0; i2 <= 20; i2++) {
                let u = (i2 / 20) * BODY_SPAN;
                let p = at(u), wv = W(i2 / 20) * maxHalf;
                let px = p.x - p.nx * wv * 0.86, py = p.y - p.ny * wv * 0.86;
                if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = this.edge;
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = maxHalf * 0.20;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // --- 红唇(Kuchibeni):红白的常见特征,一小块就够 ---
        if (this.kuchi) {
            let kp = at(FRONT * 0.75);
            let kw = W(FRONT) * maxHalf;
            ctx.beginPath();
            ctx.ellipse(kp.x - kp.tx * kw * 0.62, kp.y - kp.ty * kw * 0.62,
                        maxHalf * 0.30, maxHalf * 0.19, Math.atan2(kp.ty, kp.tx), 0, Math.PI * 2);
            ctx.fillStyle = this.kuchi;
            ctx.fill();
        }
        ctx.restore();

        // --- 胸鳍:两片半透明薄膜,随游动轻摆 ---
        const P0 = KOI_SHAPE.PECTORAL;
        let pf = at(P0.bw * BODY_SPAN);
        let pfW = W(P0.bw) * maxHalf;
        for (let sgn = -1; sgn <= 1; sgn += 2) {
            // 起点落进腹侧体表以内一点。悬在体外的话,鳍看起来就不是长在身上的
            let bx = pf.x + pf.nx * pfW * P0.lat * sgn;
            let by = pf.y + pf.ny * pfW * P0.lat * sgn;
            // 方向:(+tx,+ty) 才是朝尾。原来写 -tx/-ty = 朝头,
            // 两片鳍向前盖在身体上成了一层灰膜 —— 这就是"鳍没连到鱼腹"的根因。
            const P = KOI_SHAPE.PECTORAL;
            let ang = Math.atan2(pf.ty, pf.tx) + sgn * P.spread
                    + Math.sin(this.swimCycle * P.flapFreq) * P.flapAmp * (this.previewMotion ? 0.42 : 1);
            let fl = KOI_SHAPE.pectoralFinLen(maxHalf, this.shape);
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(ang);
            KOI_SHAPE.pectoralFinPath(ctx, fl);
            ctx.fillStyle = hexRgba(varyHexColor(this.color, 0.55), 0.30);
            ctx.fill();
            ctx.strokeStyle = hexRgba(varyHexColor(this.color, 0.68), 0.24);
            ctx.lineWidth = 0.9;
            ctx.stroke();
            ctx.restore();
        }

        // --- 尾鳍:两片弧形尾叶 + 内凹叉口，不使用三角尖尾 ---
        let tp = at(BODY_SPAN);
        // 尾鳍根部不能再是一个点。
        // 身体的尾柄末端有 W(1.0)=0.34 的半宽,而尾鳍原来 moveTo(0,0) 从【一个点】
        // 长出来 —— 点和截面接不上,才会看着断开。之前的办法是用体色补一根圆头短棒去遮,
        // 那根棒伸出身体末端 0.45*maxHalf,就成了"多出来的一节身体"。
        // 正解:根部宽度直接对齐尾柄宽度,两段天然接上,不需要任何补丁。
        let pedW = W(1.0) * maxHalf;

        let tAng = Math.atan2(tp.ty, tp.tx)
                 + Math.sin(this.swimCycle * this.waveFreq - this.waveLen)
                 * KOI_SHAPE.TAIL.anglePhase * (this.previewMotion ? 0.42 : 1);
        let tl = KOI_SHAPE.tailFinLen(maxHalf, this.shape);
        ctx.save();
        ctx.translate(tp.x, tp.y);
        ctx.rotate(tAng);
        // 形状规则在 koishape.js —— 编辑器要画同一条鱼,不能有两份控制点
        KOI_SHAPE.tailFinPath(ctx, tl, pedW);
        ctx.fillStyle = hexRgba(varyHexColor(this.color, 0.58), 0.50);
        ctx.fill();
        ctx.strokeStyle = hexRgba(varyHexColor(this.color, 0.72), 0.38);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = THEME.fish.finEdge;
        ctx.lineWidth = 0.8;
        for (let i2 = -3; i2 <= 3; i2++) {
            if (i2 === 0) continue;
            let a2 = (i2 / 3) * 0.34;
            ctx.beginPath();
            ctx.moveTo(tl * 0.08, 0);
            ctx.quadraticCurveTo(tl * 0.55, tl * Math.sin(a2) * 0.20,
                                 tl * 0.84 * Math.cos(a2), tl * 0.84 * Math.sin(a2) * 0.58);
            ctx.stroke();
        }
        ctx.restore();

        // --- 眼:头两侧一对深色小点带高光 ---
        const E = KOI_SHAPE.EYE;
        let ep = at(E.bw * BODY_SPAN);
        let ew = W(E.bw) * maxHalf;
        let er = KOI_SHAPE.eyeRadius(maxHalf, this.shape);
        for (let sgn = -1; sgn <= 1; sgn += 2) {
            let ex = ep.x + ep.nx * ew * E.lat * sgn;
            let ey = ep.y + ep.ny * ew * E.lat * sgn;
            ctx.beginPath();
            ctx.arc(ex, ey, er, 0, Math.PI * 2);
            ctx.fillStyle = THEME.fish.eye;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ex + er * E.hiOff, ey + er * E.hiOff, er * E.hi, 0, Math.PI * 2);
            ctx.fillStyle = THEME.fish.eyeHi;
            ctx.fill();
        }

        // --- 深度吸收 ---
        // 水先把红光吃掉,深水里的鱼整体偏青。只降 globalAlpha 是不够的 ——
        // 那看起来像"幽灵",而偏青才像"在水里"。
        bodyPath();
        ctx.globalAlpha = (1 - this.depth) * 0.10;
        ctx.fillStyle = WATER_TINT;
        ctx.fill();

        ctx.globalAlpha = 1;
        if (this.drop) ctx.restore();          // 收掉投放用的那层缩放
    }

return { drawFish };
}

Object.assign(exports, { createFishRenderer });
};
__modules["src/render/fish-skin.js"] = function (exports, __require) {
const { KOI_SHAPE } = __require("src/shared/legacy-assets.js");
function noseColorOf(img) {
    try {
        const c = document.createElement('canvas');
        c.width = 6; c.height = 24;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0, 6, img.naturalHeight, 0, 0, 6, 24);
        const d = x.getImageData(0, 0, 6, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 40) continue;
            r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
        if (!n) return '#ffffff';
        return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
    } catch (e) { return '#ffffff'; }
}
function buildSmoothNormals(at, N, win) {
    const px = new Float64Array(N + 1), py = new Float64Array(N + 1);
    const sx = new Float64Array(N + 1), sy = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { const p = at(i / N); px[i] = p.x; py[i] = p.y; }
    for (let i = 0; i <= N; i++) {
        let ax = 0, ay = 0, c = 0;
        for (let k = -win; k <= win; k++) {
            const j = i + k < 0 ? 0 : (i + k > N ? N : i + k);
            ax += px[j]; ay += py[j]; c++;
        }
        sx[i] = ax / c; sy[i] = ay / c;
    }
    const nx = new Float64Array(N + 1), ny = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
        const a = i - 2 < 0 ? 0 : i - 2, b = i + 2 > N ? N : i + 2;
        const dx = sx[b] - sx[a], dy = sy[b] - sy[a];
        const m = Math.hypot(dx, dy) || 1;
        nx[i] = -dy / m; ny[i] = dx / m;
    }
    return function (u) {                       // u ∈ [0,1] 沿脊柱
        const f = u <= 0 ? 0 : (u >= 1 ? N : u * N);
        const i = Math.floor(f), t = f - i, j = i + 1 > N ? N : i + 1;
        return { nx: nx[i] + (nx[j] - nx[i]) * t, ny: ny[i] + (ny[j] - ny[i]) * t };
    };
}
function drawSkinOnBody(ctx, at, BS, W, maxHalf, img, nose, noseW, capDepth) {
    // HTMLImageElement uses naturalWidth/naturalHeight; the live editor passes an
    // HTMLCanvasElement so brush strokes can appear without encoding/reloading an image.
    const TW = img.naturalWidth || img.width;
    const TH = img.naturalHeight || img.height;
    if (!(TW > 0 && TH > 0)) return;

    const K = 40;

    const OVER_MIN_PX = 1.4, OVER_MAX_T = 8;
    // 法线走平滑版本(见 buildSmoothNormals 的注释:不平滑就是一道道横带)
    const nrm = buildSmoothNormals(at, 200, 6);

    if (nose) {
        const XCAP = Math.min(TW, 14), NC = 4;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(nose.x - nose.nx * noseW, nose.y - nose.ny * noseW);
        for (let j = 1; j <= 5; j++) {
            const a = -Math.PI / 2 + Math.PI * (j / 6);
            ctx.lineTo(nose.x + nose.nx * Math.sin(a) * noseW - nose.tx * Math.cos(a) * capDepth,
                       nose.y + nose.ny * Math.sin(a) * noseW - nose.ty * Math.cos(a) * capDepth);
        }
        ctx.closePath();
        ctx.clip();
        for (let i2 = 0; i2 < NC; i2++) {
            const r0 = i2 / NC, r1 = (i2 + 1) / NC;      // 0=鼻尖, 1=与身体相接处
            const x0 = XCAP * r0, x1 = XCAP * r1;
            // 进深系数:鼻尖 1、底部 0
            const f0 = 1 - r0, f1 = 1 - r1;
            const Ax = nose.x - nose.nx * noseW - nose.tx * f0 * capDepth, Ay = nose.y - nose.ny * noseW - nose.ty * f0 * capDepth;
            const Bx = nose.x - nose.nx * noseW - nose.tx * f1 * capDepth, By = nose.y - nose.ny * noseW - nose.ty * f1 * capDepth;
            const Cx = nose.x + nose.nx * noseW - nose.tx * f0 * capDepth, Cy = nose.y + nose.ny * noseW - nose.ty * f0 * capDepth;
            const yA = 0, yC = TH;
            const ax = (Bx - Ax) / (x1 - x0), ay = (By - Ay) / (x1 - x0);
            const bx = (Cx - Ax) / (yC - yA), by = (Cy - Ay) / (yC - yA);
            const ox = Ax - ax * x0 - bx * yA, oy = Ay - ay * x0 - by * yA;
            ctx.save();
            ctx.transform(ax, ay, bx, by, ox, oy);
            ctx.drawImage(img, x0, 0, x1 - x0, TH, x0, 0, x1 - x0, TH);
            ctx.restore();
        }
        ctx.restore();
    }
    for (let i = 0; i < K; i++) {
        const u0 = i / K, u1 = (i + 1) / K;
        const bw0 = KOI_SHAPE.bwAtU(u0), bw1 = KOI_SHAPE.bwAtU(u1);
        const p0 = at(bw0 * BS), p1 = at(bw1 * BS);
        const n0 = nrm(bw0 * BS), n1 = nrm(bw1 * BS);
        const w0 = W(bw0) * maxHalf, w1 = W(bw1) * maxHalf;

        let mnx = n0.nx + n1.nx, mny = n0.ny + n1.ny;
        const mn = Math.hypot(mnx, mny) || 1;
        mnx /= mn; mny /= mn;
        const wm = w0 > w1 ? w0 : w1;
        const Ax = p0.x - mnx * wm, Ay = p0.y - mny * wm;   // (u0, v=+1) ← 纹理 y=0
        const Bx = p1.x - mnx * wm, By = p1.y - mny * wm;   // (u1, v=+1)
        const Cx = p0.x + mnx * wm, Cy = p0.y + mny * wm;   // (u0, v=-1) ← 纹理 y=TH
        const xA = u0 * TW, xB = u1 * TW, yA = 0, yC = TH;
        const ax = (Bx - Ax) / (xB - xA), ay = (By - Ay) / (xB - xA);
        const bx = (Cx - Ax) / (yC - yA), by = (Cy - Ay) / (yC - yA);
        const ox = Ax - ax * xA - bx * yA, oy = Ay - ay * xA - by * yA;
        ctx.save();
        ctx.transform(ax, ay, bx, by, ox, oy);
        const ov = Math.min(OVER_MAX_T, OVER_MIN_PX / Math.max(0.05, Math.abs(ax)));
        const sx0 = Math.max(0, xA - ov), sx1 = Math.min(TW, xB + ov);
        if (sx1 > sx0) ctx.drawImage(img, sx0, 0, sx1 - sx0, TH, sx0, 0, sx1 - sx0, TH);
        ctx.restore();
    }
}

Object.assign(exports, { noseColorOf, buildSmoothNormals, drawSkinOnBody });
};
__modules["src/render/renderer.js"] = function (exports, __require) {
const { THEME, WaterGL } = __require("src/shared/legacy-assets.js");
const { createBackground } = __require("src/render/background.js");
const { createWaterSurface } = __require("src/render/water-surface.js");
const { createCaustics } = __require("src/render/caustics.js");
const { LAYERS } = __require("src/core/layers.js");
/**
 * 渲染器 = 画布准备 + 自己的内建层 + 按层表顺序出图。
 *
 * 2026-09-26 第二轮:原先 renderer.draw() 里写死九步(还带 drawClock / drawOverlay 两个回调参数),
 * 等于"渲染器知道玩法"。现在玩法自己往层表投稿(layers.add),渲染器只认层表 ——
 * 加雨/荷花/环境声可视化不用再改这个文件。
 * 内建层的绘制内容与先后顺序与第一轮逐行一致(池底→食物→生物→水面→光感→远场调色→涟漪)。
 */
function createRenderer({ canvas, viewport, config, time, kois, foods, ripples, layers, environment }) {
    const ctx = canvas.getContext('2d');
    const underCanvas = document.createElement('canvas');
    const uctx = underCanvas.getContext('2d');
    const margin = 56;
    let pondScene, farGradient;
    const drawOrder = [];
    const background = createBackground({ viewport, invalidate() {
        if (viewport.width && viewport.height) pondScene = background.buildPond(viewport.width + margin * 2, viewport.height);
    } });
    const surface = createWaterSurface({ ctx, underCanvas, viewport, time });
    const caustics = createCaustics({ config, viewport, time });
    function resize() {
        viewport.width = window.innerWidth;
        viewport.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        underCanvas.width = viewport.width + margin * 2;
        underCanvas.height = viewport.height;
        pondScene = background.buildPond(underCanvas.width, viewport.height);
        farGradient = ctx.createLinearGradient(0, 0, 0, viewport.height * THEME.water.farSpan);
        farGradient.addColorStop(0, THEME.water.farTop);
        farGradient.addColorStop(0.55, THEME.water.farMid);
        farGradient.addColorStop(1, 'rgba(7,28,32,0)');
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- 内建层(渲染器自己的资产) ----
    const detach = [
        layers.add('floor', g => { if (pondScene) g.drawImage(pondScene, -margin, 0); }),
        // 饲料:倒序绘制与第一轮一致(后撒的先画)
        layers.add('food', g => { for (let i = foods.length - 1; i >= 0; i--) foods[i].draw(g); }),
        layers.add('creatures', g => {
            for (let i = 0; i < kois.length; i++) drawOrder[i] = kois[i];
            drawOrder.length = kois.length;
            drawOrder.sort((a, b) => a.depth - b.depth);
            for (const fish of drawOrder) fish.draw(g);
        }),
        layers.add('surface', () => surface.draw()),
        // 光感:环境给一个乘数(阴/雨压暗)。⚠️ GPU 光感路径只吃 alpha —— 所以天气靠 alpha 表达,
        // 不能指望 extraScale(那个只有 CPU 分支认)。
        layers.add('light', g => {
            if (!config.enableCaustics) return;
            const k = environment ? environment.causticAlpha : 1;
            caustics.draw(g, THEME.light.layerAlpha * k, 1, 0);
        }),
        layers.add('farTint', g => {
            g.fillStyle = farGradient;
            g.fillRect(0, 0, viewport.width, viewport.height * THEME.water.farSpan);
            // 天气色罩:整幅压暗偏冷。用 **multiply** 而不是"平铺半透明"——
            // 平铺会把画面洗灰、对比度全丢(实测亮度只掉 5%,但已经发闷);
            // multiply 是"光变弱了",暗部与亮部按比例下来,鱼和池底的结构还在。
            // 画在雨环与涟漪**之前**,所以雨点亮脊不会被罩子压掉。
            // clear 时 alpha=0 ⇒ 这一笔完全不存在(与今天逐帧一致)。
            const grade = environment ? environment.grade : null;
            if (grade && grade.alpha > 0.001) {
                g.save();
                g.globalCompositeOperation = 'multiply';
                g.globalAlpha = grade.alpha;
                g.fillStyle = grade.color;
                g.fillRect(0, 0, viewport.width, viewport.height);
                g.restore();
            }
        }),
        layers.add('ripples', g => ripples.draw(g))
    ];

    return {
        draw() {
            const { width, height } = viewport;
            ctx.clearRect(0, 0, width, height);
            ctx.lineCap = ctx.lineJoin = 'round';
            uctx.setTransform(1, 0, 0, 1, margin, 0);
            uctx.clearRect(-margin, 0, underCanvas.width, underCanvas.height);
            uctx.lineCap = uctx.lineJoin = 'round';
            for (const layer of LAYERS) layers.draw(layer.id, layer.target === 'under' ? uctx : ctx);
        },
        dispose() {
            window.removeEventListener('resize', resize);
            detach.forEach(fn => fn());
            background.dispose(); caustics.dispose(); WaterGL.dispose();
            underCanvas.width = underCanvas.height = 1; pondScene = null; drawOrder.length = 0;
        }
    };
}

Object.assign(exports, { createRenderer });
};
__modules["src/render/background.js"] = function (exports, __require) {
const { mulberry32 } = __require("src/shared/math.js");
function createBackground({ viewport, invalidate }) {
const pondBackground = new Image();
let pondBackgroundReady = false;
pondBackground.onload = () => {
    pondBackgroundReady = true;
    // Rebuild the offscreen pond once the image is ready; fish state is retained.
    invalidate();
};
/* 用【无损 WebP】:逐像素等于 PNG(见 tools/to_webp.py 的校验输出),体积却只有 39%。
 * PNG 母版仍留在 assets/,但已不被引用 ⇒ 打包时不会带上(白名单按引用扫)。 */
pondBackground.src = 'assets/pond-background-v7.webp';
function drawLilyPad(g, x, y, r, rot, pal) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    function padPath(scale, sx, sy) {
        g.beginPath();
        let segs = 52;
        for (let i = 0; i <= segs; i++) {
            let a = (i / segs) * Math.PI * 2;
            let notch = Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI);
            let rr = r * scale;
            if (notch < 0.44) rr *= 0.26 + 0.74 * (notch / 0.44);   // 荷叶标志性的 V 形缺口
            rr *= 1 + 0.035 * Math.sin(a * 7 + rot * 3);            // 叶缘轻微起伏
            let px = Math.cos(a) * rr + sx, py = Math.sin(a) * rr * 0.95 + sy;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
    }
    padPath(1.02, r * 0.05, r * 0.08);                 // 很轻的水下投影，不做硬黑边
    g.fillStyle = 'rgba(39,72,50,0.17)';
    g.fill();
    padPath(1, 0, 0);
    let lg = g.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, 0, r * 1.06);
    lg.addColorStop(0, pal[0]);
    lg.addColorStop(0.62, pal[1]);
    lg.addColorStop(1, pal[2]);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = pal[3];
    g.globalAlpha = 0.42;
    g.lineWidth = Math.max(0.8, r * 0.014);
    for (let v = 0; v < 11; v++) {
        let va = (v / 15) * Math.PI * 2 + 0.22;
        let n2 = Math.abs(((va + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (n2 < 0.52) continue;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(va) * r * 0.90, Math.sin(va) * r * 0.86);
        g.stroke();
    }
    padPath(1, 0, 0);
    g.strokeStyle = pal[4];
    g.globalAlpha = 0.38;
    g.lineWidth = Math.max(0.8, r * 0.017);
    g.stroke();
    g.beginPath();
    g.ellipse(-r * 0.28, -r * 0.32, r * 0.24, r * 0.13, -0.62, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    g.restore();
}

function drawLotus(g, x, y, r, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    for (let ring = 0; ring < 3; ring++) {
        let n = ring === 0 ? 8 : ring === 1 ? 6 : 5;
        let rr = r * (ring === 0 ? 1.0 : ring === 1 ? 0.66 : 0.37);
        for (let i = 0; i < n; i++) {
            let a = (i / n) * Math.PI * 2 + ring * 0.42;
            g.save();
            g.rotate(a);
            g.beginPath();
            g.ellipse(rr * 0.60, 0, rr * 0.56, rr * 0.21, 0, 0, Math.PI * 2);
            g.fillStyle = ring === 0 ? 'rgba(203,112,139,0.76)' : ring === 1 ? 'rgba(235,159,177,0.82)' : 'rgba(249,190,201,0.88)';
            g.fill();
            g.restore();
        }
    }
    g.beginPath();
    g.arc(0, 0, r * 0.23, 0, Math.PI * 2);
    g.fillStyle = '#e6c66a';
    g.fill();
    g.beginPath();
    g.arc(-r * 0.06, -r * 0.06, r * 0.11, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.fill();
    g.restore();
}

// Keep the artwork static and cover-cropped; live caustics, fish and ripples
// are drawn later by the main renderer.
function drawPondBackground(g, w, h) {
    let scale = Math.max(w / pondBackground.naturalWidth, h / pondBackground.naturalHeight);
    let sourceW = w / scale, sourceH = h / scale;
    let sourceX = (pondBackground.naturalWidth - sourceW) * 0.5;
    let sourceY = (pondBackground.naturalHeight - sourceH) * 0.5;
    g.drawImage(pondBackground, sourceX, sourceY, sourceW, sourceH, 0, 0, w, h);

    // Blend the image with the existing live water layers.
    let waterVeil = g.createLinearGradient(0, 0, w, h);
    waterVeil.addColorStop(0, 'rgba(22,82,79,0.08)');
    waterVeil.addColorStop(1, 'rgba(10,57,57,0.13)');
    g.fillStyle = waterVeil;
    g.fillRect(0, 0, w, h);
}

function buildPond(w, h) {
    let c = document.createElement('canvas');
    c.width = w; c.height = h;
    let g = c.getContext('2d');
    let R = mulberry32(20260924);

    if (pondBackgroundReady) {
        drawPondBackground(g, w, h);
        return c;
    }
    // --- 水:由浅青玉到青绿的柔和水色，不用单一的绿灰底 ---
    let water = g.createLinearGradient(0, 0, w * 0.4, h);
    /* ★ 这几档原来是【亮绿】(亮度 148~191),而池塘照片的中位色只有 93 ——
     *   后果:8.3MB 照片解码完成之前整屏是一块偏亮的绿,用户看到「先绿一下再变池塘」。
     *   这层现在只在「照片还没就绪」的窗口里露面,所以直接对齐照片实测的分位色:
     *   上 #267d6f / 中 #067679 / 深 #0c615f。 */
    water.addColorStop(0.00, '#2a8073');
    water.addColorStop(0.35, '#1e7a6f');
    water.addColorStop(0.72, '#106b64');
    water.addColorStop(1.00, '#0d5c58');
    g.fillStyle = water;
    g.fillRect(0, 0, w, h);

    // --- 深水区:低对比的色彩呼吸，留出干净的水面 ---
    for (let i = 0; i < 5; i++) {
        let dx = R() * w, dy = R() * h, dr = 130 + R() * 260;
        let dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
        dg.addColorStop(0, 'rgba(76,116,96,0.22)');
        dg.addColorStop(0.6, 'rgba(88,124,104,0.09)');
        dg.addColorStop(1, 'rgba(90,126,98,0)');
        g.fillStyle = dg;
        g.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }
    // --- 浅滩 ---
    for (let i = 0; i < 5; i++) {
        let dx = R() * w, dy = R() * h, dr = 90 + R() * 180;
        let dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
        dg.addColorStop(0, 'rgba(150,190,150,0.18)');   // 原来是亮黄绿,加载期会闪
        dg.addColorStop(1, 'rgba(196,214,166,0)');
        g.fillStyle = dg;
        g.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }

    // --- 塘底:只有少量朦胧石影，避免出现一排脏的深色竖线 ---
    for (let i = 0; i < 9; i++) {
        let px = R() * w, py = R() * h, pr = 26 + R() * 78;
        g.save();
        g.filter = 'blur(' + (8 + R() * 14).toFixed(0) + 'px)';
        g.beginPath();
        g.ellipse(px, py, pr, pr * (0.5 + R() * 0.5), R() * Math.PI, 0, Math.PI * 2);
        g.fillStyle = R() < 0.78 ? 'rgba(64,100,78,0.11)' : 'rgba(122,142,108,0.08)';
        g.fill();
        g.restore();
    }

    // --- 水面细密水流纹 ---
    for (let i = 0; i < 64; i++) {
        let py = R() * h, px = R() * w, len = 22 + R() * 74;
        let tilt = (R() - 0.5) * 0.5;                 // 方向别全都一样
        g.beginPath();
        g.moveTo(px, py);
        for (let k = 1; k <= 6; k++) {
            g.lineTo(px + (len * k) / 6, py + tilt * (len * k) / 6 + Math.sin(k * 1.1 + px * 0.01) * 2.6);
        }
        g.strokeStyle = R() < 0.5 ? 'rgba(244,250,235,0.075)' : 'rgba(91,132,111,0.035)';
        g.lineWidth = 0.65 + R() * 0.9;
        g.stroke();
    }

    // --- 岸边植物 ---
    for (let i = 0; i < 14; i++) {
        let edge = Math.floor(R() * 4);
        let ex, ey, ang;
        if (edge === 0) { ex = R() * w; ey = -10; ang = Math.PI / 2; }
        else if (edge === 1) { ex = w + 10; ey = R() * h; ang = Math.PI; }
        else if (edge === 2) { ex = R() * w; ey = h + 10; ang = -Math.PI / 2; }
        else { ex = -10; ey = R() * h; ang = 0; }
        ang += (R() - 0.5) * 0.9;
        let len = h * (0.08 + R() * 0.20);
        g.save();
        g.translate(ex, ey);
        g.rotate(ang);
        let bw = h * (0.004 + R() * 0.008);
        g.beginPath();
        g.moveTo(0, -bw);
        g.quadraticCurveTo(len * 0.5, -bw * 2.6, len, -bw * 1.4);
        g.quadraticCurveTo(len * 0.5, bw * 2.8, 0, bw);
        g.closePath();
        let lg2 = g.createLinearGradient(0, 0, len, 0);
        lg2.addColorStop(0, 'rgba(58,96,48,0.94)');
        lg2.addColorStop(1, 'rgba(104,150,72,0.90)');
        g.fillStyle = lg2;
        g.fill();
        g.restore();
    }

    // --- 荷叶:池塘最好看的元素 ---
    let PADS = [
        ['#86ad6d', '#668e55', '#4e7447', 'rgba(204,224,175,0.42)', 'rgba(57,105,58,0.55)'],
        ['#94b979', '#71975e', '#55794d', 'rgba(214,230,185,0.40)', 'rgba(64,110,61,0.52)'],
        ['#78a365', '#5e8753', '#496f48', 'rgba(193,216,166,0.40)', 'rgba(52,96,55,0.52)']
    ];
    let padSpots = [
        [0.04, 0.09, 0.095], [0.26, 0.04, 0.064], [0.94, 0.12, 0.084],
        [0.06, 0.69, 0.078], [0.91, 0.68, 0.092], [0.64, 0.95, 0.068],
        [0.15, 0.91, 0.060], [0.98, 0.43, 0.053]
    ];
    for (let i = 0; i < padSpots.length; i++) {
        let sp = padSpots[i];
        drawLilyPad(g, sp[0] * w, sp[1] * h, sp[2] * Math.min(w, h),
                    R() * Math.PI * 2, PADS[Math.floor(R() * PADS.length)]);
    }

    // --- 荷花 ---
    let lotusSpots = [[0.10, 0.28], [0.86, 0.34], [0.20, 0.94], [0.66, 0.06]];
    for (let i = 0; i < lotusSpots.length; i++) {
        drawLotus(g, lotusSpots[i][0] * w, lotusSpots[i][1] * h,
                  Math.min(w, h) * 0.032, R() * Math.PI * 2);
    }

    // --- 漂在水面的花瓣和落叶 ---
    for (let i = 0; i < 14; i++) {
        let px = R() * w, py = R() * h, pr = 3 + R() * 5.5, pa = R() * Math.PI * 2;
        g.save();
        g.translate(px, py);
        g.rotate(pa);
        // 花瓣形:一头尖一头圆,不是椭圆药丸
        g.beginPath();
        g.moveTo(-pr, 0);
        g.quadraticCurveTo(-pr * 0.1, -pr * 0.72, pr, 0);
        g.quadraticCurveTo(-pr * 0.1, pr * 0.72, -pr, 0);
        g.closePath();
        g.fillStyle = R() < 0.55 ? 'rgba(242,182,201,0.62)' : 'rgba(198,170,112,0.55)';
        g.fill();
        g.restore();
    }

    // --- 四角轻微压暗,但不要黑边 ---
    let vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.40, w / 2, h / 2, Math.max(w, h) * 0.80);
    vig.addColorStop(0, 'rgba(60,90,66,0)');
    vig.addColorStop(1, 'rgba(56,86,62,0.18)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    return c;
}

return { buildPond, dispose() { pondBackground.onload = null; } };
}

Object.assign(exports, { createBackground });
};
__modules["src/render/water-surface.js"] = function (exports, __require) {
function createWaterSurface({ ctx, underCanvas, viewport, time }) {
const WATER_MARGIN = 56;
const WATER_STRIPS = 16;
const WATER_WARP_AMP = 1.8;
function drawWaterSurface() {
    const sh = viewport.height / WATER_STRIPS;
    const t = time.elapsed;
    const breathe = 1 + 0.25 * Math.sin(t * 0.19);
    for (let i = 0; i < WATER_STRIPS; i++) {
        const y = i * sh;
        const dx = Math.sin(y * 0.0032 + t * 0.55) * WATER_WARP_AMP * breathe;   // 单频、波长约 2000px → 缓慢大波
        ctx.drawImage(underCanvas,
            WATER_MARGIN + dx, y, viewport.width, sh + 1.2,
            0, y, viewport.width, sh + 1.2);
    }
}

return { draw: drawWaterSurface };
}

Object.assign(exports, { createWaterSurface });
};
__modules["src/render/caustics.js"] = function (exports, __require) {
const { THEME, WaterGL } = __require("src/shared/legacy-assets.js");
const { mulberry32 } = __require("src/shared/math.js");
function createCaustics({ config, viewport, time }) {
const WATER_MARGIN = 56;
const causticTexture = new Image();
let causticTextureReady = false;

const causticWarm = document.createElement('canvas');
const causticMask = document.createElement('canvas');
let causticFeather = null;   // 边框羽化遮罩(只淡四条边,见下)
causticTexture.onload = () => {
    causticTextureReady = true;
    causticWarm.width = causticTexture.naturalWidth;
    causticWarm.height = causticTexture.naturalHeight;
    let wg = causticWarm.getContext('2d');

    wg.filter = 'saturate(' + THEME.light.desaturate + ')';

    wg.globalCompositeOperation = 'lighter';
    for (let rp = 0; rp < THEME.light.reps; rp++) wg.drawImage(causticTexture, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    wg.filter = 'none';

    if (THEME.light.tint) {
        wg.globalCompositeOperation = 'source-atop';
        wg.fillStyle = THEME.light.tint;
        wg.fillRect(0, 0, causticWarm.width, causticWarm.height);
        wg.globalCompositeOperation = 'source-over';
    }

    const FW = 0.08;
    const W0 = causticWarm.width, H0 = causticWarm.height;
    if (!causticFeather || causticFeather.width !== W0 || causticFeather.height !== H0) {
        causticFeather = document.createElement('canvas');
        causticFeather.width = W0; causticFeather.height = H0;
        const fg = causticFeather.getContext('2d');
        fg.fillStyle = '#fff';
        fg.fillRect(0, 0, W0, H0);
        fg.globalCompositeOperation = 'destination-out';   // 用渐变"擦掉"边上一圈
        const wx = W0 * FW, wy = H0 * FW;
        const band = (x, y, w, h, gx0, gy0, gx1, gy1) => {
            const gr = fg.createLinearGradient(gx0, gy0, gx1, gy1);
            gr.addColorStop(0, 'rgba(0,0,0,1)');   // 边界处擦干净
            gr.addColorStop(1, 'rgba(0,0,0,0)');   // 往里恢复
            fg.fillStyle = gr;
            fg.fillRect(x, y, w, h);
        };
        band(0, 0, wx, H0, 0, 0, wx, 0);
        band(W0 - wx, 0, wx, H0, W0, 0, W0 - wx, 0);
        band(0, 0, W0, wy, 0, 0, 0, wy);
        band(0, H0 - wy, W0, wy, 0, H0, 0, H0 - wy);
    }
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(causticFeather, 0, 0);
    wg.globalCompositeOperation = 'source-over';

    // 大尺度遮罩:★ 不能直接拿上面这张做 overlay。
    // 焦散贴图约 95% 是黑,而 overlay 遇黑就压暗 —— 整屏会蒙一层灰(实测亮度 74.9 → 66.2)。
    // 用 lighter 把底色抬到中灰,overlay 才是中性的:亮纹处提亮,其余基本不动。
    causticMask.width = causticWarm.width;
    causticMask.height = causticWarm.height;
    let mg = causticMask.getContext('2d');
    mg.drawImage(causticWarm, 0, 0);
    mg.globalCompositeOperation = 'lighter';
    mg.fillStyle = 'rgba(132,132,132,1)';
    mg.fillRect(0, 0, causticMask.width, causticMask.height);
};

causticTexture.src = THEME.light.texture;
const CAUSTIC_BLADES = THEME.light.blades;
let causticBlades = null;
function buildCausticBlades() {
    const R = mulberry32(20261105);
    const base = Math.max(viewport.width, viewport.height);
    const out = [];
    for (let i = 0; i < CAUSTIC_BLADES; i++) {
        out.push({
            cx: (R() * 1.8 - 0.4) * viewport.width,          // 允许飘到画面外,边缘才不会突然断掉
            cy: (R() * 1.8 - 0.4) * viewport.height,
            rot: R() * Math.PI * 2,
            spin: (R() - 0.5) * THEME.light.spin,

            // ★ 尺寸是"光有多宽"的唯一开关。光带贴图本身就宽,铺太大会糊成一片云;
            //   实测 0.30~0.50 时接近 1:1,光带保持"带状"而不是"团状"。

            size: base * (THEME.light.size[0] + R() * THEME.light.size[1]),
            amp: base * (0.16 + R() * 0.18),        // 漂移半径(原来 0.10~0.23,动得太慢)
            ph: R() * Math.PI * 2,
            sp: THEME.light.drift[0] + R() * THEME.light.drift[1],
            al: THEME.light.alpha[0] + R() * THEME.light.alpha[1]
        });
    }
    return out;
}

const PATCH_BLOBS = THEME.light.patchBlobs;
const PATCH_PEAK  = THEME.light.patchPeak;
const USE_CAUSTIC_PATCH = true;   // 关掉可量出遮罩吃掉了多少光
function buildCausticPatch(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    const g = c.getContext('2d');
    const R = mulberry32(20261105);
    const base = Math.max(w, h);
    for (let i = 0; i < PATCH_BLOBS; i++) {
        const x = R() * w, y = R() * h;
        const r = base * (THEME.light.patchRadius[0] + R() * THEME.light.patchRadius[1]);
        const a = PATCH_PEAK * (0.35 + R() * 0.65);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0.00, 'rgba(255,255,255,' + a.toFixed(3) + ')');
        gr.addColorStop(0.40, 'rgba(255,255,255,' + (a * 0.50).toFixed(3) + ')');
        gr.addColorStop(1.00, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
}

let causticScratch = null;
let causticPatch = null;
function ensureCausticScratch() {
    const w = Math.max(1, Math.round(viewport.width + WATER_MARGIN * 2));
    const h = Math.max(1, Math.round(viewport.height));
    if (!causticScratch || causticScratch.c.width !== w || causticScratch.c.height !== h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        causticScratch = { c: c, g: c.getContext('2d') };
        // 建大一圈(各边 +30%):遮罩要平移/缩放,余量不够会露边
        const padP = Math.round(Math.max(w, h) * 0.30);
        causticPatch = buildCausticPatch(w + padP * 2, h + padP * 2);
        causticBlades = buildCausticBlades();      // 尺寸变了,随机布局要重掷
    }
    return causticScratch;
}

function drawCausticsEx(g, baseAlpha, extraScale, offsetX) {

    if (config.useGpuCaustics && typeof WaterGL !== 'undefined' && WaterGL.init()) {
        const wc = WaterGL.causticsCanvas(viewport.width, viewport.height, time.elapsed);
        if (wc) {
            g.save();
            g.globalCompositeOperation = 'screen';
            g.globalAlpha = baseAlpha;
            g.drawImage(wc, offsetX === undefined ? 0 : offsetX, 0, viewport.width, viewport.height);
            g.restore();
            return;
        }
    }
    if (!causticTextureReady) return;
    if (!causticBlades) causticBlades = buildCausticBlades();
    const t = time.elapsed;
    const k = extraScale || 1;
    const sc = ensureCausticScratch();
    const sg = sc.g;
    const SW = sc.c.width, SH = sc.c.height;
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalAlpha = 1;
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, SW, SH);
    sg.globalCompositeOperation = 'screen';
    for (let i = 0; i < causticBlades.length; i++) {
        const B = causticBlades[i];
        const s = B.size * k;
        // 漂移用两个速度略不同的正弦(利萨如),轨迹就不会退化成一条直线来回
        const x = B.cx + WATER_MARGIN + Math.cos(t * B.sp + B.ph) * B.amp;
        const y = B.cy + Math.sin(t * B.sp * 1.37 + B.ph) * B.amp;
        sg.save();
        sg.translate(x, y);
        sg.rotate(B.rot + t * B.spin);
        sg.globalAlpha = B.al;

        const asp = causticWarm.height / causticWarm.width;
        sg.drawImage(causticWarm, -s * 0.5, -s * asp * 0.5, s, s * asp);
        sg.restore();
    }

    if (USE_CAUSTIC_PATCH) {
        sg.globalCompositeOperation = 'destination-in';
        sg.globalAlpha = 1;

        const PW = causticPatch.width, PH = causticPatch.height;
        const pad = Math.max(SW, SH) * 0.30;
        const dx = Math.sin(t * 0.17) * pad * 0.85;
        const dy = Math.cos(t * 0.13) * pad * 0.85;
        const breathe = 1 + 0.10 * Math.sin(t * 0.075);
        sg.save();
        sg.translate(SW * 0.5 + dx, SH * 0.5 + dy);
        sg.scale(breathe, breathe);
        sg.drawImage(causticPatch, -PW * 0.5, -PH * 0.5, PW, PH);
        sg.restore();
    }

    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = baseAlpha;
    // 水下画布比视口宽 2*WATER_MARGIN,所以默认要左移回去;画在水面层时偏移为 0
    g.drawImage(sc.c, offsetX === undefined ? -WATER_MARGIN : offsetX, 0, SW, SH);
    g.restore();

}
return { draw: drawCausticsEx, dispose() { causticTexture.onload = null; causticWarm.width = causticWarm.height = causticMask.width = causticMask.height = 1; causticScratch = causticPatch = causticFeather = null; } };
}

Object.assign(exports, { createCaustics });
};
__modules["src/render/ripples.js"] = function (exports, __require) {
const { THEME, WaterGL } = __require("src/shared/legacy-assets.js");
/* ★ 光向【每帧现读】,不再在加载时解构。
 *   原来是 `const [lx(), ly()] = THEME.light.dir` —— 加载时固化,
 *   之后运行时光向转了也【完全不动】(影子/涟漪/时钟偏移全都不跟),典型的"改了没反应"。
 *   这是"光随时间走"(experiments/day-phase)的前提。
 *   ⚠️ THEME.light.dir 必须保持【单位向量】:多处拿它做投影与偏移量。 */
const lx = () => THEME.light.dir[0];
const ly = () => THEME.light.dir[1];

class Ripple {

    /** profile 默认 = 鼠标涟漪那套(THEME.water.ripple);雨滴传自己的(同一套参数的派生) */
    constructor(x, y, power, profile, deps) {
        const T = this.T = profile || THEME.water.ripple;
        // 依赖从外面注入(而不是闭包):这样同一个类既能给鼠标涟漪用,也能给雨滴场用
        this.viewport = (deps && deps.viewport) || { width: 1, height: 1 };
        this.config = (deps && deps.config) || {};
        this.x = x; this.y = y;
        this.power = power;
        this.age = 0;
        this.dead = false;
        this.life = T.life[0] + power * T.life[1];
        this.speed = T.speed[0] + power * T.speed[1];
        // ★ 波长不在这里定死:λ = lamRatio × 当前半径(见 draw()),这样环永远是"细线"。
        // ★ amp/扩散衰减已经不需要了 —— 现在是"画"出来的环,不是物理高度场。
        //   留着会让人以为调它能改涟漪强度(实际只影响 fade 之外的空数据)。
        // 角向包络的抖动种子:每个涟漪不同,环才不会长得一模一样。
        this.seed = (x * 0.0131 + y * 0.0217 + power * 1.7) % (Math.PI * 2);
    }
    update(dt) {
        this.age += dt;
        if (this.age >= this.life) this.dead = true;
    }
    get radius() { return this.speed * this.age; }

    get fade() {
        const T = this.T;
        return 1 - Math.pow(Math.min(1, this.age / this.life), T.fadePower);
    }

    intensity() {
        const T = this.T;
        const spread = T.spread / (this.radius + T.spread);

        const L = Math.max(1, Math.hypot(this.viewport.width, this.viewport.height) * 0.5);
        const proj = ((this.x - this.viewport.width * 0.5) * lx() + (this.y - this.viewport.height * 0.5) * ly()) / L;
        const lightDist = 1 - T.lightDistDim * (1 - proj) * 0.5;
        return this.fade * spread * Math.max(0, lightDist);
    }
    draw(ctx) {
        const T = this.T;
        const R = this.radius;
        if (R < 2) return;

        // 雨滴强制走 Canvas 路径:GPU 那条路是给"主角级"鼠标涟漪的,几十上百个雨环挤上去
        // 会把它的容量吃光(而且 GPU 分支不支持低配剖面)。见 createRainRipples()。
        if (this.useGpu !== false && this.config.useGpuRipples && typeof WaterGL !== 'undefined' && WaterGL.init()) {
            const a0 = this.intensity();
            if (a0 < 0.035) return;
            const crest = WaterGL.rippleCanvas(this, 0);
            if (crest) {
                ctx.save();
                ctx.globalCompositeOperation = 'screen';
                ctx.globalAlpha = T.crestAlpha;
                ctx.drawImage(crest.canvas, crest.x, crest.y, crest.size, crest.size);
                ctx.restore();
            }
            const trough = T.troughAlpha > 0 ? WaterGL.rippleCanvas(this, 1) : null;
            if (trough) {
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = T.troughAlpha;
                ctx.drawImage(trough.canvas, trough.x, trough.y, trough.size, trough.size);
                ctx.restore();
            }
            return;
        }
        const lam = Math.max(2, R * T.lamRatio);
        const a = this.intensity();
        if (a < 0.035) return;

        const depth = Math.min(R, lam * Math.max(1, T.waveCycles || 4));
        const feather = Math.max(1, lam * 0.12);
        const rin = Math.max(0, R - depth);
        const rout = R + feather;
        const size = Math.ceil(rout * 2) + 4;
        const sc = ensureRippleScratch(size, this.viewport);
        if (!sc) return;
        const g = sc.g, S = sc.c.width, cx = S / 2, cy = S / 2;

        // ---- 第一趟:亮脊(screen 加光) ----
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, S, S);
        decayWaveProfile(g, S, rin, rout, R, lam, 1, T);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = rippleArcGradient(g, cx, cy, rout, T.crest, T.crestAlpha * a, this.seed, T.arcFloor, T);
        g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(sc.c, 0, 0, S, S, this.x - cx, this.y - cy, S, S);
        ctx.restore();

        // ---- 第二趟:负半波压暗,与亮半波共用同一条阻尼曲线 ----
        if (T.troughAlpha > 0) {
            g.clearRect(0, 0, S, S);
            decayWaveProfile(g, S, rin, rout, R, lam, -1, T);
            g.globalCompositeOperation = 'source-in';
            g.fillStyle = rippleArcGradient(g, cx, cy, rout, T.trough, T.troughAlpha * a, this.seed, T.flankFloor, T);
            g.fillRect(0, 0, S, S);
            g.globalCompositeOperation = 'source-over';
            ctx.drawImage(sc.c, 0, 0, S, S, this.x - cx, this.y - cy, S, S);
        }
    }
}

function rippleArcGradient(g, cx, cy, rout, head, full, seed, floor, profile) {
    const T = profile || THEME.water.ripple;
    const floorA = Math.max(0, Math.min(0.9, floor));
    const env = (d) => {                              // d = 离光夹角(弧度)
        let c = Math.cos(d);
        if (c < 0) c = 0;                             // 暗带和亮线同形状,只是地板不同
        return floorA + (1 - floorA) * Math.pow(c, T.arcPower);
    };
    const a0 = Math.atan2(ly(), lx());
    if (typeof g.createConicGradient === 'function') {
        const N = Math.max(12, T.arcStops | 0);
        const gr = g.createConicGradient(a0, cx, cy);
        for (let i = 0; i <= N; i++) {
            const f = i / N;                          // 绕一整圈的进度
            let e = env(f * Math.PI * 2) * (1 + T.arcJitter * Math.sin(f * Math.PI * 6 + seed));
            if (e < 0) e = 0;
            gr.addColorStop(f, head + Math.min(1, full * e).toFixed(4) + ')');
        }
        return gr;
    }

    const x0 = cx - lx() * rout, y0 = cy - ly() * rout;
    const x1 = cx + lx() * rout, y1 = cy + ly() * rout;
    const gl = g.createLinearGradient(x0, y0, x1, y1);
    gl.addColorStop(0, head + Math.min(1, full * floorA).toFixed(4) + ')');
    gl.addColorStop(0.5, head + Math.min(1, full * floorA).toFixed(4) + ')');
    for (let i = 1; i <= 5; i++) {
        const t = 0.5 + 0.5 * i / 5;
        gl.addColorStop(t, head + Math.min(1, full * env(Math.acos(Math.max(-1, Math.min(1, 2 * t - 1))))).toFixed(4) + ')');
    }
    return gl;
}

function decayWaveProfile(g, S, rin, rout, R, lam, polarity, profile) {
    const T = profile || THEME.water.ripple;
    const cx = S / 2, cy = S / 2, span = Math.max(1, rout - rin);
    const samples = Math.max(24, T.waveSamples | 0);
    const decay = Math.max(0, T.waveDecay || 0.85);
    const maxDepth = Math.min(R, lam * Math.max(1, T.waveCycles || 4));
    const feather = Math.max(1, rout - R);
    const rg = g.createRadialGradient(cx, cy, rin, cx, cy, rout);
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const r = rin + span * t;
        const d = R - r;
        let wave = 0;
        if (d < 0) {
            wave = Math.max(0, 1 + d / feather);
        } else if (d <= maxDepth) {
            wave = Math.exp(-decay * d / lam) * Math.cos(Math.PI * 2 * d / lam);
            const tail = Math.min(1, (maxDepth - d) / Math.max(1, lam * 0.5));
            wave *= Math.max(0, tail);
        }
        const alpha = polarity > 0 ? Math.max(0, wave) : Math.max(0, -wave);
        rg.addColorStop(t, 'rgba(255,255,255,' + Math.min(1, alpha).toFixed(4) + ')');
    }
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, rout, 0, Math.PI * 2);
    g.fill();
}

let rippleScratch = null;
function ensureRippleScratch(size, viewport) {
    const max = Math.ceil(Math.max(viewport.width, viewport.height) * 1.7);
    if (size > max) return null;
    if (!rippleScratch) {
        const c = document.createElement('canvas');
        rippleScratch = { c: c, g: c.getContext('2d'), size: 0 };
    }
    if (rippleScratch.c.width < size) {
        rippleScratch.c.width = size;
        rippleScratch.c.height = size;
    }
    return rippleScratch;
}
function createRipples({ config, viewport }) {
const ripples = [];
function spawnRipple(x, y, power) {
    const T = THEME.water.ripple;
    // ① 总数上限:超了顶掉【最老】的(它本来也最淡、最接近消失)
    while (ripples.length >= T.maxLive) ripples.shift();
    // ② 同处叠加抑制:刚冒出来、强度接近、位置几乎重合的,不重复冒
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        if (r.age > T.mergeAge) break;
        const dx = r.x - x, dy = r.y - y;
        if (Math.abs(r.power - power) < T.mergePower &&
            dx * dx + dy * dy < T.mergeDist * T.mergeDist) return;
    }
    const ripple = new Ripple(x, y, power, undefined, { viewport, config });
    ripple.useGpu = false;                 // 点击涟漪固定走新的 Canvas 2D 阻尼波剖面
    ripples.push(ripple);
}


return { ripples, spawnRipple, update(dt) { for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].update(dt); if (ripples[i].dead) ripples.splice(i, 1); } }, draw(g) { for (let i = ripples.length - 1; i >= 0; i--) ripples[i].draw(g); } };
}

/**
 * 雨滴场(2026-09-26):和鼠标涟漪**同一个 Ripple 类、同一套剖面参数**(profile 由
 * theme.weather.*.rain 派生自 THEME.water.ripple)—— 所以雨点和水面是"同一种水",
 * 不会出现两种圈。区别只有三处:
 *   ① 独立数组 + 独立上限(雨再大也挤不掉鼠标涟漪)
 *   ② 强制 Canvas 路径(不抢 GPU 涟漪容量)
 *   ③ 自己的随机流由调用方给(天气用 environment.rng,绝不碰共享 Math.random)
 * 绘制层由调用方决定:天气投稿在 weather 层(鼠标涟漪之上还是之下由层表说了算)。
 */
function createRainRipples({ viewport, config, profile }) {
    const P = profile || THEME.water.ripple;
    const list = [];
    const cap = P.maxLive || 140;
    return {
        get count() { return list.length; },
        get cap() { return cap; },
        spawn(x, y, power) {
            while (list.length >= cap) list.shift();      // 超了顶掉最老的(它最淡)
            const r = new Ripple(x, y, power, P, { viewport, config });
            r.useGpu = false;                             // 雨滴不走 GPU 路径
            list.push(r);
        },
        update(dt) {
            for (let i = list.length - 1; i >= 0; i--) { list[i].update(dt); if (list[i].dead) list.splice(i, 1); }
        },
        draw(g) { for (let i = list.length - 1; i >= 0; i--) list[i].draw(g); },
        clear() { list.length = 0; }
    };
}

Object.assign(exports, { createRipples, createRainRipples });
};
__modules["src/storage/repository.js"] = function (exports, __require) {
function createRepository() {
    return {
        getRaw(key) { try { return localStorage.getItem(key); } catch { return null; } },
        read(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } },
        write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
    };
}

Object.assign(exports, { createRepository });
};
__modules["src/input/input-router.js"] = function (exports, __require) {
function createInputRouter(mouse) {
    const actions = new Map();
    let mode = 'feed';
    return {
        move(x, y) { mouse.x = x; mouse.y = y; mouse.active = true; },
        leave() { mouse.active = false; },
        register(name, action) {
            if (actions.has(name)) throw new Error('Duplicate input mode: ' + name);
            actions.set(name, action);
            return () => actions.delete(name);
        },
        setMode(name) { if (!actions.has(name)) throw new Error('Unknown input mode: ' + name); mode = name; },
        activate(x, y) { actions.get(mode)?.(x, y); },
        dispose() { actions.clear(); mouse.active = false; }
    };
}

Object.assign(exports, { createInputRouter });
};
__modules["src/input/browser-input.js"] = function (exports, __require) {
function attachBrowserInput(router, canvas) {
    const move = e => router.move(e.clientX, e.clientY);
    const leave = () => router.leave();
    const click = e => { if (!e.defaultPrevented && e.target === canvas) router.activate(e.clientX, e.clientY); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseout', leave);
    window.addEventListener('click', click);
    return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseout', leave);
        window.removeEventListener('click', click);
    };
}

Object.assign(exports, { attachBrowserInput });
};
__modules["src/builtins.js"] = function (exports, __require) {
// 内置生物与玩法的清单 —— 装配层唯一需要"点名"的地方(2026-09-26 第二轮)
//
// 加一种新生物:写 src/pond/creatures/<kind>.js,在这里 creatures.register 一行。
// 加一个新玩法:  写 src/features/<name>.js(导出 create(ctx)),在这里 features.register 一行。
// 核心文件(app.js / renderer.js / collisions.js / population.js)都不需要改。
//
// 玩法声明自己需要什么,装配层照着接(层 id 见 core/layers.js):
//   layers      往绘制层投稿           interactions  占一个输入模式
//   update      每帧模拟(碰撞之前)     setEnabled    开关
const { createKoiCreature } = __require("src/pond/creatures/koi-fish.js");
const { createClock } = __require("src/features/clock.js");
const { createFeeding } = __require("src/features/feeding.js");
const { createFishManager } = __require("src/features/fish-manager.js");
const { createWeather } = __require("src/features/weather.js");
const { createIdleDrift } = __require("src/features/idle-drift.js");
const { createDayCycle } = __require("src/features/day-cycle.js");
const { createFishDebugPanel } = __require("src/ui/fish-debug-panel.js");
const { createRippleDebugPanel } = __require("src/ui/ripple-debug-panel.js");
const { createClockDebugPanel } = __require("src/ui/clock-debug-panel.js");
const { THEME } = __require("src/shared/legacy-assets.js");
function registerBuiltins({ creatures, features, context }) {
    // ── 生物:中国淡水鱼(复用既有分节身体与群游控制器) ──
    const koiKind = createKoiCreature({
        config: context.config, viewport: context.viewport, time: context.time, kois: context.kois,
        foods: context.foods, mouse: context.mouse, spawnRipple: context.spawnRipple,
        schoolSystem: context.schoolSystem, drawFish: context.drawFish
    });
    creatures.register({ id: 'koi-fish', title: '中国淡水鱼', create: koiKind.create, exports: koiKind });

    // ── 玩法:时钟(可在水下 hud 与最上层 ui 之间切换) ──
    features.register({ id: 'clock', title: '时钟', create: () => {
        const clock = createClock({ viewport: context.viewport });
        let on = true;
        return {
            layers: {
                hud: g => { if (on && !THEME.clock.foreground) clock.draw(g); },
                ui: g => { if (on && THEME.clock.foreground) clock.draw(g); }
            },
            setEnabled(next) { on = !!next; }        // 与第一轮一致:关掉只是不画,不是卸载
        };
    } });

    // ── 玩法:投喂(占输入模式 feed;开关走 config.enableFeeding) ──
    features.register({ id: 'feeding', title: '投喂', create: () => {
        const feeding = createFeeding({ config: context.config, foods: context.foods, Food: context.Food, spawnRipple: context.spawnRipple });
        return {
            interactions: { feed: feeding.feedAt },
            setEnabled(next) { context.config.enableFeeding = !!next; }
        };
    } });

    // ── 玩法:用户鱼数据库、添加器与状态面板 ──
    features.register({ id: 'customFish', title: '自定义鱼', create: () => {
        const make = () => createFishManager({
            Koi: koiKind.Koi, koiType: context.types.get('koi'),
            kois: context.kois, config: context.config, viewport: context.viewport,
            spawnRipple: context.spawnRipple, repository: context.repository
        });
        let inst = make();
        return {
            loadCustomFishFromStore: (...a) => inst?.loadCustomFishFromStore(...a),
            syncCustomFish: (...a) => inst?.syncCustomFish(...a),
            update: (...a) => inst?.update?.(...a),
            setEnabled(on) {
                if (!on) { inst?.dispose(); inst = null; }
                else if (!inst) { inst = make(); inst.loadCustomFishFromStore(); }
            },
            dispose() { inst?.dispose(); inst = null; }
        };
    } });

    // ── 玩法:天气(晴/阴/雨;雨环投稿 weather 层,光与色罩由 renderer 读环境状态) ──
    features.register({ id: 'weather', title: '天气', create: () => createWeather({
        config: context.config, viewport: context.viewport, environment: context.environment
    }) });

    // ── 玩法:自持事件(落叶/花瓣;无人值守时"画面自己发生的事",投稿 weather 层) ──
    // 它只借真引擎的公共通道:自己的雨滴场出涟漪、输入路由做惊扰、foods 里的不可见吸引子做聚集
    features.register({ id: 'idleDrift', title: '落叶花瓣', create: () => createIdleDrift({
        config: context.config, viewport: context.viewport, foods: context.foods,
        input: context.input, mouse: context.mouse, kois: context.kois
    }) });

    // ── 玩法:光的时段(光随时间走;写 environment 的时段通道 + 光向,默认开,宿主属性 dayCycle 可关) ──
    features.register({ id: 'dayCycle', title: '光随时间走', create: () => createDayCycle({
        config: context.config, environment: context.environment
    }) });

    // 独立编辑版的实时外观调试面板。
    features.register({ id: 'fishDebugPanel', title: '鱼外观调试', create: () => createFishDebugPanel({
        kois: context.kois, config: context.config, types: context.types, repository: context.repository
    }) });

    features.register({ id: 'rippleDebugPanel', title: '波纹调试', create: () => createRippleDebugPanel({
        config: context.config, viewport: context.viewport, spawnRipple: context.spawnRipple,
        repository: context.repository
    }) });

    features.register({ id: 'clockDebugPanel', title: '时间样式调试', create: () => createClockDebugPanel({
        repository: context.repository
    }) });

    return { creatures, features };
}

Object.assign(exports, { registerBuiltins });
};
__modules["src/pond/creatures/koi-fish.js"] = function (exports, __require) {
const { KOI_SHAPE } = __require("src/shared/legacy-assets.js");
const { varyHexColor } = __require("src/shared/math.js");
const { createBehavior } = __require("src/pond/behavior.js");
/**
 * 锦鲤 —— 默认生物 kind('koi-fish')。2026-09-26 第二轮从 pond/fish.js 搬进 pond/creatures/,
 * 顺便把"只有一种实体"的假设去掉:类型由注册表解析后传进来,自己声明碰撞契约与 translate()。
 * 身体数学、花纹、行为混入**逐行保持原样**(行为不允许在这次重构里变)。
 */
function createKoiCreature({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem, drawFish }) {
const { schools, trailPoint, QUEUE_LEN, SOLO_RATIO, SCHOOL_COUNT, SCHOOL_PERCEIVE_K, SCHOOL_PERCEIVE_MIN, SEP_W, ALIGN_W, COH_W, MAX_STEER } = schoolSystem;
class Koi {
    constructor(type, opts = {}) {
        this.type = type;
        this.typeId = type.id;
        this.segmentSpacing = this.type.segmentSpacing;
        // origin 决定"谁拥有它":stock=受鱼数设置管理 / spawned=手动投放 / custom=自定义鱼。
        // (第一轮用 `!custom` 反推"是不是库存鱼",于是任何新生物都会被鱼数设置裁掉 —— 见 population.js)
        this.origin = opts.origin || 'spawned';
        // 自定义鱼才有的字段(默认锦鲤全为 null / false,不影响任何既有分支)
        this.custom = opts.custom === true;
        this.drop = null;         // 投放动画状态:{t, dur, splashed}(见 releaseFish)
        this.shape = this.type.shape ? KOI_SHAPE.clampShape(this.type.shape) : null;        // 部位倍率(见 koishape.js 的 DEFAULTS)
        this.skin = null;         // 用户涂抹的纹理(HTMLImageElement)
        this.skinReady = false;
        this.name = '';
        this.x = Math.random() * viewport.width;
        this.y = Math.random() * viewport.height;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.baseSpeed = (0.4 + Math.random() * 0.4) * this.type.speedMultiplier;
        this.maxForce = 0.03;

        // 尺寸和深浅差异:没有这个,一池鱼像复制粘贴
        this.depth = Math.random();
        this.baseSizeMul = 0.40 + this.depth * 0.56;
        this.pickBreed();
        this.sizeMul = this.baseSizeMul * this.breedSize;

        this.segments = [];
        this.numSegments = 12;
        for (let i = 0; i < this.numSegments; i++) {
            this.segments.push({ x: this.x, y: this.y });
        }
        this.angle = Math.atan2(this.vy, this.vx);
        // 运动控制器：不使用航点或路径。heading/turnRate/speed 是唯一的运动状态，
        // vx/vy 仅是由它们导出的兼容值，供既有绘制和距离逻辑使用。
        this.heading = this.angle;
        this.turnRate = 0;
        this.speed = Math.hypot(this.vx, this.vy);

        this.bodyAngle = this.heading + Math.PI;

        const bodyLen = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        this.waveFreq = 1.00 + Math.random() * 0.55;         // 摆尾频率
        this.waveLen  = 4.3 + Math.random() * 2.3;           // 沿身体的相位差(≈波长)
        this.waveEnv  = bodyLen * (0.070 + Math.random() * 0.060);   // 尾端侧向幅度(约 0.07~0.13 体长)
        // 碰撞体:一条胶囊(脊柱第 0~9 节) + 身体半宽。长条形不能用圆判定。
        this.collHalf = bodyLen * 0.5;
        this.collR    = bodyLen * this.type.collisionRadius;
        // 碰撞契约(第二轮):碰撞系统只认这个描述符,不再假设对方是 12 节锦鲤
        this.collision = { shape: 'capsule', half: this.collHalf, r: this.collR, end: this.type.collisionEnd };
        this.burstRate = 0.30 + Math.random() * 0.35;        // ④ 间歇式游动的节奏
        this.burstPhase = Math.random() * Math.PI * 2;
        this.turnBias = 0;
        this.turnBiasTarget = (Math.random() - 0.5) * 0.20;
        this.turnBiasTimer = 1.5 + Math.random() * 2.5;
        this.cruisePhase = Math.random() * Math.PI * 2;
        // 25% 独游;其余随机分到 3 个群里。不同群之间只保持间距,不互相聚合。
        // 轮转而不是随机:随机分配实测出现过 群0:25 / 群1:15 / 群2:21,
        // 三群大小差一倍,一眼就看出不是三群而是一大两小。
        this.schoolId = Math.random() < this.type.soloRatio ? -1 : (schoolSystem.nextSchool());

        this.schoolFrac = Math.random();
        this.schoolSide = (Math.random() - 0.5) * 110;
        this.slotPhase  = Math.random() * Math.PI * 2;
        this.swimCycle = Math.random() * Math.PI * 2;
        this.fedTimer = 0;

        if (this.schoolId >= 0 && schools[this.schoolId] && schools[this.schoolId].trail) {
            const sc0 = schools[this.schoolId];
            const av0 = Math.max(80, (sc0.arcLive !== undefined ? sc0.arcLive : sc0.arc) - sc0.trail[0].a);
            const ql0 = Math.min(av0, QUEUE_LEN);
            const tp0 = trailPoint(sc0, (0.05 + 0.9 * this.schoolFrac) * ql0);
            if (tp0) {
                this.x = tp0.x + (-tp0.ty) * this.schoolSide;
                this.y = tp0.y + tp0.tx * this.schoolSide;
                this.heading = Math.atan2(tp0.ty, tp0.tx);
                this.angle = this.heading;
                this.vx = Math.cos(this.heading) * this.speed;
                this.vy = Math.sin(this.heading) * this.speed;
                for (let i = 0; i < this.numSegments; i++) {
                    this.segments[i].x = this.x;
                    this.segments[i].y = this.y;
                }
            }
        }
    }

    /** 按权重随机挑一个品种(红白/黄金/孔雀…)。
     *  原来这里还有"霓虹/单色"两个主题分支(上游留下的 fishTheme 属性)——
     *  已按用户决定删掉:这个池塘是低饱和写实风,霓虹/灰阶是另一个产品,
     *  而且默认档位就是它,那个下拉对用户等于没有。 */
    pickBreed() {
        const breeds = this.type.breeds;
        let r = Math.random() * breeds.reduce((sum, b) => sum + b.w, 0), acc = 0, pick = breeds[0];
        for (let k = 0; k < breeds.length; k++) {
            acc += breeds[k].w;
            if (r <= acc) { pick = breeds[k]; break; }
        }
        this.applyBreed(pick);
    }

    applyBreed(pick) {
        this.breedId = pick.id || 'custom-palette';
        this.breed = pick.name;
        this.breedSize = pick.size || 1;
        if (this.baseSizeMul) this.sizeMul = this.baseSizeMul * this.breedSize;
        this.shape = KOI_SHAPE.clampShape(pick.shape || this.type.shape);
        this.outlineWidth = pick.outlineWidth ?? 0.10;
        const tint = (Math.random() - 0.5) * 0.18;
        this.color = varyHexColor(pick.body, tint);

        // 花纹特征
        this.net = (pick.net || 0) * (0.75 + Math.random() * 0.5);      // 每条鱼的网纹强度也有差
        this.sheen = (pick.sheen || 0) * (0.8 + Math.random() * 0.4);
        this.kuchi = pick.kuchi ? varyHexColor(pick.kuchi, tint * 0.6) : null;
        this.edge = pick.edge ? varyHexColor(pick.edge, tint * 0.6) : null;

        // ★ 必须和 Koi.draw 里的 BODY_SPAN 完全一致。
        //   这里曾经是 0.86 而 draw 里是 0.78 —— 斑块的 u 区间整体偏后,
        //   超出体长的部分还会被轮廓裁掉,看着就是"斑长错了位置"。
        const BODY_SPAN = 0.78, NSEG = 11;
        this.spotRanges = [];
        const patches = pick.patches || [];
        for (let k = 0; k < patches.length; k++) {
            const pt = patches[k];
            const segs = pt.segs || [];
            if (!segs.length) continue;
            // 段号 → u 区间。每块斑的宽度和颜色都各自独立(轻微色差更自然)
            const u0 = Math.min(BODY_SPAN, segs[0] / NSEG);
            const u1 = Math.min(BODY_SPAN, (segs[segs.length - 1] + 1) / NSEG);
            this.spotRanges.push([
                u0, u1,
                varyHexColor(pt.color, tint * 0.6),
                pt.pw || 0.5
            ]);
        }
        // 兼容旧的 heads 写法(霓虹/单色主题还在用)
        if (!patches.length && pick.heads && pick.heads.length) {
            const u0 = Math.min(BODY_SPAN, pick.heads[0] / NSEG);
            const u1 = Math.min(BODY_SPAN, (pick.heads[pick.heads.length - 1] + 1) / NSEG);
            this.spotRanges.push([u0, u1, varyHexColor(pick.spot || '#ffffff', tint * 0.6), 0.52]);
        }
    }

    /** 碰撞推开:整体位移(身体各节一起挪,否则会把鱼扯直) */
    translate(dx, dy) {
        this.x += dx; this.y += dy;
        const S = this.segments;
        for (let i = 0; i < S.length; i++) { S[i].x += dx; S[i].y += dy; }
    }
}

Object.assign(Koi.prototype, createBehavior({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem }));
Koi.prototype.draw = function(ctx) { (this.type.draw || drawFish).call(this, ctx); };

// create 是注册表用的入口;Koi 只暴露给"要继承锦鲤身体"的既有功能(自定义鱼)。
// 新生物请写自己的 creature kind,不要继承这个类。
return { create: (type, opts) => new Koi(type, opts), Koi };
}

Object.assign(exports, { createKoiCreature });
};
__modules["src/pond/behavior.js"] = function (exports, __require) {
const { distanceSq } = __require("src/shared/math.js");
function createBehavior({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem }) {
const { schools, trailPoint, QUEUE_LEN, SOLO_RATIO, SCHOOL_COUNT, SCHOOL_PERCEIVE_K, SCHOOL_PERCEIVE_MIN, SEP_W, ALIGN_W, COH_W, MAX_STEER } = schoolSystem;
const FOOD_DETECT_RADIUS_SQ = 230400;
const EAT_RADIUS = 20;          // 吃到半径(px)。原来只写了平方值,身体判定要用原值
const EAT_RADIUS_SQ = 400;
const FEAR_RADIUS_SQ = 40000;
function computeFlockInfluence() {
        let sepX = 0, sepY = 0, alignX = 0, alignY = 0;
        let centerX = 0, centerY = 0, neighborCount = 0;
        let pushX = 0, pushY = 0, separationPressure = 0;
        const ownLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;

        for (let i = 0; i < kois.length; i++) {
            const other = kois[i];
            if (other === this) continue;
            const dx = this.x - other.x, dy = this.y - other.y;
            const d = Math.hypot(dx, dy);
            if (d < 0.001) continue;

            const otherLength = (other.numSegments - 1) * other.segmentSpacing * config.fishSize * other.sizeMul;

            const personalSpace = (ownLength + otherLength) * 0.60;
            const perception = Math.max(SCHOOL_PERCEIVE_MIN, (ownLength + otherLength) * SCHOOL_PERCEIVE_K);
            if (d > perception) continue;

            if (d < personalSpace) {
                const pressure = 1 - d / personalSpace;
                const nx = dx / d, ny = dy / d;

                sepX += nx * pressure;
                sepY += ny * pressure;
                separationPressure = Math.max(separationPressure, pressure);
            }

            if (this.schoolId >= 0 && this.schoolId === other.schoolId) {
                neighborCount++;
                alignX += other.vx;
                alignY += other.vy;
                centerX += other.x;
                centerY += other.y;
            }
        }

        let forceX = 0, forceY = 0;
        const sepLength = Math.hypot(sepX, sepY);
        if (sepLength > 0.001) {
            forceX += sepX / sepLength * SEP_W;
            forceY += sepY / sepLength * SEP_W;
        }
        if (neighborCount > 0) {
            const alignLength = Math.hypot(alignX, alignY);
            if (alignLength > 0.001) {                 // 对齐:跟上同群的平均朝向
                forceX += alignX / alignLength * ALIGN_W;
                forceY += alignY / alignLength * ALIGN_W;
            }
            const cohesionX = centerX / neighborCount - this.x;
            const cohesionY = centerY / neighborCount - this.y;
            const cohesionLength = Math.hypot(cohesionX, cohesionY);
            if (cohesionLength > 0.001) {              // 聚合:朝同群邻居的质心靠
                forceX += cohesionX / cohesionLength * COH_W;
                forceY += cohesionY / cohesionLength * COH_W;
            }
        }

        const turnFrom = (fx, fy, cap) => {
            const len = Math.hypot(fx, fy);
            if (len < 0.001) return 0;
            const h = Math.atan2(fy, fx);
            return Math.atan2(Math.sin(h - this.heading), Math.cos(h - this.heading)) * Math.min(cap, len) * 1.25;
        };
        return {
            turn: turnFrom(forceX, forceY, MAX_STEER),
            sepTurn: turnFrom(sepX / (sepLength || 1) * SEP_W, sepY / (sepLength || 1) * SEP_W, MAX_STEER),
            pushX,
            pushY,
            pressure: separationPressure
        };
    }

function bodyTouchesFood(f) {
        const S = this.segments;
        // 判定半径 = 身体半宽 + 一点嘴的够得着范围。
        // 不能用 EAT_RADIUS + collR(=28px):那样食物在鼻前 25px 就"算碰到身体"了,
        // 看起来是饲料凭空消失,而不是鱼游过去吃掉的。
        const rr = this.collR + 11;
        const n = Math.min(10, S.length);
        for (let i = 0; i < n; i++) {
            const dx = f.x - S[i].x, dy = f.y - S[i].y;
            if (dx * dx + dy * dy < rr * rr) return true;
        }
        return false;
    }

function update(dt) {
        const collisionLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        this.collHalf = collisionLength * 0.5;
        this.collR = collisionLength * this.type.collisionRadius;
        let dtMult = dt * 60;

        if (this.drop) {
            this.drop.t += dt;
            const p = this.drop.t / this.drop.dur;
            this.speed = 0;                                  // 下落中不游
            if (!this.drop.splashed && p >= 0.55) {
                this.drop.splashed = true;
                const c = this.segments[0];
                const rs = config.rippleStrength;
                // 三圈同心、扩散速度不同:一圈是"点了一下",三圈才像"扑通"
                spawnRipple(c.x, c.y, 3.2 * rs);   // 一道大涟漪(不再叠三圈)
            }
            if (p >= 1) { this.drop = null; this.speed = 2.4; }   // 入水后窜一下,别原地飘
        }
        if (this.fedTimer > 0) this.fedTimer -= dtMult;

        let target = null;
        let minDistSq = Infinity;
        if (this.fedTimer <= 0) {
            for (let i = 0; i < foods.length; i++) {
                let dSq = distanceSq(this, foods[i]);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    target = foods[i];
                }
            }
        }

        let effectiveBaseSpeed = this.baseSpeed * config.fishSpeed;
        const bodyLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        const motionTurnRadius = config.motionTurnRadius ?? 1;
        const motionTurnResponse = config.motionTurnResponse ?? 1;
        const motionCruiseCurve = config.motionCruiseCurve ?? 1;
        // 锦鲤平时至少以约 2.5 个身长的半径转弯；速度高时才允许收紧弧线。
        const minimumTurnRadius = bodyLength * this.type.turnRadius * motionTurnRadius;
        const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        let desiredTurnRate = 0;
        let desiredSpeed = effectiveBaseSpeed;
        let behavior = 'cruise';
        let wantHeading = null;   // 本行为想去哪个方向(原地掉头要用)
        const flock = this.computeFlockInfluence();

        const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
        const safeMargin = Math.max(50, bodyLength * 1.0);
        const probeDistance = Math.max(minimumTurnRadius * 1.15, this.speed * 60 * 0.9);
        let inwardX = 0, inwardY = 0, threat = 0;
        const consider = (room, comp, ix, iy) => {
            if (comp <= 0.02) return;                  // 背离这面墙 → 不会撞,不产生威胁
            const t = (room - safeMargin) / (comp * probeDistance);
            if (t < 1) {
                const w = 1 - Math.max(0, t);
                if (w > threat) { threat = w; inwardX = ix; inwardY = iy; }
            }
        };
        consider(viewport.width - this.x, fx, -1, 0);
        consider(this.x, -fx, 1, 0);
        consider(viewport.height - this.y, fy, 0, -1);
        consider(this.y, -fy, 0, 1);
        let edgeThreat = clamp(threat, 0, 1);

        const wantsFood = !!target && minDistSq < FOOD_DETECT_RADIUS_SQ;
        const foodWins = wantsFood && edgeThreat < 0.5;
        if (edgeThreat > 0.04 && !foodWins) {
            behavior = 'edge';
            let inwardHeading = Math.atan2(inwardY, inwardX);
            wantHeading = inwardHeading;
            desiredTurnRate = clamp(wrapAngle(inwardHeading - this.heading) * 3.0, -1.45, 1.45);
            desiredSpeed = effectiveBaseSpeed * (1.0 - edgeThreat * 0.20);
        } else if (foodWins) {
            behavior = 'food';
            let foodHeading = Math.atan2(target.y - this.y, target.x - this.x);
            wantHeading = foodHeading;
            desiredTurnRate = clamp(wrapAngle(foodHeading - this.heading) * 2.6, -1.45, 1.45);

            const fd = Math.sqrt(minDistSq);

            const near = clamp((fd - 14) / 110, 0.34, 1);
            desiredSpeed = effectiveBaseSpeed * 2.20 * near;   // 追饵冲刺(原 1.70)

            if (minDistSq < EAT_RADIUS_SQ || this.bodyTouchesFood(target)) {
                foods.splice(foods.indexOf(target), 1);
                this.onEat?.();
                this.fedTimer = 51;
            }

        } else if (config.shyFish && mouse.active && distanceSq(this, mouse) < FEAR_RADIUS_SQ) {
            behavior = 'flee';
            let fleeHeading = Math.atan2(this.y - mouse.y, this.x - mouse.x);
            wantHeading = fleeHeading;
            desiredTurnRate = clamp(wrapAngle(fleeHeading - this.heading) * 2.7, -1.35, 1.35);
            desiredSpeed = effectiveBaseSpeed * 2.80;   // 受惊逃窜(原 2.15)
        } else if (this.schoolId >= 0 && schools[this.schoolId]) {

            behavior = 'school';
            const s = schools[this.schoolId];

            const arcNow = (s.arcLive !== undefined ? s.arcLive : s.arc);
            const avail = Math.max(80, arcNow - (s.trail && s.trail.length ? s.trail[0].a : 0));
            const queueLen = Math.min(avail, QUEUE_LEN);

            const wantBack = (0.05 + 0.9 * this.schoolFrac) * QUEUE_LEN;
            const back = Math.min(wantBack, Math.max(30, avail - 30));
            const tp = trailPoint(s, back
                                     + Math.sin(time.elapsed * 0.35 + this.slotPhase) * 16);
            const fwd = s.curSpeed || s.speed;
            let tx = this.x, ty = this.y;
            if (tp) {
                const pnx = -tp.ty, pny = tp.tx;          // 路径法线 = 队伍的横向厚度
                const side = this.schoolSide
                           + Math.cos(time.elapsed * 0.29 + this.slotPhase) * 10;
                tx = tp.x + pnx * side;
                ty = tp.y + pny * side;
            }

            const kp = 0.008;
            const fwdX = tp ? tp.tx : Math.cos(s.heading);
            const fwdY = tp ? tp.ty : Math.sin(s.heading);
            const dvx = fwdX * fwd + (tx - this.x) * kp;
            const dvy = fwdY * fwd + (ty - this.y) * kp;
            const dvLen = Math.hypot(dvx, dvy);
            if (dvLen > 0.001) {
                const wantH = Math.atan2(dvy, dvx);
                wantHeading = wantH;
                desiredTurnRate = clamp(wrapAngle(wantH - this.heading) * 2.2, -1.20, 1.20);

                const err = Math.hypot(tx - this.x, ty - this.y);
                const catchUp = Math.min(2.6, 1 + err / 90);
                desiredSpeed = Math.min(dvLen, fwd * catchUp);
            }
        } else {
            // 有记忆的巡游偏向：短时间内保持同侧的微弯，之后才柔和地换侧。
            this.turnBiasTimer -= dt;
            if (this.turnBiasTimer <= 0) {
                this.turnBiasTarget = (Math.random() - 0.5) * 0.26;
                this.turnBiasTimer = 1.8 + Math.random() * 3.2;
            }
            this.turnBias += (this.turnBiasTarget - this.turnBias) * Math.min(1, dt / 1.25);
            desiredTurnRate = this.turnBias * motionCruiseCurve;
            this.cruisePhase += dt * 0.42;

            this.burstPhase += dt * this.burstRate;
            desiredSpeed = effectiveBaseSpeed * (0.78 + 0.34 * (0.5 + 0.5 * Math.sin(this.burstPhase)));
            // 走到这里的一定是独游的鱼(schoolId = -1):群员都在上面的 school 分支里。
        }

        this.lastBehavior = behavior;   // 诊断用:可以随时在控制台/--eval 里查每条鱼走的分支
        // 行为优先级仍由上面的分支决定；群体力只做局部修正。
        // 追食时保留 60% 分离，既能围食也不会让鱼身体互相穿过。
        if (behavior !== 'edge') {
            if (behavior === 'school') {
                // 群员只吃分离:方向和对齐由编队目标点负责,见 computeFlockInfluence 的注释
                desiredTurnRate += flock.sepTurn * 0.30;
            } else {
                const flockWeight = behavior === 'food' ? 0.60 : behavior === 'flee' ? 0.45 : 1.0;
                desiredTurnRate += flock.turn * flockWeight;
            }
        }

        // 全局转向响应只调整运动手感，不改变行为优先级。
        desiredTurnRate *= motionTurnResponse;

        let pivot = false;

        if (wantHeading !== null && behavior !== 'school') {

            pivot = Math.abs(wrapAngle(wantHeading - this.heading)) > 2.39;
        }

        if (pivot) this.pivotTimer = 0.8;
        else if (this.pivotTimer > 0) { this.pivotTimer -= dt; pivot = true; }
        if (pivot) {
            desiredTurnRate = clamp(wrapAngle(wantHeading - this.heading) * 2.6, -2.6, 2.6);
            desiredSpeed = Math.min(desiredSpeed, effectiveBaseSpeed * 0.36);
        }
        this.lastPivot = pivot;      // 诊断用:可随时查哪些鱼正在原地掉头

        // 转向率和速度都有惯性；这里不再直接覆盖 vx/vy。
        const speedPerSecond = Math.max(this.speed, effectiveBaseSpeed * 0.42) * 60;

        // ★ 判断条件用 schoolId,不能用 behavior —— 'school' 行为分支已经删掉了,
        //   继续按 behavior 判断的话群员会拿回 2.5 身长的转弯半径,又跟不住领头鱼。

        let turnRadius = minimumTurnRadius;
        if (pivot) turnRadius = minimumTurnRadius * 0.05;          // 原地掉头:半径压到最小
        else if (behavior === 'food') turnRadius = minimumTurnRadius * 0.26;
        else if (this.schoolId >= 0) turnRadius = minimumTurnRadius * 0.32;

        const fastAct = (behavior === 'food' || behavior === 'flee');
        const maxTurnRate = Math.min(pivot ? 2.6 : (fastAct ? 1.6 : 1.15),
                                     speedPerSecond / turnRadius);
        const turnAcceleration = (pivot ? 7.0 : 2.6) * motionTurnResponse; // 掉头时转向要起得来
        desiredTurnRate = clamp(desiredTurnRate, -maxTurnRate, maxTurnRate);
        this.turnRate += clamp(desiredTurnRate - this.turnRate, -turnAcceleration * dt, turnAcceleration * dt);
        this.turnRate = clamp(this.turnRate, -maxTurnRate, maxTurnRate);
        this.heading = wrapAngle(this.heading + this.turnRate * dt);

        let speedResponse = desiredSpeed > this.speed ? 1.8 : 1.15;
        // 掉头时减速要快:时间常数从 ~0.9 秒压到 ~0.29 秒,否则 0.8 秒的窗口里掉不下来
        if (pivot) speedResponse = 3.5;

        if (behavior === 'food' || behavior === 'flee') speedResponse = 4.5;
        this.speed += (desiredSpeed - this.speed) * Math.min(1, speedResponse * dt);
        // 上限要容得下新的倍率(2.8),否则躲鼠标的速度会被夹在 2.2 倍,提不起来
        let speedCap = effectiveBaseSpeed * 3.2;
        let speedFloor = effectiveBaseSpeed * 0.42;
        if (this.schoolId >= 0 && schools[this.schoolId]) {

            // 循迹之后不需要大范围变速:上限收到 1.5 倍,避免"为了抢位置而冲刺"
            const ls = schools[this.schoolId].speed;
            speedCap = Math.max(speedCap, ls * 2.6);   // 群员仍只跟到领头鱼的 2.6 倍
            speedFloor = Math.min(speedFloor, ls * 0.55);
        }
        this.speed = clamp(this.speed, speedFloor, speedCap);
        this.vx = Math.cos(this.heading) * this.speed;
        this.vy = Math.sin(this.heading) * this.speed;
        this.x += this.vx * dtMult;
        this.y += this.vy * dtMult;
        // 这里不再加 flock.push —— 位置的消重叠统一由 resolveFishCollisions() 负责

        // 兜底而非日常边界策略：若浏览器卡顿导致跨出画布，立即反射朝外分量。
        if (this.x < 0) { this.x = 0; this.heading = Math.atan2(Math.sin(this.heading), Math.abs(Math.cos(this.heading))); this.turnRate = 0; }
        if (this.x > viewport.width) { this.x = viewport.width; this.heading = Math.atan2(Math.sin(this.heading), -Math.abs(Math.cos(this.heading))); this.turnRate = 0; }
        if (this.y < 0) { this.y = 0; this.heading = Math.atan2(Math.abs(Math.sin(this.heading)), Math.cos(this.heading)); this.turnRate = 0; }
        if (this.y > viewport.height) { this.y = viewport.height; this.heading = Math.atan2(-Math.abs(Math.sin(this.heading)), Math.cos(this.heading)); this.turnRate = 0; }
        this.vx = Math.cos(this.heading) * this.speed;
        this.vy = Math.sin(this.heading) * this.speed;

        // 游速主要通过尾拍频率表现；尾幅不随速度夸张放大。
        this.swimCycle += (1.45 + this.speed * 60 * 0.075) * dt;
        this.angle = this.heading;

        this.segments[0].x = this.x;
        this.segments[0].y = this.y;

        let currentSpacing = this.segmentSpacing * config.fishSize * this.sizeMul;   // 少了 sizeMul 的话,大鱼只是变胖不变长

        // 逐节跟随必须**限制每一节相对上一节的转角**。
        // 原来只固定距离、方向完全由上一帧的旧位置决定 —— 头一急转,或者某一帧 dt 变大
        // 让头跳得比节距还远,后面几节就会朝反方向落下去,鱼把自己对折(实测出现过 cos=-1)。

        const MAX_JOINT_TURN = 0.17;                   // 空间:相邻节最大夹角(几何量)
        const MAX_JOINT_RATE = 3.5;                    // 时间:同一关节每秒最多转多少
        const maxJointTurn = MAX_JOINT_TURN;
        const maxJointStep = MAX_JOINT_RATE * dt;
        // ★ 起始角持久化:让第一关节也受限(原来这里是 null,第一关节因此不受限)
        let prevAngle = this.bodyAngle;
        let firstJointAngle = null;   // ★ 要存【第一节】的角度,不是最后一节
        if (!this.jointAngles) this.jointAngles = [];
        for (let i = 1; i < this.numSegments; i++) {
            let prev = this.segments[i - 1];
            let curr = this.segments[i];

            let dx = prev.x - curr.x;
            let dy = prev.y - curr.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let a = dist > 0.001
                ? Math.atan2(dy, dx)
                : (prevAngle !== null ? prevAngle : this.angle + Math.PI);

            if (prevAngle !== null) {
                let d = Math.atan2(Math.sin(a - prevAngle), Math.cos(a - prevAngle));
                a = prevAngle + Math.max(-maxJointTurn, Math.min(maxJointTurn, d));
            }
            curr.x = prev.x - Math.cos(a) * currentSpacing;
            curr.y = prev.y - Math.sin(a) * currentSpacing;

            const pa = this.jointAngles[i];
            if (pa !== undefined) {
                const d2 = Math.atan2(Math.sin(a - pa), Math.cos(a - pa));
                a = pa + Math.max(-maxJointStep, Math.min(maxJointStep, d2));
            }
            this.jointAngles[i] = a;
            if (i === 1) firstJointAngle = a;
            prevAngle = a;
        }

        if (firstJointAngle !== null) this.bodyAngle = firstJointAngle;

    }

return { computeFlockInfluence, bodyTouchesFood, update };
}

Object.assign(exports, { createBehavior });
};
__modules["src/features/clock.js"] = function (exports, __require) {
const { THEME } = __require("src/shared/legacy-assets.js");
/* ★ 光向【每帧现读】,不再在加载时解构。
 *   原来是 `const [lx(), ly()] = THEME.light.dir` —— 加载时固化,
 *   之后运行时光向转了也【完全不动】(影子/涟漪/时钟偏移全都不跟),典型的"改了没反应"。
 *   这是"光随时间走"(experiments/day-phase)的前提。
 *   ⚠️ THEME.light.dir 必须保持【单位向量】:多处拿它做投影与偏移量。 */
const lx = () => THEME.light.dir[0];
const ly = () => THEME.light.dir[1];
function createClock({ viewport }) {
let clockTime = '', clockDate = '', clockStamp = '';
const glassCache = new Map();
const cardBuffer = document.createElement('canvas');

function roundedRect(g, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + width, y, x + width, y + height, r);
    g.arcTo(x + width, y + height, x, y + height, r);
    g.arcTo(x, y + height, x, y, r);
    g.arcTo(x, y, x + width, y, r);
    g.closePath();
}

function drawFrostedCard(g, x, y, width, height, short, T) {
    const blur = Math.max(0.1, short * (T.cardBlur ?? 0.012));
    const opacity = T.cardOpacity ?? 0.45;
    const bleed = Math.ceil(blur * 2);
    const sx = Math.max(0, Math.floor(x - bleed));
    const sy = Math.max(0, Math.floor(y - bleed));
    const sw = Math.min(g.canvas.width - sx, Math.ceil(width + bleed * 2));
    const sh = Math.min(g.canvas.height - sy, Math.ceil(height + bleed * 2));
    if (cardBuffer.width !== sw || cardBuffer.height !== sh) {
        cardBuffer.width = sw;
        cardBuffer.height = sh;
    }
    const bg = cardBuffer.getContext('2d');
    bg.clearRect(0, 0, sw, sh);
    bg.filter = 'blur(' + blur.toFixed(1) + 'px) saturate(82%)';
    bg.drawImage(g.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    bg.filter = 'none';

    const radius = Math.max(2, short * (T.cardRadius ?? 0.022));
    g.save();
    roundedRect(g, x, y, width, height, radius);
    g.fillStyle = 'rgba(24,45,38,0.16)';
    g.shadowColor = 'rgba(8,27,23,' + (T.cardShadow ?? 0.34).toFixed(3) + ')';
    g.shadowBlur = short * 0.026;
    g.shadowOffsetX = -lx() * short * 0.008;
    g.shadowOffsetY = -ly() * short * 0.008;
    g.fill();
    g.restore();

    g.save();
    roundedRect(g, x, y, width, height, radius);
    g.clip();
    g.drawImage(cardBuffer, sx, sy);
    const tintValue = parseInt(String(T.cardTint || '#d7e2d1').slice(1), 16);
    const tr = tintValue >> 16, tg = (tintValue >> 8) & 255, tb = tintValue & 255;
    const tint = g.createLinearGradient(x, y, x + width, y + height);
    tint.addColorStop(0, 'rgba(' + Math.round(tr + (255 - tr) * 0.32) + ',' + Math.round(tg + (255 - tg) * 0.32) + ',' + Math.round(tb + (255 - tb) * 0.32) + ',' + Math.min(0.9, opacity * 1.22).toFixed(3) + ')');
    tint.addColorStop(0.56, 'rgba(' + tr + ',' + tg + ',' + tb + ',' + opacity.toFixed(3) + ')');
    tint.addColorStop(1, 'rgba(' + Math.round(tr * 0.86) + ',' + Math.round(tg * 0.90) + ',' + Math.round(tb * 0.88) + ',' + (opacity * 0.76).toFixed(3) + ')');
    g.fillStyle = tint;
    g.fillRect(x, y, width, height);
    g.restore();

    g.save();
    roundedRect(g, x + 0.5, y + 0.5, width - 1, height - 1, radius - 0.5);
    g.strokeStyle = 'rgba(249,255,244,0.62)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
}

function glassText(text, size, weight, T) {
    const strength = Math.max(0.1, T.dropletStrength ?? 0.3);
    const lightX = Math.round(lx() * 10) / 10, lightY = Math.round(ly() * 10) / 10;
    const key = [text, Math.round(size), weight, T.font, strength, lightX, lightY].join('|');
    if (glassCache.has(key)) return glassCache.get(key);

    const source = document.createElement('canvas');
    const probe = source.getContext('2d');
    probe.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
    const metrics = probe.measureText(text);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.25);
    const blur = Math.max(1, size * 0.12 * strength);
    const rim = Math.max(2, Math.round(size * 0.034 * strength));
    const pad = Math.ceil(blur * 2 + rim * 3 + 2);
    source.width = Math.ceil(metrics.width) + pad * 2;
    source.height = ascent + descent + pad * 2;

    const sg = source.getContext('2d');
    sg.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
    sg.textBaseline = 'alphabetic';
    sg.fillStyle = '#fff';
    sg.fillText(text, pad, pad + ascent);

    const blurred = document.createElement('canvas');
    blurred.width = source.width;
    blurred.height = source.height;
    const bg = blurred.getContext('2d');
    bg.filter = 'blur(' + blur.toFixed(2) + 'px)';
    bg.drawImage(source, 0, 0);
    bg.filter = 'none';

    const raw = bg.getImageData(0, 0, blurred.width, blurred.height);
    const solid = sg.getImageData(0, 0, source.width, source.height).data;
    const mask = new Uint8Array(source.width * source.height);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
        // 与参考 SVG 的 feColorMatrix 相同：把模糊 Alpha 挤回圆润的液态轮廓。
        const goo = Math.max(0, Math.min(1, raw.data[p + 3] / 255 * 25 - 10));
        mask[i] = Math.max(solid[p + 3], goo * 255) > 127 ? 1 : 0;
    }

    const glass = document.createElement('canvas');
    glass.width = source.width;
    glass.height = source.height;
    const gg = glass.getContext('2d');
    const pixels = gg.createImageData(glass.width, glass.height);
    const sample = (x, y) => x < 0 || y < 0 || x >= glass.width || y >= glass.height ? 0 : mask[y * glass.width + x];
    const offsets = [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [rim, rim], [-rim, rim], [rim, -rim], [-rim, -rim]];

    for (let y = 0; y < glass.height; y++) for (let x = 0; x < glass.width; x++) {
        const inside = sample(x, y);
        if (!offsets.some(([ox, oy]) => sample(x + ox, y + oy) !== inside)) continue;
        const gx = sample(x - rim, y) - sample(x + rim, y);
        const gy = sample(x, y - rim) - sample(x, y + rim);
        const length = Math.hypot(gx, gy) || 1;
        const facing = Math.max(-1, Math.min(1, (gx * lightX + gy * lightY) / length));
        const shine = Math.pow((facing + 1) / 2, 2.2);
        const p = (y * glass.width + x) * 4;
        if (inside) {
            // 内沿像水滴迎光面：清亮但不填满字面。
            pixels.data[p] = 150 + Math.round(97 * shine);
            pixels.data[p + 1] = 210 + Math.round(45 * shine);
            pixels.data[p + 2] = 207 + Math.round(45 * shine);
            pixels.data[p + 3] = Math.round(255 * Math.min(0.92, 0.38 + shine * 0.50));
        } else {
            // 外沿是透过水体看到的深色折射圈，保证浅水背景上仍能辨认。
            pixels.data[p] = 3 + Math.round(38 * shine);
            pixels.data[p + 1] = 35 + Math.round(70 * shine);
            pixels.data[p + 2] = 39 + Math.round(67 * shine);
            pixels.data[p + 3] = Math.round(255 * (0.46 - shine * 0.12));
        }
    }
    gg.putImageData(pixels, 0, 0);

    const result = { canvas: glass, width: metrics.width, pad };
    glassCache.set(key, result);
    if (glassCache.size > 8) glassCache.delete(glassCache.keys().next().value);
    return result;
}

function refreshClockText() {
    const d = new Date();
    const stamp = d.getFullYear() + '/' + d.getMonth() + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
    if (stamp === clockStamp) return;          // 一分钟才重算一次,别每帧都格式化
    clockStamp = stamp;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    clockTime = hh + ':' + mm;
    const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    clockDate = (d.getMonth() + 1) + '月' + d.getDate() + '日  星期' + wk;
}

function drawClock(g) {
    const T = THEME.clock;
    if (!T.show) return;
    refreshClockText();
    const short = Math.min(viewport.width, viewport.height);
    const tSize = short * T.timeSize;
    const dSize = tSize * T.dateSize;
    const gap = tSize * T.gap;
    // anchor 的写法是【纵向-横向】(top-center = 靠上 + 居中)
    const [vert, horiz] = T.anchor.split('-');
    const mx = viewport.width * T.marginX, my = viewport.height * T.marginY;

    g.save();
    g.textBaseline = 'middle';
    g.textAlign = horiz === 'left' ? 'left' : (horiz === 'right' ? 'right' : 'center');
    const cx = horiz === 'left' ? mx : (horiz === 'right' ? viewport.width - mx : viewport.width / 2);

    const timeWeight = T.weight || 600;
    const dateWeight = Math.max(300, timeWeight - 200);
    g.font = timeWeight + ' ' + Math.round(tSize) + 'px ' + T.font;
    const timeWidth = g.measureText(clockTime).width;
    g.font = dateWeight + ' ' + Math.round(dSize) + 'px ' + T.font;
    const dateWidth = g.measureText(clockDate).width;

    // 时间在上、日期在下;整块的高度用来做垂直锚点
    const blockH = tSize + gap + dSize;
    const top = vert === 'top' ? my : viewport.height - my - blockH;
    const timeY = top + tSize / 2;
    const dateY = top + tSize + gap + dSize / 2;

    if (T.cardGlass) {
        const padX = tSize * 0.34, padY = tSize * 0.30;
        const cardWidth = Math.max(timeWidth, dateWidth) + padX * 2;
        const cardHeight = blockH + padY * 2;
        const cardX = horiz === 'left' ? cx - padX : (horiz === 'right' ? cx - cardWidth + padX : cx - cardWidth / 2);
        drawFrostedCard(g, cardX, top - padY, cardWidth, cardHeight, short, T);
    }

    // 影子沿全局光向偏移 + 模糊 —— 和鱼的影子同一套光,才会像"在这个场景里"
    const off = short * T.shadowOffset;
    g.shadowColor = T.shadow + T.shadowAlpha + ')';
    g.shadowBlur = short * T.shadowBlur;
    g.shadowOffsetX = -lx() * off;      // 光从左上来 → 影子往右下
    g.shadowOffsetY = -ly() * off;

    const rf = short * 0.0022;
    function drawMainText(text, x, y, size, weight) {
        g.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
        if (!T.droplet) {
            g.fillStyle = T.cardGlass ? T.cardTextColor : T.color;
            g.fillText(text, x, y);
            return;
        }

        const glass = glassText(text, size, weight, T);
        const left = g.textAlign === 'left' ? x : (g.textAlign === 'right' ? x - glass.width : x - glass.width / 2);
        g.drawImage(glass.canvas, left - glass.pad, y - glass.canvas.height / 2);
    }

    if (!T.droplet) {
        g.save();
        g.shadowColor = 'transparent';
        g.fillStyle = T.cardGlass ? 'rgba(17,70,60,0.14)' : 'rgba(150,220,215,0.20)';
        g.font = timeWeight + ' ' + Math.round(tSize) + 'px ' + T.font;
        g.fillText(clockTime, cx - lx() * rf, timeY - ly() * rf);
        g.font = dateWeight + ' ' + Math.round(dSize) + 'px ' + T.font;
        g.fillText(clockDate, cx - lx() * rf, dateY - ly() * rf);
        g.restore();
    }

    drawMainText(clockTime, cx, timeY, tSize, timeWeight);
    drawMainText(clockDate, cx, dateY, dSize, dateWeight);
    g.restore();
}

return { draw: drawClock };
}

Object.assign(exports, { createClock });
};
__modules["src/features/feeding.js"] = function (exports, __require) {
function createFeeding({ config, foods, Food, spawnRipple }) {
function feedAt(x, y) {
    if (config.enableFeeding) {
        // 一次撒一小把饲料,而不是一粒。
        // 这样几条鱼会各自锁定最近的一粒 —— 一撒下去就有一群围过来,而不是只有一条有份。

        const N = 20;                                      // 每次 20 粒
        const MAX_FOOD = 240;                              // 上限,防止狂点堆爆
        const startIdx = foods.length;                     // 只给"新撒的这批"做落水弹跳
        for (let i = 0; i < N && foods.length < MAX_FOOD; i++) {
            let a = Math.random() * Math.PI * 2;
            let d = 8 + Math.pow(Math.random(), 0.60) * 48; // 8~56px,中心稍密
            const fx = x + Math.cos(a) * d;
            const fy = y + Math.sin(a) * d * 0.85;
            foods.push(new Food(fx, fy));
        }
        for (let i = startIdx; i < foods.length; i++) {
            foods[i].pop = 0.4 + Math.random() * 0.6;
        }
    }
    spawnRipple(x, y, 1.5 * config.rippleStrength);
}

return { feedAt };
}

Object.assign(exports, { createFeeding });
};
__modules["src/features/fish-manager.js"] = function (exports, __require) {
const { KOI_SHAPE } = __require("src/shared/legacy-assets.js");
const { noseColorOf } = __require("src/render/fish-skin.js");
const STORE_KEY = 'koi.user.fish.v2';
const MAX_FISH = 24;
const BOARD_W = 720;
const BOARD_H = 320;
const BODY_CENTER = BOARD_H / 2;
const INITIAL_FISH_COUNT = 8;
// 可通过 config.initialSameColorProbability 调整；默认约四分之一的鱼会复用已有颜色。
const INITIAL_SAME_COLOR_PROBABILITY = 0.28;
const INITIAL_COLOR_PALETTE = [
    '#d88b52', '#c96b4b', '#e0b45e', '#b5ad68', '#8f9d78', '#718d86',
    '#7896a4', '#a9758a', '#a96855', '#d0c29b', '#64766a', '#b88d62'
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const makeId = () => 'fish-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const randomItem = list => list[Math.floor(Math.random() * list.length)];

function addStyles() {
    if (document.getElementById('fish-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'fish-manager-styles';
    style.textContent = [
        '.fish-manager{--bg-top:rgba(18,71,67,.30);--bg:rgba(9,47,45,.30);--surface-1:rgba(224,255,246,.07);--surface-2:rgba(230,255,248,.11);--stroke:rgba(202,239,228,.18);--text:#f7fffb;--muted:rgba(226,245,238,.74);--accent:#f5a23e;--accent-ink:#2b2114;--control:#ef9131;--track:rgba(210,237,228,.24);position:fixed;inset:16px;z-index:40;pointer-events:none;color:var(--text);font:13.5px/1.5 "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.34)}',
        '.fish-manager *{box-sizing:border-box}.fish-manager button,.fish-manager input,.fish-manager select{font:inherit}',
        '.fish-manager__toggle{pointer-events:auto;position:absolute;right:0;top:0;height:40px;padding:0 15px;border:1px solid var(--stroke);border-radius:10px;background:linear-gradient(180deg,var(--bg-top),var(--bg));box-shadow:0 12px 30px rgba(0,24,22,.28);color:#fff;cursor:pointer}',
        '.fish-manager__panel{pointer-events:auto;position:absolute;right:0;top:0;width:min(1180px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:18px;border:1px solid rgba(222,255,246,.14);border-radius:16px;background:linear-gradient(150deg,var(--bg-top),var(--bg));box-shadow:0 28px 80px rgba(0,22,20,.46);backdrop-filter:blur(28px) saturate(1.3);-webkit-backdrop-filter:blur(28px) saturate(1.3);scrollbar-color:rgba(242,175,92,.72) rgba(255,255,255,.06)}',
        '.fish-manager__panel[hidden],.fish-manager__toggle[hidden]{display:none}.fish-manager__header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.fish-manager__title{margin:0;font-size:15px;font-weight:700}.fish-manager__hint{margin:2px 0 0;color:var(--muted);font-size:12.5px}',
        '.fish-manager__close,.fish-manager__button{height:32px;padding:0 14px;border:1px solid var(--stroke);border-radius:9px;background:var(--surface-2);color:#fff;cursor:pointer}.fish-manager button:hover{filter:brightness(1.10)}.fish-manager button:focus-visible,.fish-manager input:focus-visible,.fish-manager select:focus-visible{outline:2px solid #ffc66f;outline-offset:2px}.fish-manager__button--primary{height:36px;background:var(--accent);color:var(--accent-ink);font-weight:750;text-shadow:none}.fish-manager__button--danger{background:rgba(194,66,48,.46)}',
        '.fish-manager__layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,350px);grid-template-rows:auto auto;gap:14px}.fish-manager__card{padding:14px;border:1px solid rgba(222,255,246,.08);border-radius:13px;background:var(--surface-1)}.fish-manager__section-title{margin:0 0 10px;font-size:15px;font-weight:750}',
        '.fish-manager__form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.fish-manager__field{display:grid;gap:5px}.fish-manager__field label{color:var(--muted);font-size:12.5px}.fish-manager__field input,.fish-manager__field select{width:100%;height:30px;padding:0 9px;border:1px solid var(--stroke);border-radius:8px;background:var(--surface-2);color:#fff}.fish-manager__field select option{color:#182b2c}.fish-manager__field input[type=color]{padding:2px}.fish-manager__field input[type=range]{height:18px;padding:0;border:0;background:transparent;accent-color:var(--control)}.fish-manager__range-value{color:var(--accent);font-variant-numeric:tabular-nums}',
        '.fish-manager__editor-card{grid-column:1;grid-row:1}.fish-manager__list-card{grid-column:2;grid-row:1/span 2}.fish-manager__board-card{grid-column:1;grid-row:2}.fish-manager__board-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.fish-manager__tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fish-manager__tools input[type=color]{width:42px;height:30px;padding:2px;border:1px solid var(--stroke);border-radius:8px;background:var(--surface-2)}.fish-manager__tools input[type=range]{width:120px;accent-color:var(--control)}',
        '.fish-manager__canvas-wrap{width:100%;min-height:360px;border:1px solid rgba(163,224,207,.18);border-radius:13px;overflow:hidden;background:#073936;box-shadow:inset 0 0 46px rgba(0,15,14,.44);touch-action:none}.fish-manager__canvas{display:block;width:100%;height:auto;min-height:360px;cursor:crosshair}.fish-manager__board-note{margin:8px 0 0;color:var(--muted);font-size:12.5px}.fish-manager__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}',
        '.fish-manager__list{display:grid;gap:9px;max-height:calc(100vh - 150px);overflow:auto;padding-right:2px}.fish-manager__empty{display:grid;place-items:center;min-height:280px;color:var(--muted);text-align:center;white-space:pre-line}.fish-manager__fish{padding:12px;border:1px solid rgba(222,255,246,.08);border-radius:11px;background:rgba(217,255,244,.06)}.fish-manager__fish-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.fish-manager__fish-name{font-weight:700}.fish-manager__fish-kind{color:var(--muted);font-size:12.5px}.fish-manager__favorite{border:0;background:transparent;color:rgba(255,255,255,.55);font-size:20px;cursor:pointer}.fish-manager__favorite[aria-pressed=true]{color:var(--accent)}',
        '.fish-manager__stats{display:grid;gap:7px;margin-top:10px}.fish-manager__stat{display:grid;grid-template-columns:58px 1fr 48px;align-items:center;gap:8px}.fish-manager__track{height:11px;border-radius:999px;background:var(--track);overflow:hidden}.fish-manager__fill{height:100%;border-radius:999px;background:var(--accent)}.fish-manager__value{text-align:right;color:var(--accent);font-variant-numeric:tabular-nums}.fish-manager__fish-actions{display:flex;justify-content:flex-end;margin-top:8px}.fish-manager__status{min-height:20px;margin:8px 0 0;color:var(--muted);font-size:12.5px}',
        '@media(max-width:900px){.fish-manager{inset:8px}.fish-manager__panel{width:calc(100vw - 16px);max-height:calc(100vh - 16px);padding:12px}.fish-manager__layout{grid-template-columns:1fr;grid-template-rows:auto}.fish-manager__editor-card,.fish-manager__list-card,.fish-manager__board-card{grid-column:1;grid-row:auto}.fish-manager__list-card{order:3}.fish-manager__form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fish-manager__canvas-wrap,.fish-manager__canvas{min-height:260px}.fish-manager__list{max-height:460px}}'
    ].join('\n');
    document.head.appendChild(style);
}
function createFishManager({ Koi, koiType, kois, config, viewport, spawnRipple, repository }) {
    addStyles();
    const breedById = new Map(koiType.breeds.map(breed => [breed.id, breed]));
    let definitions = [];
    let storeUserManaged = false;
    const fishById = new Map();
    let previewFish = null;
    let previewTransform = null;
    let boardWaveTime = 0;
    let statsElapsed = 0;
    let saveElapsed = 0;

    class UserFish extends Koi {
        constructor(definition) {
            super(koiType, { custom: true, origin: 'custom' });
            this.custom = true;
            this.onEat = () => {
                this.hunger = clamp(this.hunger + 24, 0, 100);
                this.mood = clamp(this.mood + 10, 0, 100);
            };
            this.applyDefinition(definition);
        }

        applyDefinition(definition) {
            const breed = breedById.get(definition.breedId) || koiType.breeds[0];
            this.breedId = breed.id;
            this.breed = breed.name;
            this.breedSize = breed.size || 1;
            this.net = breed.net || 0;
            this.sheen = breed.sheen || 0;
            this.kuchi = breed.kuchi || null;
            this.edge = breed.edge || null;
            this.outlineWidth = breed.outlineWidth ?? 0.10;
            this.spotRanges = (breed.patches || []).flatMap(patch => {
                const segments = patch.segs || [];
                if (!segments.length) return [];
                return [[
                    Math.min(0.78, segments[0] / 11),
                    Math.min(0.78, (segments[segments.length - 1] + 1) / 11),
                    patch.color,
                    patch.pw || 0.5
                ]];
            });
            this.customId = definition.id;
            this.name = definition.name || breed.name;
            this.favorite = definition.favorite === true;
            this.hunger = clamp(definition.hunger ?? 100, 0, 100);
            this.mood = clamp(definition.mood ?? 100, 0, 100);
            this.color = /^#[0-9a-f]{6}$/i.test(definition.color) ? definition.color : breed.body;
            this.shape = KOI_SHAPE.clampShape(definition.shape || breed.shape);
            this.baseSizeMul = 0.52 + this.depth * 0.30;
            this.sizeMul = this.baseSizeMul * clamp(definition.size ?? breed.size ?? 1, 0.55, 1.65);
            this.baseSpeed = 0.4 + this.depth * 0.22;
            if (definition.skin && definition.skin !== this.skinSrc) {
                this.skinSrc = definition.skin;
                this.skinReady = false;
                const image = new Image();
                image.onload = () => {
                    this.skin = image;
                    this.skinReady = true;
                    this.noseColor = noseColorOf(image);
                    if (this === previewFish) renderBoard();
                };
                image.src = definition.skin;
            }
        }
    }

    function loadDefinitions() {
        const stored = repository.read(STORE_KEY, { list: [] });
        storeUserManaged = stored?.userManaged === true;
        definitions = Array.isArray(stored?.list)
            ? stored.list.filter(item => item && typeof item.id === 'string').slice(0, MAX_FISH)
            : [];
    }

    function saveDefinitions() {
        for (const definition of definitions) {
            const fish = fishById.get(definition.id);
            if (!fish) continue;
            definition.hunger = Math.round(fish.hunger * 10) / 10;
            definition.mood = Math.round(fish.mood * 10) / 10;
        }
        repository.write(STORE_KEY, {
            version: 2,
            initialized: true,
            userManaged: storeUserManaged,
            list: definitions
        });
    }

    function releaseFish(fish) {
        const x = viewport.width * 0.5;
        const y = viewport.height * 0.5;
        fish.x = x;
        fish.y = y;
        for (const segment of fish.segments) { segment.x = x; segment.y = y; }
        fish.heading = Math.random() * Math.PI * 2;
        fish.angle = fish.heading;
        fish.speed = 0;
        fish.depth = Math.max(0.55, fish.depth);
        fish.drop = { t: 0, dur: 1.05, splashed: false };
        spawnRipple(x, y, 0.8 * config.rippleStrength);
    }

    function syncFish(releaseId = null) {
        const ids = new Set(definitions.map(definition => definition.id));
        for (let index = kois.length - 1; index >= 0; index--) {
            const fish = kois[index];
            if (fish.custom && !ids.has(fish.customId)) {
                kois.splice(index, 1);
                fishById.delete(fish.customId);
            }
        }
        for (const definition of definitions) {
            let fish = fishById.get(definition.id);
            if (!fish) {
                fish = new UserFish(definition);
                fishById.set(definition.id, fish);
                kois.push(fish);
                if (releaseId === definition.id) releaseFish(fish);
            } else {
                fish.applyDefinition(definition);
            }
        }
    }

    const shell = document.createElement('aside');
    shell.className = 'fish-manager';
    shell.innerHTML = [
        '<button class="fish-manager__toggle" type="button" hidden>🐟 我的鱼</button>',
        '<section class="fish-manager__panel" aria-label="鱼设置">',
        '<header class="fish-manager__header"><div><h1 class="fish-manager__title">🐟 鱼设置</h1><p class="fish-manager__hint">池塘只显示你添加的鱼，外观与状态自动保存到本地数据库</p></div><button class="fish-manager__close" type="button">收起</button></header>',
        '<div class="fish-manager__layout">',
        '<section class="fish-manager__card fish-manager__editor-card"><h2 class="fish-manager__section-title">加入一只鱼</h2><div class="fish-manager__form-grid">',
        '<div class="fish-manager__field"><label>名字</label><input data-name maxlength="16" placeholder="给它起个名字"></div>',
        '<div class="fish-manager__field"><label>鱼种</label><select data-breed></select></div>',
        '<div class="fish-manager__field"><label>身体颜色</label><input data-color type="color"></div>',
        '<div class="fish-manager__field"><label>整体大小 <span class="fish-manager__range-value" data-value="size"></span></label><input data-shape="size" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>身体长度 <span class="fish-manager__range-value" data-value="bodyLen"></span></label><input data-shape="bodyLen" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>身体宽度 <span class="fish-manager__range-value" data-value="bodyH"></span></label><input data-shape="bodyH" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>头部宽度 <span class="fish-manager__range-value" data-value="headW"></span></label><input data-shape="headW" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>尾鳍大小 <span class="fish-manager__range-value" data-value="tailFin"></span></label><input data-shape="tailFin" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '</div></section>',
        '<section class="fish-manager__card fish-manager__list-card"><h2 class="fish-manager__section-title">我的鱼</h2><div class="fish-manager__list" data-list></div></section>',
        '<section class="fish-manager__card fish-manager__board-card">',
        '<div class="fish-manager__board-head"><div><h2 class="fish-manager__section-title">🎨 大画板</h2><span class="fish-manager__hint">直接在鱼身上手绘图案</span></div><div class="fish-manager__tools"><label>画笔</label><input data-brush-color type="color" value="#d94f28"><label>粗细</label><input data-brush-size type="range" min="3" max="48" value="18"><button class="fish-manager__button" data-clear type="button">清空图案</button></div></div>',
        '<div class="fish-manager__canvas-wrap"><canvas class="fish-manager__canvas" data-board width="720" height="320"></canvas></div>',
        '<p class="fish-manager__board-note">画板会按鱼的身体轮廓裁切；空白区域使用上方选择的身体颜色。</p>',
        '<div class="fish-manager__actions"><button class="fish-manager__button fish-manager__button--primary" data-add type="button">加入池塘</button></div>',
        '<p class="fish-manager__status" data-status role="status"></p>',
        '</section></div></section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.fish-manager__panel');
    const toggle = shell.querySelector('.fish-manager__toggle');
    const nameInput = shell.querySelector('[data-name]');
    const breedInput = shell.querySelector('[data-breed]');
    const colorInput = shell.querySelector('[data-color]');
    const list = shell.querySelector('[data-list]');
    const status = shell.querySelector('[data-status]');
    const brushColor = shell.querySelector('[data-brush-color]');
    const brushSize = shell.querySelector('[data-brush-size]');
    const shapeInputs = Array.from(shell.querySelectorAll('[data-shape]'));
    const board = shell.querySelector('[data-board]');
    const boardContext = board.getContext('2d');
    const paint = document.createElement('canvas');
    paint.width = BOARD_W;
    paint.height = BOARD_H;
    const paintContext = paint.getContext('2d');
    let drawing = false;

    function randomBreed() {
        const total = koiType.breeds.reduce((sum, breed) => sum + (breed.w || 1), 0);
        let cursor = Math.random() * total;
        for (const breed of koiType.breeds) {
            cursor -= breed.w || 1;
            if (cursor <= 0) return breed;
        }
        return koiType.breeds[0];
    }

    function randomShape(breed) {
        const shape = { ...breed.shape };
        for (const key of ['bodyLen', 'bodyH', 'headW', 'tailFin']) {
            shape[key] = clamp((breed.shape?.[key] || 1) * (0.86 + Math.random() * 0.28), 0.55, 1.65);
        }
        return shape;
    }

    function randomSkin(color) {
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_W;
        canvas.height = BOARD_H;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.fillRect(0, 0, BOARD_W, BOARD_H);

        const accent = randomItem(INITIAL_COLOR_PALETTE);
        const shadow = randomItem(INITIAL_COLOR_PALETTE);
        const pattern = Math.floor(Math.random() * 3);
        context.save();
        context.globalAlpha = 0.42;
        context.strokeStyle = accent;
        context.fillStyle = accent;
        if (pattern === 0) {
            for (let index = 0; index < 7; index++) {
                const x = 45 + Math.random() * 625;
                const y = 42 + Math.random() * 236;
                context.beginPath();
                context.ellipse(x, y, 18 + Math.random() * 34, 9 + Math.random() * 20, Math.random() * Math.PI, 0, Math.PI * 2);
                context.fill();
            }
        } else if (pattern === 1) {
            context.lineWidth = 9 + Math.random() * 10;
            for (let index = 0; index < 5; index++) {
                const x = 60 + index * 145 + Math.random() * 38;
                context.beginPath();
                context.moveTo(x, 24);
                context.quadraticCurveTo(x - 42, 160, x + 16, 296);
                context.stroke();
            }
        } else {
            context.lineWidth = 3;
            for (let index = 0; index < 18; index++) {
                const x = 28 + Math.random() * 664;
                const y = 35 + Math.random() * 250;
                context.beginPath();
                context.arc(x, y, 8 + Math.random() * 13, Math.PI * 0.12, Math.PI * 0.88);
                context.stroke();
            }
        }
        context.globalAlpha = 0.18;
        context.fillStyle = shadow;
        context.fillRect(0, 0, BOARD_W, 18 + Math.random() * 18);
        context.restore();
        return canvas.toDataURL('image/png');
    }

    function createInitialDefinitions() {
        const colors = [];
        const sameColorProbability = clamp(
            config.initialSameColorProbability ?? INITIAL_SAME_COLOR_PROBABILITY,
            0,
            1
        );
        return Array.from({ length: INITIAL_FISH_COUNT }, (_, index) => {
            const breed = randomBreed();
            const reuseColor = colors.length > 0 && Math.random() < sameColorProbability;
            let color = reuseColor ? randomItem(colors) : randomItem(INITIAL_COLOR_PALETTE);
            if (!reuseColor && colors.length) {
                let attempts = 0;
                while (colors.includes(color) && attempts++ < 8) color = randomItem(INITIAL_COLOR_PALETTE);
            }
            colors.push(color);
            const shape = randomShape(breed);
            return {
                id: makeId(),
                name: breed.name + (index + 1),
                breedId: breed.id,
                color,
                size: clamp((breed.size || 1) * (0.76 + Math.random() * 0.48), 0.55, 1.65),
                shape,
                skin: randomSkin(color),
                hunger: 100,
                mood: 100,
                favorite: false,
                createdAt: Date.now() + index
            };
        });
    }

    for (const breed of koiType.breeds) {
        const option = document.createElement('option');
        option.value = breed.id;
        option.textContent = breed.name;
        breedInput.appendChild(option);
    }

    const selectedBreed = () => breedById.get(breedInput.value) || koiType.breeds[0];
    const input = key => shell.querySelector('[data-shape="' + key + '"]');

    function updateRangeLabels() {
        for (const item of shapeInputs) {
            shell.querySelector('[data-value="' + item.dataset.shape + '"]').textContent = Number(item.value).toFixed(2);
        }
    }

    function applyBreedDefaults(clearPaint = false) {
        const breed = selectedBreed();
        colorInput.value = breed.body;
        input('size').value = clamp(breed.size || 1, 0.55, 1.65);
        for (const key of ['bodyLen', 'bodyH', 'headW', 'tailFin']) {
            input(key).value = clamp(breed.shape?.[key] || 1, 0.55, 1.65);
        }
        if (clearPaint) paintContext.clearRect(0, 0, BOARD_W, BOARD_H);
        updateRangeLabels();
        renderBoard();
    }

    function drawBoardBackground() {
        const sourceX = 340;
        const sourceY = 158;
        const gradient = boardContext.createRadialGradient(sourceX, 148, 30, sourceX, 148, 430);
        gradient.addColorStop(0, '#0f5e58');
        gradient.addColorStop(0.58, '#0a4a46');
        gradient.addColorStop(1, '#052f2d');
        boardContext.fillStyle = gradient;
        boardContext.fillRect(0, 0, BOARD_W, BOARD_H);

        // Soft, continuous ripples travel out from a quiet source under the fish.
        // Each ring has its own phase so the water never reads as a static target.
        boardContext.save();
        boardContext.globalCompositeOperation = 'screen';
        const cycle = 360;
        const travel = boardWaveTime * 48;
        for (let index = 0; index < 5; index++) {
            const progress = ((travel + index * 74) % cycle) / cycle;
            const radius = 26 + progress * 420;
            const fade = Math.pow(1 - progress, 1.35);
            const alpha = 0.18 * fade;
            boardContext.lineWidth = 1.1 + fade * 1.8;
            boardContext.strokeStyle = `rgba(168,235,216,${alpha})`;
            boardContext.beginPath();
            boardContext.arc(sourceX, sourceY, radius, 0, Math.PI * 2);
            boardContext.stroke();

            // A short displaced highlight gives each ring a soft crest instead of
            // a perfectly uniform vector circle.
            boardContext.lineWidth = 0.8 + fade * 1.1;
            boardContext.strokeStyle = `rgba(218,255,240,${alpha * 0.72})`;
            boardContext.beginPath();
            boardContext.arc(
                sourceX - 2,
                sourceY - 1,
                radius + 2.5,
                -Math.PI * 0.82 + progress * 0.28,
                -Math.PI * 0.18 + progress * 0.28
            );
            boardContext.stroke();
        }

        // The source is deliberately subtle: it anchors the wave field without
        // competing with the fish preview.
        const sourceGlow = boardContext.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 38);
        sourceGlow.addColorStop(0, 'rgba(206,255,239,.13)');
        sourceGlow.addColorStop(1, 'rgba(206,255,239,0)');
        boardContext.fillStyle = sourceGlow;
        boardContext.beginPath();
        boardContext.arc(sourceX, sourceY, 38, 0, Math.PI * 2);
        boardContext.fill();
        boardContext.restore();
    }

    function previewDefinition() {
        const breed = selectedBreed();
        return {
            id: 'preview',
            name: nameInput.value.trim() || breed.name,
            breedId: breed.id,
            color: colorInput.value,
            size: Number(input('size').value),
            shape: {
                ...breed.shape,
                bodyLen: Number(input('bodyLen').value),
                bodyH: Number(input('bodyH').value),
                headW: Number(input('headW').value),
                tailFin: Number(input('tailFin').value)
            },
            skin: null,
            hunger: 100,
            mood: 100,
            favorite: false
        };
    }

    function preparePreviewFish() {
        if (!previewFish) previewFish = new UserFish(previewDefinition());
        else previewFish.applyDefinition(previewDefinition());

        const size = Number(input('size').value);
        previewFish.depth = 1;
        previewFish.baseSizeMul = 0.82;
        previewFish.sizeMul = previewFish.baseSizeMul * size;
        const spacing = config.fishSize * previewFish.sizeMul * koiType.segmentSpacing;
        for (let index = 0; index < previewFish.numSegments; index++) {
            previewFish.segments[index].x = index * spacing;
            previewFish.segments[index].y = 0;
        }
        previewFish.x = 0;
        previewFish.y = 0;
        previewFish.drop = null;
        previewFish.speed = 0;
        previewFish.angle = 0;
        previewFish.heading = 0;
        previewFish.skin = paint;
        previewFish.skinReady = true;
        previewFish.skinSrc = null;
        previewFish.noseColor = colorInput.value;

        const total = spacing * (previewFish.numSegments - 1);
        // The editor preview is intentionally calmer than the pond animation.
        // Keep the shared renderer, but reduce the spine wave and fin swing for a clear drawing target.
        previewFish.waveEnv = total * 0.040;
        previewFish.previewMotion = true;
        const bodySpan = total * 0.78 * previewFish.shape.bodyLen;
        const maxHalf = total * 0.78 * 0.168 * previewFish.shape.bodyH;
        const noseDepth = KOI_SHAPE.shapeWidth(KOI_SHAPE.FRONT, previewFish.shape) * maxHalf * 0.95;
        const tailLength = KOI_SHAPE.tailFinLen(maxHalf, previewFish.shape);
        const width = noseDepth + bodySpan + tailLength;
        const height = maxHalf * 3.1;
        const scale = Math.min((BOARD_W - 84) / Math.max(1, width), (BOARD_H - 48) / Math.max(1, height));
        previewTransform = {
            scale,
            x: (BOARD_W - width * scale) / 2 + noseDepth * scale,
            y: BODY_CENTER,
            total,
            bodySpan,
            maxHalf
        };
        return previewFish;
    }

    function renderBoard() {
        drawBoardBackground();
        const fish = preparePreviewFish();
        boardContext.save();
        boardContext.translate(previewTransform.x, previewTransform.y);
        boardContext.scale(previewTransform.scale, previewTransform.scale);
        fish.draw(boardContext);
        boardContext.restore();
    }

    function exportSkin() {
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_W;
        canvas.height = BOARD_H;
        const context = canvas.getContext('2d');
        context.fillStyle = colorInput.value;
        context.fillRect(0, 0, BOARD_W, BOARD_H);
        context.drawImage(paint, 0, 0);
        return canvas.toDataURL('image/png');
    }

    function boardPoint(event) {
        const bounds = board.getBoundingClientRect();
        const fish = preparePreviewFish();
        const screenX = (event.clientX - bounds.left) * BOARD_W / bounds.width;
        const screenY = (event.clientY - bounds.top) * BOARD_H / bounds.height;
        const pointX = (screenX - previewTransform.x) / previewTransform.scale;
        const pointY = (screenY - previewTransform.y) / previewTransform.scale;
        const total = previewTransform.total;
        const bodySpan = 0.78 * fish.shape.bodyLen;
        const bodyPosition = pointX / Math.max(1, total * bodySpan);
        const maxHalf = previewTransform.maxHalf;
        const localHalf = KOI_SHAPE.shapeWidth(bodyPosition, fish.shape) * maxHalf;
        const spinePosition = bodyPosition * bodySpan;
        const waveOffset = Math.sin(
            fish.swimCycle * fish.waveFreq - spinePosition * fish.waveLen
        ) * fish.waveEnv * spinePosition * spinePosition;
        return {
            x: clamp(KOI_SHAPE.uAtBw(bodyPosition) * BOARD_W, 0, BOARD_W),
            y: clamp((pointY - waveOffset + localHalf) / Math.max(1, localHalf * 2) * BOARD_H, 0, BOARD_H),
            inside: bodyPosition >= KOI_SHAPE.FRONT && bodyPosition <= 1
                && Math.abs(pointY - waveOffset) <= localHalf
        };
    }

    function beginDrawing(event) {
        const point = boardPoint(event);
        if (!point.inside) return;
        drawing = true;
        board.setPointerCapture(event.pointerId);
        paintContext.beginPath();
        paintContext.moveTo(point.x, point.y);
    }

    function continueDrawing(event) {
        if (!drawing) return;
        const point = boardPoint(event);
        if (!point.inside) {
            paintContext.beginPath();
            return;
        }
        paintContext.lineCap = 'round';
        paintContext.lineJoin = 'round';
        paintContext.strokeStyle = brushColor.value;
        paintContext.lineWidth = Number(brushSize.value);
        paintContext.lineTo(point.x, point.y);
        paintContext.stroke();
        renderBoard();
    }

    function addStat(container, label, value, displayedValue = Math.round(value) + '%') {
        const row = document.createElement('div');
        row.className = 'fish-manager__stat';
        const title = document.createElement('span');
        title.textContent = label;
        const track = document.createElement('div');
        track.className = 'fish-manager__track';
        const fill = document.createElement('div');
        fill.className = 'fish-manager__fill';
        fill.style.width = clamp(value, 0, 100) + '%';
        track.appendChild(fill);
        const number = document.createElement('span');
        number.className = 'fish-manager__value';
        number.textContent = displayedValue;
        row.append(title, track, number);
        container.appendChild(row);
    }

    function moodEmoji(value) {
        return value >= 75 ? '😊' : value >= 45 ? '🙂' : value >= 20 ? '😕' : '😢';
    }

    function renderList() {
        list.replaceChildren();
        if (!definitions.length) {
            const empty = document.createElement('div');
            empty.className = 'fish-manager__empty';
            empty.textContent = '池塘现在是空的。\n设计并加入第一只鱼。';
            list.appendChild(empty);
            return;
        }
        const ordered = [...definitions].sort((a, b) => Number(b.favorite) - Number(a.favorite));
        for (const definition of ordered) {
            const fish = fishById.get(definition.id);
            const card = document.createElement('article');
            card.className = 'fish-manager__fish';
            const header = document.createElement('div');
            header.className = 'fish-manager__fish-head';
            const identity = document.createElement('div');
            const fishName = document.createElement('div');
            fishName.className = 'fish-manager__fish-name';
            fishName.textContent = definition.name;
            const kind = document.createElement('div');
            kind.className = 'fish-manager__fish-kind';
            kind.textContent = (breedById.get(definition.breedId)?.name || '淡水鱼') + ' · ' + definition.name;
            identity.append(fishName, kind);
            const favorite = document.createElement('button');
            favorite.className = 'fish-manager__favorite';
            favorite.type = 'button';
            favorite.textContent = '★';
            favorite.setAttribute('aria-label', '收藏');
            favorite.setAttribute('aria-pressed', String(definition.favorite === true));
            favorite.addEventListener('click', () => {
                definition.favorite = !definition.favorite;
                if (fish) fish.favorite = definition.favorite;
                storeUserManaged = true;
                saveDefinitions();
                renderList();
            });
            header.append(identity, favorite);
            card.appendChild(header);

            const stats = document.createElement('div');
            stats.className = 'fish-manager__stats';
            const hunger = fish?.hunger ?? definition.hunger ?? 100;
            const mood = fish?.mood ?? definition.mood ?? 100;
            const speed = Math.max(0, Number(fish?.speed) || 0) * 60;
            addStat(stats, '饱食度', hunger);
            addStat(stats, '心情 ' + moodEmoji(mood), mood);
            addStat(stats, '游速', Math.min(100, speed / 2.2), speed.toFixed(1));
            card.appendChild(stats);

            const actions = document.createElement('div');
            actions.className = 'fish-manager__fish-actions';
            const remove = document.createElement('button');
            remove.className = 'fish-manager__button fish-manager__button--danger';
            remove.type = 'button';
            remove.textContent = '删除';
            remove.addEventListener('click', () => {
                definitions = definitions.filter(item => item.id !== definition.id);
                storeUserManaged = true;
                saveDefinitions();
                syncFish();
                renderList();
                status.textContent = '已从池塘删除“' + definition.name + '”';
            });
            actions.appendChild(remove);
            card.appendChild(actions);
            list.appendChild(card);
        }
    }

    function addFish() {
        if (definitions.length >= MAX_FISH) {
            status.textContent = '最多可以添加 ' + MAX_FISH + ' 只鱼';
            return;
        }
        const breed = selectedBreed();
        const name = nameInput.value.trim() || breed.name + (definitions.length + 1);
        const definition = {
            id: makeId(),
            name,
            breedId: breed.id,
            color: colorInput.value,
            size: Number(input('size').value),
            shape: {
                ...breed.shape,
                bodyLen: Number(input('bodyLen').value),
                bodyH: Number(input('bodyH').value),
                headW: Number(input('headW').value),
                tailFin: Number(input('tailFin').value)
            },
            skin: exportSkin(),
            hunger: 100,
            mood: 100,
            favorite: false,
            createdAt: Date.now()
        };
        definitions.push(definition);
        storeUserManaged = true;
        saveDefinitions();
        syncFish(definition.id);
        renderList();
        nameInput.value = '';
        status.textContent = '“' + name + '”已经加入池塘并保存';
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        if (open) renderBoard();
    }

    breedInput.addEventListener('change', () => applyBreedDefaults(false));
    colorInput.addEventListener('input', renderBoard);
    for (const shapeInput of shapeInputs) {
        shapeInput.addEventListener('input', () => { updateRangeLabels(); renderBoard(); });
    }
    board.addEventListener('pointerdown', beginDrawing);
    board.addEventListener('pointermove', continueDrawing);
    board.addEventListener('pointerup', () => { drawing = false; });
    board.addEventListener('pointercancel', () => { drawing = false; });
    shell.querySelector('[data-clear]').addEventListener('click', () => {
        paintContext.clearRect(0, 0, BOARD_W, BOARD_H);
        renderBoard();
    });
    shell.querySelector('[data-add]').addEventListener('click', addFish);
    shell.querySelector('.fish-manager__close').addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));

    loadDefinitions();
    if (!definitions.length && !storeUserManaged) {
        definitions = createInitialDefinitions();
        saveDefinitions();
    }
    syncFish();
    applyBreedDefaults(true);
    renderList();
    status.textContent = definitions.length
        ? '已从本地数据库恢复 ' + definitions.length + ' 只鱼'
        : '池塘已清空，请添加第一只鱼';

    return {
        loadCustomFishFromStore() { loadDefinitions(); syncFish(); renderList(); },
        syncCustomFish: syncFish,
        update(dt) {
            statsElapsed += dt;
            saveElapsed += dt;
            if (!panel.hidden) boardWaveTime += dt;
            if (previewFish && !panel.hidden) {
                if (!drawing) previewFish.swimCycle += 2.65 * dt;
                renderBoard();
            }
            if (statsElapsed >= 1) {
                statsElapsed = 0;
                for (const fish of fishById.values()) {
                    fish.hunger = clamp(fish.hunger - 0.02, 0, 100);
                    const targetMood = 30 + fish.hunger * 0.7;
                    fish.mood = clamp(fish.mood + (targetMood - fish.mood) * 0.025, 0, 100);
                }
                renderList();
            }
            if (saveElapsed >= 5) {
                saveElapsed = 0;
                saveDefinitions();
            }
        },
        dispose() {
            saveDefinitions();
            previewFish = null;
            shell.remove();
            for (let index = kois.length - 1; index >= 0; index--) {
                if (kois[index].custom) kois.splice(index, 1);
            }
            fishById.clear();
        }
    };
}

Object.assign(exports, { createFishManager });
};
__modules["src/features/weather.js"] = function (exports, __require) {
const { createRainRipples } = __require("src/render/ripples.js");
const { createRainStreaks } = __require("src/render/rain-streaks.js");
const { THEME } = __require("src/shared/legacy-assets.js");
/**
 * 天气玩法(2026-09-26):晴 / 阴 / 雨。
 *
 * 它做三件事,且只做这三件:
 *   ① 每帧把 config.weather(宿主属性的数字下标)同步进 environment(状态 + 平滑过渡)
 *   ② 下雨时按秒率生成雨环,画在 **weather 层**(层表里在 farTint 之后、鼠标涟漪之前)
 *   ③ 自己被 setFeature('weather', ...) 关掉时停止生成,雨自然下完(不硬清屏)
 *
 * 光与色罩不在这里 —— render/renderer.js 每帧读 environment 施加(它才知道画布)。
 *
 * 不冲突的三条(见 tools/test-modules.mjs 里对应的断言):
 *   · 晴 = 与今天逐帧一致(不开天气时这条链路等于没接:不生成雨环、光感 alpha ×1、色罩 alpha 0)
 *   · 雨环用**自己的数组 + 自己的上限**,再大的雨也挤不掉鼠标涟漪;且只走 Canvas 路径
 *   · 雨点位置用 environment 的**独立随机流**,绝不碰共享 Math.random(否则会改掉鱼的随机序列)
 */
function createWeather({ config, viewport, environment }) {
    // 雨环剖面 = 鼠标涟漪那套参数的派生(同一种水,只是更小更淡、关掉暗带)
    const T = THEME.water.ripple;
    const rain = (THEME.weather && THEME.weather.rain && THEME.weather.rain.rain) || {};
    const profile = Object.freeze({
        ...T,
        ...(rain.life ? { life: rain.life } : {}),
        ...(rain.speed ? { speed: rain.speed } : {}),
        ...(rain.crestAlpha !== undefined ? { crestAlpha: rain.crestAlpha } : {}),
        ...(rain.troughAlpha !== undefined ? { troughAlpha: rain.troughAlpha } : {}),
        ...(rain.maxLive ? { maxLive: rain.maxLive } : {})
    });
    const field = createRainRipples({ viewport, config, profile });
    // 雨丝:空中的雨。它的**落点**才是水面雨坑的来源 —— 看得见"滴—坑"因果,才不像两层贴图。
    // 随机流仍用 environment 的(固定种子 ⇒ 雨点分布可复现),绝不碰 Math.random。
    const streaks = createRainStreaks({ viewport, streak: rain.streak || {}, rng: environment.rng });
    let enabled = true;
    let spawned = 0;                     // 诊断用:累计生成的水坑数

    /** 雨丝撞到水面 → 原地起一个坑(半径/寿命由雨滴剖面决定) */
    function onImpact(x, y) {
        const p = rain.power || [0.10, 0.25];
        field.spawn(x, y, environment.range(p[0], p[1]));
        spawned++;
    }

    return {
        /** 宿主属性(wallpaperPropertyListener / livelyPropertyListener)只写 config,**每帧在这里同步** */
        /** 禁用后还要把雨收完(见 core/feature-registry.js 的 settleWhileDisabled) */
        settleWhileDisabled: true,

        update(dt) {
            // 启用时:宿主属性是唯一真源(它写 config.weather,这里每帧同步)
            // 禁用时:目标固定为晴 —— 天色平滑过渡回中性,雨丝落完即退休,不留残景
            const want = enabled ? (Number(config.weather) || 0) : 0;
            if (want !== environment.targetIndex) environment.setWeather(want);
            environment.update(dt);
            // 雨丝的"在场条数"由环境给(晴=0 ⇒ 落完就退休);关掉玩法时连水坑也不再生成
            const wantStreaks = enabled ? environment.rainSpawnCount() : 0;
            streaks.fill(wantStreaks);
            streaks.update(dt, wantStreaks, enabled ? onImpact : null);
            field.update(dt);
        },
        layers: {
            // 先雨坑(水面),再雨丝(空气)—— 两者都在 weather 层里,层表一个字没改
            weather: g => { field.draw(g); streaks.draw(g); }
        },
        setEnabled(on) {
            enabled = !!on;
            // 关掉 = 回到晴(不是"冻在当前天色");重新打开 = 回到宿主选的那档
            environment.setWeather(enabled ? (Number(config.weather) || 0) : 0);
        },
        dispose() { field.clear(); streaks.clear(); },
        inspect: () => ({ field, streaks, spawned, enabled, profile })
    };
}

Object.assign(exports, { createWeather });
};
__modules["src/render/rain-streaks.js"] = function (exports, __require) {
/**
 * 雨丝(2026-09-26):**下落中的雨**,不是"屏幕上的贴膜"。
 *
 * 为什么要有它:只有水面雨点时,顶视角看到的是"水被打了坑",看不出"在下雨" ——
 * 用户原话:"只能看到涟漪,没有雨丝,感觉不对"。所以雨要有两条腿:空中的雨丝 + 落点的水坑。
 *
 * 三条做法上的讲究(不然就是一层脏贴膜):
 *   ① **落点与雨坑是同一件事**:雨丝落到它自己的水面深度时回调 onImpact(x, y),
 *      由玩法在原地起一个涟漪。看得见的"滴—坑"因果,比两套互不相干的随机更真。
 *   ② 雨丝**互相平行**、比竖直略斜(同一阵风),短(10~26px)、快(600~900px/s);
 *      每条各自随机角度会像"划痕",不像雨。
 *   ③ **池化 + 上限**:预分配固定数量对象循环复用,零每帧分配(壁纸是常驻的,GC 抖动会被看见)。
 *
 * 混合用 screen(加光):雨丝是"空气里反光的水";普通 alpha 叠白线会像油漆。
 */
function createRainStreaks({ viewport, streak = {}, rng = Math.random }) {
    const cap = Math.max(1, streak.maxLive || 140);
    const lenR = streak.len || [10, 26];
    const speedR = streak.speed || [620, 900];
    const width = streak.width || 1.25;
    const slopeR = streak.slope || [-0.26, -0.26];     // dx/dy(负数 = 往左飘)
    const alphaR = streak.alpha || [0.10, 0.30];

    const pool = new Array(cap);
    const pick = (r) => r[0] + rng() * (r[1] - r[0]);
    for (let i = 0; i < cap; i++) pool[i] = { x: 0, y: 0, len: 0, vy: 0, slope: 0, a: 0, target: 0, live: false };

    let created = 0, impacts = 0;

    /** 从画面上方重新落下。far = 视差:远的小/慢/淡,近的大/快/亮 */
    function respawn(s, anywhere) {
        const far = rng();
        s.len = pick(lenR) * (0.55 + 0.75 * far);
        s.vy = pick(speedR) * (0.55 + 0.75 * far);
        s.slope = pick(slopeR);
        s.a = pick(alphaR) * (0.45 + 0.9 * far);
        s.x = rng() * viewport.width * 1.25 - viewport.width * 0.125;
        // 每条雨丝有自己的"水面深度":越远的越早消失(造成层次),所以不是所有人都在同一行撞水
        s.target = viewport.height * (0.05 + 0.95 * rng());
        s.y = anywhere ? rng() * s.target : -s.len - rng() * viewport.height * 0.3;
        s.live = true;
        created++;
    }

    return {
        get count() { return pool.reduce((n, s) => n + (s.live ? 1 : 0), 0); },
        get cap() { return cap; },
        get created() { return created; },
        get impacts() { return impacts; },

        /** 把数量凑到 target(不足就补;多了不动,等它自己落完) */
        fill(target) {
            let live = this.count;
            for (let i = 0; i < cap && live < target; i++) {
                if (!pool[i].live) { respawn(pool[i], true); live++; }
            }
        },

        /**
         * @param dt 秒
         * @param target 当前该有多少条在场(天晴/关天气时传 0 ⇒ 落完就退休,不会永远循环)
         * @param onImpact 撞到水面的回调(在原地起水坑)
         */
        update(dt, target = cap, onImpact) {
            for (let i = 0; i < cap; i++) {
                const s = pool[i];
                if (!s.live) continue;
                s.y += s.vy * dt;
                s.x += s.vy * s.slope * dt;
                if (s.y >= s.target) {
                    if (onImpact) { onImpact(s.x, s.target); impacts++; }
                    // 超过目标数量就退休(雨停/切晴);否则回到天上继续下
                    if (this.count > target) s.live = false; else respawn(s, false);
                }
                if (s.x < -viewport.width * 0.25) s.x += viewport.width * 1.5;   // 只往一边飘,出界就绕回来
            }
        },

        draw(g) {
            const wasOp = g.globalCompositeOperation, wasA = g.globalAlpha;
            g.globalCompositeOperation = 'screen';
            g.lineCap = 'round';
            g.lineWidth = width;
            g.strokeStyle = 'rgba(228,245,249,1)';
            for (let i = 0; i < cap; i++) {
                const s = pool[i];
                if (!s.live) continue;
                g.globalAlpha = s.a;
                g.beginPath();
                g.moveTo(s.x, s.y);
                g.lineTo(s.x - s.slope * s.len * 1.0, s.y - s.len);
                g.stroke();
            }
            g.globalAlpha = wasA;
            g.globalCompositeOperation = wasOp;
        },

        clear() { for (let i = 0; i < cap; i++) pool[i].live = false; },
        inspect: () => ({ cap, created, impacts, count: pool.reduce((n, s) => n + (s.live ? 1 : 0), 0) })
    };
}

Object.assign(exports, { createRainStreaks });
};
__modules["src/features/idle-drift.js"] = function (exports, __require) {
const { createRainRipples } = __require("src/render/ripples.js");
const { createIdleSprites } = __require("src/render/idle-sprites.js");
const { mulberry32 } = __require("src/shared/math.js");
const { THEME } = __require("src/shared/legacy-assets.js");
/**
 * 自持事件:落叶 / 花瓣(2026-09-26 接入)。
 *
 * 它解决的是"壁纸没人操作时,画面自己发生的事"。鱼群 boids 看久了就是同一套运动,
 * 而壁纸大部分时间是被余光看的 —— 需要偶发的小事件提供"这池塘是活的"这一层。
 *
 * 数值全部来自实验页 experiments/idle-events-mock/on-real-pond.html 的定版
 * (用户逐版看过并认可),接入时只做了两处工程化:随机流独立、计时器不用 setTimeout。
 *
 * ── 一条因果链(全部走真引擎的公共通道,不自己改坐标) ──
 *   坠落 → 触水 → ① 真涟漪(自己的雨滴场,不占鼠标涟漪容量)
 *                 ② 真惊扰(往输入路由注入一次"鼠标在这",让"躲鼠标"分支真的散开)
 *                 ③ 0.9s 后聚集(往 foods 塞一个**不可见**吸引子,借用好奇→聚集的行为)
 * 落水**不投食**:只产生涟漪与惊吓,不产生食物 —— 否则用户分不清"这是风吹的还是我投的"。
 *
 * ── 三条刻意的约束(见 tools/test-modules.mjs 里对应的断言) ──
 *   · **绝不碰共享 Math.random**:用自己的 mulberry32 流(seed 在 theme.idleDrift)。
 *     共享流被消费一次,鱼的随机序列与指纹就会漂 —— 那种漂移截图看不出来。
 *   · **自己的涟漪池 + 自己的上限**:再多的落叶也挤不掉鼠标涟漪。
 *   · **计时器走每帧倒计时,不用 setTimeout**:dispose() 之后不能还有回调进来改状态。
 *   · **素材缺失不降级**:不画程序化替身,也不生成假件 —— 缺素材是打包/路径错了,
 *     那种错误必须立刻看见(停止生成 + 控制台报到具体文件名),而不是用几个椭圆把故障藏起来。
 *
 * ── 与宿主的关系 ──
 *   开关是 config.idleEvents(宿主属性 idleEvents,见 platform/properties.js 的通用布尔分支)。
 *   关掉后不再生成新的,但在场的会**落完**(settleWhileDisabled)—— 不留"冻在半空"的残景。
 */
function createIdleDrift({ config, viewport, foods, input, mouse, kois }) {
    const P = THEME.idleDrift || {};
    const rng = mulberry32(P.seed || 0x51ed270b);
    const range = r => r[0] + rng() * (r[1] - r[0]);
    const pick = arr => arr[Math.floor(rng() * arr.length) % arr.length];

    /* 落水涟漪:和天气同一个 Ripple 类,只是剖面派生自 water.ripple(小一号、淡一些)。
     * 独立池子的理由和天气一样 —— 容量上限必须各管各的。 */
    const R = P.ripple || {};
    const profile = Object.freeze({
        ...THEME.water.ripple,
        ...(R.maxLive !== undefined ? { maxLive: R.maxLive } : {}),
        ...(R.speed ? { speed: R.speed } : {}),
        ...(R.life ? { life: R.life } : {}),
        ...(R.crestAlpha !== undefined ? { crestAlpha: R.crestAlpha } : {}),
        ...(R.lamRatio !== undefined ? { lamRatio: R.lamRatio } : {}),
        ...(R.waveCycles !== undefined ? { waveCycles: R.waveCycles } : {}),
        ...(R.waveDecay !== undefined ? { waveDecay: R.waveDecay } : {}),
        ...(R.arcFloor !== undefined ? { arcFloor: R.arcFloor } : {}),
        ...(R.arcJitter !== undefined ? { arcJitter: R.arcJitter } : {}),
        ...(R.troughAlpha !== undefined ? { troughAlpha: R.troughAlpha } : {})
    });
    const field = createRainRipples({ viewport, config, profile });

    const sprites = createIdleSprites({
        longSide: { leaf: (P.sprite && P.sprite.leaf) || 30, petal: (P.sprite && P.sprite.petal) || 26 }
    });
    sprites.load();

    const items = [];            // 在空中的 / 水里的落叶花瓣
    const holds = [];            // 惊扰:注入的鼠标位置还要保持多久
    const gathers = [];          // 聚集:延迟若干秒后塞吸引子(替代 setTimeout)
    const timers = { leaf: 0, petal: 0 };
    let enabled = config.idleEvents !== false;
    let spawned = 0, landed = 0, startled = 0, gathered = 0;
    let sinceSpawn = 1e9;        // 距上一件多久(全局最小间隔用)

    const kinds = ['leaf', 'petal'];

    /** 放一件下来(公开:测试与"阵风"这类后续玩法都用它;不给 x 就随机)。
     *  没有素材就【不放】—— 返回 null。宁可什么都没有,也不放一个假形状骗自己。 */
    function drop(kind, x) {
        if (items.length >= (P.cap || 12)) return null;
        const petal = kind === 'petal';
        const arr = sprites.groups[kind] || [];
        if (!arr.length) return null;
        const F = P.fall || {};
        const it = {
            kind, petal,
            x: x !== undefined ? x : range([0.06, 0.94]) * viewport.width,
            y: -36,
            vy: range(F.vy || [34, 66]),
            t: rng() * 6,
            rot: rng() * Math.PI * 2,
            spin: range(F.spin || [-1.4, 1.4]),
            flip: rng() * Math.PI * 2,
            flipSpd: range(F.flip || [1.1, 2.3]),
            sway: range(F.sway || [0.7, 1.6]),
            sizeMul: range((P.sprite && P.sprite.sizeMul) || [1, 1]),
            spr: pick(arr),
            land: range(P.land || [0.3, 0.88]) * viewport.height,
            state: 'fall', sink: 0, sinkRate: range((P.sink && P.sink.rate) || [0.1, 0.18]),
            life: range(P.life || [9, 17]), swirl: rng() * 6.28, driftA: rng() * 6.28
        };
        items.push(it);
        spawned++;
        return it;
    }

    /** 触水:涟漪 → 惊扰 → 延迟聚集(与实验页同一条链,顺序也一致) */
    function onLand(it) {
        landed++;
        const power = (R.power && R.power[it.kind]) || 0.36;
        field.spawn(it.x, it.y, power);

        const near = nearby(it.x, it.y, (P.startle && P.startle.radius) || 150);
        if (near > 0) {
            /* 注入一次"鼠标在这儿":behavior 的躲鼠标分支会真的把附近的鱼赶散。
             * 只注入一次、不每帧重写 —— 用户真去动鼠标时,桥推来的位置会自然覆盖它
             * (这正好是自持事件的场景:没人操作的时候才有这些事件)。 */
            input.move(it.x, it.y);
            holds.push({ x: it.x, y: it.y, left: (P.startle && P.startle.hold) || 0.42 });
            startled += near;
        }
        const g = P.gather || {};
        const around = nearby(it.x, it.y, ((P.startle && P.startle.radius) || 150) * (g.radiusMul || 1.8));
        if (around > 0) gathers.push({ x: it.x, y: it.y, left: (g.delay || 0.9) });
    }

    function nearby(x, y, radius) {
        if (!Array.isArray(kois) || !radius) return 0;
        let n = 0;
        const r2 = radius * radius;
        for (let i = 0; i < kois.length; i++) {
            const dx = kois[i].x - x, dy = kois[i].y - y;
            if (dx * dx + dy * dy < r2) n++;
        }
        return n;
    }

    /** 聚集:往真引擎的 foods 里塞一个**不画**的吸引子 —— 借它"好奇→游过去"的行为 */
    function bait(x, y, seconds) {
        const b = {
            x, y, life: seconds, sink: 0, sinkRate: 0, pop: 0,
            swirl: rng() * 6.28, dvx: 0, dvy: 0,
            /* life 由 simulation 统一递减并回收(它每帧 `foods[i].update(dt); life<=0 → splice`)。
             * ★ 这里【不要自己 splice】:那会在引擎的倒序遍历里挪动下标,可能顺手删掉一粒真饲料。 */
            update(dt) { this.life -= dt; },
            draw() { /* 故意不画:只是个吸引子 */ }
        };
        foods.push(b);
        gathered++;
        return b;
    }

    /* 素材不齐 → 不生成,并只报一次错(报到具体文件名)。
     * 不做程序化替身:素材出问题这件事本身就是"必须修"的,不该被一层假形状掩盖过去。 */
    let assetErrorReported = false;
    function assetsOk() {
        if (sprites.complete) return true;
        if (!assetErrorReported && sprites.ready) {
            assetErrorReported = true;
            console.error('[koi] 自落事件素材缺失,已停止生成(不是降级,是错误):',
                          sprites.failedFiles.join(', '));
        }
        return false;
    }

    function stepItems(dt) {
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            it.t += dt;
            if (it.state === 'fall') {
                it.flip += it.flipSpd * dt;
                it.x += Math.sin(it.t * it.sway) * ((P.fall && P.fall.swayAmp) || 22) * dt;
                it.y += it.vy * dt;
                // 落点可能超出当前高度(窗口变小了):夹一下,别让它沉到画布外面
                const land = Math.min(it.land, viewport.height * 0.94);
                if (it.y >= land) { it.state = 'float'; it.y = land; onLand(it); }
            } else {
                const S = P.sink || {};
                it.life -= dt;
                if (it.sink < 1) {
                    it.sink = Math.min(1, it.sink + dt * it.sinkRate);
                    it.swirl += dt * (S.swirl || 0.6);
                    it.x += (Math.cos(it.driftA) * (S.drift || 0.14) + Math.cos(it.swirl) * 0.06) * 60 * dt;
                    it.y += (Math.sin(it.driftA) * 0.09 + Math.sin(it.swirl * 0.8) * 0.05) * 60 * dt;
                }
                if (it.life <= 0) {
                    const out = P.fadeOut || 1.6;
                    it.sink = Math.min(1, it.sink + dt * 0.6);
                    if (it.life <= -out) { items.splice(i, 1); continue; }
                }
            }
        }
    }

    function drawItem(g, it) {
        const S = P.sink || {};
        const out = P.fadeOut || 1.6;
        const fade = it.life < out ? Math.max(0, it.life / out) : 1;
        const deep = it.state === 'fall' ? 0 : it.sink;
        g.save();
        g.translate(it.x, it.y);
        g.rotate(it.rot + it.t * 0.7);
        g.globalAlpha = fade * (1 - deep * (S.fade !== undefined ? S.fade : 0.55));
        // 翻面:横向压扁(叶子在空中翻起来不像贴纸);下沉时再纵向压一点(侧视变俯视)
        g.scale(0.35 + 0.65 * Math.abs(Math.cos(it.flip)), 1 - deep * (S.squash !== undefined ? S.squash : 0.30));
        const k = it.sizeMul;
        g.drawImage(it.spr.c, -it.spr.w * k / 2, -it.spr.h * k / 2, it.spr.w * k, it.spr.h * k);
        g.restore();
    }

    function stepHolds(dt) {
        for (let i = holds.length - 1; i >= 0; i--) {
            const h = holds[i];
            h.left -= dt;
            if (h.left > 0) continue;
            holds.splice(i, 1);
            /* 只在"注入的位置没被人动过"时才收回鼠标状态:
             * 把 mouse.active 置回 false 是个有副作用的动作,用户自己正在用鼠标时不能替他决定。 */
            const moved = mouse && (mouse.x === null || Math.abs(mouse.x - h.x) > 2 || Math.abs(mouse.y - h.y) > 2);
            if (!moved) input.leave();
        }
    }

    function stepGathers(dt) {
        for (let i = gathers.length - 1; i >= 0; i--) {
            const g = gathers[i];
            g.left -= dt;
            if (g.left > 0) continue;
            gathers.splice(i, 1);
            bait(g.x, g.y, (P.gather && P.gather.seconds) || 8);
        }
    }

    return {
        /** 关掉后还要让在空中的落完、在水里的沉完(不留残景) */
        settleWhileDisabled: true,

        /** 手动放一件(测试与后续"阵风"玩法用) */
        drop,

        update(dt) {
            /* 两个开关都开才生成新的:
             *   enabled            = 玩法开关(setFeature('idleDrift', ...))
             *   config.idleEvents  = **宿主属性**(WE / Lively 面板上那个勾)
             * 宿主属性是唯一真源,所以必须每帧读 —— 只在创建时读一次的话,
             * 面板上拨动它要重启壁纸才生效(这个 bug 被下面那条属性断言抓过)。 */
            const want = enabled && config.idleEvents !== false && assetsOk();
            sinceSpawn += dt;
            if (want) {
                /* 两个定时器各自累;但**全局最小间隔**没到就不放 —— 否则两条定时器撞在一起
                 * 会在同一瞬间掉两件(实测最短 0.2 秒),那不是"偶尔",那是机械。
                 * 被挡住的定时器停在 0(不丢),间隔一到立刻放出来。 */
                const gapOk = sinceSpawn >= (P.minGap || 0);
                for (const kind of kinds) {
                    timers[kind] -= dt;
                    if (timers[kind] <= 0) {
                        if (gapOk) {
                            if (drop(kind)) sinceSpawn = 0;
                            const r = (P.rate && P.rate[kind]) || [3, 1.5];
                            timers[kind] = r[0] + rng() * r[1];
                        } else {
                            timers[kind] = 0;          // 压着,等最小间隔
                        }
                    }
                }
            }
            stepItems(dt);
            stepHolds(dt);
            stepGathers(dt);
            field.update(dt);
        },
        layers: {
            // 层表里 weather 的语义就是"天气(雨/落叶/花瓣)这类前景粒子"——新层一个字没加
            weather: g => {
                field.draw(g);
                for (let i = 0; i < items.length; i++) drawItem(g, items[i]);
            }
        },
        setEnabled(on) { enabled = !!on; },
        dispose() {
            items.length = 0; holds.length = 0; gathers.length = 0;
            field.clear();
            sprites.dispose();
        },
        inspect: () => ({
            enabled, host: config.idleEvents !== false, cap: P.cap || 12,
            count: items.length, spawned, landed, startled, gathered, sinceSpawn,
            pending: { holds: holds.length, gathers: gathers.length },
            field, sprites
        })
    };
}

Object.assign(exports, { createIdleDrift });
};
__modules["src/render/idle-sprites.js"] = function (exports, __require) {
/**
 * 自持事件的素材(落叶 4 + 花瓣 4)—— 加载 → 算紧包围盒 → 预缩放到显示尺寸 → alpha 归一。
 *
 * 为什么在这里做这三件事(而不是在玩法里):
 *   ① **紧包围盒**:素材是 1254×1254 的大图,物体只占中间一小块(实测最小边距 17%)。
 *      直接按原图尺寸画,显示大小会被留白带偏;用 alpha>8 的可见范围当源矩形才对。
 *   ② **预缩放**:壁纸是常驻进程,每帧缩放 1254² 的图是纯浪费 —— 一次性缩到 22~30px 缓存。
 *      (assets/idle/README.md 也明确建议"接入时缓存缩小精灵"。)
 *   ③ **alpha 归一**:素材里出现过"主体半透明"的图(petal-3:可见区 38% 的 alpha 只有
 *      150~200),画在深色池塘上会透出池底变成灰团。它是 alpha 问题,RGB 是正常粉色 ——
 *      提一次 alpha 就能救回来,不必重新生成。叶子/花瓣其余 7 张低 alpha 占比都在 1% 左右,
 *      这条曲线对它们几乎是恒等变换;边缘抗锯齿保留。
 *
 * 三条刻意的约束:
 *   · **文件名写成字面量**(不拼字符串):打包脚本(koi-wallpaper/tools/sync.sh)是按
 *     "代码里出现过这个文件名"来决定拷不拷素材的,拼出来的名字会被判成"没人引用"而丢掉。
 *   · **绝不碰 Math.random**:加载过程一帧都不该动共享随机序列,否则鱼的随机序列/指纹会漂。
 *   · **素材缺失不降级**:不做程序化替身。缺素材就是打包/路径错了 ——
 *     那属于"必须立刻看见"的错误(玩法会停止生成并往控制台报一次错,见 features/idle-drift.js)。
 *     画几个椭圆假装"事件还在发生",只会把真正的故障藏起来。
 */

/* 素材 = **256px 无损 WebP**(由 tools/to_webp.py 生成:先按 alpha>8 裁紧包围盒,再缩到长边 256)。
 * 显示尺寸只有 22~30px ⇒ 8~11 倍过采样;而且是"缩到 256px 之后逐像素无损",不是有损压缩。 */
const IDLE_ASSET_FILES = {
    leaf: ['assets/idle/leaf-1.webp', 'assets/idle/leaf-2.webp',
           'assets/idle/leaf-3.webp', 'assets/idle/leaf-4.webp'],
    petal: ['assets/idle/petal-1.webp', 'assets/idle/petal-2.webp',
            'assets/idle/petal-3.webp', 'assets/idle/petal-4.webp']
};

/** alpha 归一曲线:≤20 归 0、≥150 归 255(拐点取 150 = 实测"半透明主体"的 alpha 中位区) */
const ALPHA_LO = 20, ALPHA_HI = 150;
/** 可见判据(与素材 manifest 的 boundsAlphaThreshold 一致) */
const VISIBLE_ALPHA = 8;

/**
 * @param opts.base 资源前缀(默认空 = 相对页面根;宿主打包后也走相对路径)
 * @param opts.longSide { leaf, petal } 显示长边(CSS px)
 */
function createIdleSprites({ base = '', longSide = { leaf: 30, petal: 26 } } = {}) {
    const groups = { leaf: [], petal: [] };
    let expected = 0, loaded = 0, normalized = 0;
    const failedFiles = [];          // 缺了哪些:报错要能直接指名道姓

    function prep(url, targetLong) {
        return new Promise(resolve => {
            const im = new Image();
            im.onerror = () => { failedFiles.push(url); resolve(null); };
            im.onload = () => {
                try {
                    const w0 = im.naturalWidth, h0 = im.naturalHeight;
                    const src = document.createElement('canvas');
                    src.width = w0; src.height = h0;
                    const sx = src.getContext('2d', { willReadFrequently: true });
                    sx.drawImage(im, 0, 0);

                    // ① 紧包围盒:一次 getImageData 扫描(一次性成本,换掉每帧缩放)
                    const d = sx.getImageData(0, 0, w0, h0).data;
                    let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
                    for (let yy = 0; yy < h0; yy++) {
                        const row = yy * w0;
                        for (let xx = 0; xx < w0; xx++) {
                            if (d[(row + xx) * 4 + 3] > VISIBLE_ALPHA) {
                                if (xx < x0) x0 = xx;
                                if (xx > x1) x1 = xx;
                                if (yy < y0) y0 = yy;
                                if (yy > y1) y1 = yy;
                            }
                        }
                    }
                    if (x1 < 0) { failedFiles.push(url + '(全透明)'); return resolve(null); }
                    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
                    const k = targetLong / Math.max(cw, ch);
                    const out = document.createElement('canvas');
                    out.width = Math.max(1, Math.round(cw * k));
                    out.height = Math.max(1, Math.round(ch * k));
                    const oc = out.getContext('2d', { willReadFrequently: true });
                    oc.drawImage(src, x0, y0, cw, ch, 0, 0, out.width, out.height);

                    // ③ alpha 归一:在小图上做(几十像素,成本可忽略)
                    const small = oc.getImageData(0, 0, out.width, out.height);
                    const sd = small.data;
                    let touched = 0;
                    for (let i = 3; i < sd.length; i += 4) {
                        const a = sd[i];
                        if (a <= ALPHA_LO) { sd[i] = 0; touched++; }
                        else if (a >= ALPHA_HI) { sd[i] = 255; if (a !== 255) touched++; }
                        else { sd[i] = Math.round((a - ALPHA_LO) / (ALPHA_HI - ALPHA_LO) * 255); touched++; }
                    }
                    if (touched) { oc.putImageData(small, 0, 0); normalized++; }

                    loaded++;
                    resolve({ c: out, w: out.width, h: out.height, src: url,
                              box: [x0, y0, cw, ch] });
                } catch (e) {
                    // 跨域/解码失败:记下来(玩法会因此停止生成,并把它报到控制台)
                    failedFiles.push(url + '(' + (e && e.message ? e.message : 'decode') + ')');
                    resolve(null);
                }
            };
            im.src = base + url;
        });
    }

    /** 异步加载;完成前 groups 为空 —— 玩法会等到 complete 才开始生成(不画假件) */
    function load() {
        const jobs = [];
        for (const kind of Object.keys(IDLE_ASSET_FILES)) {
            for (const url of IDLE_ASSET_FILES[kind]) {
                expected++;
                jobs.push(prep(url, longSide[kind]).then(s => { if (s) groups[kind].push(s); }));
            }
        }
        return Promise.all(jobs);
    }

    return {
        groups,
        load,
        get ready() { return expected > 0 && loaded + failedFiles.length >= expected; },
        get failed() { return failedFiles.length; },
        failedFiles,
        /** 全部素材就绪且一件不缺 —— 玩法据此决定"要不要生成" */
        get complete() { return expected > 0 && loaded === expected && failedFiles.length === 0; },
        inspect: () => ({ expected, loaded, failed: failedFiles.length, failedFiles: [...failedFiles], normalized,
                          leaf: groups.leaf.length, petal: groups.petal.length,
                          sizes: groups.leaf.concat(groups.petal).map(s => s.w + 'x' + s.h) }),
        dispose() { groups.leaf.length = 0; groups.petal.length = 0; }
    };
}

Object.assign(exports, { createIdleSprites, IDLE_ASSET_FILES });
};
__modules["src/features/day-cycle.js"] = function (exports, __require) {
const { THEME, WaterGL } = __require("src/shared/legacy-assets.js");
/**
 * 光的"时段" —— 光随时间走(2026-09-26 接入)。
 *
 * 一句话:让池塘的天色/光向跟着**现实时间**走,于是它和池里那行时钟是自洽的
 * (时钟写着 22:07,水面就真的是夜里的样子)。
 *
 * ── 只动光,别的一律不动 ──
 * 写出去的东西只有三样,全部走既有通道:
 *   ① core/environment.js 的**时段通道**(相对量:光感乘数 / 压暗 / 色罩 / 整层乘数)
 *      —— 由 environment 与天气精确合成后交给 renderer,所以 renderer 一行没改;
 *   ② THEME.light.dir(光向)—— 消费方(鱼影/时钟影/涟漪)已改成每帧现读;
 *   ③ WaterGL.P.az / elev(GPU 涟漪高光的光向与高度角)—— 保证"光只有一个真源"。
 * 鱼的构造数学、行为、水面、事件**一个字都没碰**,同种子指纹不变。
 *
 * ── 三条定版(用户拍板)──
 *   · 默认**开**(config.dayCycle);不喜欢的人在宿主面板里关掉即可。
 *   · 光向**走半圈**(theme.dayPhase.azAmp = 0.5):整圈时有些角度光从正下方来,影子方向很怪。
 *   · 夜间亮度**就用现在这版**(keys 里 dim 0.50 / causticMul 0.22);想改口味用宿主属性 nightDim。
 *
 * ── 两个必须守的实现细节(都是踩过的坑)──
 *   · **宿主属性每帧读**,不能只在创建时读一次 —— 否则面板上拨了要重启壁纸才生效
 *     (idleDrift 第一版就是这么错的)。
 *   · **缓入放在"光的数值域",不放"时刻域"**:真实时间模式下睡眠唤醒会让时刻跳几小时;
 *     若在时刻域做最短路径插值,22:30 → 10:00 会被当成"往前 11.5 小时",缓冲期间画面真的
 *     走一遍午夜(先更黑再变亮,像快进)。数值域插值只有一个方向:当前色/亮度趋于目标。
 */

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbHex = a => '#' + a.map(v => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0')).join('');
function createDayCycle({ config, environment }) {
    const P = THEME.dayPhase || {};
    const keys = (P.keys || []).slice().sort((a, b) => a.h - b.h);
    /* ★ 基线 = "今天的样子":光向从主题当前值反推方位角(不是写死 232,否则 12:00 会有 0.5° 的偏差,
     *   而"12:00 恒等"这条承诺必须逐字成立);涟漪高度角也抓 WaterGL 的当前值。 */
    /* 归一到 0~360:watergl 的 P.az 用的是 0~360(232°),而 atan2 会给 -128.5°(同一个方向)。
     * 不归一的话,读数字的人(和以后的代码)会被绕晕。 */
    const baseAz = ((Math.atan2(THEME.light.dir[1], THEME.light.dir[0]) * 180 / Math.PI) % 360 + 360) % 360;
    const baseElev = (WaterGL && WaterGL.P && Number.isFinite(WaterGL.P.elev)) ? WaterGL.P.elev : 55;
    const elevNight = Number.isFinite(P.elevNight) ? P.elevNight : 30;
    const ease = Number.isFinite(P.ease) ? P.ease : 0.3;

    let on = true;                 // setFeature 开关
    let pinned = null;             // 测试/预览:把时刻钉在某个小时(null = 走真实时间)
    let reported = '';             // 诊断:最近一次写出去的时刻
    /* 缓入状态(null = 还没初始化 → 第一次直接到位) */
    const CUR = { causticMul: null, dim: null, lm: null, az: null, rgb: null };

    const realHour = () => {
        const d = new Date();
        return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    };
    const dayness = h => clamp01(1 - Math.abs(h - 12) / 9);      // 正午 1、夜里 0

    /** 时刻 → 该时刻的相对量(关键帧之间线性插值) */
    function sample(h) {
        let a = keys[0], b = keys[keys.length - 1];
        for (let i = 0; i < keys.length - 1; i++) {
            if (h >= keys[i].h && h <= keys[i + 1].h) { a = keys[i]; b = keys[i + 1]; break; }
        }
        const f = b.h === a.h ? 0 : clamp01((h - a.h) / (b.h - a.h));
        const A = hexRgb(a.grade), B = hexRgb(b.grade);
        return {
            causticMul: a.causticMul + (b.causticMul - a.causticMul) * f,
            dim: a.dim + (b.dim - a.dim) * f,
            lm: a.lm + (b.lm - a.lm) * f,
            rgb: [0, 1, 2].map(i => A[i] + (B[i] - A[i]) * f),
            az: baseAz + (h - 12) * (P.azPerHour || 15) * (P.azAmp === undefined ? 0.5 : P.azAmp)
        };
    }

    /** 数值域缓入(dt 给大值 = 直接到位) */
    function easeTo(t, dt) {
        const f = clamp01(dt * ease);
        if (CUR.dim === null) {
            CUR.causticMul = t.causticMul; CUR.dim = t.dim; CUR.lm = t.lm; CUR.az = t.az; CUR.rgb = t.rgb.slice();
            return;
        }
        const k = f;
        CUR.causticMul += (t.causticMul - CUR.causticMul) * k;
        CUR.dim += (t.dim - CUR.dim) * k;
        CUR.lm += (t.lm - CUR.lm) * k;
        let d = t.az - CUR.az;
        if (d > 180) d -= 360; else if (d < -180) d += 360;      // 角度走最短弧,别绕远
        CUR.az += d * k;
        for (let i = 0; i < 3; i++) CUR.rgb[i] += (t.rgb[i] - CUR.rgb[i]) * k;
    }

    /** 把当前值写进真通道(光向原地改,零每帧分配 —— 也避免有人持着旧数组的引用) */
    function write(hour) {
        environment.setDayPhase({
            causticMul: CUR.causticMul, dim: CUR.dim, lm: CUR.lm, grade: rgbHex(CUR.rgb)
        });
        const r = CUR.az * Math.PI / 180;
        THEME.light.dir[0] = Math.cos(r);
        THEME.light.dir[1] = Math.sin(r);
        if (WaterGL && WaterGL.P) {
            WaterGL.P.az = CUR.az;
            WaterGL.P.elev = elevNight + (baseElev - elevNight) * dayness(hour);
        }
    }

    /** 还原成"今天的样子"(关掉 / dispose 时都要走这条) */
    function restore() {
        environment.setDayPhase(null);
        const r = baseAz * Math.PI / 180;
        THEME.light.dir[0] = Math.cos(r);
        THEME.light.dir[1] = Math.sin(r);
        if (WaterGL && WaterGL.P) { WaterGL.P.az = baseAz; WaterGL.P.elev = baseElev; }
    }

    return {
        update(dt) {
            /* 两个开关都开才走时段:玩法开关(setFeature)× 宿主属性(config.dayCycle)。
             * 关掉 = 目标回到 12:00 基线(不是"冻在当前天色")—— 和天气开关同一条规矩。 */
            const want = on && config.dayCycle !== false;
            const dimMul = Number.isFinite(Number(config.nightDim)) ? Number(config.nightDim) : (P.nightDim ?? 1);
            const hour = want ? (pinned === null ? realHour() : pinned) : 12;
            const t = sample(hour);
            t.dim = clamp01(t.dim * dimMul);
            t.lm = 1 - (1 - t.lm) * dimMul;          // lm 是"整层乘数",暗度倍率要按"压掉多少"缩放
            easeTo(t, dt);
            write(hour);
            reported = hour;
        },
        /** 预览/测试:把时刻钉住(小时,可小数);传 null 回到真实时间 */
        setClock(hours) {
            pinned = Number.isFinite(hours) ? ((hours % 24) + 24) % 24 : null;
            return pinned;
        },
        setEnabled(next) { on = !!next; },
        dispose() { restore(); },
        inspect: () => ({
            on, host: config.dayCycle !== false,
            nightDim: Number(config.nightDim),
            pinned, hour: reported,
            realHour: realHour(),
            baseAz, baseElev, azAmp: P.azAmp === undefined ? 0.5 : P.azAmp,
            cur: { ...CUR, rgb: CUR.rgb ? rgbHex(CUR.rgb) : null },
            lightDir: [THEME.light.dir[0], THEME.light.dir[1]],
            waterAz: WaterGL && WaterGL.P ? WaterGL.P.az : null,
            waterElev: WaterGL && WaterGL.P ? WaterGL.P.elev : null,
            day: environment.dayPhase
        })
    };
}

Object.assign(exports, { createDayCycle });
};
__modules["src/ui/fish-debug-panel.js"] = function (exports, __require) {
const SHAPE_DEFAULTS = Object.freeze({
    bodyLen: 1,
    bodyH: 1,
    headW: 1,
    tailW: 1,
    tailFin: 1,
    fin: 1,
    eye: 1
});

const STORE_KEY = 'koi.debug.fish.v1';
const DEFAULT_FISH_SIZE = 2.2;

const RANGE_LABELS = Object.freeze({
    fishSize: '整体大小',
    fishSpeed: '游动速度',
    motionTurnRadius: '转弯半径',
    motionTurnResponse: '转向响应',
    motionCruiseCurve: '巡游弯曲度',
    bodyLen: '身体长度',
    bodyH: '身体宽度',
    headW: '头部宽度',
    tailW: '尾柄宽度',
    tailFin: '尾鳍大小',
    fin: '胸鳍大小',
    eye: '眼睛大小',
    spotWidth: '斑纹宽度',
    outlineWidth: '纯黑描边粗细',
    net: '鳞片强度',
    sheen: '金属光泽'
});

function addStyles() {
    if (document.getElementById('fish-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'fish-debug-panel-styles';
    style.textContent = [
        '.fish-debug{position:fixed;top:16px;right:16px;z-index:20;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.fish-debug *{box-sizing:border-box}',
        '.fish-debug button,.fish-debug input,.fish-debug select,.fish-debug textarea{font:inherit}',
        '.fish-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.92);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.fish-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid rgba(208,235,225,.24);border-radius:14px;background:rgba(6,22,21,.94);box-shadow:0 18px 50px rgba(0,0,0,.38);backdrop-filter:blur(14px) saturate(115%)}',
        '.fish-debug__panel[hidden],.fish-debug__toggle[hidden]{display:none}',
        '.fish-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.fish-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.fish-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.fish-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.fish-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.fish-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.fish-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.fish-debug__field:last-child{margin-bottom:0}',
        '.fish-debug__field label{color:#dcece6}',
        '.fish-debug__value{min-width:42px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.fish-debug__field input[type="range"]{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.fish-debug__field input[type="color"]{width:48px;height:30px;padding:2px;border:1px solid rgba(208,235,225,.25);border-radius:7px;background:#102b28;cursor:pointer}',
        '.fish-debug__select{width:100%;height:38px;padding:0 10px;border:1px solid rgba(208,235,225,.24);border-radius:8px;background:#102b28;color:#eef8f4}',
        '.fish-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.fish-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.fish-debug__button--primary{border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.fish-debug__output{width:100%;height:112px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}',
        '.fish-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.fish-debug__metrics{display:grid;grid-template-columns:1fr auto;gap:7px 14px;margin-top:12px;padding:11px;border-radius:9px;background:#081b1a;color:#b8d7cd}',
        '.fish-debug__metric-value{color:#8fe0c3;text-align:right;font-variant-numeric:tabular-nums}',
        '.fish-debug__readonly{margin:9px 0 0;color:#8eb5a8;font-size:12px}',
        '.fish-debug button:hover{filter:brightness(1.08)}',
        '.fish-debug button:focus-visible,.fish-debug input:focus-visible,.fish-debug select:focus-visible,.fish-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:600px){.fish-debug{top:10px;right:10px}.fish-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}}',
        '@media(prefers-reduced-transparency:reduce){.fish-debug__panel,.fish-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, min, max, step, value) {
    return [
        '<div class="fish-debug__field">',
        '<label for="fish-debug-' + key + '">' + RANGE_LABELS[key] + '</label>',
        '<output class="fish-debug__value" data-output="' + key + '">' + Number(value).toFixed(2) + '</output>',
        '<input id="fish-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">',
        '</div>'
    ].join('');
}
function createFishDebugPanel({ kois, config, types, repository }) {
    addStyles();

    const fishType = types.get('koi');
    const originalFishSize = Number.isFinite(Number(config.fishSize)) ? config.fishSize : DEFAULT_FISH_SIZE;
    config.fishSize = originalFishSize;
    const originalMotion = {
        fishSpeed: config.fishSpeed,
        motionTurnRadius: config.motionTurnRadius ?? 1,
        motionTurnResponse: config.motionTurnResponse ?? 1,
        motionCruiseCurve: config.motionCruiseCurve ?? 1
    };
    const shell = document.createElement('aside');
    shell.className = 'fish-debug';
    shell.setAttribute('aria-label', '鱼外观调试工具');
    shell.innerHTML = [
        '<button class="fish-debug__toggle" type="button" aria-expanded="true" hidden>鱼外观</button>',
        '<section class="fish-debug__panel">',
        '<header class="fish-debug__head">',
        '<div><h2 class="fish-debug__title">鱼外观调试</h2><p class="fish-debug__hint">10 种中国常见淡水鱼 · 按 D 显示或隐藏</p></div>',
        '<button class="fish-debug__close" type="button">收起</button>',
        '</header>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">品种</legend>',
        '<select class="fish-debug__select" data-breed aria-label="选择淡水鱼种"><option value="mixed">10 种混合</option></select>',
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">尺寸与轮廓</legend>',
        rangeField('fishSize', 0.5, 3, 0.05, originalFishSize),
        rangeField('bodyLen', 0.35, 2.2, 0.05, 1),
        rangeField('bodyH', 0.35, 2.2, 0.05, 1),
        rangeField('headW', 0.35, 2.2, 0.05, 1),
        rangeField('tailW', 0.35, 2.2, 0.05, 1),
        rangeField('tailFin', 0.35, 2.2, 0.05, 1),
        rangeField('fin', 0.35, 2.2, 0.05, 1),
        rangeField('eye', 0.35, 2.2, 0.05, 1),
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">平面运动</legend>',
        rangeField('fishSpeed', 0.2, 3, 0.05, config.fishSpeed),
        rangeField('motionTurnRadius', 0.25, 3, 0.05, config.motionTurnRadius ?? 1),
        rangeField('motionTurnResponse', 0.25, 2.5, 0.05, config.motionTurnResponse ?? 1),
        rangeField('motionCruiseCurve', 0, 2.5, 0.05, config.motionCruiseCurve ?? 1),
        '<div class="fish-debug__metrics" aria-label="实时运动状态">',
        '<span>平均游速</span><span class="fish-debug__metric-value" data-motion="speed">0 px/s</span>',
        '<span>平均转向率</span><span class="fish-debug__metric-value" data-motion="turn">0 °/s</span>',
        '<span>平均转弯半径</span><span class="fish-debug__metric-value" data-motion="radius">—</span>',
        '<span>主要行为</span><span class="fish-debug__metric-value" data-motion="behavior">巡游</span>',
        '</div><p class="fish-debug__readonly">上方滑块修改运动模型，下方数据实时监测鱼群状态。</p>',
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">颜色与质感</legend>',
        '<div class="fish-debug__field"><label for="fish-debug-bodyColor">身体底色</label><input id="fish-debug-bodyColor" data-key="bodyColor" type="color" value="#eee8dc"></div>',
        '<div class="fish-debug__field"><label for="fish-debug-spotColor">斑纹颜色</label><input id="fish-debug-spotColor" data-key="spotColor" type="color" value="#d94f28"></div>',
        rangeField('spotWidth', 0.1, 0.72, 0.01, 0.5),
        rangeField('outlineWidth', 0, 1, 0.01, 0.22),
        rangeField('net', 0, 1, 0.01, 0),
        rangeField('sheen', 0, 1, 0.01, 0),
        '</fieldset>',
        '<div class="fish-debug__actions">',
        '<button class="fish-debug__button" type="button" data-reset>恢复全部默认</button>',
        '<button class="fish-debug__button fish-debug__button--primary" type="button" data-copy>复制参数</button>',
        '</div>',
        '<textarea class="fish-debug__output" readonly aria-label="当前调试参数"></textarea>',
        '<p class="fish-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.fish-debug__panel');
    const toggle = shell.querySelector('.fish-debug__toggle');
    const close = shell.querySelector('.fish-debug__close');
    const breed = shell.querySelector('[data-breed]');
    const output = shell.querySelector('.fish-debug__output');
    const status = shell.querySelector('.fish-debug__status');
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    for (const item of fishType.breeds) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        breed.appendChild(option);
    }

    function ordinaryFish() {
        return kois.filter(fish => !fish.custom);
    }

    function inputFor(key) {
        return shell.querySelector('[data-key="' + key + '"]');
    }

    function numberValue(key) {
        return Number(inputFor(key).value);
    }

    function shapeValues() {
        return {
            bodyLen: numberValue('bodyLen'),
            bodyH: numberValue('bodyH'),
            headW: numberValue('headW'),
            tailW: numberValue('tailW'),
            tailFin: numberValue('tailFin'),
            fin: numberValue('fin'),
            eye: numberValue('eye')
        };
    }

    function currentParameters() {
        return {
            breed: breed.value,
            fishSize: numberValue('fishSize'),
            motion: {
                fishSpeed: numberValue('fishSpeed'),
                turnRadius: numberValue('motionTurnRadius'),
                turnResponse: numberValue('motionTurnResponse'),
                cruiseCurve: numberValue('motionCruiseCurve')
            },
            shape: shapeValues(),
            bodyColor: inputFor('bodyColor').value,
            spotColor: inputFor('spotColor').value,
            spotWidth: numberValue('spotWidth'),
            outlineWidth: numberValue('outlineWidth'),
            net: numberValue('net'),
            sheen: numberValue('sheen')
        };
    }

    function refreshOutput() {
        output.value = JSON.stringify(currentParameters(), null, 2);
    }

    function save() {
        repository.write(STORE_KEY, currentParameters());
    }

    function setSavedInput(key, value) {
        const input = inputFor(key);
        if (!input) return;
        if (input.type === 'color') {
            if (/^#[0-9a-f]{6}$/i.test(value)) input.value = value;
            return;
        }
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        input.value = Math.max(Number(input.min), Math.min(Number(input.max), number));
    }

    function updateRangeLabel(input) {
        if (input.type !== 'range') return;
        const target = shell.querySelector('[data-output="' + input.dataset.key + '"]');
        if (target) target.value = Number(input.value).toFixed(2);
    }

    function applyInput(input, persist = true) {
        const key = input.dataset.key;
        const value = input.type === 'color' ? input.value : Number(input.value);
        const fish = ordinaryFish();

        if (key === 'fishSize') {
            config.fishSize = value;
        } else if (key === 'fishSpeed' || key === 'motionTurnRadius' || key === 'motionTurnResponse' || key === 'motionCruiseCurve') {
            config[key] = value;
        } else if (key === 'bodyColor') {
            for (const koi of fish) koi.color = value;
        } else if (key === 'spotColor') {
            for (const koi of fish) for (const spot of koi.spotRanges) spot[2] = value;
        } else if (key === 'spotWidth') {
            for (const koi of fish) for (const spot of koi.spotRanges) spot[3] = value;
        } else if (key === 'outlineWidth') {
            for (const koi of fish) koi.outlineWidth = value;
        } else if (key === 'net' || key === 'sheen') {
            for (const koi of fish) koi[key] = value;
        } else if (Object.prototype.hasOwnProperty.call(SHAPE_DEFAULTS, key)) {
            for (const koi of fish) koi.shape = { ...SHAPE_DEFAULTS, ...(koi.shape || {}), [key]: value };
        }

        updateRangeLabel(input);
        refreshOutput();
        if (persist) save();
        status.textContent = '已应用到 ' + fish.length + ' 条普通鱼';
    }

    function syncFromFirstFish() {
        const first = ordinaryFish()[0];
        if (!first) return;
        const firstShape = { ...SHAPE_DEFAULTS, ...(first.shape || {}) };
        for (const key of Object.keys(SHAPE_DEFAULTS)) inputFor(key).value = firstShape[key];
        inputFor('bodyColor').value = first.color || '#eee8dc';
        const firstSpot = first.spotRanges && first.spotRanges[0];
        if (firstSpot) {
            inputFor('spotColor').value = firstSpot[2];
            inputFor('spotWidth').value = firstSpot[3];
        }
        inputFor('outlineWidth').value = first.outlineWidth ?? 0.22;
        inputFor('net').value = Math.max(0, Math.min(1, first.net || 0));
        inputFor('sheen').value = Math.max(0, Math.min(1, first.sheen || 0));
        for (const input of inputs) updateRangeLabel(input);
        refreshOutput();
    }

    function changeBreed(persist = true) {
        const fish = ordinaryFish();
        const selected = fishType.breeds.find(item => item.id === breed.value);
        for (const koi of fish) {
            if (selected) koi.applyBreed(selected);
            else koi.pickBreed();
        }
        syncFromFirstFish();
        if (persist) save();
        status.textContent = selected ? '已切换为“' + selected.name + '”' : '已重新随机分配品种';
    }

    function restoreSaved() {
        const saved = repository.read(STORE_KEY, null);
        if (!saved || typeof saved !== 'object') return false;
        const validBreed = saved.breed === 'mixed' || fishType.breeds.some(item => item.id === saved.breed);
        breed.value = validBreed ? saved.breed : 'mixed';
        changeBreed(false);
        setSavedInput('fishSize', saved.fishSize);
        setSavedInput('fishSpeed', saved.motion?.fishSpeed);
        setSavedInput('motionTurnRadius', saved.motion?.turnRadius);
        setSavedInput('motionTurnResponse', saved.motion?.turnResponse);
        setSavedInput('motionCruiseCurve', saved.motion?.cruiseCurve);
        for (const key of Object.keys(SHAPE_DEFAULTS)) setSavedInput(key, saved.shape?.[key]);
        for (const key of ['bodyColor', 'spotColor', 'spotWidth', 'outlineWidth', 'net', 'sheen']) {
            setSavedInput(key, saved[key]);
        }
        for (const input of inputs) applyInput(input, false);
        refreshOutput();
        status.textContent = '已恢复上次保存的鱼群参数';
        return true;
    }

    function reset() {
        config.fishSize = originalFishSize;
        inputFor('fishSize').value = originalFishSize;
        for (const [key, value] of Object.entries(originalMotion)) {
            config[key] = value;
            inputFor(key).value = value;
        }
        inputFor('outlineWidth').value = 0.22;
        breed.value = 'mixed';
        for (const key of Object.keys(SHAPE_DEFAULTS)) inputFor(key).value = SHAPE_DEFAULTS[key];
        for (const koi of ordinaryFish()) {
            delete koi.outlineWidth;
            koi.shape = koi.type.shape ? { ...koi.type.shape } : null;
            koi.pickBreed();
        }
        syncFromFirstFish();
        save();
        status.textContent = '已恢复全部默认参数';
    }

    const behaviorLabels = {
        cruise: '巡游',
        school: '鱼群跟随',
        food: '追食',
        flee: '躲避鼠标',
        edge: '边界避让'
    };

    function refreshMotionStatus() {
        const fish = ordinaryFish();
        if (!fish.length) return;
        let speedSum = 0;
        let turnSum = 0;
        let radiusSum = 0;
        let radiusCount = 0;
        const behaviors = Object.create(null);

        for (const koi of fish) {
            const speed = Math.max(0, Number(koi.speed) || 0) * 60;
            const turn = Math.abs(Number(koi.turnRate) || 0);
            speedSum += speed;
            turnSum += turn;
            if (turn > 0.015) {
                radiusSum += speed / turn;
                radiusCount++;
            }
            const behavior = koi.lastBehavior || 'cruise';
            behaviors[behavior] = (behaviors[behavior] || 0) + 1;
        }

        let mainBehavior = 'cruise';
        for (const key of Object.keys(behaviors)) {
            if ((behaviors[key] || 0) > (behaviors[mainBehavior] || 0)) mainBehavior = key;
        }

        shell.querySelector('[data-motion="speed"]').textContent = (speedSum / fish.length).toFixed(1) + ' px/s';
        shell.querySelector('[data-motion="turn"]').textContent = (turnSum / fish.length * 180 / Math.PI).toFixed(1) + ' °/s';
        shell.querySelector('[data-motion="radius"]').textContent = radiusCount ? (radiusSum / radiusCount).toFixed(0) + ' px' : '近似直线';
        shell.querySelector('[data-motion="behavior"]').textContent = behaviorLabels[mainBehavior] || mainBehavior;
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus();
        else toggle.focus();
    }

    function copyParameters() {
        refreshOutput();
        output.focus();
        output.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (_) {}
        status.textContent = copied ? '参数已复制到剪贴板' : '参数已选中，请按 Ctrl+C 复制';
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 'd') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => applyInput(input));
    breed.addEventListener('change', changeBreed);
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    const motionTimer = setInterval(refreshMotionStatus, 250);

    syncFromFirstFish();
    refreshMotionStatus();
    status.textContent = '面板已就绪';

    return {
        restoreSaved,
        dispose() {
            clearInterval(motionTimer);
            window.removeEventListener('keydown', onKeyDown);
            shell.remove();
        }
    };
}

Object.assign(exports, { createFishDebugPanel });
};
__modules["src/ui/ripple-debug-panel.js"] = function (exports, __require) {
const { THEME } = __require("src/shared/legacy-assets.js");
const STORE_KEY = 'koi.debug.ripple.v1';

function addStyles() {
    if (document.getElementById('ripple-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'ripple-debug-panel-styles';
    style.textContent = [
        '.ripple-debug{position:fixed;top:16px;left:16px;z-index:21;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.ripple-debug *{box-sizing:border-box}',
        '.ripple-debug button,.ripple-debug input,.ripple-debug textarea{font:inherit}',
        '.ripple-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.94);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.ripple-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:14px;background:rgba(6,22,21,.95);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(14px) saturate(115%);scrollbar-color:#4c8d79 #0a201e;scrollbar-width:thin}',
        '.ripple-debug__panel[hidden],.ripple-debug__toggle[hidden]{display:none}',
        '.ripple-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.ripple-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.ripple-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.ripple-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.ripple-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.ripple-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.ripple-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.ripple-debug__field:last-child{margin-bottom:0}',
        '.ripple-debug__field label{color:#dcece6}',
        '.ripple-debug__value{min-width:52px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.ripple-debug__field input{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.ripple-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.ripple-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.ripple-debug__button--primary{grid-column:1/-1;border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.ripple-debug__output{width:100%;height:112px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;caret-color:#8fe0c3}',
        '.ripple-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.ripple-debug button:hover{filter:brightness(1.08)}',
        '.ripple-debug button:focus-visible,.ripple-debug input:focus-visible,.ripple-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:700px){.ripple-debug{top:10px;left:10px}.ripple-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}}',
        '@media(prefers-reduced-transparency:reduce){.ripple-debug__panel,.ripple-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, label, min, max, step, value) {
    return [
        '<div class="ripple-debug__field">',
        '<label for="ripple-debug-' + key + '">' + label + '</label>',
        '<output class="ripple-debug__value" data-output="' + key + '"></output>',
        '<input id="ripple-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">',
        '</div>'
    ].join('');
}
function createRippleDebugPanel({ config, viewport, spawnRipple, repository }) {
    addStyles();
    const T = THEME.water.ripple;
    const clamp = value => Math.max(0, Math.min(1, value));
    // 融合滑块的 1.0 基准；主题可以保存调试后的缩放值。
    const base = {
        crestAlpha: 0.78,
        troughAlpha: 0.45,
        arcPower: 2,
        arcFloor: 0,
        flankFloor: 0.35,
        speed: [105, 55],
        life: [1.5, 0.7]
    };
    let direction = clamp((T.arcPower / base.arcPower - 0.5) / 0.5);
    const fields = {
        rippleStrength: { label: '冲击强度', min: 0.1, max: 3, step: 0.05, get: () => config.rippleStrength, set: v => { config.rippleStrength = v; } },
        lamRatio: { label: '波纹间距', min: 0.08, max: 0.6, step: 0.01, get: () => T.lamRatio, set: v => { T.lamRatio = v; } },
        waveCycles: { label: '波纹圈数', min: 1, max: 8, step: 0.25, get: () => T.waveCycles, set: v => { T.waveCycles = v; } },
        waveDecay: { label: '向内衰减', min: 0, max: 2.5, step: 0.05, get: () => T.waveDecay, set: v => { T.waveDecay = v; } },
        contrast: {
            label: '明暗对比', min: 0.2, max: 1.5, step: 0.05,
            get: () => T.crestAlpha / base.crestAlpha,
            set: v => {
                T.crestAlpha = clamp(base.crestAlpha * v);
                T.troughAlpha = clamp(base.troughAlpha * v);
            }
        },
        direction: {
            label: '光向差异', min: 0, max: 1, step: 0.05,
            get: () => direction,
            set: v => {
                direction = v;
                T.arcPower = base.arcPower * (0.5 + v * 0.5);
                T.arcFloor = clamp(base.arcFloor + (1 - v) * 0.55);
                T.flankFloor = clamp(base.flankFloor + (1 - v) * 0.45);
            }
        },
        speedScale: {
            label: '扩散速度', min: 0.4, max: 2, step: 0.05,
            get: () => T.speed[0] / base.speed[0],
            set: v => { T.speed[0] = base.speed[0] * v; T.speed[1] = base.speed[1] * v; }
        },
        sizeScale: {
            label: '扩散大小', min: 0.4, max: 2.5, step: 0.05,
            get: () => T.life[0] / base.life[0],
            // 半径 = 扩散速度 × 存活时间；保持速度不变，通过寿命直接控制最大范围。
            set: v => { T.life[0] = base.life[0] * v; T.life[1] = base.life[1] * v; }
        }
    };
    const original = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()]));
    const saved = repository.read(STORE_KEY, null);
    if (saved && typeof saved === 'object') {
        for (const [key, field] of Object.entries(fields)) {
            const value = Number(saved[key]);
            if (Number.isFinite(value)) field.set(Math.max(field.min, Math.min(field.max, value)));
        }
    }
    const group = keys => keys.map(key => {
        const field = fields[key];
        return rangeField(key, field.label, field.min, field.max, field.step, field.get());
    }).join('');

    const shell = document.createElement('aside');
    shell.className = 'ripple-debug';
    shell.setAttribute('aria-label', '波纹调试工具');
    shell.innerHTML = [
        '<button class="ripple-debug__toggle" type="button" aria-expanded="true" hidden>波纹调试</button>',
        '<section class="ripple-debug__panel">',
        '<header class="ripple-debug__head"><div><h2 class="ripple-debug__title">波纹调试</h2><p class="ripple-debug__hint">8 个常用参数 · 按 R 显示或隐藏</p></div><button class="ripple-debug__close" type="button">收起</button></header>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">形状</legend>',
        group(['rippleStrength', 'lamRatio', 'waveCycles', 'waveDecay']), '</fieldset>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">外观</legend>',
        group(['contrast', 'direction']), '</fieldset>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">运动</legend>',
        group(['speedScale', 'sizeScale']), '</fieldset>',
        '<div class="ripple-debug__actions">',
        '<button class="ripple-debug__button ripple-debug__button--primary" type="button" data-test>中心测试波纹</button>',
        '<button class="ripple-debug__button" type="button" data-reset>恢复默认</button>',
        '<button class="ripple-debug__button" type="button" data-copy>复制参数</button>',
        '</div>',
        '<textarea class="ripple-debug__output" readonly aria-label="当前波纹参数"></textarea>',
        '<p class="ripple-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.ripple-debug__panel');
    const toggle = shell.querySelector('.ripple-debug__toggle');
    const close = shell.querySelector('.ripple-debug__close');
    const output = shell.querySelector('.ripple-debug__output');
    const status = shell.querySelector('.ripple-debug__status');
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    function format(key, value) {
        const step = fields[key].step;
        return step >= 1 ? String(Math.round(value)) : Number(value).toFixed(step < 0.1 ? 2 : 1);
    }

    function refresh() {
        for (const input of inputs) {
            const key = input.dataset.key;
            input.value = fields[key].get();
            shell.querySelector('[data-output="' + key + '"]').value = format(key, fields[key].get());
        }
        output.value = JSON.stringify({
            rippleStrength: config.rippleStrength,
            waveform: { lamRatio: T.lamRatio, waveCycles: T.waveCycles, waveDecay: T.waveDecay },
            appearance: {
                contrast: fields.contrast.get(), direction,
                crestAlpha: T.crestAlpha, troughAlpha: T.troughAlpha,
                arcPower: T.arcPower, arcFloor: T.arcFloor, flankFloor: T.flankFloor
            },
            motion: {
                speedScale: fields.speedScale.get(), sizeScale: fields.sizeScale.get(),
                speed: [...T.speed], life: [...T.life]
            }
        }, null, 2);
    }

    function save() {
        repository.write(STORE_KEY, Object.fromEntries(
            Object.entries(fields).map(([key, field]) => [key, field.get()])
        ));
    }

    function testRipple() {
        spawnRipple(viewport.width * 0.5, viewport.height * 0.5, 1.5 * config.rippleStrength);
        status.textContent = '已在画面中心生成测试波纹';
    }

    function reset() {
        for (const [key, value] of Object.entries(original)) fields[key].set(value);
        refresh();
        save();
        testRipple();
        status.textContent = '已恢复默认参数并生成测试波纹';
    }

    function copyParameters() {
        refresh();
        output.focus();
        output.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (_) {}
        status.textContent = copied ? '参数已复制到剪贴板' : '参数已选中，请按 Ctrl+C 复制';
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus();
        else toggle.focus();
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 'r') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => {
        const key = input.dataset.key;
        fields[key].set(Number(input.value));
        refresh();
        save();
        status.textContent = '参数已实时应用；点击“中心测试波纹”查看完整扩散过程';
    });
    shell.querySelector('[data-test]').addEventListener('click', testRipple);
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    refresh();
    status.textContent = saved ? '已恢复上次保存的波纹参数' : '面板已就绪';

    return {
        dispose() {
            window.removeEventListener('keydown', onKeyDown);
            shell.remove();
        }
    };
}

Object.assign(exports, { createRippleDebugPanel });
};
__modules["src/ui/clock-debug-panel.js"] = function (exports, __require) {
const { THEME } = __require("src/shared/legacy-assets.js");
const STORE_KEY = 'koi.debug.clock.v1';

function addStyles() {
    if (document.getElementById('clock-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'clock-debug-panel-styles';
    style.textContent = [
        '.clock-debug{position:fixed;top:16px;left:352px;z-index:22;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.clock-debug *{box-sizing:border-box}',
        '.clock-debug button,.clock-debug input,.clock-debug select,.clock-debug textarea{font:inherit}',
        '.clock-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.94);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.clock-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:14px;background:rgba(6,22,21,.95);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(14px) saturate(115%);scrollbar-color:#4c8d79 #0a201e;scrollbar-width:thin}',
        '.clock-debug__panel[hidden],.clock-debug__toggle[hidden]{display:none}',
        '.clock-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.clock-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.clock-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.clock-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.clock-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.clock-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.clock-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.clock-debug__field:last-child{margin-bottom:0}',
        '.clock-debug__field label{color:#dcece6}',
        '.clock-debug__value{min-width:52px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.clock-debug__field input[type="range"]{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.clock-debug__field input[type="color"]{width:48px;height:30px;padding:2px;border:1px solid rgba(208,235,225,.25);border-radius:7px;background:#102b28;cursor:pointer}',
        '.clock-debug__field input[type="checkbox"]{width:18px;height:18px;accent-color:#76cdb0}',
        '.clock-debug__palettes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 14px}',
        '.clock-debug__palette{display:grid;grid-template-columns:28px 1fr;align-items:center;gap:8px;min-height:42px;padding:6px 8px;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#102b28;color:#dcece6;text-align:left;cursor:pointer}',
        '.clock-debug__palette[aria-pressed="true"]{border-color:#8bdbc0;box-shadow:0 0 0 2px rgba(139,219,192,.20)}',
        '.clock-debug__palette-swatch{position:relative;width:28px;height:28px;border:1px solid rgba(255,255,255,.42);border-radius:7px;background:var(--palette-bg);box-shadow:inset 0 1px rgba(255,255,255,.35)}',
        '.clock-debug__palette-swatch::after{content:"Aa";position:absolute;inset:0;display:grid;place-items:center;color:var(--palette-fg);font:700 10px/1 system-ui,sans-serif}',
        '.clock-debug__palette-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}',
        '.clock-debug__select{grid-column:1/-1;width:100%;height:38px;padding:0 10px;border:1px solid rgba(208,235,225,.24);border-radius:8px;background:#102b28;color:#eef8f4}',
        '.clock-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.clock-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.clock-debug__button--primary{border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.clock-debug__output{width:100%;height:108px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;caret-color:#8fe0c3}',
        '.clock-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.clock-debug button:hover{filter:brightness(1.08)}',
        '.clock-debug button:focus-visible,.clock-debug input:focus-visible,.clock-debug select:focus-visible,.clock-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:900px){.clock-debug{top:60px;left:10px}.clock-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 70px)}}',
        '@media(prefers-reduced-transparency:reduce){.clock-debug__panel,.clock-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, label, min, max, step, value) {
    return '<div class="clock-debug__field"><label for="clock-debug-' + key + '">' + label + '</label>' +
        '<output class="clock-debug__value" data-output="' + key + '"></output>' +
        '<input id="clock-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></div>';
}

function parseColor(value) {
    const text = String(value);
    if (/^#[0-9a-f]{6}$/i.test(text)) return { hex: text, alpha: 1 };
    const start = text.indexOf('('), end = text.indexOf(')');
    if (start < 0 || end < start) return { hex: '#f4fcf8', alpha: 1 };
    const parts = text.slice(start + 1, end).split(',').map(Number);
    if (parts.length < 3 || parts.some(value => !Number.isFinite(value))) return { hex: '#f4fcf8', alpha: 1 };
    const hex = '#' + parts.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
    return { hex, alpha: parts.length > 3 ? parts[3] : 1 };
}

function rgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha.toFixed(3) + ')';
}
function createClockDebugPanel({ repository }) {
    addStyles();
    const T = THEME.clock;
    const parsed = parseColor(T.color);
    let colorHex = parsed.hex;
    let colorAlpha = parsed.alpha;
    const cardTextParsed = parseColor(T.cardTextColor);
    let cardTextHex = cardTextParsed.hex;
    let cardTextAlpha = cardTextParsed.alpha;
    let cardTintHex = parseColor(T.cardTint || '#d7e2d1').hex;
    const fonts = {
        yahei: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        system: 'system-ui, sans-serif',
        serif: 'Georgia, "Times New Roman", serif',
        mono: 'Consolas, "SFMono-Regular", monospace'
    };
    const palettes = [
        { id: 'lotus-mist', name: '荷叶雾', bg: '#d7e2d1', text: '#1a433b' },
        { id: 'moon-water', name: '月光水', bg: '#dbe9e9', text: '#234c55' },
        { id: 'warm-jade', name: '暖玉', bg: '#eadfc8', text: '#5a4431' },
        { id: 'lotus-pink', name: '莲粉', bg: '#ead9dc', text: '#64404a' },
        { id: 'deep-pond', name: '深潭', bg: '#31534d', text: '#f0f5e9' },
        { id: 'night-blue', name: '夜蓝', bg: '#354b5f', text: '#f2f7f5' }
    ];
    const paletteMarkup = palettes.map(palette =>
        '<button class="clock-debug__palette" type="button" data-palette="' + palette.id + '" aria-pressed="false" style="--palette-bg:' + palette.bg + ';--palette-fg:' + palette.text + '">' +
        '<span class="clock-debug__palette-swatch" aria-hidden="true"></span><span class="clock-debug__palette-name">' + palette.name + '</span></button>'
    ).join('');
    let fontId = Object.keys(fonts).find(key => fonts[key] === T.font) || 'yahei';
    const fields = {
        timeSize: { label: '时间大小', min: 0.03, max: 0.15, step: 0.005, get: () => T.timeSize, set: v => { T.timeSize = v; } },
        dateSize: { label: '日期比例', min: 0.2, max: 0.8, step: 0.01, get: () => T.dateSize, set: v => { T.dateSize = v; } },
        marginX: { label: '水平边距', min: 0, max: 0.2, step: 0.005, get: () => T.marginX, set: v => { T.marginX = v; } },
        marginY: { label: '垂直边距', min: 0, max: 0.25, step: 0.005, get: () => T.marginY, set: v => { T.marginY = v; } },
        gap: { label: '时间日期间距', min: 0.05, max: 0.8, step: 0.01, get: () => T.gap, set: v => { T.gap = v; } },
        weight: { label: '字体粗细', min: 300, max: 800, step: 100, get: () => T.weight || 600, set: v => { T.weight = Math.round(v); } },
        opacity: { label: '普通字体透明度', min: 0.1, max: 1, step: 0.01, get: () => colorAlpha, set: v => { colorAlpha = v; T.color = rgba(colorHex, colorAlpha); } },
        dropletStrength: { label: '玻璃水滴质感', min: 0.2, max: 1.8, step: 0.05, get: () => T.dropletStrength ?? 0.3, set: v => { T.dropletStrength = v; } },
        cardOpacity: { label: '卡片透明度', min: 0.05, max: 0.8, step: 0.01, get: () => T.cardOpacity ?? 0.45, set: v => { T.cardOpacity = v; } },
        cardTextOpacity: { label: '卡片字体透明度', min: 0.1, max: 1, step: 0.01, get: () => cardTextAlpha, set: v => { cardTextAlpha = v; T.cardTextColor = rgba(cardTextHex, cardTextAlpha); } },
        cardBlur: { label: '背景模糊', min: 0, max: 0.04, step: 0.001, get: () => T.cardBlur ?? 0.012, set: v => { T.cardBlur = v; } },
        cardRadius: { label: '卡片圆角', min: 0.003, max: 0.06, step: 0.001, get: () => T.cardRadius ?? 0.022, set: v => { T.cardRadius = v; } },
        cardShadow: { label: '卡片阴影', min: 0, max: 0.7, step: 0.01, get: () => T.cardShadow ?? 0.34, set: v => { T.cardShadow = v; } },
        shadowAlpha: { label: '阴影强度', min: 0, max: 1, step: 0.01, get: () => T.shadowAlpha, set: v => { T.shadowAlpha = v; } },
        shadowBlur: { label: '阴影模糊', min: 0, max: 0.08, step: 0.001, get: () => T.shadowBlur, set: v => { T.shadowBlur = v; } },
        shadowOffset: { label: '阴影距离', min: 0, max: 0.04, step: 0.001, get: () => T.shadowOffset, set: v => { T.shadowOffset = v; } }
    };
    const original = {
        fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()])),
        show: T.show, anchor: T.anchor, colorHex, fontId,
        cardTextHex, cardTintHex,
        droplet: T.droplet === true, cardGlass: T.cardGlass === true,
        foreground: T.foreground === true
    };
    const saved = repository.read(STORE_KEY, null);
    if (saved && typeof saved === 'object') {
        if (/^#[0-9a-f]{6}$/i.test(saved.colorHex)) colorHex = saved.colorHex;
        if (/^#[0-9a-f]{6}$/i.test(saved.cardTextHex)) cardTextHex = saved.cardTextHex;
        if (/^#[0-9a-f]{6}$/i.test(saved.cardTintHex)) cardTintHex = saved.cardTintHex;
        if (Object.prototype.hasOwnProperty.call(fonts, saved.fontId)) fontId = saved.fontId;
        if (typeof saved.show === 'boolean') T.show = saved.show;
        if (typeof saved.foreground === 'boolean') T.foreground = saved.foreground;
        if (typeof saved.droplet === 'boolean') T.droplet = saved.droplet;
        if (typeof saved.cardGlass === 'boolean') T.cardGlass = saved.cardGlass;
        if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(saved.anchor)) T.anchor = saved.anchor;
        if (saved.fields && typeof saved.fields === 'object') {
            for (const [key, field] of Object.entries(fields)) {
                const value = Number(saved.fields[key]);
                if (Number.isFinite(value)) field.set(Math.max(field.min, Math.min(field.max, value)));
            }
        }
        T.font = fonts[fontId];
        T.color = rgba(colorHex, colorAlpha);
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardTint = cardTintHex;
    }
    const group = keys => keys.map(key => {
        const field = fields[key];
        return rangeField(key, field.label, field.min, field.max, field.step, field.get());
    }).join('');

    const shell = document.createElement('aside');
    shell.className = 'clock-debug';
    shell.setAttribute('aria-label', '时间显示样式调试工具');
    shell.innerHTML = [
        '<button class="clock-debug__toggle" type="button" aria-expanded="true" hidden>时间样式</button>',
        '<section class="clock-debug__panel">',
        '<header class="clock-debug__head"><div><h2 class="clock-debug__title">时间显示样式</h2><p class="clock-debug__hint">实时修改画面时钟 · 按 T 显示或隐藏</p></div><button class="clock-debug__close" type="button">收起</button></header>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">显示与位置</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-show">显示时间</label><input id="clock-debug-show" data-show type="checkbox"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-foreground">时间置于鱼上方</label><input id="clock-debug-foreground" data-foreground type="checkbox"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-anchor">位置</label><select id="clock-debug-anchor" class="clock-debug__select" data-anchor>' +
            '<option value="top-left">左上</option><option value="top-center">上方居中</option><option value="top-right">右上</option>' +
            '<option value="bottom-left">左下</option><option value="bottom-center">下方居中</option><option value="bottom-right">右下</option></select></div>',
        group(['marginX', 'marginY']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">文字</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-font">字体</label><select id="clock-debug-font" class="clock-debug__select" data-font>' +
            '<option value="yahei">微软雅黑</option><option value="system">系统字体</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option></select></div>',
        '<div class="clock-debug__field"><label for="clock-debug-color">文字颜色</label><input id="clock-debug-color" data-color type="color"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-droplet">水滴字体</label><input id="clock-debug-droplet" data-droplet type="checkbox"></div>',
        group(['dropletStrength', 'timeSize', 'dateSize', 'gap', 'weight', 'opacity']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">卡片毛玻璃</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-card-glass">开启毛玻璃卡片</label><input id="clock-debug-card-glass" data-card-glass type="checkbox"></div>',
        '<div class="clock-debug__palettes" role="group" aria-label="卡片配色预设">', paletteMarkup, '</div>',
        '<div class="clock-debug__field"><label for="clock-debug-card-tint">卡片色调</label><input id="clock-debug-card-tint" data-card-tint type="color"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-card-text-color">卡片字体颜色</label><input id="clock-debug-card-text-color" data-card-text-color type="color"></div>',
        group(['cardTextOpacity', 'cardOpacity', 'cardBlur', 'cardRadius', 'cardShadow']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">阴影</legend>',
        group(['shadowAlpha', 'shadowBlur', 'shadowOffset']), '</fieldset>',
        '<div class="clock-debug__actions"><button class="clock-debug__button" type="button" data-reset>恢复默认</button><button class="clock-debug__button clock-debug__button--primary" type="button" data-copy>复制参数</button></div>',
        '<textarea class="clock-debug__output" readonly aria-label="当前时间样式参数"></textarea>',
        '<p class="clock-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.clock-debug__panel');
    const toggle = shell.querySelector('.clock-debug__toggle');
    const close = shell.querySelector('.clock-debug__close');
    const output = shell.querySelector('.clock-debug__output');
    const status = shell.querySelector('.clock-debug__status');
    const showInput = shell.querySelector('[data-show]');
    const foregroundInput = shell.querySelector('[data-foreground]');
    const anchorInput = shell.querySelector('[data-anchor]');
    const fontInput = shell.querySelector('[data-font]');
    const colorInput = shell.querySelector('[data-color]');
    const dropletInput = shell.querySelector('[data-droplet]');
    const cardGlassInput = shell.querySelector('[data-card-glass]');
    const cardTintInput = shell.querySelector('[data-card-tint]');
    const cardTextColorInput = shell.querySelector('[data-card-text-color]');
    const paletteButtons = Array.from(shell.querySelectorAll('[data-palette]'));
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    function format(key, value) {
        const step = fields[key].step;
        if (step >= 1) return String(Math.round(value));
        return Number(value).toFixed(step < 0.01 ? 3 : 2);
    }

    function refresh() {
        showInput.checked = T.show !== false;
        foregroundInput.checked = T.foreground === true;
        anchorInput.value = T.anchor;
        fontInput.value = fontId;
        colorInput.value = colorHex;
        dropletInput.checked = T.droplet === true;
        cardGlassInput.checked = T.cardGlass === true;
        cardTintInput.value = cardTintHex;
        cardTextColorInput.value = cardTextHex;
        for (const button of paletteButtons) {
            const palette = palettes.find(item => item.id === button.dataset.palette);
            button.setAttribute('aria-pressed', String(cardTintHex.toLowerCase() === palette.bg && cardTextHex.toLowerCase() === palette.text));
        }
        for (const input of inputs) {
            const key = input.dataset.key;
            input.value = fields[key].get();
            shell.querySelector('[data-output="' + key + '"]').value = format(key, fields[key].get());
        }
        output.value = JSON.stringify({
            show: T.show, foreground: T.foreground === true,
            anchor: T.anchor, marginX: T.marginX, marginY: T.marginY,
            timeSize: T.timeSize, dateSize: T.dateSize, gap: T.gap,
            color: T.color, font: T.font, weight: T.weight || 600,
            droplet: T.droplet === true, dropletStrength: T.dropletStrength,
            cardGlass: T.cardGlass === true,
            cardTint: T.cardTint, cardTextColor: T.cardTextColor,
            cardOpacity: T.cardOpacity, cardBlur: T.cardBlur,
            cardRadius: T.cardRadius, cardShadow: T.cardShadow,
            shadowAlpha: T.shadowAlpha, shadowBlur: T.shadowBlur, shadowOffset: T.shadowOffset
        }, null, 2);
    }

    function save() {
        repository.write(STORE_KEY, {
            fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()])),
            show: T.show !== false,
            foreground: T.foreground === true,
            anchor: T.anchor,
            fontId,
            colorHex,
            droplet: T.droplet === true,
            cardGlass: T.cardGlass === true,
            cardTintHex,
            cardTextHex
        });
    }

    function reset() {
        for (const [key, value] of Object.entries(original.fields)) fields[key].set(value);
        T.show = original.show;
        T.anchor = original.anchor;
        T.foreground = original.foreground;
        T.droplet = original.droplet;
        T.cardGlass = original.cardGlass;
        colorHex = original.colorHex;
        cardTextHex = original.cardTextHex;
        cardTintHex = original.cardTintHex;
        fontId = original.fontId;
        T.font = fonts[fontId];
        T.color = rgba(colorHex, colorAlpha);
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardTint = cardTintHex;
        refresh();
        save();
        status.textContent = '已恢复默认时间样式';
    }

    function copyParameters() {
        refresh();
        output.focus();
        output.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (_) {}
        status.textContent = copied ? '参数已复制到剪贴板' : '参数已选中，请按 Ctrl+C 复制';
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus(); else toggle.focus();
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 't') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => {
        fields[input.dataset.key].set(Number(input.value));
        refresh();
        save();
        status.textContent = '时间样式已实时应用';
    });
    showInput.addEventListener('change', () => { T.show = showInput.checked; refresh(); save(); });
    foregroundInput.addEventListener('change', () => {
        T.foreground = foregroundInput.checked;
        refresh();
        save();
        status.textContent = foregroundInput.checked ? '时间已置于鱼群上方' : '鱼群可从时间上方游过';
    });
    anchorInput.addEventListener('change', () => { T.anchor = anchorInput.value; refresh(); save(); });
    fontInput.addEventListener('change', () => { fontId = fontInput.value; T.font = fonts[fontId]; refresh(); save(); });
    colorInput.addEventListener('input', () => { colorHex = colorInput.value; T.color = rgba(colorHex, colorAlpha); refresh(); save(); });
    dropletInput.addEventListener('change', () => {
        T.droplet = dropletInput.checked;
        refresh();
        save();
        status.textContent = dropletInput.checked ? '已开启水滴字体' : '已恢复普通字体';
    });
    cardGlassInput.addEventListener('change', () => {
        T.cardGlass = cardGlassInput.checked;
        refresh();
        save();
        status.textContent = cardGlassInput.checked ? '已开启卡片毛玻璃' : '已关闭卡片毛玻璃';
    });
    cardTintInput.addEventListener('input', () => {
        cardTintHex = cardTintInput.value;
        T.cardTint = cardTintHex;
        refresh();
        save();
    });
    cardTextColorInput.addEventListener('input', () => {
        cardTextHex = cardTextColorInput.value;
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        refresh();
        save();
    });
    for (const button of paletteButtons) button.addEventListener('click', () => {
        const palette = palettes.find(item => item.id === button.dataset.palette);
        cardTintHex = palette.bg;
        cardTextHex = palette.text;
        T.cardTint = cardTintHex;
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardGlass = true;
        refresh();
        save();
        status.textContent = '已应用「' + palette.name + '」配色';
    });
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    refresh();
    status.textContent = saved ? '已恢复上次保存的时间样式' : '面板已就绪';

    return { dispose() { window.removeEventListener('keydown', onKeyDown); shell.remove(); } };
}

Object.assign(exports, { createClockDebugPanel });
};
const __cache = Object.create(null);
function __require(id) {
  if (__cache[id]) return __cache[id];
  if (!__modules[id]) throw new Error("Module not found: " + id);
  const exports = {};
  __cache[id] = exports;
  __modules[id](exports, __require);
  return exports;
}
__require("src/app.js");
})();
