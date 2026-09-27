import { THEME, KOI_SHAPE } from '../shared/legacy-assets.js';
import { shadeColor, varyHexColor, hexRgba, mixHex, traceSmooth } from '../shared/math.js';
import { drawSkinOnBody } from './fish-skin.js';
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

export function createFishRenderer({ config }) {
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
