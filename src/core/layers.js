// 绘制层次表 —— 全项目**唯一**的绘制顺序定义(2026-09-26 第二轮重构)
//
// 为什么要有这张表:第一轮把渲染拆成了模块,但顺序还写死在 renderer.draw() 里:
//   池底 → 时钟 → 食物 → 鱼(按深度排序)→ 水面 → 光感 → 远场调色 → 涟漪 → 界面
// 于是"加一个新玩法"(雨、荷花、环境声可视化…)**必须去改 renderer.js**,顺序一改就可能
// 影响所有既有层。现在顺序在这张表里,玩法只能往已有的层里"投稿",不能自己插队。
//
// target:under = 画在 underCanvas 上(会经过水面位移/折射),main = 画在主画布上
//
// ⚠️ 层的**相对顺序**属于用户可见行为(曾经逐版调过),不要为了新功能随意调换;
//    真需要新层时,在表里挑一个语义位置加(并同步 docs/architecture.md)。
export const LAYERS = Object.freeze([
    { id: 'floor',     target: 'under', desc: '池底与水底纹理' },
    { id: 'hud',       target: 'under', desc: '时钟/字幕这类"沉在水下"的界面层' },
    { id: 'food',      target: 'under', desc: '饲料' },
    { id: 'creatures', target: 'under', desc: '鱼与其他生物(按 depth 排序)' },
    { id: 'surface',   target: 'main',  desc: '水面位移与折射' },
    { id: 'light',     target: 'main',  desc: '焦散/光感' },
    { id: 'farTint',   target: 'main',  desc: '远场调色(把远处压暗)' },
    { id: 'weather',   target: 'main',  desc: '天气(雨/落叶/花瓣)这类前景粒子' },
    { id: 'ripples',   target: 'main',  desc: '鼠标涟漪' },
    { id: 'ui',        target: 'main',  desc: '界面覆盖层(名字、入口按钮)' }
]);

const LAYER_IDS = new Set(LAYERS.map(l => l.id));
const TARGETS = new Set(['under', 'main']);

export function createLayerSet() {
    const lists = new Map(LAYERS.map(l => [l.id, []]));
    function add(layerId, draw) {
        if (!lists.has(layerId)) throw new Error('Unknown draw layer: ' + layerId);
        if (typeof draw !== 'function') throw new Error('Layer draw must be a function');
        lists.get(layerId).push(draw);
        return () => {
            const list = lists.get(layerId);
            const i = list.indexOf(draw);
            if (i >= 0) list.splice(i, 1);
        };
    }
    return {
        add,
        /** 按固定顺序遍历某一层(renderer 每帧调用) */
        draw(layerId, ctx) {
            const list = lists.get(layerId);
            if (!list) throw new Error('Unknown draw layer: ' + layerId);
            for (let i = 0; i < list.length; i++) list[i](ctx);
        },
        count: layerId => (lists.get(layerId) || []).length,
        layerIds: () => [...LAYER_IDS],
        /** 自检用:所有层都在表里、target 合法 */
        inspect: () => LAYERS.map(l => ({ ...l, contributors: lists.get(l.id).length }))
    };
}

export function isLayerId(id) { return LAYER_IDS.has(id); }
export function isLayerTarget(t) { return TARGETS.has(t); }
