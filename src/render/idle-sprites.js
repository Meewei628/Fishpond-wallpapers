/**
 * 自持事件的素材(落叶 4 + 花瓣 4)—— 加载 → 算紧包围盒 → 预缩放到显示尺寸 → alpha 归一。
 *
 * 为什么在这里做这三件事(而不是在玩法里):
 *   ① **紧包围盒**:素材是 1254×1254 的大图,物体只占中间一小块(实测最小边距 17%)。
 *      直接按原图尺寸画,显示大小会被留白带偏;用 alpha>8 的可见范围当源矩形才对。
 *   ② **预缩放**:壁纸是常驻进程,每帧缩放 1254² 的图是纯浪费 —— 一次性缩到 22~30px 缓存。
 *      (assets/idle/README.md 也明确建议"接入时缓存缩小精灵"。)
 *   ③ **alpha 归一**:素材里出现过"主体半透明"的图(petal-3:可见区 38% 的 alpha 只有
 *      150~200),画在深色池塘上会透出池底变成灰团。它是 alpha 问题,RGB 是正常粉色 ——
 *      提一次 alpha 就能救回来,不必重新生成。叶子/花瓣其余 7 张低 alpha 占比都在 1% 左右,
 *      这条曲线对它们几乎是恒等变换;边缘抗锯齿保留。
 *
 * 三条刻意的约束:
 *   · **文件名写成字面量**(不拼字符串):打包脚本(koi-wallpaper/tools/sync.sh)是按
 *     "代码里出现过这个文件名"来决定拷不拷素材的,拼出来的名字会被判成"没人引用"而丢掉。
 *   · **绝不碰 Math.random**:加载过程一帧都不该动共享随机序列,否则鱼的随机序列/指纹会漂。
 *   · **素材缺失不降级**:不做程序化替身。缺素材就是打包/路径错了 ——
 *     那属于"必须立刻看见"的错误(玩法会停止生成并往控制台报一次错,见 features/idle-drift.js)。
 *     画几个椭圆假装"事件还在发生",只会把真正的故障藏起来。
 */

/* 素材 = **256px 无损 WebP**(由 tools/to_webp.py 生成:先按 alpha>8 裁紧包围盒,再缩到长边 256)。
 * 显示尺寸只有 22~30px ⇒ 8~11 倍过采样;而且是"缩到 256px 之后逐像素无损",不是有损压缩。 */
export const IDLE_ASSET_FILES = {
    leaf: ['assets/idle/leaf-1.webp', 'assets/idle/leaf-2.webp',
           'assets/idle/leaf-3.webp', 'assets/idle/leaf-4.webp'],
    petal: ['assets/idle/petal-1.webp', 'assets/idle/petal-2.webp',
            'assets/idle/petal-3.webp', 'assets/idle/petal-4.webp']
};

/** alpha 归一曲线:≤20 归 0、≥150 归 255(拐点取 150 = 实测"半透明主体"的 alpha 中位区) */
const ALPHA_LO = 20, ALPHA_HI = 150;
/** 可见判据(与素材 manifest 的 boundsAlphaThreshold 一致) */
const VISIBLE_ALPHA = 8;

/**
 * @param opts.base 资源前缀(默认空 = 相对页面根;宿主打包后也走相对路径)
 * @param opts.longSide { leaf, petal } 显示长边(CSS px)
 */
export function createIdleSprites({ base = '', longSide = { leaf: 30, petal: 26 } } = {}) {
    const groups = { leaf: [], petal: [] };
    let expected = 0, loaded = 0, normalized = 0;
    const failedFiles = [];          // 缺了哪些:报错要能直接指名道姓

    function prep(url, targetLong) {
        return new Promise(resolve => {
            const im = new Image();
            im.onerror = () => { failedFiles.push(url); resolve(null); };
            im.onload = () => {
                try {
                    const w0 = im.naturalWidth, h0 = im.naturalHeight;
                    const src = document.createElement('canvas');
                    src.width = w0; src.height = h0;
                    const sx = src.getContext('2d', { willReadFrequently: true });
                    sx.drawImage(im, 0, 0);

                    // ① 紧包围盒:一次 getImageData 扫描(一次性成本,换掉每帧缩放)
                    const d = sx.getImageData(0, 0, w0, h0).data;
                    let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
                    for (let yy = 0; yy < h0; yy++) {
                        const row = yy * w0;
                        for (let xx = 0; xx < w0; xx++) {
                            if (d[(row + xx) * 4 + 3] > VISIBLE_ALPHA) {
                                if (xx < x0) x0 = xx;
                                if (xx > x1) x1 = xx;
                                if (yy < y0) y0 = yy;
                                if (yy > y1) y1 = yy;
                            }
                        }
                    }
                    if (x1 < 0) { failedFiles.push(url + '(全透明)'); return resolve(null); }
                    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
                    const k = targetLong / Math.max(cw, ch);
                    const out = document.createElement('canvas');
                    out.width = Math.max(1, Math.round(cw * k));
                    out.height = Math.max(1, Math.round(ch * k));
                    const oc = out.getContext('2d', { willReadFrequently: true });
                    oc.drawImage(src, x0, y0, cw, ch, 0, 0, out.width, out.height);

                    // ③ alpha 归一:在小图上做(几十像素,成本可忽略)
                    const small = oc.getImageData(0, 0, out.width, out.height);
                    const sd = small.data;
                    let touched = 0;
                    for (let i = 3; i < sd.length; i += 4) {
                        const a = sd[i];
                        if (a <= ALPHA_LO) { sd[i] = 0; touched++; }
                        else if (a >= ALPHA_HI) { sd[i] = 255; if (a !== 255) touched++; }
                        else { sd[i] = Math.round((a - ALPHA_LO) / (ALPHA_HI - ALPHA_LO) * 255); touched++; }
                    }
                    if (touched) { oc.putImageData(small, 0, 0); normalized++; }

                    loaded++;
                    resolve({ c: out, w: out.width, h: out.height, src: url,
                              box: [x0, y0, cw, ch] });
                } catch (e) {
                    // 跨域/解码失败:记下来(玩法会因此停止生成,并把它报到控制台)
                    failedFiles.push(url + '(' + (e && e.message ? e.message : 'decode') + ')');
                    resolve(null);
                }
            };
            im.src = base + url;
        });
    }

    /** 异步加载;完成前 groups 为空 —— 玩法会等到 complete 才开始生成(不画假件) */
    function load() {
        const jobs = [];
        for (const kind of Object.keys(IDLE_ASSET_FILES)) {
            for (const url of IDLE_ASSET_FILES[kind]) {
                expected++;
                jobs.push(prep(url, longSide[kind]).then(s => { if (s) groups[kind].push(s); }));
            }
        }
        return Promise.all(jobs);
    }

    return {
        groups,
        load,
        get ready() { return expected > 0 && loaded + failedFiles.length >= expected; },
        get failed() { return failedFiles.length; },
        failedFiles,
        /** 全部素材就绪且一件不缺 —— 玩法据此决定"要不要生成" */
        get complete() { return expected > 0 && loaded === expected && failedFiles.length === 0; },
        inspect: () => ({ expected, loaded, failed: failedFiles.length, failedFiles: [...failedFiles], normalized,
                          leaf: groups.leaf.length, petal: groups.petal.length,
                          sizes: groups.leaf.concat(groups.petal).map(s => s.w + 'x' + s.h) }),
        dispose() { groups.leaf.length = 0; groups.petal.length = 0; }
    };
}
