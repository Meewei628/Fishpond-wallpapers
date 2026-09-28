import { createRainRipples } from '../render/ripples.js';
import { createIdleSprites } from '../render/idle-sprites.js';
import { mulberry32 } from '../shared/math.js';
import { THEME } from '../shared/legacy-assets.js';

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
export function createIdleDrift({ config, viewport, foods, input, mouse, kois }) {
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
            input.startle(it.x, it.y);
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
