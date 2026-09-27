import { THEME, WaterGL } from '../shared/legacy-assets.js';
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

export function createRipples({ config, viewport }) {
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
export function createRainRipples({ viewport, config, profile }) {
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
