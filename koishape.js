/* ===========================================================================
 * 锦鲤形状的【唯一真源】
 * ===========================================================================
 * 壁纸渲染(script.js)和自定义鱼编辑器(editor.html)必须用同一份形状代码。
 * 分成两份会漂移 —— 一旦漂移,用户在编辑器里涂的位置和壁纸上渲染的位置就对不上,
 * 而那种 bug 从截图上很难看出是"两份曲线不一致"。
 *
 * bw: 0 = 吻端, 1 = 尾柄;返回【归一化半宽】(0..1)。
 * =========================================================================== */
const KOI_SHAPE = (function () {
    function smooth01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

    /* 俯视锦鲤的半宽轮廓。头部一段是**椭圆弧** w=sqrt(1-((c-bw)/c)^2), c=0.38:
     *   宽度按开方增长 → 轮廓是圆的。线性增长会变成两条直线交于一点 = 楔形尖头。
     * 后半段才收成尾柄,所以前后明显不对称 —— 对称椭圆画出来是一根黄瓜,不是鱼。 */
    const PROFILE = [
        [0.000, 0.000], [0.045, 0.470], [0.090, 0.646], [0.140, 0.775],
        [0.200, 0.881], [0.270, 0.957], [0.340, 0.994], [0.380, 1.000],
        [0.500, 0.970], [0.640, 0.860], [0.760, 0.700], [0.880, 0.490],
        [0.940, 0.325], [1.000, 0.215]
    ];

    function koiWidth(bw) {
        // 必须用 Catmull-Rom 穿过控制点,不能逐段用 smoothstep:
        // smoothstep 在**每个节点处导数都是 0**,13 个控制点就会在轮廓上留下 13 个
        // 平肩,曲线看着是一节一节的 = 几何感。Catmull-Rom 是真正 C1 连续的。
        bw = bw < 0 ? 0 : (bw > 1 ? 1 : bw);
        let n = PROFILE.length, i = 0;
        while (i < n - 2 && bw > PROFILE[i + 1][0]) i++;
        let p0 = PROFILE[i > 0 ? i - 1 : 0];
        let p1 = PROFILE[i];
        let p2 = PROFILE[i + 1];
        let p3 = PROFILE[i + 2 < n ? i + 2 : n - 1];
        let t = (bw - p1[0]) / (p2[0] - p1[0]);
        let t2 = t * t, t3 = t2 * t;
        let v = 0.5 * (2 * p1[1]
                     + (-p0[1] + p2[1]) * t
                     + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                     + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        return v < 0 ? 0 : (v > 1.06 ? 1.06 : v);
    }

    /* 身体从吻端往后这个位置开始取体侧轮廓,前面一段由半椭圆封口(见 script.js 的体轮廓)。
     * 这里显式暴露,是为了让编辑器画出的轮廓 = 壁纸真正填充的区域。 */
    const FRONT = 0.045;

    /* 可调部位。1.0 = 原始锦鲤,全部是**倍率**不是绝对值:
     * 这样"默认鱼"和真实锦鲤的形状完全一致,用户不动滑杆就不会有惊喜。 */
    const DEFAULTS = {
        bodyLen: 1.00,   // 体长(身体占脊柱的比例)
        bodyH:   1.00,   // 体高(整体横向宽度)
        headW:   1.00,   // 头宽(只在 bw<0.40 段生效)
        tailW:   1.00,   // 尾柄(只在 bw>0.60 段生效)
        tailFin: 1.00,   // 尾鳍大小
        fin:     1.00,   // 胸鳍大小
        eye:     1.00    // 眼睛大小
    };

    function clampShape(s) {
        const o = {};
        for (const k in DEFAULTS) {
            let v = (s && typeof s[k] === "number" && isFinite(s[k])) ? s[k] : DEFAULTS[k];
            o[k] = Math.max(0.35, Math.min(2.20, v));
        }
        return o;
    }

    /* 把部位倍率揉进半宽曲线。
     * ★ 两个权重必须用 smoothstep 过渡,不能硬分段:
     *   硬分段会在切换点留下折角,轮廓上直接看到一道"棱"。 */
    function shapeWidth(bw, s) {
        let w = koiWidth(bw);
        if (!s) return w;
        const hw = smooth01(bw / 0.40);            // 1→0:越靠头权重越大
        const tw = smooth01((bw - 0.60) / 0.40);   // 0→1:越靠尾柄权重越大
        let k = 1;
        k *= 1 + (s.headW - 1) * (1 - hw);
        k *= 1 + (s.tailW - 1) * tw;
        return w * k;
    }

    /* 编辑器/渲染共用的"身体参数映射":
     *   u ∈ [0,1]  (纹理横向)  →  bw = FRONT + (1-FRONT)*u      (沿身体)
     *   v ∈ [-1,1] (纹理纵向)  →  横向偏移 = v * shapeWidth(bw)  (归一化,再乘 maxHalf)
     * 两边都用这一套,涂抹才对得上。 */
    function bwAtU(u) { return FRONT + (1 - FRONT) * u; }
    function uAtBw(bw) { return (bw - FRONT) / (1 - FRONT); }

    /* 折线 → 平滑闭合曲线(中点法)。
     * 壁纸和编辑器都要用:少了它,几十个采样点连出来是折线,
     * 吻端封口更会变成一个五边形(编辑器里一度就是这样)。 */
    function traceClosedSmooth(g, pts) {
        const n = pts.length;
        if (n < 3) return;
        g.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
        for (let i = 0; i < n; i++) {
            const c = pts[i], q = pts[(i + 1) % n];
            g.quadraticCurveTo(c[0], c[1], (c[0] + q[0]) / 2, (c[1] + q[1]) / 2);
        }
        g.closePath();
    }

    /* ---------- 尾鳍 / 胸鳍 / 眼睛的形状规则 ----------
     * 和体轮廓同一个道理:编辑器要画出【整条鱼】,壁纸要长出同一批零件,
     * 这些控制点就只能有一份。之前只抽了体轮廓,所以编辑器里只有一个光身子
     * —— 用户看不到尾鳍/胸鳍/眼睛,也就没法判断滑杆到底改了什么。 */
    function tailFinLen(maxHalf, shape) { return maxHalf * 1.58 * (shape ? shape.tailFin : 1); }
    function pectoralFinLen(maxHalf, shape) { return maxHalf * 1.25 * (shape ? shape.fin : 1); }
    function eyeRadius(maxHalf, shape) {
        return Math.max(0.75, maxHalf * 0.105 * (shape ? shape.eye : 1));
    }

    /* 尾鳍:以【尾柄末端】为原点,+x 指向尾后。
     * 根部宽度必须 = 尾柄半宽,否则和身体断开(那是"多出来一节"的老坑)。 */
    function tailFinPath(g, tl, pedW) {
        g.beginPath();
        g.moveTo(0, -pedW);
        g.quadraticCurveTo(tl * 0.34, -tl * 0.34 - pedW * 0.35, tl * 0.88, -tl * 0.54);
        g.quadraticCurveTo(tl * 1.02, -tl * 0.48, tl * 0.72, -tl * 0.08);
        g.quadraticCurveTo(tl * 0.63, 0, tl * 0.72, tl * 0.08);      // 内凹叉口
        g.quadraticCurveTo(tl * 1.02, tl * 0.48, tl * 0.88, tl * 0.54);
        g.quadraticCurveTo(tl * 0.34, tl * 0.34 + pedW * 0.35, 0, pedW);
        g.closePath();
    }
    /* 胸鳍:以鳍根为原点,+x 指向鳍尖 */
    function pectoralFinPath(g, fl) {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(fl * 0.55, -fl * 0.32, fl, -fl * 0.06);
        g.quadraticCurveTo(fl * 0.55, fl * 0.36, 0, 0);
        g.closePath();
    }

    /* 零件在身体上的位置(编辑器画它们时必须用同一套定位,否则和壁纸对不上) */
    const EYE = { bw: 0.085, lat: 0.62, hi: 0.34, hiOff: -0.28 };
    const PECTORAL = { bw: 0.26, lat: 0.78, spread: 0.72, flapFreq: 1.7, flapAmp: 0.10 };
    const TAIL = { anglePhase: 0.26, rayCount: 3, raySpread: 0.34 };

    return { smooth01, PROFILE, koiWidth, FRONT, DEFAULTS, clampShape, shapeWidth, bwAtU, uAtBw,
             tailFinLen, pectoralFinLen, eyeRadius, tailFinPath, pectoralFinPath,
             EYE, PECTORAL, TAIL, traceClosedSmooth };
})();
