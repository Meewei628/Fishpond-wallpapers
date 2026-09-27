import { KOI_SHAPE } from '../shared/legacy-assets.js';
import { noseColorOf } from '../render/fish-skin.js';

export function createCustomFish({ Koi, koiType, kois, config, viewport, spawnRipple, repository }) {
const listeners = [];
function listen(n, fn) { window.addEventListener(n, fn); listeners.push([n, fn]); }
let customDefs = [];
const customKoiById = new Map();

class CustomKoi extends Koi {
    constructor(def) {
        // 2026-09-26:生物构造签名改成 (type, opts) —— 自定义鱼是"锦鲤身体 + 自定义外观",
        // 所以显式继承锦鲤这个 kind,并声明 origin='custom'(种群系统按 origin 决定谁受鱼数管理)
        super(koiType, { custom: true, origin: 'custom' });
        this.custom = true;
        this.customId = def.id;
        this.sizeMul = 0.50 + this.depth * 0.44;   // 自定义鱼是主角,给大一点
        // 斑纹/鳞网/红唇/腹缘全部关掉 —— 用户涂什么就是什么
        this.spotRanges = [];
        this.net = 0; this.sheen = 0; this.kuchi = null; this.edge = null;
        this.applyCustomDef(def);
    }
    applyCustomDef(def) {
        this.shape = KOI_SHAPE.clampShape(def.shape);
        this.name = def.name || '';
        this.color = def.color || '#ffffff';
        if (def.skin && def.skin !== this.skinSrc) {
            this.skinSrc = def.skin;
            const im = new Image();
            // 解码期间继续用旧纹理,不闪白
            im.onload = () => {
                this.skin = im; this.skinReady = true;
                this.noseColor = noseColorOf(im);
            };
            im.src = def.skin;
        }
    }
}

function syncCustomFish() {
    for (let i = kois.length - 1; i >= 0; i--) {
        const k = kois[i];
        if (k.custom && !customDefs.some(d => d && d.id === k.customId)) {
            kois.splice(i, 1); customKoiById.delete(k.customId);
        }
    }
    customDefs.slice(0, 6).forEach(d => {          // 上限 6 条,再多就抢戏了
        if (!d || !d.id) return;
        let k = customKoiById.get(d.id);
        if (!k) {
            k = new CustomKoi(d);
            customKoiById.set(d.id, k);
            kois.push(k);
        } else {
            k.applyCustomDef(d);
        }
    });
}

let lastCustomRaw = null;

const RELEASE_KEY = 'koi.custom.release.v1';
let lastReleaseRaw = '';

function releaseFish(k) {
    if (!k) return;
    const cx = viewport.width * 0.5, cy = viewport.height * 0.5;
    for (let i = 0; i < k.segments.length; i++) { k.segments[i].x = cx; k.segments[i].y = cy; }
    k.x = cx; k.y = cy;
    k.heading = Math.random() * Math.PI * 2;
    k.angle = k.heading;
    k.speed = 0;
    k.depth = Math.max(0.45, k.depth);      // 别一入水就沉到底看不见
    k.drop = { t: 0, dur: 1.05, splashed: false };
    // 入水点先起一圈很淡的预兆(主涟漪在 update 里按进度冒)
    spawnRipple(cx, cy, 0.8 * config.rippleStrength);
}

function checkRelease() {
    let raw = null;
    try { raw = repository.getRaw(RELEASE_KEY); } catch (e) { return; }
    if (!raw || raw === lastReleaseRaw) return;
    lastReleaseRaw = raw;
    let msg = null;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    // 陈旧的投放指令不要执行(否则每次刷新壁纸都会把鱼扔一次)
    if (!msg || !msg.id || Date.now() - msg.t > 15000) return;
    releaseFish(customKoiById.get(msg.id));
}

listen('storage', e => {
    if (e.key === RELEASE_KEY) { loadCustomFishFromStore(); checkRelease(); }
});

function loadCustomFishFromStore() {
    try {
        const raw = repository.getRaw('koi.custom.fish.v1');
        lastCustomRaw = raw;
        const parsed = raw && JSON.parse(raw);
        customDefs = Array.isArray(parsed?.list) ? parsed.list.filter(d => d && typeof d.id === 'string') : [];
    } catch (e) {
        customDefs = [];      // 存储不可用/内容坏了都不能把整池鱼拖垮
    }
    syncCustomFish();
}

// 编辑器保存后自动同步:同源跨窗口的 storage 事件
listen('storage', e => {
    if (e.key === 'koi.custom.fish.v1') loadCustomFishFromStore();
});

const poll = setInterval(() => {
    try {
        if (repository.getRaw('koi.custom.fish.v1') !== lastCustomRaw) loadCustomFishFromStore();
    } catch (e) {  }
    checkRelease();
}, 2000);

return { syncCustomFish, loadCustomFishFromStore, releaseFish, dispose() { clearInterval(poll); for (const [n, f] of listeners) window.removeEventListener(n, f); for (let i = kois.length - 1; i >= 0; i--) if (kois[i].custom) kois.splice(i, 1); customKoiById.clear(); } };
}
