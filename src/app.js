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
import { createFishTypes } from './pond/types.js';
import { createSettings } from './core/settings.js';
import { createLoop } from './core/loop.js';
import { createLayerSet } from './core/layers.js';
import { createEnvironment } from './core/environment.js';
import { createFeatureRegistry } from './core/feature-registry.js';
import { createCreatureRegistry } from './pond/creature-registry.js';
import { createPopulation } from './pond/population.js';
import { createSchools } from './pond/schools.js';
import { createCollisions } from './pond/collisions.js';
import { createFood } from './pond/food.js';
import { createSimulation } from './pond/simulation.js';
import { createFishRenderer } from './render/fish-renderer.js';
import { createRenderer } from './render/renderer.js';
import { createRipples } from './render/ripples.js';
import { createRepository } from './storage/repository.js';
import { createInputRouter } from './input/input-router.js';
import { attachBrowserInput } from './input/browser-input.js';
import { registerBuiltins } from './builtins.js';

export function createPondApp(canvas) {
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
export const app = createPondApp(document.getElementById('wallpaper-canvas'));
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
