/* ===========================================================================
 * 主题 token —— 视觉的【唯一真源】
 * ===========================================================================
 * 为什么要有这个文件:
 *   水色、光向、影子色、鳞光、涟漪色、界面配色原来散在 script.js 的 55 处 hex
 *   和 67 处 rgba 里,编辑器(editor.html)还另有一套 UI 配色。
 *   后期任何新面板/新玩法都会各自复制一份,然后慢慢漂移 ——
 *   表现就是"同一个池塘,不同页面看着不是一套东西"。
 *
 * 用法:
 *   · canvas 代码:直接读 THEME.xxx(script.js 顶部已经把它拆成常量)
 *   · HTML/CSS 页面:调 applyThemeCssVars(),然后写 var(--koi-accent) 这类变量
 *
 * 约定:
 *   · 只放【视觉身份】:颜色、光、材质、界面配色。
 *   · 不放几何/动画的魔数(鱼身曲线在 koishape.js,物理参数跟着各自算法走)。
 *   · 带 `+` 结尾的字符串是"基色",调用方在后面拼 alpha,例如
 *     THEME.fish.shadow + '0.24)'。
 * =========================================================================== */
const THEME = {
    /* ---------- 水 ---------- */
    water: {
        tint: '#1d5c5e',            // 深水吸收色:所有"越深越偏青"都以它为准
        farTop: 'rgba(7,28,32,0.20)',   // 远处(画面上方)压暗:顶部
        farMid: 'rgba(7,28,32,0.06)',   // 中段
        farSpan: 0.45,                  // 压暗覆盖的高度比例(0.45 = 上面 45%)
        /* ---------- 涟漪 ----------
         * ★ 横截面不是猜的,也不是一次就量准的:用 tools/ripple_ref.py 把用户给的
         *   参考图量了三遍才对上(前两遍都栽在"背景怎么扣"上,见下面 ★★)。
         * 结论(相对【局部水面】的亮度偏离;环心/半径都是拟合出来的):
         *      Δr = -40         Δr = 0              Δr = +35        (λ ≈ 80px)
         *      内暗带           亮脊                 外暗带
         *      -2.4%           +32%(迎光侧 +50%)     -2.8%
         *      FWHM ~31px      FWHM 26px            FWHM ~9px
         *   → 亮:暗 ≈ 12:1 —— 这道环【主要就是"一条亮线",两侧暗带只是很淡的暗边】,
         *     不是三等价。亮脊 FWHM ≈ 0.3λ;两侧暗带中心距 = λ/2。
         *   ★★ 前两遍量错的教训(同一个坑):暗带深度对"背景怎么扣"极其敏感。
         *     ① 拿远场当基线 → 亮:暗 10:1;② 用三次多项式拟合整段当基线 →
         *     多项式会跟着亮脊一起鼓起来,把亮脊压到 +16、暗带夸到 −8.6(1.9:1);
         *     ③ 只用【环外两侧】(r<266 与 r>400)拟合背景 → 亮 +32% / 暗 −2.5%
         *     (12:1)。③ 和原始亮度直读对得上,才可信。 */
        ripple: {
            /* 高光用【微暖的白】而不是纯白:纯白叠在青绿水面上会被读成"更青的绿",
             * 稍微偏暖一点点才像"光"。 */
            crest: 'rgba(255,251,242,',
            trough: 'rgba(22,52,54,',        // 深色带:接近中性的暗青,不要深到发黑
            /* 径向纵截面：A(d)=e^(-decay·d/λ)·cos(2πd/λ)。
             * d 从最外侧波前向圆心量；正半波加亮，负半波压暗。 */
            lamRatio: 0.20,                  // λ = lamRatio × 当前扩散半径
            waveCycles: 1.5,                 // 从波前向内保留的周期数
            waveDecay: 0.85,                 // 每个波长的指数衰减速度
            waveSamples: 64,                 // 径向渐变采样数（每周期约 16 点）
            /* 亮脊 / 暗带强度。★ 这两个数是拿 tools/probe_ripple_profile.mjs 量【自己
             * 渲染出来的结果】反推的,目标 = 相对水面 亮 +32% / 暗 −2.5%。
             * 注意两者不是同一套换算:亮脊走 screen(每 1.0 alpha 抬 ≈(255−水面)),
             * 暗带走 source-over 深色(每 1.0 alpha 只压 ≈(水面−trough)≈ 52)——
             * 同样的 alpha,亮脊的绝对变化是暗带的 2.8 倍。所以那 12:1 的观感,
             * alpha 只需约 4.7:1。 */
            /* 亮度:★ 按参考图的【原始射线】定,不是拟合值。
             *   迎光侧原始读数 亮 +45% / 暗 −4~−7%;原来 0.52/0.22 只做出 +32%/−3.4%,
             *   用户:「光太弱,暗也太弱」。提上来对上原始读数。 */
            /* 当前默认值以波纹调试面板定版参数为准。 */
            crestAlpha: 0.234,
            troughAlpha: 0.135,
            /* ---------- 角向包络 ----------
             * ★★ 参考图的原始射线实测(逐条读灰度,不是拟合),这才是"光向"的样子:
             *      迎光侧(离光 0°)  : 暗(−40,−4%) → 【亮(−8,+45%)】 → 暗(+22,−7%)
             *      离光 45°          : 同样的结构,幅度略降
             *      离光 90°          : 【整条消失】(±1%,基本看不见)
             *      背光侧(离光 180°): 【没有亮线】,只剩一条浅暗带(+13~+49,−1.7%)
             *   → 亮线【只在迎光侧】,背光侧那道环是【以暗影的形式】存在的。
             *   ★ 所以是两条包络,不是一条:
             *       亮脊 arcFloor = 0      : max(0,cosΔ)^arcPower —— 背光侧干净归零
             *       暗带 flankFloor = 0.35 : 留 35% —— 背光侧用暗影把圈闭上
             *   ★★ 中间踩过的坑:为了治"少了一半"把亮脊的地板抬到 0.22,
             *      结果整圈等亮 → 用户:"没有体现光的方向,然后背光也没体现"。
             *      地板只能加在【暗带】上,不能加在【亮线】上 —— 环的闭合感由暗影提供,
             *      光向的可读性由亮线提供,这两件事不能用一个旋钮调。 */
            arcPower: 1.15,
            arcFloor: 0.4675,
            flankFloor: 0.7325,
            arcStops: 24,                    // 用几个 stop 逼近(越多越圆滑)
            arcJitter: 0.20,                 // 每个涟漪自己的角向抖动量(不然所有环长得一模一样)
            /* 两种"变淡",缺一不可:
             *   spread 越大 → 环扩出去以后还越清楚;越小 → 越扩越淡
             *   lightDistDim 是"离光远近"那一侧额外再压多少 —— 必须和 water.farTop
             *   那道远处压暗对齐,否则远处的水暗着、涟漪却还是全亮,一眼假 */
            spread: 520,
            /* "离光的距离":沿【全局光向】投影,越远越淡(不是只看画面上下)。
             * 0.5 = 背光那端比迎光那端淡一半。 */
            lightDistDim: 0.5,
            speed: [105, 55],                // 波前速度 px/s(要能扩到 300~400px)
            /* 寿命 秒 + 淡出曲线。★ 参考图那道环半径 324px 时还很亮,而原来
             * (1-age/life)^1.2 在 age/life=0.68 只剩 0.26 —— 还没扩开就没劲了。
             * 现在改成"先稳住、末尾再掉":fade = 1 − (age/life)^fadePower。 */
            life: [0.75, 0.35],
            fadePower: 2.5,
            /* ---------- 数量控制 ----------
             * 原来 7 处各自 ripples.push,频率和事件频率绑死:
             * 高刷鼠标一秒发 100+ 个 mousemove,10% 概率就是每秒 10 个涟漪。
             * 现在全部收口到 spawnRipple(),在这里统一限流。 */
            /* 参考图里就一道环 —— 涟漪要"稀"才像水。上限从 24 收到 16。 */
            maxLive: 16,                     // 同时存在的涟漪上限(超了顶掉最老的)
            mergeAge: 0.20,                  // 只和"刚冒出来"的比(秒)
            mergePower: 0.30,                // 强度接近到这个程度
            mergeDist: 14,                   // 距离近到这个程度 → 不重复冒(px)
        }
    },

    /* ---------- 光 ---------- */
    light: {
        dir: [-0.62, -0.78],        // 全局光向(影子和明暗都跟它);左上打光
        texture: 'assets/light-water-ribbons-v2.webp',   // 无损 WebP(逐像素等于 PNG)
        /* 贴图是 RGBA、靠 alpha 承载明暗,所以只能"轻上色",不能 multiply 填色。
         * 这一张的 RGB 本身是淡青白(不偏暖),所以染色要更轻、更中性 ——
         * 用上一张的暖奶油色会把池塘染黄。 */
        tint: null,   // 这张图 RGB 已是淡青白;染色那一步会压低 alpha(见 script.js 注释)
        desaturate: 0.25,           // 贴图自带绿条纹,不去掉会像水藻
        reps: 6,                    // 用 lighter 叠几次把 alpha 抬上去(这张图 alpha 更稀)
        /* ★ 片数管【覆盖】,疏密要交给下面的斑驳遮罩 —— 这两个是不同的旋钮。
         *   片数降到 2 时,刀片位置是随机的,很容易两片都落在画面外,
         *   实测全屏亮度差变成 +0.0(光直接没了)。所以片数保持够覆盖,
         *   想"疏"就减遮罩的斑数(留白变多)。 */
        blades: 4,
        size: [0.3, 0.35],         // [基数, 随机幅度] × 画面长边
        drift: [0.16, 0.18],        // 漂移速度(要能看出来在动)
        spin: 0.060,                // 自转幅度
        alpha: [0.3, 0.38],        // 每片的透明度 [基数, 随机幅度]
        patchBlobs: 24,             // 斑数越少 → 留白越多(疏)
        patchPeak: 1.0,            // 斑心全开:亮了才亮、留白照样多(疏密靠斑数,不靠压低峰值)
        patchRadius: [0.09, 0.13],
        layerAlpha: 0.4            // 整层光最终叠到水面上的强度(最大旋钮)
    },

    /* ---------- 天气(2026-09-26) ----------
     * 预设只调【已经存在的东西】:光感强度(causticAlpha)+ 一层全屏色罩(grade)。
     * 不新增绘制系统 —— 顶视角的"水感"来自光的调制,不是往屏幕上加粒子(KB 法则:
     * 水感来自光的调制而非几何位移)。雨环的剖面也不在这里:它复用 water.ripple
     * 的同一套参数(见 render/ripples.js 的 rainProfile),只压暗、关掉暗带。
     * ⚠️ GPU 光感路径只吃 alpha(GPU 分支不认图案缩放),所以预设必须靠 alpha + 色罩表达,
     *    不能指望 "把光斑调大/调碎" 这类只有 CPU 路径才有的旋钮。 */
    weather: {
        order: ['clear', 'rain'],                // 下标 ↔ 宿主属性值(WPE combo / Lively dropdown 都是数字)
                                                 // 只要两档(用户决定):想加"阴/大雨/雪"就在 order 与下面各加一条预设
        transition: 3.5,                         // 过渡时长(秒):"天变阴"不是"啪一下"
        rainFade: 1.1,                           // 雨量的淡入淡出(秒)
        /* grade 走 multiply:值越暗压得越狠,alpha 是"压多少"。clear 必须 alpha 0 */
        clear:    { causticAlpha: 1.00, grade: '#ffffff', gradeAlpha: 0.00, rain: null },
        /* 雨滴是"小坑"不是"大环":小、密、整圈可见。
         * arcFloor 0.45 是关键 —— 鼠标涟漪用 0(只亮迎光那一侧,像一道月光弧),
         * 雨滴用 0 会变成一根根"流星尾巴";抬到 0.45 才是四面都亮的小圆坑。 */
        rain:     { causticAlpha: 0.28, grade: '#95a4ac', gradeAlpha: 0.78,
                    /* 上限是**成本**定的,不是审美定的。真机 WORK(每帧 update+draw 实际耗时,1920×1080):
                     *   晴 6.5ms → 雨(丝 130/坑 96) 9.5~10.8ms ⇒ 每颗粒子约 0.02ms
                     * 宿主 Wallpaper Engine 当前 **30fps** ⇒ 每帧预算 33ms,离上限很远,
                     * 所以这里按观感优先给到 ≈200 条雨丝 / 180 个水坑(预计 WORK ≈13ms,余量 60%)。
                     * 量法:node tools/perf.mjs(见 docs/perf.md);改完重量一次,别靠推算。 */
                    /* 雨坑(落点驱动,所以这里没有速率 —— 只有尺寸分布与池子上限) */
                    rain: { power: [0.07, 0.24], maxLive: 180,
                            speed: [42, 18], life: [0.75, 0.48], crestAlpha: 0.72,
                            /* 小雨坑放大波长，避免亮暗半波被抗锯齿抹掉。 */
                            lamRatio: 0.45, waveCycles: 2, waveDecay: 1.15,
                            arcFloor: 0.55, arcJitter: 0.40, troughAlpha: 0,
                            /* 雨丝:空中那一条。perSec 这里 = 满雨时在场条数(见 environment.rainSpawnCount)。
                             * 30fps 下要按"每帧走多远"定:速度/30 必须小于丝长,否则看起来是一串虚线。
                             * 520~760 ÷ 30 = 每帧 17~25px < 丝长 28~56 ⇒ 连续。60fps 时更宽松。 */
                            streak: { perSec: 200, maxLive: 210, len: [28, 56], speed: [520, 760],
                                      width: 1.4, slope: [-0.26, -0.26], alpha: [0.14, 0.36] } } }
    },

    /* ---------- 自持事件:落叶 / 花瓣(2026-09-26 接入) ----------
     * "无人值守时画面自己发生的事"。数值全部来自实验页
     * experiments/idle-events-mock/on-real-pond.html 的定版(用户看过并认可),
     * 那里按 1280×800 调的,所以这里是绝对像素,和 water.ripple 同一口径。
     *
     * 为什么单独一个块(而不是塞进 weather):它们是**两件事** ——
     * 天气是"环境状态"(天色过渡、雨量淡入淡出),自持事件是"偶发的小事件"。
     * 混在一起会让"关掉天气"顺带把落叶也关掉。 */
    idleDrift: {
        seed: 0x51ed270b,            // ★ 自己的随机流(mulberry32)。绝不碰共享 Math.random —— 鱼的随机序列/指纹不能被改
        /* 每件的节奏(秒)= base + 随机(0..jitter)。★ 这是【常驻壁纸】,不是动画短片:
         *   旧值 3.4+1.8 / 2.6+1.4 是照实验页定的,合起来 ≈32 件/分钟 —— 用户反馈"掉落太频繁"。
         *   现在合起来 ≈1 件/分钟(平均间隔 60 多秒),随机范围拉到 2~3 倍宽,让它不像定时器:
         *   一分钟里可能什么都没有,也可能两件挨得近一些 —— 但被 minGap 挡着,不会同时掉两件。
         *   要调观感先动这里;`cap` 只是护栏(现在的密度下几乎不会碰到)。 */
        rate: { leaf: [80, 140], petal: [60, 100] },  // 落叶 80~220s；花瓣 60~160s(合起来 ≈1 件/分钟)
        /* 两件之间至少隔这么久。为什么需要:落叶和花瓣是两条独立定时器,
         * 它们偶尔会在同一瞬间都到点 —— 实测最短间隔 0.2 秒,看起来是"双黄蛋",
         * 而"偶尔、不经意"要的是**一件一件**地掉。被挡住的定时器不丢,等到点立刻放。 */
        minGap: 20,
        cap: 4,                      // 在场上限:稀疏之后它不是"密度旋钮",只是异常情况的护栏
        /* 素材显示尺寸(长边 px)+ 每件自己的大小倍率 */
        sprite: { leaf: 30, petal: 26, sizeMul: [0.72, 1.30] },
        fall: {
            vy: [34, 66],            // 下落速度 px/s
            sway: [0.7, 1.6],        // 横向摆动频率(乘 sin)
            swayAmp: 22,             // 横向摆动等效推进(px/s)
            spin: [-1.4, 1.4],       // 自转(rad/s)
            flip: [1.1, 2.3]         // 翻面(rad/s):用 |cos| 压扁,叶子翻起来才不像贴纸
        },
        land: [0.30, 0.88],          // 落点纵向范围(画面高比例),每次不同 → 不会"同一行入水"
        /* 水中:越沉越淡,但到底仍可见(fade 是压掉的比例,alphaMin 是最终保留) */
        sink: { rate: [0.10, 0.18], fade: 0.55, alphaMin: 0.45, squash: 0.30, drift: 0.14, swirl: 0.6 },
        life: [9, 17],               // 漂浮寿命(秒),到期后 fadeOut 秒内淡出
        fadeOut: 1.6,
        /* 落水涟漪:自己的剖面(派生自 water.ripple)。
         * 落物比雨滴大、比鼠标小 —— power 落在两者之间。 */
        ripple: { power: { leaf: 0.42, petal: 0.32 }, maxLive: 20,
                  speed: [34, 14], life: [0.85, 0.55], crestAlpha: 0.60,
                  lamRatio: 0.32, waveCycles: 2.5, waveDecay: 0.95,
                  arcFloor: 0.30, arcJitter: 0.35, troughAlpha: 0 },
        /* 因果:惊扰(走真引擎"躲鼠标"分支)→ delay 秒后聚集(往 foods 塞不可见吸引子) */
        startle: { radius: 150, hold: 0.42 },
        gather: { delay: 0.9, seconds: 8, radiusMul: 1.8 }
    },

    /* ---------- 光的"时段"(光随时间走,2026-09-26 接入) ----------
     * 由 features/day-cycle.js 每帧采样,写进 core/environment.js 的**时段通道**,
     * 在那里与天气相乘后一起提交给 renderer(所以 renderer 一行都不用改)。
     *
     * 三条规定(定版):
     *   ① **12:00 = 今天的基线(恒等变换)**:grade 白×0、causticMul 1、光向 azBase。
     *      任何时段都能和"今天"逐帧对比,也让"关掉这个功能"有一个明确的落点。
     *   ② **全是相对量**(乘数/压暗比例),不是绝对值 —— 这样"夜里下雨"这类组合才成立。
     *   ③ **光向走半圈**(azAmp 0.5):整圈时某些角度光从正下方/右侧来,影子方向很怪(用户定:半圈)。
     *
     * keys 的时刻(h)必须递增且覆盖 0~24;中间线性插值。实测(60 分钟虚拟时间):
     * 整屏平均亮度 正午 104 → 夜 63(1.64 倍);光向 232°±90° 内摆动。 */
    dayPhase: {
        azBase: 232,              // 12:00 的光向(与 watergl.js 的 P.az 一致)
        azPerHour: 15,            // 每小时转多少度(整圈=360/天)
        azAmp: 0.5,               // ★ 只走半圈(±90°)
        elevNight: 30,            // 涟漪的光高度角:夜里降到这个值,正午 = 抓 WaterGL 当前基线(保证 12:00 恒等)
        ease: 0.3,                // 缓入速率(每秒收敛比例 → 时间常数约 3 秒)。见 features/day-cycle.js
        nightDim: 1.0,            // 夜间暗度倍率(宿主属性 nightDim 会覆盖它;1.0 = 现在这版观感)
        keys: [
            { h: 0.0,  grade: '#2a3c5e', dim: 0.50, causticMul: 0.22, lm: 0.70 },
            { h: 4.5,  grade: '#2a3c5e', dim: 0.50, causticMul: 0.22, lm: 0.70 },
            { h: 6.0,  grade: '#e8a97f', dim: 0.30, causticMul: 0.45, lm: 0.85 },
            { h: 7.5,  grade: '#ffd3a8', dim: 0.16, causticMul: 0.70, lm: 0.95 },
            { h: 10.0, grade: '#ffffff', dim: 0.04, causticMul: 0.95, lm: 1.00 },
            { h: 12.0, grade: '#ffffff', dim: 0.00, causticMul: 1.00, lm: 1.00 },   // ★ 基线
            { h: 15.0, grade: '#fff6e8', dim: 0.04, causticMul: 0.98, lm: 1.00 },
            { h: 17.5, grade: '#ffcf9a', dim: 0.18, causticMul: 0.80, lm: 0.95 },
            { h: 19.0, grade: '#ff9a5c', dim: 0.30, causticMul: 0.55, lm: 0.88 },
            { h: 20.5, grade: '#3f5480', dim: 0.44, causticMul: 0.32, lm: 0.78 },
            { h: 22.5, grade: '#2a3c5e', dim: 0.50, causticMul: 0.22, lm: 0.70 },
            { h: 24.0, grade: '#2a3c5e', dim: 0.50, causticMul: 0.22, lm: 0.70 }
        ]
    },

    /* ---------- 鱼 ---------- */
    fish: {
        shadow: 'rgba(14,50,46,',        // 塘底投影(后面接 alpha)
        outline: '#000000',              // 鱼身纯黑描边，粗细由调试面板控制
        sheen: 'rgba(255,252,232,',      // 金属光泽(黄金/孔雀这类亮皮)
        finEdge: 'rgba(186,206,196,0.30)',  // 尾鳍鳍条
        spotHi: 'rgba(255,255,255,0.10)',   // 斑块上的水彩提亮
        eye: 'rgba(44,36,29,0.72)',         // 眼
        eyeHi: 'rgba(255,255,255,0.54)',    // 眼高光
        waterLine: 'rgba(10,30,28,'         // 自定义鱼的背光面(后面接 alpha)
    },

    /* ---------- 池塘里的时间/日期 ----------
     * 位置用"锚点 + 边距",锚点可选:top-left/top-center/top-right/
     * bottom-left/bottom-center/bottom-right。 */
    clock: {
        show: true,
        anchor: 'top-right',
        marginX: 0.05,          // 相对画面宽
        marginY: 0.105,        // 让开右上角那个「自定义鱼」入口         // 相对画面高
        timeSize: 0.075,        // 相对画面【短边】的字号
        dateSize: 0.34,         // 相对时间字号的倍率
        weight: 600,            // 时间字重；日期自动比它轻 200
        color: 'rgba(244,252,248,0.94)',   // 暖白偏青:像水面反光,不是 UI 文字
        shadow: 'rgba(8,34,36,',           // 影子基色(后面接 alpha)
        shadowAlpha: 0.62,
        shadowBlur: 0.040,      // 相对短边:糊一点才像水里的暗,不像描边
        shadowOffset: 0.012,    // 相对短边:沿【全局光向】偏移,和鱼的影子同一套光
        gap: 0.35,              // 日期与时间的间距(相对时间字号)
        font: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif'
    },

    /* ---------- 界面(编辑器 / 以后的设置面板、启动页都该用这套) ---------- */
    ui: {
        /* ★ 池塘主题(2026-09 重做)。原来是"通用深灰 UI"—— 底 #12181c + 不透明灰面板
         *   + 灰胶囊,层级全靠深浅差一点点,和池塘毫无关系。
         *   现在改成【水底 + 水面】两件事:窗口底是深水,浮起来的卡片是半透明水面
         *   (带上缘反光),强调色只给主操作和选中态,分组标记用荷叶绿。
         *   顺带:编辑器的画布改成【透明】—— 让它坐在池塘上,而不是一块黑方框。 */
        // 荷叶纸感：深池水做底，暖纸只作为很薄的一层材质，不能变成一张白卡片。
        bg: '#173b39',
        water: '#28574f',
        waterHi: '#4a7667',
        bank: '#123331',
        pad: '#536c4d',
        padHi: '#71865c',
        paper: '#e8dfc7',                  // 稻纸暖色，仅用于面板的低透明叠层
        panel: 'rgba(232,223,199,0.11)',
        line: 'rgba(227,222,196,0.26)',
        ink: '#f1efdf',
        dim: '#b4c0a9',
        accent: '#d88796',                 // 荷花粉：唯一的主操作 / 选中态
        accentInk: '#34252b',
        canvas: 'transparent',             // 画布透明 → 坐在池塘上
        raise: 'rgba(239,231,208,0.10)',   // 按钮常态
        raiseHi: 'rgba(239,231,208,0.18)'  // 按钮悬停
    }
};

