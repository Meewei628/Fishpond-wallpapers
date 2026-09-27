import { createRainRipples } from '../render/ripples.js';
import { createRainStreaks } from '../render/rain-streaks.js';
import { THEME } from '../shared/legacy-assets.js';

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
export function createWeather({ config, viewport, environment }) {
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
