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
export function createRainStreaks({ viewport, streak = {}, rng = Math.random }) {
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
