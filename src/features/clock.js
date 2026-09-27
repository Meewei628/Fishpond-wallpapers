import { THEME } from '../shared/legacy-assets.js';
/* ★ 光向【每帧现读】,不再在加载时解构。
 *   原来是 `const [lx(), ly()] = THEME.light.dir` —— 加载时固化,
 *   之后运行时光向转了也【完全不动】(影子/涟漪/时钟偏移全都不跟),典型的"改了没反应"。
 *   这是"光随时间走"(experiments/day-phase)的前提。
 *   ⚠️ THEME.light.dir 必须保持【单位向量】:多处拿它做投影与偏移量。 */
const lx = () => THEME.light.dir[0];
const ly = () => THEME.light.dir[1];

export function createClock({ viewport }) {
let clockTime = '', clockDate = '', clockStamp = '';
const glassCache = new Map();
const cardBuffer = document.createElement('canvas');

function roundedRect(g, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + width, y, x + width, y + height, r);
    g.arcTo(x + width, y + height, x, y + height, r);
    g.arcTo(x, y + height, x, y, r);
    g.arcTo(x, y, x + width, y, r);
    g.closePath();
}

function drawFrostedCard(g, x, y, width, height, short, T) {
    const blur = Math.max(0.1, short * (T.cardBlur ?? 0.012));
    const opacity = T.cardOpacity ?? 0.45;
    const bleed = Math.ceil(blur * 2);
    const sx = Math.max(0, Math.floor(x - bleed));
    const sy = Math.max(0, Math.floor(y - bleed));
    const sw = Math.min(g.canvas.width - sx, Math.ceil(width + bleed * 2));
    const sh = Math.min(g.canvas.height - sy, Math.ceil(height + bleed * 2));
    if (cardBuffer.width !== sw || cardBuffer.height !== sh) {
        cardBuffer.width = sw;
        cardBuffer.height = sh;
    }
    const bg = cardBuffer.getContext('2d');
    bg.clearRect(0, 0, sw, sh);
    bg.filter = 'blur(' + blur.toFixed(1) + 'px) saturate(82%)';
    bg.drawImage(g.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    bg.filter = 'none';

    const radius = Math.max(2, short * (T.cardRadius ?? 0.022));
    g.save();
    roundedRect(g, x, y, width, height, radius);
    g.fillStyle = 'rgba(24,45,38,0.16)';
    g.shadowColor = 'rgba(8,27,23,' + (T.cardShadow ?? 0.34).toFixed(3) + ')';
    g.shadowBlur = short * 0.026;
    g.shadowOffsetX = -lx() * short * 0.008;
    g.shadowOffsetY = -ly() * short * 0.008;
    g.fill();
    g.restore();

    g.save();
    roundedRect(g, x, y, width, height, radius);
    g.clip();
    g.drawImage(cardBuffer, sx, sy);
    const tintValue = parseInt(String(T.cardTint || '#d7e2d1').slice(1), 16);
    const tr = tintValue >> 16, tg = (tintValue >> 8) & 255, tb = tintValue & 255;
    const tint = g.createLinearGradient(x, y, x + width, y + height);
    tint.addColorStop(0, 'rgba(' + Math.round(tr + (255 - tr) * 0.32) + ',' + Math.round(tg + (255 - tg) * 0.32) + ',' + Math.round(tb + (255 - tb) * 0.32) + ',' + Math.min(0.9, opacity * 1.22).toFixed(3) + ')');
    tint.addColorStop(0.56, 'rgba(' + tr + ',' + tg + ',' + tb + ',' + opacity.toFixed(3) + ')');
    tint.addColorStop(1, 'rgba(' + Math.round(tr * 0.86) + ',' + Math.round(tg * 0.90) + ',' + Math.round(tb * 0.88) + ',' + (opacity * 0.76).toFixed(3) + ')');
    g.fillStyle = tint;
    g.fillRect(x, y, width, height);
    g.restore();

    g.save();
    roundedRect(g, x + 0.5, y + 0.5, width - 1, height - 1, radius - 0.5);
    g.strokeStyle = 'rgba(249,255,244,0.62)';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
}

function glassText(text, size, weight, T) {
    const strength = Math.max(0.1, T.dropletStrength ?? 0.3);
    const lightX = Math.round(lx() * 10) / 10, lightY = Math.round(ly() * 10) / 10;
    const key = [text, Math.round(size), weight, T.font, strength, lightX, lightY].join('|');
    if (glassCache.has(key)) return glassCache.get(key);

    const source = document.createElement('canvas');
    const probe = source.getContext('2d');
    probe.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
    const metrics = probe.measureText(text);
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || size * 0.8);
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || size * 0.25);
    const blur = Math.max(1, size * 0.12 * strength);
    const rim = Math.max(2, Math.round(size * 0.034 * strength));
    const pad = Math.ceil(blur * 2 + rim * 3 + 2);
    source.width = Math.ceil(metrics.width) + pad * 2;
    source.height = ascent + descent + pad * 2;

    const sg = source.getContext('2d');
    sg.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
    sg.textBaseline = 'alphabetic';
    sg.fillStyle = '#fff';
    sg.fillText(text, pad, pad + ascent);

    const blurred = document.createElement('canvas');
    blurred.width = source.width;
    blurred.height = source.height;
    const bg = blurred.getContext('2d');
    bg.filter = 'blur(' + blur.toFixed(2) + 'px)';
    bg.drawImage(source, 0, 0);
    bg.filter = 'none';

    const raw = bg.getImageData(0, 0, blurred.width, blurred.height);
    const solid = sg.getImageData(0, 0, source.width, source.height).data;
    const mask = new Uint8Array(source.width * source.height);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
        // 与参考 SVG 的 feColorMatrix 相同：把模糊 Alpha 挤回圆润的液态轮廓。
        const goo = Math.max(0, Math.min(1, raw.data[p + 3] / 255 * 25 - 10));
        mask[i] = Math.max(solid[p + 3], goo * 255) > 127 ? 1 : 0;
    }

    const glass = document.createElement('canvas');
    glass.width = source.width;
    glass.height = source.height;
    const gg = glass.getContext('2d');
    const pixels = gg.createImageData(glass.width, glass.height);
    const sample = (x, y) => x < 0 || y < 0 || x >= glass.width || y >= glass.height ? 0 : mask[y * glass.width + x];
    const offsets = [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [rim, rim], [-rim, rim], [rim, -rim], [-rim, -rim]];

    for (let y = 0; y < glass.height; y++) for (let x = 0; x < glass.width; x++) {
        const inside = sample(x, y);
        if (!offsets.some(([ox, oy]) => sample(x + ox, y + oy) !== inside)) continue;
        const gx = sample(x - rim, y) - sample(x + rim, y);
        const gy = sample(x, y - rim) - sample(x, y + rim);
        const length = Math.hypot(gx, gy) || 1;
        const facing = Math.max(-1, Math.min(1, (gx * lightX + gy * lightY) / length));
        const shine = Math.pow((facing + 1) / 2, 2.2);
        const p = (y * glass.width + x) * 4;
        if (inside) {
            // 内沿像水滴迎光面：清亮但不填满字面。
            pixels.data[p] = 150 + Math.round(97 * shine);
            pixels.data[p + 1] = 210 + Math.round(45 * shine);
            pixels.data[p + 2] = 207 + Math.round(45 * shine);
            pixels.data[p + 3] = Math.round(255 * Math.min(0.92, 0.38 + shine * 0.50));
        } else {
            // 外沿是透过水体看到的深色折射圈，保证浅水背景上仍能辨认。
            pixels.data[p] = 3 + Math.round(38 * shine);
            pixels.data[p + 1] = 35 + Math.round(70 * shine);
            pixels.data[p + 2] = 39 + Math.round(67 * shine);
            pixels.data[p + 3] = Math.round(255 * (0.46 - shine * 0.12));
        }
    }
    gg.putImageData(pixels, 0, 0);

    const result = { canvas: glass, width: metrics.width, pad };
    glassCache.set(key, result);
    if (glassCache.size > 8) glassCache.delete(glassCache.keys().next().value);
    return result;
}