/* 把界面那部分发布成 CSS 变量前缀 --koi-*,HTML/CSS 页面直接 var(--koi-accent)。
 * 为什么要把 JS 主题也发一份到 CSS:不然"编辑器是深蓝灰、壁纸是墨绿"这种事
 * 迟早会发生 —— 两边各写一套 hex,谁也管不着谁。 */
function applyThemeCssVars(root) {
    const el = root || document.documentElement;
    if (!el || !el.style) return;
    const u = THEME.ui;
    el.style.setProperty('--koi-bg', u.bg);
    el.style.setProperty('--koi-panel', u.panel);
    el.style.setProperty('--koi-line', u.line);
    el.style.setProperty('--koi-ink', u.ink);
    el.style.setProperty('--koi-dim', u.dim);
    el.style.setProperty('--koi-accent', u.accent);
    el.style.setProperty('--koi-canvas', u.canvas);
    el.style.setProperty('--koi-raise', u.raise);
    el.style.setProperty('--koi-raise-hi', u.raiseHi);
    /* 池塘主题新增的几个(旧代码不认它们也不会坏,只是拿不到就退回兜底色) */
    if (u.water)     el.style.setProperty('--koi-water', u.water);
    if (u.waterHi)   el.style.setProperty('--koi-water-hi', u.waterHi);
    if (u.bank)      el.style.setProperty('--koi-bank', u.bank);
    if (u.pad)       el.style.setProperty('--koi-pad', u.pad);
    if (u.padHi)     el.style.setProperty('--koi-pad-hi', u.padHi);
    if (u.paper)     el.style.setProperty('--koi-paper', u.paper);
    if (u.accentInk) el.style.setProperty('--koi-accent-ink', u.accentInk);
    el.style.setProperty('--koi-font', '"Microsoft YaHei", system-ui, sans-serif');
}
