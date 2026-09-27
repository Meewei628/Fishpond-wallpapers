import { KOI_SHAPE } from '../shared/legacy-assets.js';
import { noseColorOf } from '../render/fish-skin.js';

const STORE_KEY = 'koi.user.fish.v2';
const MAX_FISH = 24;
const BOARD_W = 720;
const BOARD_H = 320;
const BODY_CENTER = BOARD_H / 2;
const INITIAL_FISH_COUNT = 8;
// 可通过 config.initialSameColorProbability 调整；默认约四分之一的鱼会复用已有颜色。
const INITIAL_SAME_COLOR_PROBABILITY = 0.28;
const INITIAL_COLOR_PALETTE = [
    '#d88b52', '#c96b4b', '#e0b45e', '#b5ad68', '#8f9d78', '#718d86',
    '#7896a4', '#a9758a', '#a96855', '#d0c29b', '#64766a', '#b88d62'
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const makeId = () => 'fish-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const randomItem = list => list[Math.floor(Math.random() * list.length)];

function addStyles() {
    if (document.getElementById('fish-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'fish-manager-styles';
    style.textContent = [
        '.fish-manager{--bg-top:rgba(18,71,67,.30);--bg:rgba(9,47,45,.30);--surface-1:rgba(224,255,246,.07);--surface-2:rgba(230,255,248,.11);--stroke:rgba(202,239,228,.18);--text:#f7fffb;--muted:rgba(226,245,238,.74);--accent:#f5a23e;--accent-ink:#2b2114;--control:#ef9131;--track:rgba(210,237,228,.24);position:fixed;inset:16px;z-index:40;pointer-events:none;color:var(--text);font:13.5px/1.5 "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.34)}',
        '.fish-manager *{box-sizing:border-box}.fish-manager button,.fish-manager input,.fish-manager select{font:inherit}',
        '.fish-manager__toggle{pointer-events:auto;position:absolute;right:0;top:0;height:40px;padding:0 15px;border:1px solid var(--stroke);border-radius:10px;background:linear-gradient(180deg,var(--bg-top),var(--bg));box-shadow:0 12px 30px rgba(0,24,22,.28);color:#fff;cursor:pointer}',
        '.fish-manager__panel{pointer-events:auto;position:absolute;right:0;top:0;width:min(1180px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:18px;border:1px solid rgba(222,255,246,.14);border-radius:16px;background:linear-gradient(150deg,var(--bg-top),var(--bg));box-shadow:0 28px 80px rgba(0,22,20,.46);backdrop-filter:blur(28px) saturate(1.3);-webkit-backdrop-filter:blur(28px) saturate(1.3);scrollbar-color:rgba(242,175,92,.72) rgba(255,255,255,.06)}',
        '.fish-manager__panel[hidden],.fish-manager__toggle[hidden]{display:none}.fish-manager__header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.fish-manager__title{margin:0;font-size:15px;font-weight:700}.fish-manager__hint{margin:2px 0 0;color:var(--muted);font-size:12.5px}',
        '.fish-manager__close,.fish-manager__button{height:32px;padding:0 14px;border:1px solid var(--stroke);border-radius:9px;background:var(--surface-2);color:#fff;cursor:pointer}.fish-manager button:hover{filter:brightness(1.10)}.fish-manager button:focus-visible,.fish-manager input:focus-visible,.fish-manager select:focus-visible{outline:2px solid #ffc66f;outline-offset:2px}.fish-manager__button--primary{height:36px;background:var(--accent);color:var(--accent-ink);font-weight:750;text-shadow:none}.fish-manager__button--danger{background:rgba(194,66,48,.46)}',
        '.fish-manager__layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,350px);grid-template-rows:auto auto;gap:14px}.fish-manager__card{padding:14px;border:1px solid rgba(222,255,246,.08);border-radius:13px;background:var(--surface-1)}.fish-manager__section-title{margin:0 0 10px;font-size:15px;font-weight:750}',
        '.fish-manager__form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.fish-manager__field{display:grid;gap:5px}.fish-manager__field label{color:var(--muted);font-size:12.5px}.fish-manager__field input,.fish-manager__field select{width:100%;height:30px;padding:0 9px;border:1px solid var(--stroke);border-radius:8px;background:var(--surface-2);color:#fff}.fish-manager__field select option{color:#182b2c}.fish-manager__field input[type=color]{padding:2px}.fish-manager__field input[type=range]{height:18px;padding:0;border:0;background:transparent;accent-color:var(--control)}.fish-manager__range-value{color:var(--accent);font-variant-numeric:tabular-nums}',
        '.fish-manager__editor-card{grid-column:1;grid-row:1}.fish-manager__list-card{grid-column:2;grid-row:1/span 2}.fish-manager__board-card{grid-column:1;grid-row:2}.fish-manager__board-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.fish-manager__tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fish-manager__tools input[type=color]{width:42px;height:30px;padding:2px;border:1px solid var(--stroke);border-radius:8px;background:var(--surface-2)}.fish-manager__tools input[type=range]{width:120px;accent-color:var(--control)}',
        '.fish-manager__canvas-wrap{width:100%;min-height:360px;border:1px solid rgba(163,224,207,.18);border-radius:13px;overflow:hidden;background:#073936;box-shadow:inset 0 0 46px rgba(0,15,14,.44);touch-action:none}.fish-manager__canvas{display:block;width:100%;height:auto;min-height:360px;cursor:crosshair}.fish-manager__board-note{margin:8px 0 0;color:var(--muted);font-size:12.5px}.fish-manager__actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}',
        '.fish-manager__list{display:grid;gap:9px;max-height:calc(100vh - 150px);overflow:auto;padding-right:2px}.fish-manager__empty{display:grid;place-items:center;min-height:280px;color:var(--muted);text-align:center;white-space:pre-line}.fish-manager__fish{padding:12px;border:1px solid rgba(222,255,246,.08);border-radius:11px;background:rgba(217,255,244,.06)}.fish-manager__fish-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.fish-manager__fish-name{font-weight:700}.fish-manager__fish-kind{color:var(--muted);font-size:12.5px}.fish-manager__favorite{border:0;background:transparent;color:rgba(255,255,255,.55);font-size:20px;cursor:pointer}.fish-manager__favorite[aria-pressed=true]{color:var(--accent)}',
        '.fish-manager__stats{display:grid;gap:7px;margin-top:10px}.fish-manager__stat{display:grid;grid-template-columns:58px 1fr 48px;align-items:center;gap:8px}.fish-manager__track{height:11px;border-radius:999px;background:var(--track);overflow:hidden}.fish-manager__fill{height:100%;border-radius:999px;background:var(--accent)}.fish-manager__value{text-align:right;color:var(--accent);font-variant-numeric:tabular-nums}.fish-manager__fish-actions{display:flex;justify-content:flex-end;margin-top:8px}.fish-manager__status{min-height:20px;margin:8px 0 0;color:var(--muted);font-size:12.5px}',
        '@media(max-width:900px){.fish-manager{inset:8px}.fish-manager__panel{width:calc(100vw - 16px);max-height:calc(100vh - 16px);padding:12px}.fish-manager__layout{grid-template-columns:1fr;grid-template-rows:auto}.fish-manager__editor-card,.fish-manager__list-card,.fish-manager__board-card{grid-column:1;grid-row:auto}.fish-manager__list-card{order:3}.fish-manager__form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fish-manager__canvas-wrap,.fish-manager__canvas{min-height:260px}.fish-manager__list{max-height:460px}}'
    ].join('\n');
    document.head.appendChild(style);
}

export function createFishManager({ Koi, koiType, kois, config, viewport, spawnRipple, repository }) {
    addStyles();
    const breedById = new Map(koiType.breeds.map(breed => [breed.id, breed]));
    let definitions = [];
    let storeUserManaged = false;
    const fishById = new Map();
    let previewFish = null;
    let previewTransform = null;
    let boardWaveTime = 0;
    let statsElapsed = 0;
    let saveElapsed = 0;

    class UserFish extends Koi {
        constructor(definition) {
            super(koiType, { custom: true, origin: 'custom' });
            this.custom = true;
            this.onEat = () => {
                this.hunger = clamp(this.hunger + 24, 0, 100);
                this.mood = clamp(this.mood + 10, 0, 100);
            };
            this.applyDefinition(definition);
        }

        applyDefinition(definition) {
            const breed = breedById.get(definition.breedId) || koiType.breeds[0];
            this.breedId = breed.id;
            this.breed = breed.name;
            this.breedSize = breed.size || 1;
            this.net = breed.net || 0;
            this.sheen = breed.sheen || 0;
            this.kuchi = breed.kuchi || null;
            this.edge = breed.edge || null;
            this.outlineWidth = breed.outlineWidth ?? 0.10;
            this.spotRanges = (breed.patches || []).flatMap(patch => {
                const segments = patch.segs || [];
                if (!segments.length) return [];
                return [[
                    Math.min(0.78, segments[0] / 11),
                    Math.min(0.78, (segments[segments.length - 1] + 1) / 11),
                    patch.color,
                    patch.pw || 0.5
                ]];
            });
            this.customId = definition.id;
            this.name = definition.name || breed.name;
            this.favorite = definition.favorite === true;
            this.hunger = clamp(definition.hunger ?? 100, 0, 100);
            this.mood = clamp(definition.mood ?? 100, 0, 100);
            this.color = /^#[0-9a-f]{6}$/i.test(definition.color) ? definition.color : breed.body;
            this.shape = KOI_SHAPE.clampShape(definition.shape || breed.shape);
            this.baseSizeMul = 0.52 + this.depth * 0.30;
            this.sizeMul = this.baseSizeMul * clamp(definition.size ?? breed.size ?? 1, 0.55, 1.65);
            this.baseSpeed = 0.4 + this.depth * 0.22;
            if (definition.skin && definition.skin !== this.skinSrc) {
                this.skinSrc = definition.skin;
                this.skinReady = false;
                const image = new Image();
                image.onload = () => {
                    this.skin = image;
                    this.skinReady = true;
                    this.noseColor = noseColorOf(image);
                    if (this === previewFish) renderBoard();
                };
                image.src = definition.skin;
            }
        }
    }

    function loadDefinitions() {
        const stored = repository.read(STORE_KEY, { list: [] });
        storeUserManaged = stored?.userManaged === true;
        definitions = Array.isArray(stored?.list)
            ? stored.list.filter(item => item && typeof item.id === 'string').slice(0, MAX_FISH)
            : [];
    }

    function saveDefinitions() {
        for (const definition of definitions) {
            const fish = fishById.get(definition.id);
            if (!fish) continue;
            definition.hunger = Math.round(fish.hunger * 10) / 10;
            definition.mood = Math.round(fish.mood * 10) / 10;
        }
        repository.write(STORE_KEY, {
            version: 2,
            initialized: true,
            userManaged: storeUserManaged,
            list: definitions
        });
    }

    function releaseFish(fish) {
        const x = viewport.width * 0.5;
        const y = viewport.height * 0.5;
        fish.x = x;
        fish.y = y;
        for (const segment of fish.segments) { segment.x = x; segment.y = y; }
        fish.heading = Math.random() * Math.PI * 2;
        fish.angle = fish.heading;
        fish.speed = 0;
        fish.depth = Math.max(0.55, fish.depth);
        fish.drop = { t: 0, dur: 1.05, splashed: false };
        spawnRipple(x, y, 0.8 * config.rippleStrength);
    }

    function syncFish(releaseId = null) {
        const ids = new Set(definitions.map(definition => definition.id));
        for (let index = kois.length - 1; index >= 0; index--) {
            const fish = kois[index];
            if (fish.custom && !ids.has(fish.customId)) {
                kois.splice(index, 1);
                fishById.delete(fish.customId);
            }
        }
        for (const definition of definitions) {
            let fish = fishById.get(definition.id);
            if (!fish) {
                fish = new UserFish(definition);
                fishById.set(definition.id, fish);
                kois.push(fish);
                if (releaseId === definition.id) releaseFish(fish);
            } else {
                fish.applyDefinition(definition);
            }
        }
    }

    const shell = document.createElement('aside');
    shell.className = 'fish-manager';
    shell.innerHTML = [
        '<button class="fish-manager__toggle" type="button" hidden>🐟 我的鱼</button>',
        '<section class="fish-manager__panel" aria-label="鱼设置">',
        '<header class="fish-manager__header"><div><h1 class="fish-manager__title">🐟 鱼设置</h1><p class="fish-manager__hint">池塘只显示你添加的鱼，外观与状态自动保存到本地数据库</p></div><button class="fish-manager__close" type="button">收起</button></header>',
        '<div class="fish-manager__layout">',
        '<section class="fish-manager__card fish-manager__editor-card"><h2 class="fish-manager__section-title">加入一只鱼</h2><div class="fish-manager__form-grid">',
        '<div class="fish-manager__field"><label>名字</label><input data-name maxlength="16" placeholder="给它起个名字"></div>',
        '<div class="fish-manager__field"><label>鱼种</label><select data-breed></select></div>',
        '<div class="fish-manager__field"><label>身体颜色</label><input data-color type="color"></div>',
        '<div class="fish-manager__field"><label>整体大小 <span class="fish-manager__range-value" data-value="size"></span></label><input data-shape="size" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>身体长度 <span class="fish-manager__range-value" data-value="bodyLen"></span></label><input data-shape="bodyLen" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>身体宽度 <span class="fish-manager__range-value" data-value="bodyH"></span></label><input data-shape="bodyH" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>头部宽度 <span class="fish-manager__range-value" data-value="headW"></span></label><input data-shape="headW" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '<div class="fish-manager__field"><label>尾鳍大小 <span class="fish-manager__range-value" data-value="tailFin"></span></label><input data-shape="tailFin" type="range" min="0.55" max="1.65" step="0.05"></div>',
        '</div></section>',
        '<section class="fish-manager__card fish-manager__list-card"><h2 class="fish-manager__section-title">我的鱼</h2><div class="fish-manager__list" data-list></div></section>',
        '<section class="fish-manager__card fish-manager__board-card">',
        '<div class="fish-manager__board-head"><div><h2 class="fish-manager__section-title">🎨 大画板</h2><span class="fish-manager__hint">直接在鱼身上手绘图案</span></div><div class="fish-manager__tools"><label>画笔</label><input data-brush-color type="color" value="#d94f28"><label>粗细</label><input data-brush-size type="range" min="3" max="48" value="18"><button class="fish-manager__button" data-clear type="button">清空图案</button></div></div>',
        '<div class="fish-manager__canvas-wrap"><canvas class="fish-manager__canvas" data-board width="720" height="320"></canvas></div>',
        '<p class="fish-manager__board-note">画板会按鱼的身体轮廓裁切；空白区域使用上方选择的身体颜色。</p>',
        '<div class="fish-manager__actions"><button class="fish-manager__button fish-manager__button--primary" data-add type="button">加入池塘</button></div>',
        '<p class="fish-manager__status" data-status role="status"></p>',
        '</section></div></section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.fish-manager__panel');
    const toggle = shell.querySelector('.fish-manager__toggle');
    const nameInput = shell.querySelector('[data-name]');
    const breedInput = shell.querySelector('[data-breed]');
    const colorInput = shell.querySelector('[data-color]');
    const list = shell.querySelector('[data-list]');
    const status = shell.querySelector('[data-status]');
    const brushColor = shell.querySelector('[data-brush-color]');
    const brushSize = shell.querySelector('[data-brush-size]');
    const shapeInputs = Array.from(shell.querySelectorAll('[data-shape]'));
    const board = shell.querySelector('[data-board]');
    const boardContext = board.getContext('2d');
    const paint = document.createElement('canvas');
    paint.width = BOARD_W;
    paint.height = BOARD_H;
    const paintContext = paint.getContext('2d');
    let drawing = false;

    function randomBreed() {
        const total = koiType.breeds.reduce((sum, breed) => sum + (breed.w || 1), 0);
        let cursor = Math.random() * total;
        for (const breed of koiType.breeds) {
            cursor -= breed.w || 1;
            if (cursor <= 0) return breed;
        }
        return koiType.breeds[0];
    }

    function randomShape(breed) {
        const shape = { ...breed.shape };
        for (const key of ['bodyLen', 'bodyH', 'headW', 'tailFin']) {
            shape[key] = clamp((breed.shape?.[key] || 1) * (0.86 + Math.random() * 0.28), 0.55, 1.65);
        }
        return shape;
    }

    function randomSkin(color) {
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_W;
        canvas.height = BOARD_H;
        const context = canvas.getContext('2d');
        context.fillStyle = color;
        context.fillRect(0, 0, BOARD_W, BOARD_H);

        const accent = randomItem(INITIAL_COLOR_PALETTE);
        const shadow = randomItem(INITIAL_COLOR_PALETTE);
        const pattern = Math.floor(Math.random() * 3);
        context.save();
        context.globalAlpha = 0.42;
        context.strokeStyle = accent;
        context.fillStyle = accent;
        if (pattern === 0) {
            for (let index = 0; index < 7; index++) {
                const x = 45 + Math.random() * 625;
                const y = 42 + Math.random() * 236;
                context.beginPath();
                context.ellipse(x, y, 18 + Math.random() * 34, 9 + Math.random() * 20, Math.random() * Math.PI, 0, Math.PI * 2);
                context.fill();
            }
        } else if (pattern === 1) {
            context.lineWidth = 9 + Math.random() * 10;
            for (let index = 0; index < 5; index++) {
                const x = 60 + index * 145 + Math.random() * 38;
                context.beginPath();
                context.moveTo(x, 24);
                context.quadraticCurveTo(x - 42, 160, x + 16, 296);
                context.stroke();
            }
        } else {
            context.lineWidth = 3;
            for (let index = 0; index < 18; index++) {
                const x = 28 + Math.random() * 664;
                const y = 35 + Math.random() * 250;
                context.beginPath();
                context.arc(x, y, 8 + Math.random() * 13, Math.PI * 0.12, Math.PI * 0.88);
                context.stroke();
            }
        }
        context.globalAlpha = 0.18;
        context.fillStyle = shadow;
        context.fillRect(0, 0, BOARD_W, 18 + Math.random() * 18);
        context.restore();
        return canvas.toDataURL('image/png');
    }

    function createInitialDefinitions() {
        const colors = [];
        const sameColorProbability = clamp(
            config.initialSameColorProbability ?? INITIAL_SAME_COLOR_PROBABILITY,
            0,
            1
        );
        return Array.from({ length: INITIAL_FISH_COUNT }, (_, index) => {
            const breed = randomBreed();
            const reuseColor = colors.length > 0 && Math.random() < sameColorProbability;
            let color = reuseColor ? randomItem(colors) : randomItem(INITIAL_COLOR_PALETTE);
            if (!reuseColor && colors.length) {
                let attempts = 0;
                while (colors.includes(color) && attempts++ < 8) color = randomItem(INITIAL_COLOR_PALETTE);
            }
            colors.push(color);
            const shape = randomShape(breed);
            return {
                id: makeId(),
                name: breed.name + (index + 1),
                breedId: breed.id,
                color,
                size: clamp((breed.size || 1) * (0.76 + Math.random() * 0.48), 0.55, 1.65),
                shape,
                skin: randomSkin(color),
                hunger: 100,
                mood: 100,
                favorite: false,
                createdAt: Date.now() + index
            };
        });
    }

    for (const breed of koiType.breeds) {
        const option = document.createElement('option');
        option.value = breed.id;
        option.textContent = breed.name;
        breedInput.appendChild(option);
    }

    const selectedBreed = () => breedById.get(breedInput.value) || koiType.breeds[0];
    const input = key => shell.querySelector('[data-shape="' + key + '"]');

    function updateRangeLabels() {
        for (const item of shapeInputs) {
            shell.querySelector('[data-value="' + item.dataset.shape + '"]').textContent = Number(item.value).toFixed(2);
        }
    }

    function applyBreedDefaults(clearPaint = false) {
        const breed = selectedBreed();
        colorInput.value = breed.body;
        input('size').value = clamp(breed.size || 1, 0.55, 1.65);
        for (const key of ['bodyLen', 'bodyH', 'headW', 'tailFin']) {
            input(key).value = clamp(breed.shape?.[key] || 1, 0.55, 1.65);
        }
        if (clearPaint) paintContext.clearRect(0, 0, BOARD_W, BOARD_H);
        updateRangeLabels();
        renderBoard();
    }

    function drawBoardBackground() {
        const sourceX = 340;
        const sourceY = 158;
        const gradient = boardContext.createRadialGradient(sourceX, 148, 30, sourceX, 148, 430);
        gradient.addColorStop(0, '#0f5e58');
        gradient.addColorStop(0.58, '#0a4a46');
        gradient.addColorStop(1, '#052f2d');
        boardContext.fillStyle = gradient;
        boardContext.fillRect(0, 0, BOARD_W, BOARD_H);

        // Soft, continuous ripples travel out from a quiet source under the fish.
        // Each ring has its own phase so the water never reads as a static target.
        boardContext.save();
        boardContext.globalCompositeOperation = 'screen';
        const cycle = 360;
        const travel = boardWaveTime * 48;
        for (let index = 0; index < 5; index++) {
            const progress = ((travel + index * 74) % cycle) / cycle;
            const radius = 26 + progress * 420;
            const fade = Math.pow(1 - progress, 1.35);
            const alpha = 0.18 * fade;
            boardContext.lineWidth = 1.1 + fade * 1.8;
            boardContext.strokeStyle = `rgba(168,235,216,${alpha})`;
            boardContext.beginPath();
            boardContext.arc(sourceX, sourceY, radius, 0, Math.PI * 2);
            boardContext.stroke();

            // A short displaced highlight gives each ring a soft crest instead of
            // a perfectly uniform vector circle.
            boardContext.lineWidth = 0.8 + fade * 1.1;
            boardContext.strokeStyle = `rgba(218,255,240,${alpha * 0.72})`;
            boardContext.beginPath();
            boardContext.arc(
                sourceX - 2,
                sourceY - 1,
                radius + 2.5,
                -Math.PI * 0.82 + progress * 0.28,
                -Math.PI * 0.18 + progress * 0.28
            );
            boardContext.stroke();
        }

        // The source is deliberately subtle: it anchors the wave field without
        // competing with the fish preview.
        const sourceGlow = boardContext.createRadialGradient(sourceX, sourceY, 0, sourceX, sourceY, 38);
        sourceGlow.addColorStop(0, 'rgba(206,255,239,.13)');
        sourceGlow.addColorStop(1, 'rgba(206,255,239,0)');
        boardContext.fillStyle = sourceGlow;
        boardContext.beginPath();
        boardContext.arc(sourceX, sourceY, 38, 0, Math.PI * 2);
        boardContext.fill();
        boardContext.restore();
    }

    function previewDefinition() {
        const breed = selectedBreed();
        return {
            id: 'preview',
            name: nameInput.value.trim() || breed.name,
            breedId: breed.id,
            color: colorInput.value,
            size: Number(input('size').value),
            shape: {
                ...breed.shape,
                bodyLen: Number(input('bodyLen').value),
                bodyH: Number(input('bodyH').value),
                headW: Number(input('headW').value),
                tailFin: Number(input('tailFin').value)
            },
            skin: null,
            hunger: 100,
            mood: 100,
            favorite: false
        };
    }

    function preparePreviewFish() {
        if (!previewFish) previewFish = new UserFish(previewDefinition());
        else previewFish.applyDefinition(previewDefinition());

        const size = Number(input('size').value);
        previewFish.depth = 1;
        previewFish.baseSizeMul = 0.82;
        previewFish.sizeMul = previewFish.baseSizeMul * size;
        const spacing = config.fishSize * previewFish.sizeMul * koiType.segmentSpacing;
        for (let index = 0; index < previewFish.numSegments; index++) {
            previewFish.segments[index].x = index * spacing;
            previewFish.segments[index].y = 0;
        }
        previewFish.x = 0;
        previewFish.y = 0;
        previewFish.drop = null;
        previewFish.speed = 0;
        previewFish.angle = 0;
        previewFish.heading = 0;
        previewFish.skin = paint;
        previewFish.skinReady = true;
        previewFish.skinSrc = null;
        previewFish.noseColor = colorInput.value;

        const total = spacing * (previewFish.numSegments - 1);
        // The editor preview is intentionally calmer than the pond animation.
        // Keep the shared renderer, but reduce the spine wave and fin swing for a clear drawing target.
        previewFish.waveEnv = total * 0.040;
        previewFish.previewMotion = true;
        const bodySpan = total * 0.78 * previewFish.shape.bodyLen;
        const maxHalf = total * 0.78 * 0.168 * previewFish.shape.bodyH;
        const noseDepth = KOI_SHAPE.shapeWidth(KOI_SHAPE.FRONT, previewFish.shape) * maxHalf * 0.95;
        const tailLength = KOI_SHAPE.tailFinLen(maxHalf, previewFish.shape);
        const width = noseDepth + bodySpan + tailLength;
        const height = maxHalf * 3.1;
        const scale = Math.min((BOARD_W - 84) / Math.max(1, width), (BOARD_H - 48) / Math.max(1, height));
        previewTransform = {
            scale,
            x: (BOARD_W - width * scale) / 2 + noseDepth * scale,
            y: BODY_CENTER,
            total,
            bodySpan,
            maxHalf
        };
        return previewFish;
    }

    function renderBoard() {
        drawBoardBackground();
        const fish = preparePreviewFish();
        boardContext.save();
        boardContext.translate(previewTransform.x, previewTransform.y);
        boardContext.scale(previewTransform.scale, previewTransform.scale);
        fish.draw(boardContext);
        boardContext.restore();
    }

    function exportSkin() {
        const canvas = document.createElement('canvas');
        canvas.width = BOARD_W;
        canvas.height = BOARD_H;
        const context = canvas.getContext('2d');
        context.fillStyle = colorInput.value;
        context.fillRect(0, 0, BOARD_W, BOARD_H);
        context.drawImage(paint, 0, 0);
        return canvas.toDataURL('image/png');
    }

    function boardPoint(event) {
        const bounds = board.getBoundingClientRect();
        const fish = preparePreviewFish();
        const screenX = (event.clientX - bounds.left) * BOARD_W / bounds.width;
        const screenY = (event.clientY - bounds.top) * BOARD_H / bounds.height;
        const pointX = (screenX - previewTransform.x) / previewTransform.scale;
        const pointY = (screenY - previewTransform.y) / previewTransform.scale;
        const total = previewTransform.total;
        const bodySpan = 0.78 * fish.shape.bodyLen;
        const bodyPosition = pointX / Math.max(1, total * bodySpan);
        const maxHalf = previewTransform.maxHalf;
        const localHalf = KOI_SHAPE.shapeWidth(bodyPosition, fish.shape) * maxHalf;
        const spinePosition = bodyPosition * bodySpan;
        const waveOffset = Math.sin(
            fish.swimCycle * fish.waveFreq - spinePosition * fish.waveLen
        ) * fish.waveEnv * spinePosition * spinePosition;
        return {
            x: clamp(KOI_SHAPE.uAtBw(bodyPosition) * BOARD_W, 0, BOARD_W),
            y: clamp((pointY - waveOffset + localHalf) / Math.max(1, localHalf * 2) * BOARD_H, 0, BOARD_H),
            inside: bodyPosition >= KOI_SHAPE.FRONT && bodyPosition <= 1
                && Math.abs(pointY - waveOffset) <= localHalf
        };
    }

    function beginDrawing(event) {
        const point = boardPoint(event);
        if (!point.inside) return;
        drawing = true;
        board.setPointerCapture(event.pointerId);
        paintContext.beginPath();
        paintContext.moveTo(point.x, point.y);
    }

    function continueDrawing(event) {
        if (!drawing) return;
        const point = boardPoint(event);
        if (!point.inside) {
            paintContext.beginPath();
            return;
        }
        paintContext.lineCap = 'round';
        paintContext.lineJoin = 'round';
        paintContext.strokeStyle = brushColor.value;
        paintContext.lineWidth = Number(brushSize.value);
        paintContext.lineTo(point.x, point.y);
        paintContext.stroke();
        renderBoard();
    }

    function addStat(container, label, value, displayedValue = Math.round(value) + '%') {
        const row = document.createElement('div');
        row.className = 'fish-manager__stat';
        const title = document.createElement('span');
        title.textContent = label;
        const track = document.createElement('div');
        track.className = 'fish-manager__track';
        const fill = document.createElement('div');
        fill.className = 'fish-manager__fill';
        fill.style.width = clamp(value, 0, 100) + '%';
        track.appendChild(fill);
        const number = document.createElement('span');
        number.className = 'fish-manager__value';
        number.textContent = displayedValue;
        row.append(title, track, number);
        container.appendChild(row);
    }

    function moodEmoji(value) {
        return value >= 75 ? '😊' : value >= 45 ? '🙂' : value >= 20 ? '😕' : '😢';
    }

    function renderList() {
        list.replaceChildren();
        if (!definitions.length) {
            const empty = document.createElement('div');
            empty.className = 'fish-manager__empty';
            empty.textContent = '池塘现在是空的。\n设计并加入第一只鱼。';
            list.appendChild(empty);
            return;
        }
        const ordered = [...definitions].sort((a, b) => Number(b.favorite) - Number(a.favorite));
        for (const definition of ordered) {
            const fish = fishById.get(definition.id);
            const card = document.createElement('article');
            card.className = 'fish-manager__fish';
            const header = document.createElement('div');
            header.className = 'fish-manager__fish-head';
            const identity = document.createElement('div');
            const fishName = document.createElement('div');
            fishName.className = 'fish-manager__fish-name';
            fishName.textContent = definition.name;
            const kind = document.createElement('div');
            kind.className = 'fish-manager__fish-kind';
            kind.textContent = (breedById.get(definition.breedId)?.name || '淡水鱼') + ' · ' + definition.name;
            identity.append(fishName, kind);
            const favorite = document.createElement('button');
            favorite.className = 'fish-manager__favorite';
            favorite.type = 'button';
            favorite.textContent = '★';
            favorite.setAttribute('aria-label', '收藏');
            favorite.setAttribute('aria-pressed', String(definition.favorite === true));
            favorite.addEventListener('click', () => {
                definition.favorite = !definition.favorite;
                if (fish) fish.favorite = definition.favorite;
                storeUserManaged = true;
                saveDefinitions();
                renderList();
            });
            header.append(identity, favorite);
            card.appendChild(header);

            const stats = document.createElement('div');
            stats.className = 'fish-manager__stats';
            const hunger = fish?.hunger ?? definition.hunger ?? 100;
            const mood = fish?.mood ?? definition.mood ?? 100;
            const speed = Math.max(0, Number(fish?.speed) || 0) * 60;
            addStat(stats, '饱食度', hunger);
            addStat(stats, '心情 ' + moodEmoji(mood), mood);
            addStat(stats, '游速', Math.min(100, speed / 2.2), speed.toFixed(1));
            card.appendChild(stats);

            const actions = document.createElement('div');
            actions.className = 'fish-manager__fish-actions';
            const remove = document.createElement('button');
            remove.className = 'fish-manager__button fish-manager__button--danger';
            remove.type = 'button';
            remove.textContent = '删除';
            remove.addEventListener('click', () => {
                definitions = definitions.filter(item => item.id !== definition.id);
                storeUserManaged = true;
                saveDefinitions();
                syncFish();
                renderList();
                status.textContent = '已从池塘删除“' + definition.name + '”';
            });
            actions.appendChild(remove);
            card.appendChild(actions);
            list.appendChild(card);
        }
    }

    function addFish() {
        if (definitions.length >= MAX_FISH) {
            status.textContent = '最多可以添加 ' + MAX_FISH + ' 只鱼';
            return;
        }
        const breed = selectedBreed();
        const name = nameInput.value.trim() || breed.name + (definitions.length + 1);
        const definition = {
            id: makeId(),
            name,
            breedId: breed.id,
            color: colorInput.value,
            size: Number(input('size').value),
            shape: {
                ...breed.shape,
                bodyLen: Number(input('bodyLen').value),
                bodyH: Number(input('bodyH').value),
                headW: Number(input('headW').value),
                tailFin: Number(input('tailFin').value)
            },
            skin: exportSkin(),
            hunger: 100,
            mood: 100,
            favorite: false,
            createdAt: Date.now()
        };
        definitions.push(definition);
        storeUserManaged = true;
        saveDefinitions();
        syncFish(definition.id);
        renderList();
        nameInput.value = '';
        status.textContent = '“' + name + '”已经加入池塘并保存';
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        if (open) renderBoard();
    }

    breedInput.addEventListener('change', () => applyBreedDefaults(false));
    colorInput.addEventListener('input', renderBoard);
    for (const shapeInput of shapeInputs) {
        shapeInput.addEventListener('input', () => { updateRangeLabels(); renderBoard(); });
    }
    board.addEventListener('pointerdown', beginDrawing);
    board.addEventListener('pointermove', continueDrawing);
    board.addEventListener('pointerup', () => { drawing = false; });
    board.addEventListener('pointercancel', () => { drawing = false; });
    shell.querySelector('[data-clear]').addEventListener('click', () => {
        paintContext.clearRect(0, 0, BOARD_W, BOARD_H);
        renderBoard();
    });
    shell.querySelector('[data-add]').addEventListener('click', addFish);
    shell.querySelector('.fish-manager__close').addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));

    loadDefinitions();
    if (!definitions.length && !storeUserManaged) {
        definitions = createInitialDefinitions();
        saveDefinitions();
    }
    syncFish();
    applyBreedDefaults(true);
    renderList();
    status.textContent = definitions.length
        ? '已从本地数据库恢复 ' + definitions.length + ' 只鱼'
        : '池塘已清空，请添加第一只鱼';

    return {
        loadCustomFishFromStore() { loadDefinitions(); syncFish(); renderList(); },
        syncCustomFish: syncFish,
        update(dt) {
            statsElapsed += dt;
            saveElapsed += dt;
            if (!panel.hidden) boardWaveTime += dt;
            if (previewFish && !panel.hidden) {
                if (!drawing) previewFish.swimCycle += 2.65 * dt;
                renderBoard();
            }
            if (statsElapsed >= 1) {
                statsElapsed = 0;
                for (const fish of fishById.values()) {
                    fish.hunger = clamp(fish.hunger - 0.02, 0, 100);
                    const targetMood = 30 + fish.hunger * 0.7;
                    fish.mood = clamp(fish.mood + (targetMood - fish.mood) * 0.025, 0, 100);
                }
                renderList();
            }
            if (saveElapsed >= 5) {
                saveElapsed = 0;
                saveDefinitions();
            }
        },
        dispose() {
            saveDefinitions();
            previewFish = null;
            shell.remove();
            for (let index = kois.length - 1; index >= 0; index--) {
                if (kois[index].custom) kois.splice(index, 1);
            }
            fishById.clear();
        }
    };
}
