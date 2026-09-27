import { THEME } from '../shared/legacy-assets.js';

function addStyles() {
    if (document.getElementById('clock-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'clock-debug-panel-styles';
    style.textContent = [
        '.clock-debug{position:fixed;top:16px;left:352px;z-index:22;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.clock-debug *{box-sizing:border-box}',
        '.clock-debug button,.clock-debug input,.clock-debug select,.clock-debug textarea{font:inherit}',
        '.clock-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.94);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.clock-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:14px;background:rgba(6,22,21,.95);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(14px) saturate(115%);scrollbar-color:#4c8d79 #0a201e;scrollbar-width:thin}',
        '.clock-debug__panel[hidden],.clock-debug__toggle[hidden]{display:none}',
        '.clock-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.clock-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.clock-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.clock-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.clock-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.clock-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.clock-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.clock-debug__field:last-child{margin-bottom:0}',
        '.clock-debug__field label{color:#dcece6}',
        '.clock-debug__value{min-width:52px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.clock-debug__field input[type="range"]{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.clock-debug__field input[type="color"]{width:48px;height:30px;padding:2px;border:1px solid rgba(208,235,225,.25);border-radius:7px;background:#102b28;cursor:pointer}',
        '.clock-debug__field input[type="checkbox"]{width:18px;height:18px;accent-color:#76cdb0}',
        '.clock-debug__select{grid-column:1/-1;width:100%;height:38px;padding:0 10px;border:1px solid rgba(208,235,225,.24);border-radius:8px;background:#102b28;color:#eef8f4}',
        '.clock-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.clock-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.clock-debug__button--primary{border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.clock-debug__output{width:100%;height:108px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;caret-color:#8fe0c3}',
        '.clock-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.clock-debug button:hover{filter:brightness(1.08)}',
        '.clock-debug button:focus-visible,.clock-debug input:focus-visible,.clock-debug select:focus-visible,.clock-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:900px){.clock-debug{top:60px;left:10px}.clock-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 70px)}}',
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

export function createClockDebugPanel() {
    addStyles();
    const T = THEME.clock;
    const parsed = parseColor(T.color);
    let colorHex = parsed.hex;
    let colorAlpha = parsed.alpha;
    const fonts = {
        yahei: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
        system: 'system-ui, sans-serif',
        serif: 'Georgia, "Times New Roman", serif',
        mono: 'Consolas, "SFMono-Regular", monospace'
    };
    let fontId = Object.keys(fonts).find(key => fonts[key] === T.font) || 'yahei';
    const fields = {
        timeSize: { label: '时间大小', min: 0.03, max: 0.15, step: 0.005, get: () => T.timeSize, set: v => { T.timeSize = v; } },
        dateSize: { label: '日期比例', min: 0.2, max: 0.8, step: 0.01, get: () => T.dateSize, set: v => { T.dateSize = v; } },
        marginX: { label: '水平边距', min: 0, max: 0.2, step: 0.005, get: () => T.marginX, set: v => { T.marginX = v; } },
        marginY: { label: '垂直边距', min: 0, max: 0.25, step: 0.005, get: () => T.marginY, set: v => { T.marginY = v; } },
        gap: { label: '时间日期间距', min: 0.05, max: 0.8, step: 0.01, get: () => T.gap, set: v => { T.gap = v; } },
        weight: { label: '字体粗细', min: 300, max: 800, step: 100, get: () => T.weight || 600, set: v => { T.weight = Math.round(v); } },
        opacity: { label: '文字透明度', min: 0.1, max: 1, step: 0.01, get: () => colorAlpha, set: v => { colorAlpha = v; T.color = rgba(colorHex, colorAlpha); } },
        shadowAlpha: { label: '阴影强度', min: 0, max: 1, step: 0.01, get: () => T.shadowAlpha, set: v => { T.shadowAlpha = v; } },
        shadowBlur: { label: '阴影模糊', min: 0, max: 0.08, step: 0.001, get: () => T.shadowBlur, set: v => { T.shadowBlur = v; } },
        shadowOffset: { label: '阴影距离', min: 0, max: 0.04, step: 0.001, get: () => T.shadowOffset, set: v => { T.shadowOffset = v; } }
    };
    const original = {
        fields: Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()])),
        show: T.show, anchor: T.anchor, colorHex, fontId
    };
    const group = keys => keys.map(key => {
        const field = fields[key];
        return rangeField(key, field.label, field.min, field.max, field.step, field.get());
    }).join('');

    const shell = document.createElement('aside');
    shell.className = 'clock-debug';
    shell.setAttribute('aria-label', '时间显示样式调试工具');
    shell.innerHTML = [
        '<button class="clock-debug__toggle" type="button" aria-expanded="true" hidden>时间样式</button>',
        '<section class="clock-debug__panel">',
        '<header class="clock-debug__head"><div><h2 class="clock-debug__title">时间显示样式</h2><p class="clock-debug__hint">实时修改画面时钟 · 按 T 显示或隐藏</p></div><button class="clock-debug__close" type="button">收起</button></header>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">显示与位置</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-show">显示时间</label><input id="clock-debug-show" data-show type="checkbox"></div>',
        '<div class="clock-debug__field"><label for="clock-debug-anchor">位置</label><select id="clock-debug-anchor" class="clock-debug__select" data-anchor>' +
            '<option value="top-left">左上</option><option value="top-center">上方居中</option><option value="top-right">右上</option>' +
            '<option value="bottom-left">左下</option><option value="bottom-center">下方居中</option><option value="bottom-right">右下</option></select></div>',
        group(['marginX', 'marginY']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">文字</legend>',
        '<div class="clock-debug__field"><label for="clock-debug-font">字体</label><select id="clock-debug-font" class="clock-debug__select" data-font>' +
            '<option value="yahei">微软雅黑</option><option value="system">系统字体</option><option value="serif">衬线字体</option><option value="mono">等宽字体</option></select></div>',
        '<div class="clock-debug__field"><label for="clock-debug-color">文字颜色</label><input id="clock-debug-color" data-color type="color"></div>',
        group(['timeSize', 'dateSize', 'gap', 'weight', 'opacity']), '</fieldset>',
        '<fieldset class="clock-debug__section"><legend class="clock-debug__legend">阴影</legend>',
        group(['shadowAlpha', 'shadowBlur', 'shadowOffset']), '</fieldset>',
        '<div class="clock-debug__actions"><button class="clock-debug__button" type="button" data-reset>恢复默认</button><button class="clock-debug__button clock-debug__button--primary" type="button" data-copy>复制参数</button></div>',
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
    const anchorInput = shell.querySelector('[data-anchor]');
    const fontInput = shell.querySelector('[data-font]');
    const colorInput = shell.querySelector('[data-color]');
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    function format(key, value) {
        const step = fields[key].step;
        if (step >= 1) return String(Math.round(value));
        return Number(value).toFixed(step < 0.01 ? 3 : 2);
    }

    function refresh() {
        showInput.checked = T.show !== false;
        anchorInput.value = T.anchor;
        fontInput.value = fontId;
        colorInput.value = colorHex;
        for (const input of inputs) {
            const key = input.dataset.key;
            input.value = fields[key].get();
            shell.querySelector('[data-output="' + key + '"]').value = format(key, fields[key].get());
        }
        output.value = JSON.stringify({
            show: T.show, anchor: T.anchor, marginX: T.marginX, marginY: T.marginY,
            timeSize: T.timeSize, dateSize: T.dateSize, gap: T.gap,
            color: T.color, font: T.font, weight: T.weight || 600,
            shadowAlpha: T.shadowAlpha, shadowBlur: T.shadowBlur, shadowOffset: T.shadowOffset
        }, null, 2);
    }

    function reset() {
        for (const [key, value] of Object.entries(original.fields)) fields[key].set(value);
        T.show = original.show;
        T.anchor = original.anchor;
        colorHex = original.colorHex;
        fontId = original.fontId;
        T.font = fonts[fontId];
        T.color = rgba(colorHex, colorAlpha);
        refresh();
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
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus(); else toggle.focus();
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 't') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => {
        fields[input.dataset.key].set(Number(input.value));
        refresh();
        status.textContent = '时间样式已实时应用';
    });
    showInput.addEventListener('change', () => { T.show = showInput.checked; refresh(); });
    anchorInput.addEventListener('change', () => { T.anchor = anchorInput.value; refresh(); });
    fontInput.addEventListener('change', () => { fontId = fontInput.value; T.font = fonts[fontId]; refresh(); });
    colorInput.addEventListener('input', () => { colorHex = colorInput.value; T.color = rgba(colorHex, colorAlpha); refresh(); });
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    refresh();
    status.textContent = '面板已就绪';

    return { dispose() { window.removeEventListener('keydown', onKeyDown); shell.remove(); } };
}
