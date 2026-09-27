import { THEME, WaterGL } from '../shared/legacy-assets.js';

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

export function createDayCycle({ config, environment }) {
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
