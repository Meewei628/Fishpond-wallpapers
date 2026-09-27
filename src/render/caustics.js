import { THEME, WaterGL } from '../shared/legacy-assets.js';
import { mulberry32 } from '../shared/math.js';

export function createCaustics({ config, viewport, time }) {
const WATER_MARGIN = 56;
const causticTexture = new Image();
let causticTextureReady = false;

const causticWarm = document.createElement('canvas');
const causticMask = document.createElement('canvas');
let causticFeather = null;   // 边框羽化遮罩(只淡四条边,见下)
causticTexture.onload = () => {
    causticTextureReady = true;
    causticWarm.width = causticTexture.naturalWidth;
    causticWarm.height = causticTexture.naturalHeight;
    let wg = causticWarm.getContext('2d');

    wg.filter = 'saturate(' + THEME.light.desaturate + ')';

    wg.globalCompositeOperation = 'lighter';
    for (let rp = 0; rp < THEME.light.reps; rp++) wg.drawImage(causticTexture, 0, 0);
    wg.globalCompositeOperation = 'source-over';
    wg.filter = 'none';

    if (THEME.light.tint) {
        wg.globalCompositeOperation = 'source-atop';
        wg.fillStyle = THEME.light.tint;
        wg.fillRect(0, 0, causticWarm.width, causticWarm.height);
        wg.globalCompositeOperation = 'source-over';
    }

    const FW = 0.08;
    const W0 = causticWarm.width, H0 = causticWarm.height;
    if (!causticFeather || causticFeather.width !== W0 || causticFeather.height !== H0) {
        causticFeather = document.createElement('canvas');
        causticFeather.width = W0; causticFeather.height = H0;
        const fg = causticFeather.getContext('2d');
        fg.fillStyle = '#fff';
        fg.fillRect(0, 0, W0, H0);
        fg.globalCompositeOperation = 'destination-out';   // 用渐变"擦掉"边上一圈
        const wx = W0 * FW, wy = H0 * FW;
        const band = (x, y, w, h, gx0, gy0, gx1, gy1) => {
            const gr = fg.createLinearGradient(gx0, gy0, gx1, gy1);
            gr.addColorStop(0, 'rgba(0,0,0,1)');   // 边界处擦干净
            gr.addColorStop(1, 'rgba(0,0,0,0)');   // 往里恢复
            fg.fillStyle = gr;
            fg.fillRect(x, y, w, h);
        };
        band(0, 0, wx, H0, 0, 0, wx, 0);
        band(W0 - wx, 0, wx, H0, W0, 0, W0 - wx, 0);
        band(0, 0, W0, wy, 0, 0, 0, wy);
        band(0, H0 - wy, W0, wy, 0, H0, 0, H0 - wy);
    }
    wg.globalCompositeOperation = 'destination-in';
    wg.drawImage(causticFeather, 0, 0);
    wg.globalCompositeOperation = 'source-over';

    // 大尺度遮罩:★ 不能直接拿上面这张做 overlay。
    // 焦散贴图约 95% 是黑,而 overlay 遇黑就压暗 —— 整屏会蒙一层灰(实测亮度 74.9 → 66.2)。
    // 用 lighter 把底色抬到中灰,overlay 才是中性的:亮纹处提亮,其余基本不动。
    causticMask.width = causticWarm.width;
    causticMask.height = causticWarm.height;
    let mg = causticMask.getContext('2d');
    mg.drawImage(causticWarm, 0, 0);
    mg.globalCompositeOperation = 'lighter';
    mg.fillStyle = 'rgba(132,132,132,1)';
    mg.fillRect(0, 0, causticMask.width, causticMask.height);
};

causticTexture.src = THEME.light.texture;
const CAUSTIC_BLADES = THEME.light.blades;
let causticBlades = null;
function buildCausticBlades() {
    const R = mulberry32(20261105);
    const base = Math.max(viewport.width, viewport.height);
    const out = [];
    for (let i = 0; i < CAUSTIC_BLADES; i++) {
        out.push({
            cx: (R() * 1.8 - 0.4) * viewport.width,          // 允许飘到画面外,边缘才不会突然断掉
            cy: (R() * 1.8 - 0.4) * viewport.height,
            rot: R() * Math.PI * 2,
            spin: (R() - 0.5) * THEME.light.spin,

            // ★ 尺寸是"光有多宽"的唯一开关。光带贴图本身就宽,铺太大会糊成一片云;
            //   实测 0.30~0.50 时接近 1:1,光带保持"带状"而不是"团状"。

            size: base * (THEME.light.size[0] + R() * THEME.light.size[1]),
            amp: base * (0.16 + R() * 0.18),        // 漂移半径(原来 0.10~0.23,动得太慢)
            ph: R() * Math.PI * 2,
            sp: THEME.light.drift[0] + R() * THEME.light.drift[1],
            al: THEME.light.alpha[0] + R() * THEME.light.alpha[1]
        });
    }
    return out;
}

const PATCH_BLOBS = THEME.light.patchBlobs;
const PATCH_PEAK  = THEME.light.patchPeak;
const USE_CAUSTIC_PATCH = true;   // 关掉可量出遮罩吃掉了多少光
function buildCausticPatch(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    const g = c.getContext('2d');
    const R = mulberry32(20261105);
    const base = Math.max(w, h);
    for (let i = 0; i < PATCH_BLOBS; i++) {
        const x = R() * w, y = R() * h;
        const r = base * (THEME.light.patchRadius[0] + R() * THEME.light.patchRadius[1]);
        const a = PATCH_PEAK * (0.35 + R() * 0.65);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0.00, 'rgba(255,255,255,' + a.toFixed(3) + ')');
        gr.addColorStop(0.40, 'rgba(255,255,255,' + (a * 0.50).toFixed(3) + ')');
        gr.addColorStop(1.00, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
}

let causticScratch = null;
let causticPatch = null;
function ensureCausticScratch() {
    const w = Math.max(1, Math.round(viewport.width + WATER_MARGIN * 2));
    const h = Math.max(1, Math.round(viewport.height));
    if (!causticScratch || causticScratch.c.width !== w || causticScratch.c.height !== h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        causticScratch = { c: c, g: c.getContext('2d') };
        // 建大一圈(各边 +30%):遮罩要平移/缩放,余量不够会露边
        const padP = Math.round(Math.max(w, h) * 0.30);
        causticPatch = buildCausticPatch(w + padP * 2, h + padP * 2);
        causticBlades = buildCausticBlades();      // 尺寸变了,随机布局要重掷
    }
    return causticScratch;
}

function drawCausticsEx(g, baseAlpha, extraScale, offsetX) {

    if (config.useGpuCaustics && typeof WaterGL !== 'undefined' && WaterGL.init()) {
        const wc = WaterGL.causticsCanvas(viewport.width, viewport.height, time.elapsed);
        if (wc) {
            g.save();
            g.globalCompositeOperation = 'screen';
            g.globalAlpha = baseAlpha;
            g.drawImage(wc, offsetX === undefined ? 0 : offsetX, 0, viewport.width, viewport.height);
            g.restore();
            return;
        }
    }
    if (!causticTextureReady) return;
    if (!causticBlades) causticBlades = buildCausticBlades();
    const t = time.elapsed;
    const k = extraScale || 1;
    const sc = ensureCausticScratch();
    const sg = sc.g;
    const SW = sc.c.width, SH = sc.c.height;
    sg.setTransform(1, 0, 0, 1, 0, 0);
    sg.globalAlpha = 1;
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, SW, SH);
    sg.globalCompositeOperation = 'screen';
    for (let i = 0; i < causticBlades.length; i++) {
        const B = causticBlades[i];
        const s = B.size * k;
        // 漂移用两个速度略不同的正弦(利萨如),轨迹就不会退化成一条直线来回
        const x = B.cx + WATER_MARGIN + Math.cos(t * B.sp + B.ph) * B.amp;
        const y = B.cy + Math.sin(t * B.sp * 1.37 + B.ph) * B.amp;
        sg.save();
        sg.translate(x, y);
        sg.rotate(B.rot + t * B.spin);
        sg.globalAlpha = B.al;

        const asp = causticWarm.height / causticWarm.width;
        sg.drawImage(causticWarm, -s * 0.5, -s * asp * 0.5, s, s * asp);
        sg.restore();
    }

    if (USE_CAUSTIC_PATCH) {
        sg.globalCompositeOperation = 'destination-in';
        sg.globalAlpha = 1;

        const PW = causticPatch.width, PH = causticPatch.height;
        const pad = Math.max(SW, SH) * 0.30;
        const dx = Math.sin(t * 0.17) * pad * 0.85;
        const dy = Math.cos(t * 0.13) * pad * 0.85;
        const breathe = 1 + 0.10 * Math.sin(t * 0.075);
        sg.save();
        sg.translate(SW * 0.5 + dx, SH * 0.5 + dy);
        sg.scale(breathe, breathe);
        sg.drawImage(causticPatch, -PW * 0.5, -PH * 0.5, PW, PH);
        sg.restore();
    }

    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = baseAlpha;
    // 水下画布比视口宽 2*WATER_MARGIN,所以默认要左移回去;画在水面层时偏移为 0
    g.drawImage(sc.c, offsetX === undefined ? -WATER_MARGIN : offsetX, 0, SW, SH);
    g.restore();

}
return { draw: drawCausticsEx, dispose() { causticTexture.onload = null; causticWarm.width = causticWarm.height = causticMask.width = causticMask.height = 1; causticScratch = causticPatch = causticFeather = null; } };
}
