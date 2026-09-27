// 内置生物与玩法的清单 —— 装配层唯一需要"点名"的地方(2026-09-26 第二轮)
//
// 加一种新生物:写 src/pond/creatures/<kind>.js,在这里 creatures.register 一行。
// 加一个新玩法:  写 src/features/<name>.js(导出 create(ctx)),在这里 features.register 一行。
// 核心文件(app.js / renderer.js / collisions.js / population.js)都不需要改。
//
// 玩法声明自己需要什么,装配层照着接(层 id 见 core/layers.js):
//   layers      往绘制层投稿           interactions  占一个输入模式
//   update      每帧模拟(碰撞之前)     setEnabled    开关
import { createKoiCreature } from './pond/creatures/koi-fish.js';
import { createClock } from './features/clock.js';
import { createFeeding } from './features/feeding.js';
import { createCustomFish } from './features/custom-fish.js';
import { createWeather } from './features/weather.js';
import { createIdleDrift } from './features/idle-drift.js';
import { createDayCycle } from './features/day-cycle.js';
import { createFishDebugPanel } from './ui/fish-debug-panel.js';
import { createRippleDebugPanel } from './ui/ripple-debug-panel.js';
import { createClockDebugPanel } from './ui/clock-debug-panel.js';

export function registerBuiltins({ creatures, features, context }) {
    // ── 生物:锦鲤(默认 kind,鱼种不声明 creature 时用它) ──
    // 锦鲤这个 kind 的依赖(context 里的学校/渲染器)由装配层提供,但"它是谁"由这份清单决定
    const koiKind = createKoiCreature({
        config: context.config, viewport: context.viewport, time: context.time, kois: context.kois,
        foods: context.foods, mouse: context.mouse, spawnRipple: context.spawnRipple,
        schoolSystem: context.schoolSystem, drawFish: context.drawFish
    });
    creatures.register({ id: 'koi-fish', title: '锦鲤', create: koiKind.create, exports: koiKind });

    // ── 玩法:时钟(沉在水下的 hud 层) ──
    features.register({ id: 'clock', title: '时钟', create: () => {
        const clock = createClock({ viewport: context.viewport });
        let on = true;
        return {
            layers: { hud: g => { if (on) clock.draw(g); } },
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

    // ── 玩法:自定义鱼(用户捏的鱼;禁用时连鱼带监听一起收走) ──
    features.register({ id: 'customFish', title: '自定义鱼', create: () => {
        const make = () => createCustomFish({
            Koi: koiKind.Koi, koiType: context.types.get('koi'),
            kois: context.kois, config: context.config, viewport: context.viewport,
            spawnRipple: context.spawnRipple, repository: context.repository
        });
        let inst = make();
        return {
            loadCustomFishFromStore: (...a) => inst?.loadCustomFishFromStore(...a),
            syncCustomFish: (...a) => inst?.syncCustomFish(...a),
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
        kois: context.kois, config: context.config, types: context.types
    }) });

    features.register({ id: 'rippleDebugPanel', title: '波纹调试', create: () => createRippleDebugPanel({
        config: context.config, viewport: context.viewport, spawnRipple: context.spawnRipple
    }) });

    features.register({ id: 'clockDebugPanel', title: '时间样式调试', create: () => createClockDebugPanel() });

    return { creatures, features };
}