function refreshClockText() {
    const d = new Date();
    const stamp = d.getFullYear() + '/' + d.getMonth() + '/' + d.getDate() + ' ' + d.getHours() + ':' + d.getMinutes();
    if (stamp === clockStamp) return;          // 一分钟才重算一次,别每帧都格式化
    clockStamp = stamp;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    clockTime = hh + ':' + mm;
    const wk = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    clockDate = (d.getMonth() + 1) + '月' + d.getDate() + '日  星期' + wk;
}

function drawClock(g) {
    const T = THEME.clock;
    if (!T.show) return;
    refreshClockText();
    const short = Math.min(viewport.width, viewport.height);
    const tSize = short * T.timeSize;
    const dSize = tSize * T.dateSize;
    const gap = tSize * T.gap;
    // anchor 的写法是【纵向-横向】(top-center = 靠上 + 居中)
    const [vert, horiz] = T.anchor.split('-');
    const mx = viewport.width * T.marginX, my = viewport.height * T.marginY;

    g.save();
    g.textBaseline = 'middle';
    g.textAlign = horiz === 'left' ? 'left' : (horiz === 'right' ? 'right' : 'center');
    const cx = horiz === 'left' ? mx : (horiz === 'right' ? viewport.width - mx : viewport.width / 2);

    const timeWeight = T.weight || 600;
    const dateWeight = Math.max(300, timeWeight - 200);
    g.font = timeWeight + ' ' + Math.round(tSize) + 'px ' + T.font;
    const timeWidth = g.measureText(clockTime).width;
    g.font = dateWeight + ' ' + Math.round(dSize) + 'px ' + T.font;
    const dateWidth = g.measureText(clockDate).width;

    // 时间在上、日期在下;整块的高度用来做垂直锚点
    const blockH = tSize + gap + dSize;
    const top = vert === 'top' ? my : viewport.height - my - blockH;
    const timeY = top + tSize / 2;
    const dateY = top + tSize + gap + dSize / 2;

    if (T.cardGlass) {
        const padX = tSize * 0.34, padY = tSize * 0.30;
        const cardWidth = Math.max(timeWidth, dateWidth) + padX * 2;
        const cardHeight = blockH + padY * 2;
        const cardX = horiz === 'left' ? cx - padX : (horiz === 'right' ? cx - cardWidth + padX : cx - cardWidth / 2);
        drawFrostedCard(g, cardX, top - padY, cardWidth, cardHeight, short, T);
    }

    // 影子沿全局光向偏移 + 模糊 —— 和鱼的影子同一套光,才会像"在这个场景里"
    const off = short * T.shadowOffset;
    g.shadowColor = T.shadow + T.shadowAlpha + ')';
    g.shadowBlur = short * T.shadowBlur;
    g.shadowOffsetX = -lx() * off;      // 光从左上来 → 影子往右下
    g.shadowOffsetY = -ly() * off;

    const rf = short * 0.0022;
    function drawMainText(text, x, y, size, weight) {
        g.font = weight + ' ' + Math.round(size) + 'px ' + T.font;
        if (!T.droplet) {
            g.fillStyle = T.cardGlass ? T.cardTextColor : T.color;
            g.fillText(text, x, y);
            return;
        }

        const glass = glassText(text, size, weight, T);
        const left = g.textAlign === 'left' ? x : (g.textAlign === 'right' ? x - glass.width : x - glass.width / 2);
        g.drawImage(glass.canvas, left - glass.pad, y - glass.canvas.height / 2);
    }

    if (!T.droplet) {
        g.save();
        g.shadowColor = 'transparent';
        g.fillStyle = T.cardGlass ? 'rgba(17,70,60,0.14)' : 'rgba(150,220,215,0.20)';
        g.font = timeWeight + ' ' + Math.round(tSize) + 'px ' + T.font;
        g.fillText(clockTime, cx - lx() * rf, timeY - ly() * rf);
        g.font = dateWeight + ' ' + Math.round(dSize) + 'px ' + T.font;
        g.fillText(clockDate, cx - lx() * rf, dateY - ly() * rf);
        g.restore();
    }

    drawMainText(clockTime, cx, timeY, tSize, timeWeight);
    drawMainText(clockDate, cx, dateY, dSize, dateWeight);
    g.restore();
}

return { draw: drawClock };
}
