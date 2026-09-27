
export function createWaterSurface({ ctx, underCanvas, viewport, time }) {
const WATER_MARGIN = 56;
const WATER_STRIPS = 16;
const WATER_WARP_AMP = 1.8;
function drawWaterSurface() {
    const sh = viewport.height / WATER_STRIPS;
    const t = time.elapsed;
    const breathe = 1 + 0.25 * Math.sin(t * 0.19);
    for (let i = 0; i < WATER_STRIPS; i++) {
        const y = i * sh;
        const dx = Math.sin(y * 0.0032 + t * 0.55) * WATER_WARP_AMP * breathe;   // 单频、波长约 2000px → 缓慢大波
        ctx.drawImage(underCanvas,
            WATER_MARGIN + dx, y, viewport.width, sh + 1.2,
            0, y, viewport.width, sh + 1.2);
    }
}

return { draw: drawWaterSurface };
}
