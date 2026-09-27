import { THEME, WaterGL } from '../shared/legacy-assets.js';
import { createBackground } from './background.js';
import { createWaterSurface } from './water-surface.js';
import { createCaustics } from './caustics.js';
import { LAYERS } from '../core/layers.js';

/**
 * 渲染器 = 画布准备 + 自己的内建层 + 按层表顺序出图。
 *
 * 2026-09-26 第二轮:原先 renderer.draw() 里写死九步(还带 drawClock / drawOverlay 两个回调参数),
 * 等于"渲染器知道玩法"。现在玩法自己往层表投稿(layers.add),渲染器只认层表 ——
 * 加雨/荷花/环境声可视化不用再改这个文件。
 * 内建层的绘制内容与先后顺序与第一轮逐行一致(池底→食物→生物→水面→光感→远场调色→涟漪)。
 */
export function createRenderer({ canvas, viewport, config, time, kois, foods, ripples, layers, environment }) {
    const ctx = canvas.getContext('2d');
    const underCanvas = document.createElement('canvas');
    const uctx = underCanvas.getContext('2d');
    const margin = 56;
    let pondScene, farGradient;
    const drawOrder = [];
    const background = createBackground({ viewport, invalidate() {
        if (viewport.width && viewport.height) pondScene = background.buildPond(viewport.width + margin * 2, viewport.height);
    } });
    const surface = createWaterSurface({ ctx, underCanvas, viewport, time });
    const caustics = createCaustics({ config, viewport, time });
    function resize() {
        viewport.width = window.innerWidth;
        viewport.height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        underCanvas.width = viewport.width + margin * 2;
        underCanvas.height = viewport.height;
        pondScene = background.buildPond(underCanvas.width, viewport.height);
        farGradient = ctx.createLinearGradient(0, 0, 0, viewport.height * THEME.water.farSpan);
        farGradient.addColorStop(0, THEME.water.farTop);
        farGradient.addColorStop(0.55, THEME.water.farMid);
        farGradient.addColorStop(1, 'rgba(7,28,32,0)');
    }
    window.addEventListener('resize', resize);
    resize();

    // ---- 内建层(渲染器自己的资产) ----
    const detach = [
        layers.add('floor', g => { if (pondScene) g.drawImage(pondScene, -margin, 0); }),
        // 饲料:倒序绘制与第一轮一致(后撒的先画)
        layers.add('food', g => { for (let i = foods.length - 1; i >= 0; i--) foods[i].draw(g); }),
        layers.add('creatures', g => {
            for (let i = 0; i < kois.length; i++) drawOrder[i] = kois[i];
            drawOrder.length = kois.length;
            drawOrder.sort((a, b) => a.depth - b.depth);
            for (const fish of drawOrder) fish.draw(g);
        }),
        layers.add('surface', () => surface.draw()),
        // 光感:环境给一个乘数(阴/雨压暗)。⚠️ GPU 光感路径只吃 alpha —— 所以天气靠 alpha 表达,
        // 不能指望 extraScale(那个只有 CPU 分支认)。
        layers.add('light', g => {
            if (!config.enableCaustics) return;
            const k = environment ? environment.causticAlpha : 1;
            caustics.draw(g, THEME.light.layerAlpha * k, 1, 0);
        }),
        layers.add('farTint', g => {
            g.fillStyle = farGradient;
            g.fillRect(0, 0, viewport.width, viewport.height * THEME.water.farSpan);
            // 天气色罩:整幅压暗偏冷。用 **multiply** 而不是"平铺半透明"——
            // 平铺会把画面洗灰、对比度全丢(实测亮度只掉 5%,但已经发闷);
            // multiply 是"光变弱了",暗部与亮部按比例下来,鱼和池底的结构还在。
            // 画在雨环与涟漪**之前**,所以雨点亮脊不会被罩子压掉。
            // clear 时 alpha=0 ⇒ 这一笔完全不存在(与今天逐帧一致)。
            const grade = environment ? environment.grade : null;
            if (grade && grade.alpha > 0.001) {
                g.save();
                g.globalCompositeOperation = 'multiply';
                g.globalAlpha = grade.alpha;
                g.fillStyle = grade.color;
                g.fillRect(0, 0, viewport.width, viewport.height);
                g.restore();
            }
        }),
        layers.add('ripples', g => ripples.draw(g))
    ];

    return {
        draw() {
            const { width, height } = viewport;
            ctx.clearRect(0, 0, width, height);
            ctx.lineCap = ctx.lineJoin = 'round';
            uctx.setTransform(1, 0, 0, 1, margin, 0);
            uctx.clearRect(-margin, 0, underCanvas.width, underCanvas.height);
            uctx.lineCap = uctx.lineJoin = 'round';
            for (const layer of LAYERS) layers.draw(layer.id, layer.target === 'under' ? uctx : ctx);
        },
        dispose() {
            window.removeEventListener('resize', resize);
            detach.forEach(fn => fn());
            background.dispose(); caustics.dispose(); WaterGL.dispose();
            underCanvas.width = underCanvas.height = 1; pondScene = null; drawOrder.length = 0;
        }
    };
}
