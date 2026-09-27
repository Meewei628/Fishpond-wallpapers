export function smooth01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

export function shadeColor(hex, amt) {
    let n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

export function varyHexColor(hex, amt) {
    let n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
    const part = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    return '#' + part(r) + part(g) + part(b);
}

export function hexRgba(hex, alpha) {
    let n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}
// 画面统一从左上打光。所有物体的明暗都要沿它,不能各自为政
// 视觉常量一律从 theme.js 取(唯一真源,见那里的注释)
export function mixHex(a, b, t) {
    let na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    let r = Math.round(((na >> 16) & 255) + ((((nb >> 16) & 255) - ((na >> 16) & 255)) * t));
    let g = Math.round(((na >> 8) & 255) + ((((nb >> 8) & 255) - ((na >> 8) & 255)) * t));
    let bl = Math.round((na & 255) + (((nb & 255) - (na & 255)) * t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}
export function traceSmooth(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
        let mx = (pts[i][0] + pts[i + 1][0]) / 2;
        let my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    let last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
}

export function distanceSq(a, b) {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return dx * dx + dy * dy;
}

export function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
