import { THEME } from '../shared/legacy-assets.js';

import { ensureIconStyles, icon, iconLabel, setAnimatedVisibility } from './icons.js';

const STORE_KEY = 'koi.debug.clock.v1';

function addStyles() {
    if (document.getElementById('clock-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'clock-debug-panel-styles';
    style.textContent = [
        '.clock-debug{position:fixed;top:16px;left:352px;z-index:22;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.clock-debug:not(.clock-debug--embedded){top:50%;left:50%;transform:translate(-50%,-50%)}',
        '.clock-debug *{box-sizing:border-box}',
        '.clock-debug button,.clock-debug input,.clock-debug select,.clock-debug textarea{font:inherit}',
        '.clock-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.94);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.clock-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:14px;background:rgba(6,22,21,.95);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(14px) saturate(115%);scrollbar-color:#4c8d79 #0a201e;scrollbar-width:thin}',
        '.clock-debug__panel[hidden],.clock-debug__toggle[hidden]{display:none}',
        '.clock-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.clock-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.clock-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.clock-debug__close{width:34px;height:34px;padding:0;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.clock-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.clock-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.clock-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.clock-debug__field:last-child{margin-bottom:0}',
        '.clock-debug__field label{color:#dcece6}',
        '.clock-debug__value{min-width:52px;text-align:right;color:var(--pond-ui-primary);font-variant-numeric:tabular-nums}',
        '.clock-debug__field input[type="range"]{grid-column:1/-1;width:100%;margin:0;accent-color:var(--pond-ui-primary)}',
        '.clock-debug__field input[type="color"]{width:48px;height:30px;padding:2px;border:1px solid rgba(208,235,225,.25);border-radius:7px;background:#102b28;cursor:pointer}',
        '.clock-debug__field input[type="checkbox"]{appearance:none;-webkit-appearance:none;position:relative;width:42px;height:24px;margin:0;border:1px solid rgba(208,235,225,.28);border-radius:999px;background:rgba(218,244,236,.12);box-shadow:inset 0 1px 3px rgba(0,20,18,.24);cursor:pointer;transition:background-color 160ms ease-out,border-color 160ms ease-out,box-shadow 160ms ease-out}',
        '.clock-debug__field input[type="checkbox"]::after{content:"";position:absolute;left:3px;top:3px;width:16px;height:16px;border-radius:50%;background:rgba(238,250,246,.82);box-shadow:0 2px 5px rgba(0,20,18,.34);transition:transform 180ms cubic-bezier(.2,.8,.2,1),background-color 160ms ease-out}',
        '.clock-debug__field input[type="checkbox"]:hover{border-color:var(--pond-ui-primary-border);background:var(--pond-ui-primary-soft)}',
        '.clock-debug__field input[type="checkbox"]:checked{border-color:var(--pond-ui-primary);background:var(--pond-ui-primary);box-shadow:inset 0 1px 3px rgba(0,45,39,.22)}',
        '.clock-debug__field input[type="checkbox"]:checked::after{transform:translateX(18px);background:var(--pond-ui-primary-ink)}',
        '.clock-debug__field input[type="checkbox"]:disabled{opacity:.45;cursor:not-allowed}',
        '.clock-debug__palettes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:2px 0 14px}',
        '.clock-debug__palette{display:grid;grid-template-columns:28px 1fr 16px;align-items:center;gap:8px;min-height:42px;padding:6px 8px;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#102b28;color:#dcece6;text-align:left;cursor:pointer}',
        '.clock-debug__palette[aria-pressed="true"]{border-color:#8bdbc0;box-shadow:0 0 0 2px rgba(139,219,192,.20)}',
        '.clock-debug__palette-swatch{position:relative;width:28px;height:28px;border:1px solid rgba(255,255,255,.42);border-radius:7px;background:var(--palette-bg);box-shadow:inset 0 1px rgba(255,255,255,.35)}',
        '.clock-debug__palette-swatch::after{content:"Aa";position:absolute;inset:0;display:grid;place-items:center;color:var(--palette-fg);font:700 10px/1 system-ui,sans-serif}',
        '.clock-debug__palette-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}',
        '.clock-debug__palette-mark{opacity:0;color:var(--pond-ui-primary)}.clock-debug__palette[aria-pressed="true"] .clock-debug__palette-mark{opacity:1}',
        '.clock-debug__select{grid-column:1/-1;width:100%;height:38px;padding:0 10px;border:1px solid rgba(208,235,225,.24);border-radius:8px;background:#102b28;color:#eef8f4}',
        '.clock-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.clock-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.clock-debug__button--primary{border-color:var(--pond-ui-primary);background:var(--pond-ui-primary);color:var(--pond-ui-primary-ink);font-weight:750}',
        '.clock-debug__output{width:100%;height:108px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;caret-color:#8fe0c3}',
        '.clock-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.clock-debug button:hover{filter:brightness(1.08)}',
        '.clock-debug button:focus-visible,.clock-debug input:focus-visible,.clock-debug select:focus-visible,.clock-debug textarea:focus-visible{outline:3px solid var(--pond-ui-focus);outline-offset:2px}',
        '@media(max-width:900px){.clock-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}}',
        '@media(prefers-reduced-motion:reduce){.clock-debug__field input[type="checkbox"],.clock-debug__field input[type="checkbox"]::after{transition:none}}',
        '@media(prefers-reduced-transparency:reduce){.clock-debug__panel,.clock-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, label, min, max, step, value) {
    return '<div class="clock-debug__field"><label for="clock-debug-' + key + '">' + label + '</label>' +
        '<output class="clock-debug__value" data-output="' + key + '"></output>' +
        '<input id="clock-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></div>';
}

function parseColor(value) {
    const text = String(value);
    if (/^#[0-9a-f]{6}$/i.test(text)) return { hex: text, alpha: 1 };
    const start = text.indexOf('('), end = text.indexOf(')');
    if (start < 0 || end < start) return { hex: '#f4fcf8', alpha: 1 };
    const parts = text.slice(start + 1, end).split(',').map(Number);
    if (parts.length < 3 || parts.some(value => !Number.isFinite(value))) return { hex: '#f4fcf8', alpha: 1 };
    const hex = '#' + parts.slice(0, 3).map(value => Math.round(value).toString(16).padStart(2, '0')).join('');
    return { hex, alpha: parts.length > 3 ? parts[3] : 1 };
}

function rgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha.toFixed(3) + ')';
}

export function createClockDebugPanel({ repository, embedded = false }) {
    ensureIconStyles();
    addStyles();
    const T = THEME.clock;
    const parsed = parseColor(T.color);
    let colorHex = parsed.hex;
    let colorAlpha = parsed.alpha;
    const cardTextParsed = parseColor(T.cardTextColor);
    let cardTextHex = cardTextParsed.hex;
    let cardTextAlpha = cardTextParsed.alpha;
    let cardTintHex = parseColor(T.cardTint || '#d7e2d1').hex;
    const fonts = {
        yahei: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        system: 'system-ui, sans-serif',
        serif: 'Georgia, "Times New Roman", serif',
        mono: 'Consolas, "SFMono-Regular", monospace'
    };
    const palettes = [
        { id: 'lotus-mist', name: '荷叶雾', bg: '#d7e2d1', text: '#1a433b' },
        { id: 'moon-water', name: '月光水', bg: '#dbe9e9', text: '#234c55' },
        { id: 'warm-jade', name: '暖玉', bg: '#eadfc8', text: '#5a4431' },
        { id: 'lotus-pink', name: '莲粉', bg: '#ead9dc', text: '#64404a' },
        { id: 'deep-pond', name: '深潭', bg: '#31534d', text: '#f0f5e9' },
        { id: 'night-blue', name: '夜蓝', bg: '#354b5f', text: '#f2f7f5' }
    ];
    const paletteMarkup = palettes.map(palette =>
        '<button class="clock-debug__palette" type="button" data-palette="' + palette.id + '" aria-pressed="false" style="--palette-bg:' + palette.bg + ';--palette-fg:' + palette.text + '">' +
        '<span class="clock-debug__palette-swatch" aria-hidden="true"></span><span class="clock-debug__palette-name">' + palette.name + '</span><span class="clock-debug__palette-mark" aria-hidden="true">' + icon('check') + '</span></button>'
    ).join('');
    let fontId = Object.keys(fonts).find(key => fonts[key] === T.font) || 'yahei';
    const fields = {
        timeSize: { label: '时间大小', min: 0.03, max: 0.15, step: 0.005, get: () => T.timeSize, set: v => { T.timeSize = v; } },
        dateSize: { label: '日期比例', min: 0.2, max: 0.8, step: 0.01, get: () => T.dateSize, set: v => { T.dateSize = v; } },
        marginX: { label: '水平边距', min: 0, max: 0.2, step: 0.005, get: () => T.marginX, set: v => { T.marginX = v; } },
        marginY: { label: '垂直边距', min: 0, max: 0.25, step: 0.005, get: () => T.marginY, set: v => { T.marginY = v; } },
        gap: { label: '时间日期间距', min: 0.05, max: 0.8, step: 0.01, get: () => T.gap, set: v => { T.gap = v; } },
        weight: { label: '字体粗细', min: 300, max: 800, step: 100, get: () => T.weight || 600, set: v => { T.weight = Math.round(v); } },
        opacity: { label: '普通字体透明度', min: 0.1, max: 1, step: 0.01, get: () => colorAlpha, set: v => { colorAlpha = v; T.color = rgba(colorHex, colorAlpha); } },
        dropletStrength: { label: '玻璃水滴质感', min: 0.2, max: 1.8, step: 0.05, get: () => T.dropletStrength ?? 0.3, set: v => { T.dropletStrength = v; } },
        cardOpacity: { label: '卡片透明度', min: 0.05, max: 0.8, step: 0.01, get: () => T.cardOpacity ?? 0.45, set: v => { T.cardOpacity = v; } },
        cardTextOpacity: { label: '卡片字体透明度', min: 0.1, max: 1, step: 0.01, get: () => cardTextAlpha, set: v => { cardTextAlpha = v; T.cardTextColor = rgba(cardTextHex, cardTextAlpha); } },
        cardBlur: { label: '背景模糊', min: 0, max: 0.04, step: 0.001, get: () => T.cardBlur ?? 0.012, set: v => { T.cardBlur = v; } },
        cardRadius: { label: '卡片圆角', min: 0.003, max: 0.06, step: 0.001, get: () => T.cardRadius ?? 0.022, set: v => { T.cardRadius = v; } },
        cardShadow: { label: '卡片阴影', min: 0, max: 0.7, step: 0.01, get: () => T.cardShadow ?? 0.34, set: v => { T.cardShadow = v; } },
        shadowAlpha: { label: '阴影强度', min: 0, max: 1, step: 0.01, get: () => T.shadowAlpha, set: v => { T.shadowAlpha = v; } },
        shadowBlur: { label: '阴影模糊', min: 0, max: 0.08, step: 0.001, get: () => T.shadowBlur, set: v => { T.shadowBlur = v; } },
        shadowOffset: { label: '阴影距离', min: 0, max: 0.04, step: 0.001, get: () => T.shadowOffset, set: v => { T.shadowOffset = v; } }
    };
    const original = {
        fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()])),
        show: T.show, anchor: T.anchor, colorHex, fontId,
        cardTextHex, cardTintHex,
        droplet: T.droplet === true, cardGlass: T.cardGlass === true,
        foreground: T.foreground === true
    };
    const saved = repository.read(STORE_KEY, null);
    if (saved && typeof saved === 'object') {
        if (/^#[0-9a-f]{6}$/i.test(saved.colorHex)) colorHex = saved.colorHex;
        if (/^#[0-9a-f]{6}$/i.test(saved.cardTextHex)) cardTextHex = saved.cardTextHex;
        if (/^#[0-9a-f]{6}$/i.test(saved.cardTintHex)) cardTintHex = saved.cardTintHex;
        if (Object.prototype.hasOwnProperty.call(fonts, saved.fontId)) fontId = saved.fontId;
        if (typeof saved.show === 'boolean') T.show = saved.show;
        if (typeof saved.foreground === 'boolean') T.foreground = saved.foreground;
        if (typeof saved.droplet === 'boolean') T.droplet = saved.droplet;
        if (typeof saved.cardGlass === 'boolean') T.cardGlass = saved.cardGlass;
        if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(saved.anchor)) T.anchor = saved.anchor;
        if (saved.fields && typeof saved.fields === 'object') {
            for (const [key, field] of Object.entries(fields)) {
                const value = Number(saved.fields[key]);
                if (Number.isFinite(value)) field.set(Math.max(field.min, Math.min(field.max, value)));
            }
        }
        T.font = fonts[fontId];
        T.color = rgba(colorHex, colorAlpha);
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardTint = cardTintHex;
    }
    const group = keys => keys.map(key => {
        const field = fields[key];
        return rangeField(key, field.label, field.min, field.max, field.step, field.get());
    }).join('');

    const shell = document.createElement('aside');
    shell.className = 'clock-debug';
    if (embedded) shell.classList.add('clock-debug--embedded');
    shell.setAttribute('aria-label', '时间显示样式调试工具');
    shell.innerHTML = [
        '<button class="clock-debug__toggle pond-icon-button" type="button" aria-expanded="true" hidden>' + iconLabel('clock', '时间样式') + '</button>',
        '<section class="clock-debug__panel">',
        '<header class="clock-debug__head"><div><h2 class="clock-debug__title">时间显示样式</h2><p class="clock-debug__hint">实时修改画面时钟</p></div><button class="clock-debug__close pond-icon-only" type="button" aria-label="收起时间样式面板" title="收起">' + icon('x', 'pond-icon pond-icon--18') + '</button></header>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">显示与位置</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-show">显示时间</label><input id="clock-debug-show" data-show type="checkbox"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-foreground">时间置于鱼上方</label><input id="clock-debug-foreground" data-foreground type="checkbox"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-anchor">位置</label><select id="clock-debug-anchor" class="clock-debug__select" data-anchor>' +
            '<option value="top-left">左上</option><option value="top-center">上方居中</option><option value="top-right">右上</option>' +
            '<option value="bottom-left">左下</option><option value="bottom-center">下方居中</option><option value="bottom-right">右下</option></select></div>',
        group(['marginX', 'marginY']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">文字</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-font">字体</label><select id="clock-debug-font" class="clock-debug__select" data-font>' +
            '<option value="yahei">微软雅黑</option><option value="system">系统字体</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option></select></div>',
        '<div class="clock-debug__field"><label for="clock-debug-color">文字颜色</label><input id="clock-debug-color" data-color type="color"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-droplet">水滴字体</label><input id="clock-debug-droplet" data-droplet type="checkbox"></div>',
        group(['dropletStrength', 'timeSize', 'dateSize', 'gap', 'weight', 'opacity']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">卡片毛玻璃</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-card-glass">开启毛玻璃卡片</label><input id="clock-debug-card-glass" data-card-glass type="checkbox"></div>',
        '<div class="clock-debug__palettes" role="group" aria-label="卡片配色预设">', paletteMarkup, '</div>',
        '<div class="clock-debug__field"><label for="clock-debug-card-tint">卡片色调</label><input id="clock-debug-card-tint" data-card-tint type="color"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-card-text-color">卡片字体颜色</label><input id="clock-debug-card-text-color" data-card-text-color type="color"></div>',
        group(['cardTextOpacity', 'cardOpacity', 'cardBlur', 'cardRadius', 'cardShadow']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">阴影</legend>',
        group(['shadowAlpha', 'shadowBlur', 'shadowOffset']), '</fieldset>',
        '<div class="clock-debug__actions"><button class="clock-debug__button pond-icon-button" type="button" data-reset>' + iconLabel('rotate-ccw', '恢复默认') + '</button><button class="clock-debug__button clock-debug__button--primary pond-icon-button" type="button" data-copy>' + iconLabel('copy', '复制参数') + '</button></div>',
        '<textarea class="clock-debug__output" readonly aria-label="当前时间样式参数"></textarea>',
        '<p class="clock-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.clock-debug__panel');
    const toggle = shell.querySelector('.clock-debug__toggle');
    const close = shell.querySelector('.clock-debug__close');
    const output = shell.querySelector('.clock-debug__output');
    const status = shell.querySelector('.clock-debug__status');
    const showInput = shell.querySelector('[data-show]');
    const foregroundInput = shell.querySelector('[data-foreground]');
    const anchorInput = shell.querySelector('[data-anchor]');
    const fontInput = shell.querySelector('[data-font]');
    const colorInput = shell.querySelector('[data-color]');
    const dropletInput = shell.querySelector('[data-droplet]');
    const cardGlassInput = shell.querySelector('[data-card-glass]');
    const cardTintInput = shell.querySelector('[data-card-tint]');
    const cardTextColorInput = shell.querySelector('[data-card-text-color]');
    const paletteButtons = Array.from(shell.querySelectorAll('[data-palette]'));
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    function format(key, value) {
        const step = fields[key].step;
        if (step >= 1) return String(Math.round(value));
        return Number(value).toFixed(step < 0.01 ? 3 : 2);
    }

    function refresh() {
        showInput.checked = T.show !== false;
        foregroundInput.checked = T.foreground === true;
        anchorInput.value = T.anchor;
        fontInput.value = fontId;
        colorInput.value = colorHex;
        dropletInput.checked = T.droplet === true;
        cardGlassInput.checked = T.cardGlass === true;
        cardTintInput.value = cardTintHex;
        cardTextColorInput.value = cardTextHex;
        for (const button of paletteButtons) {
            const palette = palettes.find(item => item.id === button.dataset.palette);
            button.setAttribute('aria-pressed', String(cardTintHex.toLowerCase() === palette.bg && cardTextHex.toLowerCase() === palette.text));
        }
        for (const input of inputs) {
            const key = input.dataset.key;
            input.value = fields[key].get();
            shell.querySelector('[data-output="' + key + '"]').value = format(key, fields[key].get());
        }
        output.value = JSON.stringify({
            show: T.show, foreground: T.foreground === true,
            anchor: T.anchor, marginX: T.marginX, marginY: T.marginY,
            timeSize: T.timeSize, dateSize: T.dateSize, gap: T.gap,
            color: T.color, font: T.font, weight: T.weight || 600,
            droplet: T.droplet === true, dropletStrength: T.dropletStrength,
            cardGlass: T.cardGlass === true,
            cardTint: T.cardTint, cardTextColor: T.cardTextColor,
            cardOpacity: T.cardOpacity, cardBlur: T.cardBlur,
            cardRadius: T.cardRadius, cardShadow: T.cardShadow,
            shadowAlpha: T.shadowAlpha, shadowBlur: T.shadowBlur, shadowOffset: T.shadowOffset
        }, null, 2);
    }

    function save() {
        repository.write(STORE_KEY, {
            fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()])),
            show: T.show !== false,
            foreground: T.foreground === true,
            anchor: T.anchor,
            fontId,
            colorHex,
            droplet: T.droplet === true,
            cardGlass: T.cardGlass === true,
            cardTintHex,
            cardTextHex
        });
    }

    function reset() {
        for (const [key, value] of Object.entries(original.fields)) fields[key].set(value);
        T.show = original.show;
        T.anchor = original.anchor;
        T.foreground = original.foreground;
        T.droplet = original.droplet;
        T.cardGlass = original.cardGlass;
        colorHex = original.colorHex;
        cardTextHex = original.cardTextHex;
        cardTintHex = original.cardTintHex;
        fontId = original.fontId;
        T.font = fonts[fontId];
        T.color = rgba(colorHex, colorAlpha);
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardTint = cardTintHex;
        refresh();
        save();
        status.textContent = '已恢复默认时间样式';
    }

    function copyParameters() {
        refresh();
        output.focus();
        output.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (_) {}
        status.textContent = copied ? '参数已复制到剪贴板' : '参数已选中，请按 Ctrl+C 复制';
    }

    function setOpen(open) {
        setAnimatedVisibility(panel, open);
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus(); else toggle.focus();
    }

    for (const input of inputs) input.addEventListener('input', () => {
        fields[input.dataset.key].set(Number(input.value));
        refresh();
        save();
        status.textContent = '时间样式已实时应用';
    });
    showInput.addEventListener('change', () => { T.show = showInput.checked; refresh(); save(); });
    foregroundInput.addEventListener('change', () => {
        T.foreground = foregroundInput.checked;
        refresh();
        save();
        status.textContent = foregroundInput.checked ? '时间已置于鱼群上方' : '鱼群可从时间上方游过';
    });
    anchorInput.addEventListener('change', () => { T.anchor = anchorInput.value; refresh(); save(); });
    fontInput.addEventListener('change', () => { fontId = fontInput.value; T.font = fonts[fontId]; refresh(); save(); });
    colorInput.addEventListener('input', () => { colorHex = colorInput.value; T.color = rgba(colorHex, colorAlpha); refresh(); save(); });
    dropletInput.addEventListener('change', () => {
        T.droplet = dropletInput.checked;
        refresh();
        save();
        status.textContent = dropletInput.checked ? '已开启水滴字体' : '已恢复普通字体';
    });
    cardGlassInput.addEventListener('change', () => {
        T.cardGlass = cardGlassInput.checked;
        refresh();
        save();
        status.textContent = cardGlassInput.checked ? '已开启卡片毛玻璃' : '已关闭卡片毛玻璃';
    });
    cardTintInput.addEventListener('input', () => {
        cardTintHex = cardTintInput.value;
        T.cardTint = cardTintHex;
        refresh();
        save();
    });
    cardTextColorInput.addEventListener('input', () => {
        cardTextHex = cardTextColorInput.value;
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        refresh();
        save();
    });
    for (const button of paletteButtons) button.addEventListener('click', () => {
        const palette = palettes.find(item => item.id === button.dataset.palette);
        cardTintHex = palette.bg;
        cardTextHex = palette.text;
        T.cardTint = cardTintHex;
        T.cardTextColor = rgba(cardTextHex, cardTextAlpha);
        T.cardGlass = true;
        refresh();
        save();
        status.textContent = '已应用「' + palette.name + '」配色';
    });
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    if (!embedded) {
        close.addEventListener('click', () => setOpen(false));
        toggle.addEventListener('click', () => setOpen(true));
    }
    refresh();
    status.textContent = saved ? '已恢复上次保存的时间样式' : '面板已就绪';

    return { element: shell, dispose() { shell.remove(); } };
}
