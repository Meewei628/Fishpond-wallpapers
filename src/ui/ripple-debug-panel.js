import { THEME } from '../shared/legacy-assets.js';

function addStyles() {
    if (document.getElementById('ripple-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'ripple-debug-panel-styles';
    style.textContent = [
        '.ripple-debug{position:fixed;top:16px;left:16px;z-index:21;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.ripple-debug *{box-sizing:border-box}',
        '.ripple-debug button,.ripple-debug input,.ripple-debug textarea{font:inherit}',
        '.ripple-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.94);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.ripple-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border-radius:14px;background:rgba(6,22,21,.95);box-shadow:0 18px 50px rgba(0,0,0,.4);backdrop-filter:blur(14px) saturate(115%);scrollbar-color:#4c8d79 #0a201e;scrollbar-width:thin}',
        '.ripple-debug__panel[hidden],.ripple-debug__toggle[hidden]{display:none}',
        '.ripple-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.ripple-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.ripple-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.ripple-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.ripple-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.ripple-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.ripple-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.ripple-debug__field:last-child{margin-bottom:0}',
        '.ripple-debug__field label{color:#dcece6}',
        '.ripple-debug__value{min-width:52px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.ripple-debug__field input{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.ripple-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.ripple-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.ripple-debug__button--primary{grid-column:1/-1;border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.ripple-debug__output{width:100%;height:112px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;caret-color:#8fe0c3}',
        '.ripple-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.ripple-debug button:hover{filter:brightness(1.08)}',
        '.ripple-debug button:focus-visible,.ripple-debug input:focus-visible,.ripple-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:700px){.ripple-debug{top:10px;left:10px}.ripple-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}}',
        '@media(prefers-reduced-transparency:reduce){.ripple-debug__panel,.ripple-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, label, min, max, step, value) {
    return [
        '<div class="ripple-debug__field">',
        '<label for="ripple-debug-' + key + '">' + label + '</label>',
        '<output class="ripple-debug__value" data-output="' + key + '"></output>',
        '<input id="ripple-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">',
        '</div>'
    ].join('');
}

export function createRippleDebugPanel({ config, viewport, spawnRipple }) {
    addStyles();
    const T = THEME.water.ripple;
    const clamp = value => Math.max(0, Math.min(1, value));
    // 融合滑块的 1.0 基准；主题可以保存调试后的缩放值。
    const base = {
        crestAlpha: 0.78,
        troughAlpha: 0.45,
        arcPower: 2,
        arcFloor: 0,
        flankFloor: 0.35,
        speed: [105, 55],
        life: [1.5, 0.7]
    };
    let direction = clamp((T.arcPower / base.arcPower - 0.5) / 0.5);
    const fields = {
        rippleStrength: { label: '冲击强度', min: 0.1, max: 3, step: 0.05, get: () => config.rippleStrength, set: v => { config.rippleStrength = v; } },
        lamRatio: { label: '波纹间距', min: 0.08, max: 0.6, step: 0.01, get: () => T.lamRatio, set: v => { T.lamRatio = v; } },
        waveCycles: { label: '波纹圈数', min: 1, max: 8, step: 0.25, get: () => T.waveCycles, set: v => { T.waveCycles = v; } },
        waveDecay: { label: '向内衰减', min: 0, max: 2.5, step: 0.05, get: () => T.waveDecay, set: v => { T.waveDecay = v; } },
        contrast: {
            label: '明暗对比', min: 0.2, max: 1.5, step: 0.05,
            get: () => T.crestAlpha / base.crestAlpha,
            set: v => {
                T.crestAlpha = clamp(base.crestAlpha * v);
                T.troughAlpha = clamp(base.troughAlpha * v);
            }
        },
        direction: {
            label: '光向差异', min: 0, max: 1, step: 0.05,
            get: () => direction,
            set: v => {
                direction = v;
                T.arcPower = base.arcPower * (0.5 + v * 0.5);
                T.arcFloor = clamp(base.arcFloor + (1 - v) * 0.55);
                T.flankFloor = clamp(base.flankFloor + (1 - v) * 0.45);
            }
        },
        speedScale: {
            label: '扩散速度', min: 0.4, max: 2, step: 0.05,
            get: () => T.speed[0] / base.speed[0],
            set: v => { T.speed[0] = base.speed[0] * v; T.speed[1] = base.speed[1] * v; }
        },
        sizeScale: {
            label: '扩散大小', min: 0.4, max: 2.5, step: 0.05,
            get: () => T.life[0] / base.life[0],
            // 半径 = 扩散速度 × 存活时间；保持速度不变，通过寿命直接控制最大范围。
            set: v => { T.life[0] = base.life[0] * v; T.life[1] = base.life[1] * v; }
        }
    };
    const original = Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.get()]));
    const group = keys => keys.map(key => {
        const field = fields[key];
        return rangeField(key, field.label, field.min, field.max, field.step, field.get());
    }).join('');

    const shell = document.createElement('aside');
    shell.className = 'ripple-debug';
    shell.setAttribute('aria-label', '波纹调试工具');
    shell.innerHTML = [
        '<button class="ripple-debug__toggle" type="button" aria-expanded="true" hidden>波纹调试</button>',
        '<section class="ripple-debug__panel">',
        '<header class="ripple-debug__head"><div><h2 class="ripple-debug__title">波纹调试</h2><p class="ripple-debug__hint">8 个常用参数 · 按 R 显示或隐藏</p></div><button class="ripple-debug__close" type="button">收起</button></header>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">形状</legend>',
        group(['rippleStrength', 'lamRatio', 'waveCycles', 'waveDecay']), '</fieldset>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">外观</legend>',
        group(['contrast', 'direction']), '</fieldset>',
        '<fieldset class="ripple-debug__section"><legend class="ripple-debug__legend">运动</legend>',
        group(['speedScale', 'sizeScale']), '</fieldset>',
        '<div class="ripple-debug__actions">',
        '<button class="ripple-debug__button ripple-debug__button--primary" type="button" data-test>中心测试波纹</button>',
        '<button class="ripple-debug__button" type="button" data-reset>恢复默认</button>',
        '<button class="ripple-debug__button" type="button" data-copy>复制参数</button>',
        '</div>',
        '<textarea class="ripple-debug__output" readonly aria-label="当前波纹参数"></textarea>',
        '<p class="ripple-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.ripple-debug__panel');
    const toggle = shell.querySelector('.ripple-debug__toggle');
    const close = shell.querySelector('.ripple-debug__close');
    const output = shell.querySelector('.ripple-debug__output');
    const status = shell.querySelector('.ripple-debug__status');
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    function format(key, value) {
        const step = fields[key].step;
        return step >= 1 ? String(Math.round(value)) : Number(value).toFixed(step < 0.1 ? 2 : 1);
    }

    function refresh() {
        for (const input of inputs) {
            const key = input.dataset.key;
            input.value = fields[key].get();
            shell.querySelector('[data-output="' + key + '"]').value = format(key, fields[key].get());
        }
        output.value = JSON.stringify({
            rippleStrength: config.rippleStrength,
            waveform: { lamRatio: T.lamRatio, waveCycles: T.waveCycles, waveDecay: T.waveDecay },
            appearance: {
                contrast: fields.contrast.get(), direction,
                crestAlpha: T.crestAlpha, troughAlpha: T.troughAlpha,
                arcPower: T.arcPower, arcFloor: T.arcFloor, flankFloor: T.flankFloor
            },
            motion: {
                speedScale: fields.speedScale.get(), sizeScale: fields.sizeScale.get(),
                speed: [...T.speed], life: [...T.life]
            }
        }, null, 2);
    }

    function testRipple() {
        spawnRipple(viewport.width * 0.5, viewport.height * 0.5, 1.5 * config.rippleStrength);
        status.textContent = '已在画面中心生成测试波纹';
    }

    function reset() {
        for (const [key, value] of Object.entries(original)) fields[key].set(value);
        refresh();
        testRipple();
        status.textContent = '已恢复默认参数并生成测试波纹';
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
        if (open) close.focus();
        else toggle.focus();
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 'r') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => {
        const key = input.dataset.key;
        fields[key].set(Number(input.value));
        refresh();
        status.textContent = '参数已实时应用；点击“中心测试波纹”查看完整扩散过程';
    });
    shell.querySelector('[data-test]').addEventListener('click', testRipple);
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    refresh();
    status.textContent = '面板已就绪';

    return {
        dispose() {
            window.removeEventListener('keydown', onKeyDown);
            shell.remove();
        }
    };
}
