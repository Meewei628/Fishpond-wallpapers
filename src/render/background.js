import { mulberry32 } from '../shared/math.js';

export function createBackground({ viewport, invalidate }) {
const pondBackground = new Image();
let pondBackgroundReady = false;
pondBackground.onload = () => {
    pondBackgroundReady = true;
    // Rebuild the offscreen pond once the image is ready; fish state is retained.
    invalidate();
};
/* 用【无损 WebP】:逐像素等于 PNG(见 tools/to_webp.py 的校验输出),体积却只有 39%。
 * PNG 母版仍留在 assets/,但已不被引用 ⇒ 打包时不会带上(白名单按引用扫)。 */
pondBackground.src = 'assets/pond-background-v7.webp';
function drawLilyPad(g, x, y, r, rot, pal) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    function padPath(scale, sx, sy) {
        g.beginPath();
        let segs = 52;
        for (let i = 0; i <= segs; i++) {
            let a = (i / segs) * Math.PI * 2;
            let notch = Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI);
            let rr = r * scale;
            if (notch < 0.44) rr *= 0.26 + 0.74 * (notch / 0.44);   // 荷叶标志性的 V 形缺口
            rr *= 1 + 0.035 * Math.sin(a * 7 + rot * 3);            // 叶缘轻微起伏
            let px = Math.cos(a) * rr + sx, py = Math.sin(a) * rr * 0.95 + sy;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
    }
    padPath(1.02, r * 0.05, r * 0.08);                 // 很轻的水下投影，不做硬黑边
    g.fillStyle = 'rgba(39,72,50,0.17)';
    g.fill();
    padPath(1, 0, 0);
    let lg = g.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, 0, r * 1.06);
    lg.addColorStop(0, pal[0]);
    lg.addColorStop(0.62, pal[1]);
    lg.addColorStop(1, pal[2]);
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = pal[3];
    g.globalAlpha = 0.42;
    g.lineWidth = Math.max(0.8, r * 0.014);
    for (let v = 0; v < 11; v++) {
        let va = (v / 15) * Math.PI * 2 + 0.22;
        let n2 = Math.abs(((va + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (n2 < 0.52) continue;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(va) * r * 0.90, Math.sin(va) * r * 0.86);
        g.stroke();
    }
    padPath(1, 0, 0);
    g.strokeStyle = pal[4];
    g.globalAlpha = 0.38;
    g.lineWidth = Math.max(0.8, r * 0.017);
    g.stroke();
    g.beginPath();
    g.ellipse(-r * 0.28, -r * 0.32, r * 0.24, r * 0.13, -0.62, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fill();
    g.restore();
}

function drawLotus(g, x, y, r, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    for (let ring = 0; ring < 3; ring++) {
        let n = ring === 0 ? 8 : ring === 1 ? 6 : 5;
        let rr = r * (ring === 0 ? 1.0 : ring === 1 ? 0.66 : 0.37);
        for (let i = 0; i < n; i++) {
            let a = (i / n) * Math.PI * 2 + ring * 0.42;
            g.save();
            g.rotate(a);
            g.beginPath();
            g.ellipse(rr * 0.60, 0, rr * 0.56, rr * 0.21, 0, 0, Math.PI * 2);
            g.fillStyle = ring === 0 ? 'rgba(203,112,139,0.76)' : ring === 1 ? 'rgba(235,159,177,0.82)' : 'rgba(249,190,201,0.88)';
            g.fill();
            g.restore();
        }
    }
    g.beginPath();
    g.arc(0, 0, r * 0.23, 0, Math.PI * 2);
    g.fillStyle = '#e6c66a';
    g.fill();
    g.beginPath();
    g.arc(-r * 0.06, -r * 0.06, r * 0.11, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.38)';
    g.fill();
    g.restore();
}

// Keep the artwork static and cover-cropped; live caustics, fish and ripples
// are drawn later by the main renderer.
function drawPondBackground(g, w, h) {
    let scale = Math.max(w / pondBackground.naturalWidth, h / pondBackground.naturalHeight);
    let sourceW = w / scale, sourceH = h / scale;
    let sourceX = (pondBackground.naturalWidth - sourceW) * 0.5;
    let sourceY = (pondBackground.naturalHeight - sourceH) * 0.5;
    g.drawImage(pondBackground, sourceX, sourceY, sourceW, sourceH, 0, 0, w, h);

    // Blend the image with the existing live water layers.
    let waterVeil = g.createLinearGradient(0, 0, w, h);
    waterVeil.addColorStop(0, 'rgba(22,82,79,0.08)');
    waterVeil.addColorStop(1, 'rgba(10,57,57,0.13)');
    g.fillStyle = waterVeil;
    g.fillRect(0, 0, w, h);
}

function buildPond(w, h) {
    let c = document.createElement('canvas');
    c.width = w; c.height = h;
    let g = c.getContext('2d');
    let R = mulberry32(20260924);

    if (pondBackgroundReady) {
        drawPondBackground(g, w, h);
        return c;
    }
    // --- 水:由浅青玉到青绿的柔和水色，不用单一的绿灰底 ---
    let water = g.createLinearGradient(0, 0, w * 0.4, h);
    /* ★ 这几档原来是【亮绿】(亮度 148~191),而池塘照片的中位色只有 93 ——
     *   后果:8.3MB 照片解码完成之前整屏是一块偏亮的绿,用户看到「先绿一下再变池塘」。
     *   这层现在只在「照片还没就绪」的窗口里露面,所以直接对齐照片实测的分位色:
     *   上 #267d6f / 中 #067679 / 深 #0c615f。 */
    water.addColorStop(0.00, '#2a8073');
    water.addColorStop(0.35, '#1e7a6f');
    water.addColorStop(0.72, '#106b64');
    water.addColorStop(1.00, '#0d5c58');
    g.fillStyle = water;
    g.fillRect(0, 0, w, h);

    // --- 深水区:低对比的色彩呼吸，留出干净的水面 ---
    for (let i = 0; i < 5; i++) {
        let dx = R() * w, dy = R() * h, dr = 130 + R() * 260;
        let dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
        dg.addColorStop(0, 'rgba(76,116,96,0.22)');
        dg.addColorStop(0.6, 'rgba(88,124,104,0.09)');
        dg.addColorStop(1, 'rgba(90,126,98,0)');
        g.fillStyle = dg;
        g.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }
    // --- 浅滩 ---
    for (let i = 0; i < 5; i++) {
        let dx = R() * w, dy = R() * h, dr = 90 + R() * 180;
        let dg = g.createRadialGradient(dx, dy, 0, dx, dy, dr);
        dg.addColorStop(0, 'rgba(150,190,150,0.18)');   // 原来是亮黄绿,加载期会闪
        dg.addColorStop(1, 'rgba(196,214,166,0)');
        g.fillStyle = dg;
        g.fillRect(dx - dr, dy - dr, dr * 2, dr * 2);
    }

    // --- 塘底:只有少量朦胧石影，避免出现一排脏的深色竖线 ---
    for (let i = 0; i < 9; i++) {
        let px = R() * w, py = R() * h, pr = 26 + R() * 78;
        g.save();
        g.filter = 'blur(' + (8 + R() * 14).toFixed(0) + 'px)';
        g.beginPath();
        g.ellipse(px, py, pr, pr * (0.5 + R() * 0.5), R() * Math.PI, 0, Math.PI * 2);
        g.fillStyle = R() < 0.78 ? 'rgba(64,100,78,0.11)' : 'rgba(122,142,108,0.08)';
        g.fill();
        g.restore();
    }

    // --- 水面细密水流纹 ---
    for (let i = 0; i < 64; i++) {
        let py = R() * h, px = R() * w, len = 22 + R() * 74;
        let tilt = (R() - 0.5) * 0.5;                 // 方向别全都一样
        g.beginPath();
        g.moveTo(px, py);
        for (let k = 1; k <= 6; k++) {
            g.lineTo(px + (len * k) / 6, py + tilt * (len * k) / 6 + Math.sin(k * 1.1 + px * 0.01) * 2.6);
        }
        g.strokeStyle = R() < 0.5 ? 'rgba(244,250,235,0.075)' : 'rgba(91,132,111,0.035)';
        g.lineWidth = 0.65 + R() * 0.9;
        g.stroke();
    }

    // --- 岸边植物 ---
    for (let i = 0; i < 14; i++) {
        let edge = Math.floor(R() * 4);
        let ex, ey, ang;
        if (edge === 0) { ex = R() * w; ey = -10; ang = Math.PI / 2; }
        else if (edge === 1) { ex = w + 10; ey = R() * h; ang = Math.PI; }
        else if (edge === 2) { ex = R() * w; ey = h + 10; ang = -Math.PI / 2; }
        else { ex = -10; ey = R() * h; ang = 0; }
        ang += (R() - 0.5) * 0.9;
        let len = h * (0.08 + R() * 0.20);
        g.save();
        g.translate(ex, ey);
        g.rotate(ang);
        let bw = h * (0.004 + R() * 0.008);
        g.beginPath();
        g.moveTo(0, -bw);
        g.quadraticCurveTo(len * 0.5, -bw * 2.6, len, -bw * 1.4);
        g.quadraticCurveTo(len * 0.5, bw * 2.8, 0, bw);
        g.closePath();
        let lg2 = g.createLinearGradient(0, 0, len, 0);
        lg2.addColorStop(0, 'rgba(58,96,48,0.94)');
        lg2.addColorStop(1, 'rgba(104,150,72,0.90)');
        g.fillStyle = lg2;
        g.fill();
        g.restore();
    }

    // --- 荷叶:池塘最好看的元素 ---
    let PADS = [
        ['#86ad6d', '#668e55', '#4e7447', 'rgba(204,224,175,0.42)', 'rgba(57,105,58,0.55)'],
        ['#94b979', '#71975e', '#55794d', 'rgba(214,230,185,0.40)', 'rgba(64,110,61,0.52)'],
        ['#78a365', '#5e8753', '#496f48', 'rgba(193,216,166,0.40)', 'rgba(52,96,55,0.52)']
    ];
    let padSpots = [
        [0.04, 0.09, 0.095], [0.26, 0.04, 0.064], [0.94, 0.12, 0.084],
        [0.06, 0.69, 0.078], [0.91, 0.68, 0.092], [0.64, 0.95, 0.068],
        [0.15, 0.91, 0.060], [0.98, 0.43, 0.053]
    ];
    for (let i = 0; i < padSpots.length; i++) {
        let sp = padSpots[i];
        drawLilyPad(g, sp[0] * w, sp[1] * h, sp[2] * Math.min(w, h),
                    R() * Math.PI * 2, PADS[Math.floor(R() * PADS.length)]);
    }

    // --- 荷花 ---
    let lotusSpots = [[0.10, 0.28], [0.86, 0.34], [0.20, 0.94], [0.66, 0.06]];
    for (let i = 0; i < lotusSpots.length; i++) {
        drawLotus(g, lotusSpots[i][0] * w, lotusSpots[i][1] * h,
                  Math.min(w, h) * 0.032, R() * Math.PI * 2);
    }

    // --- 漂在水面的花瓣和落叶 ---
    for (let i = 0; i < 14; i++) {
        let px = R() * w, py = R() * h, pr = 3 + R() * 5.5, pa = R() * Math.PI * 2;
        g.save();
        g.translate(px, py);
        g.rotate(pa);
        // 花瓣形:一头尖一头圆,不是椭圆药丸
        g.beginPath();
        g.moveTo(-pr, 0);
        g.quadraticCurveTo(-pr * 0.1, -pr * 0.72, pr, 0);
        g.quadraticCurveTo(-pr * 0.1, pr * 0.72, -pr, 0);
        g.closePath();
        g.fillStyle = R() < 0.55 ? 'rgba(242,182,201,0.62)' : 'rgba(198,170,112,0.55)';
        g.fill();
        g.restore();
    }

    // --- 四角轻微压暗,但不要黑边 ---
    let vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.40, w / 2, h / 2, Math.max(w, h) * 0.80);
    vig.addColorStop(0, 'rgba(60,90,66,0)');
    vig.addColorStop(1, 'rgba(56,86,62,0.18)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    return c;
}

return { buildPond, dispose() { pondBackground.onload = null; } };
}
