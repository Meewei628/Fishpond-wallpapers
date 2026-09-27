import { THEME } from '../shared/legacy-assets.js';
import { mixHex, mulberry32 } from '../shared/math.js';

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
export function createEnvironment({ config, transition, seed = 0x9e3779b9 } = {}) {
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
