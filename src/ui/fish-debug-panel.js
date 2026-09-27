const SHAPE_DEFAULTS = Object.freeze({
    bodyLen: 1,
    bodyH: 1,
    headW: 1,
    tailW: 1,
    tailFin: 1,
    fin: 1,
    eye: 1
});

const RANGE_LABELS = Object.freeze({
    fishSize: '整体大小',
    fishSpeed: '游动速度',
    motionTurnRadius: '转弯半径',
    motionTurnResponse: '转向响应',
    motionCruiseCurve: '巡游弯曲度',
    bodyLen: '身体长度',
    bodyH: '身体宽度',
    headW: '头部宽度',
    tailW: '尾柄宽度',
    tailFin: '尾鳍大小',
    fin: '胸鳍大小',
    eye: '眼睛大小',
    spotWidth: '斑纹宽度',
    outlineWidth: '纯黑描边粗细',
    net: '鳞片强度',
    sheen: '金属光泽'
});

function addStyles() {
    if (document.getElementById('fish-debug-panel-styles')) return;
    const style = document.createElement('style');
    style.id = 'fish-debug-panel-styles';
    style.textContent = [
        '.fish-debug{position:fixed;top:16px;right:16px;z-index:20;color:#eef8f4;font:14px/1.45 system-ui,-apple-system,"Microsoft YaHei",sans-serif}',
        '.fish-debug *{box-sizing:border-box}',
        '.fish-debug button,.fish-debug input,.fish-debug select,.fish-debug textarea{font:inherit}',
        '.fish-debug__toggle{min-width:92px;height:40px;padding:0 16px;border:1px solid rgba(208,235,225,.32);border-radius:12px;background:rgba(6,22,21,.92);color:#f4fbf8;box-shadow:0 10px 30px rgba(0,0,0,.28);cursor:pointer}',
        '.fish-debug__panel{width:320px;max-height:calc(100dvh - 32px);overflow:auto;padding:18px;border:1px solid rgba(208,235,225,.24);border-radius:14px;background:rgba(6,22,21,.94);box-shadow:0 18px 50px rgba(0,0,0,.38);backdrop-filter:blur(14px) saturate(115%)}',
        '.fish-debug__panel[hidden],.fish-debug__toggle[hidden]{display:none}',
        '.fish-debug__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}',
        '.fish-debug__title{margin:0;font-size:18px;line-height:1.25;font-weight:750;letter-spacing:-.02em}',
        '.fish-debug__hint{margin:4px 0 0;color:#a8c6bb;font-size:12px}',
        '.fish-debug__close{height:34px;padding:0 10px;border:1px solid rgba(208,235,225,.22);border-radius:8px;background:#12302d;color:#dcece6;cursor:pointer}',
        '.fish-debug__section{margin:0;padding:15px 0;border:0;border-top:1px solid rgba(208,235,225,.14)}',
        '.fish-debug__legend{padding:0 0 10px;font-size:13px;font-weight:700;color:#cfe6de}',
        '.fish-debug__field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:7px 12px;margin-bottom:13px}',
        '.fish-debug__field:last-child{margin-bottom:0}',
        '.fish-debug__field label{color:#dcece6}',
        '.fish-debug__value{min-width:42px;text-align:right;color:#91d7c0;font-variant-numeric:tabular-nums}',
        '.fish-debug__field input[type="range"]{grid-column:1/-1;width:100%;margin:0;accent-color:#76cdb0}',
        '.fish-debug__field input[type="color"]{width:48px;height:30px;padding:2px;border:1px solid rgba(208,235,225,.25);border-radius:7px;background:#102b28;cursor:pointer}',
        '.fish-debug__select{width:100%;height:38px;padding:0 10px;border:1px solid rgba(208,235,225,.24);border-radius:8px;background:#102b28;color:#eef8f4}',
        '.fish-debug__actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}',
        '.fish-debug__button{min-height:38px;padding:8px 10px;border:1px solid rgba(208,235,225,.24);border-radius:9px;background:#143632;color:#eef8f4;cursor:pointer}',
        '.fish-debug__button--primary{border-color:#72cbae;background:#72cbae;color:#08211d;font-weight:750}',
        '.fish-debug__output{width:100%;height:112px;margin-top:12px;padding:10px;resize:vertical;border:1px solid rgba(208,235,225,.18);border-radius:9px;background:#081b1a;color:#bfe1d6;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}',
        '.fish-debug__status{min-height:20px;margin:10px 0 0;color:#9ccabd;font-size:12px}',
        '.fish-debug__metrics{display:grid;grid-template-columns:1fr auto;gap:7px 14px;margin-top:12px;padding:11px;border-radius:9px;background:#081b1a;color:#b8d7cd}',
        '.fish-debug__metric-value{color:#8fe0c3;text-align:right;font-variant-numeric:tabular-nums}',
        '.fish-debug__readonly{margin:9px 0 0;color:#8eb5a8;font-size:12px}',
        '.fish-debug button:hover{filter:brightness(1.08)}',
        '.fish-debug button:focus-visible,.fish-debug input:focus-visible,.fish-debug select:focus-visible,.fish-debug textarea:focus-visible{outline:3px solid rgba(138,225,196,.7);outline-offset:2px}',
        '@media(max-width:600px){.fish-debug{top:10px;right:10px}.fish-debug__panel{width:min(320px,calc(100vw - 20px));max-height:calc(100dvh - 20px)}}',
        '@media(prefers-reduced-transparency:reduce){.fish-debug__panel,.fish-debug__toggle{background:#061615;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

function rangeField(key, min, max, step, value) {
    return [
        '<div class="fish-debug__field">',
        '<label for="fish-debug-' + key + '">' + RANGE_LABELS[key] + '</label>',
        '<output class="fish-debug__value" data-output="' + key + '">' + Number(value).toFixed(2) + '</output>',
        '<input id="fish-debug-' + key + '" data-key="' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '">',
        '</div>'
    ].join('');
}

export function createFishDebugPanel({ kois, config, types }) {
    addStyles();

    const fishType = types.get('koi');
    const originalFishSize = config.fishSize;
    const originalMotion = {
        fishSpeed: config.fishSpeed,
        motionTurnRadius: config.motionTurnRadius ?? 1,
        motionTurnResponse: config.motionTurnResponse ?? 1,
        motionCruiseCurve: config.motionCruiseCurve ?? 1
    };
    const shell = document.createElement('aside');
    shell.className = 'fish-debug';
    shell.setAttribute('aria-label', '鱼外观调试工具');
    shell.innerHTML = [
        '<button class="fish-debug__toggle" type="button" aria-expanded="true" hidden>鱼外观</button>',
        '<section class="fish-debug__panel">',
        '<header class="fish-debug__head">',
        '<div><h2 class="fish-debug__title">鱼外观调试</h2><p class="fish-debug__hint">实时应用到池中全部普通锦鲤 · 按 D 显示或隐藏</p></div>',
        '<button class="fish-debug__close" type="button">收起</button>',
        '</header>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">品种</legend>',
        '<select class="fish-debug__select" data-breed aria-label="选择锦鲤品种"><option value="mixed">混合随机</option></select>',
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">尺寸与轮廓</legend>',
        rangeField('fishSize', 0.5, 3, 0.05, config.fishSize),
        rangeField('bodyLen', 0.35, 2.2, 0.05, 1),
        rangeField('bodyH', 0.35, 2.2, 0.05, 1),
        rangeField('headW', 0.35, 2.2, 0.05, 1),
        rangeField('tailW', 0.35, 2.2, 0.05, 1),
        rangeField('tailFin', 0.35, 2.2, 0.05, 1),
        rangeField('fin', 0.35, 2.2, 0.05, 1),
        rangeField('eye', 0.35, 2.2, 0.05, 1),
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">平面运动</legend>',
        rangeField('fishSpeed', 0.2, 3, 0.05, config.fishSpeed),
        rangeField('motionTurnRadius', 0.25, 3, 0.05, config.motionTurnRadius ?? 1),
        rangeField('motionTurnResponse', 0.25, 2.5, 0.05, config.motionTurnResponse ?? 1),
        rangeField('motionCruiseCurve', 0, 2.5, 0.05, config.motionCruiseCurve ?? 1),
        '<div class="fish-debug__metrics" aria-label="实时运动状态">',
        '<span>平均游速</span><span class="fish-debug__metric-value" data-motion="speed">0 px/s</span>',
        '<span>平均转向率</span><span class="fish-debug__metric-value" data-motion="turn">0 °/s</span>',
        '<span>平均转弯半径</span><span class="fish-debug__metric-value" data-motion="radius">—</span>',
        '<span>主要行为</span><span class="fish-debug__metric-value" data-motion="behavior">巡游</span>',
        '</div><p class="fish-debug__readonly">上方滑块修改运动模型，下方数据实时监测鱼群状态。</p>',
        '</fieldset>',
        '<fieldset class="fish-debug__section"><legend class="fish-debug__legend">颜色与质感</legend>',
        '<div class="fish-debug__field"><label for="fish-debug-bodyColor">身体底色</label><input id="fish-debug-bodyColor" data-key="bodyColor" type="color" value="#eee8dc"></div>',
        '<div class="fish-debug__field"><label for="fish-debug-spotColor">斑纹颜色</label><input id="fish-debug-spotColor" data-key="spotColor" type="color" value="#d94f28"></div>',
        rangeField('spotWidth', 0.1, 0.72, 0.01, 0.5),
        rangeField('outlineWidth', 0, 1, 0.01, 0.22),
        rangeField('net', 0, 1, 0.01, 0),
        rangeField('sheen', 0, 1, 0.01, 0),
        '</fieldset>',
        '<div class="fish-debug__actions">',
        '<button class="fish-debug__button" type="button" data-reset>恢复全部默认</button>',
        '<button class="fish-debug__button fish-debug__button--primary" type="button" data-copy>复制参数</button>',
        '</div>',
        '<textarea class="fish-debug__output" readonly aria-label="当前调试参数"></textarea>',
        '<p class="fish-debug__status" role="status" aria-live="polite"></p>',
        '</section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.fish-debug__panel');
    const toggle = shell.querySelector('.fish-debug__toggle');
    const close = shell.querySelector('.fish-debug__close');
    const breed = shell.querySelector('[data-breed]');
    const output = shell.querySelector('.fish-debug__output');
    const status = shell.querySelector('.fish-debug__status');
    const inputs = Array.from(shell.querySelectorAll('[data-key]'));

    for (const item of fishType.breeds) {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        breed.appendChild(option);
    }

    function ordinaryFish() {
        return kois.filter(fish => !fish.custom);
    }

    function inputFor(key) {
        return shell.querySelector('[data-key="' + key + '"]');
    }

    function numberValue(key) {
        return Number(inputFor(key).value);
    }

    function shapeValues() {
        return {
            bodyLen: numberValue('bodyLen'),
            bodyH: numberValue('bodyH'),
            headW: numberValue('headW'),
            tailW: numberValue('tailW'),
            tailFin: numberValue('tailFin'),
            fin: numberValue('fin'),
            eye: numberValue('eye')
        };
    }

    function currentParameters() {
        return {
            breed: breed.value,
            fishSize: numberValue('fishSize'),
            motion: {
                fishSpeed: numberValue('fishSpeed'),
                turnRadius: numberValue('motionTurnRadius'),
                turnResponse: numberValue('motionTurnResponse'),
                cruiseCurve: numberValue('motionCruiseCurve')
            },
            shape: shapeValues(),
            bodyColor: inputFor('bodyColor').value,
            spotColor: inputFor('spotColor').value,
            spotWidth: numberValue('spotWidth'),
            outlineWidth: numberValue('outlineWidth'),
            net: numberValue('net'),
            sheen: numberValue('sheen')
        };
    }

    function refreshOutput() {
        output.value = JSON.stringify(currentParameters(), null, 2);
    }

    function updateRangeLabel(input) {
        if (input.type !== 'range') return;
        const target = shell.querySelector('[data-output="' + input.dataset.key + '"]');
        if (target) target.value = Number(input.value).toFixed(2);
    }

    function applyInput(input) {
        const key = input.dataset.key;
        const value = input.type === 'color' ? input.value : Number(input.value);
        const fish = ordinaryFish();

        if (key === 'fishSize') {
            config.fishSize = value;
        } else if (key === 'fishSpeed' || key === 'motionTurnRadius' || key === 'motionTurnResponse' || key === 'motionCruiseCurve') {
            config[key] = value;
        } else if (key === 'bodyColor') {
            for (const koi of fish) koi.color = value;
        } else if (key === 'spotColor') {
            for (const koi of fish) for (const spot of koi.spotRanges) spot[2] = value;
        } else if (key === 'spotWidth') {
            for (const koi of fish) for (const spot of koi.spotRanges) spot[3] = value;
        } else if (key === 'outlineWidth') {
            for (const koi of fish) koi.outlineWidth = value;
        } else if (key === 'net' || key === 'sheen') {
            for (const koi of fish) koi[key] = value;
        } else if (Object.prototype.hasOwnProperty.call(SHAPE_DEFAULTS, key)) {
            for (const koi of fish) koi.shape = { ...SHAPE_DEFAULTS, ...(koi.shape || {}), [key]: value };
        }

        updateRangeLabel(input);
        refreshOutput();
        status.textContent = '已应用到 ' + fish.length + ' 条锦鲤';
    }

    function syncFromFirstFish() {
        const first = ordinaryFish()[0];
        if (!first) return;
        inputFor('bodyColor').value = first.color || '#eee8dc';
        const firstSpot = first.spotRanges && first.spotRanges[0];
        if (firstSpot) {
            inputFor('spotColor').value = firstSpot[2];
            inputFor('spotWidth').value = firstSpot[3];
        }
        inputFor('outlineWidth').value = first.outlineWidth ?? 0.22;
        inputFor('net').value = Math.max(0, Math.min(1, first.net || 0));
        inputFor('sheen').value = Math.max(0, Math.min(1, first.sheen || 0));
        for (const input of inputs) updateRangeLabel(input);
        refreshOutput();
    }

    function changeBreed() {
        const fish = ordinaryFish();
        const selected = fishType.breeds.find(item => item.id === breed.value);
        for (const koi of fish) {
            if (selected) koi.applyBreed(selected);
            else koi.pickBreed();
        }
        syncFromFirstFish();
        status.textContent = selected ? '已切换为“' + selected.name + '”' : '已重新随机分配品种';
    }

    function reset() {
        config.fishSize = originalFishSize;
        inputFor('fishSize').value = originalFishSize;
        for (const [key, value] of Object.entries(originalMotion)) {
            config[key] = value;
            inputFor(key).value = value;
        }
        inputFor('outlineWidth').value = 0.22;
        breed.value = 'mixed';
        for (const key of Object.keys(SHAPE_DEFAULTS)) inputFor(key).value = SHAPE_DEFAULTS[key];
        for (const koi of ordinaryFish()) {
            delete koi.outlineWidth;
            koi.shape = koi.type.shape ? { ...koi.type.shape } : null;
            koi.pickBreed();
        }
        syncFromFirstFish();
        status.textContent = '已恢复全部默认参数';
    }

    const behaviorLabels = {
        cruise: '巡游',
        school: '鱼群跟随',
        food: '追食',
        flee: '躲避鼠标',
        edge: '边界避让'
    };

    function refreshMotionStatus() {
        const fish = ordinaryFish();
        if (!fish.length) return;
        let speedSum = 0;
        let turnSum = 0;
        let radiusSum = 0;
        let radiusCount = 0;
        const behaviors = Object.create(null);

        for (const koi of fish) {
            const speed = Math.max(0, Number(koi.speed) || 0) * 60;
            const turn = Math.abs(Number(koi.turnRate) || 0);
            speedSum += speed;
            turnSum += turn;
            if (turn > 0.015) {
                radiusSum += speed / turn;
                radiusCount++;
            }
            const behavior = koi.lastBehavior || 'cruise';
            behaviors[behavior] = (behaviors[behavior] || 0) + 1;
        }

        let mainBehavior = 'cruise';
        for (const key of Object.keys(behaviors)) {
            if ((behaviors[key] || 0) > (behaviors[mainBehavior] || 0)) mainBehavior = key;
        }

        shell.querySelector('[data-motion="speed"]').textContent = (speedSum / fish.length).toFixed(1) + ' px/s';
        shell.querySelector('[data-motion="turn"]').textContent = (turnSum / fish.length * 180 / Math.PI).toFixed(1) + ' °/s';
        shell.querySelector('[data-motion="radius"]').textContent = radiusCount ? (radiusSum / radiusCount).toFixed(0) + ' px' : '近似直线';
        shell.querySelector('[data-motion="behavior"]').textContent = behaviorLabels[mainBehavior] || mainBehavior;
    }

    function setOpen(open) {
        panel.hidden = !open;
        toggle.hidden = open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) close.focus();
        else toggle.focus();
    }

    function copyParameters() {
        refreshOutput();
        output.focus();
        output.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (_) {}
        status.textContent = copied ? '参数已复制到剪贴板' : '参数已选中，请按 Ctrl+C 复制';
    }

    function onKeyDown(event) {
        const tag = event.target && event.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (event.key.toLowerCase() === 'd') setOpen(panel.hidden);
    }

    for (const input of inputs) input.addEventListener('input', () => applyInput(input));
    breed.addEventListener('change', changeBreed);
    shell.querySelector('[data-reset]').addEventListener('click', reset);
    shell.querySelector('[data-copy]').addEventListener('click', copyParameters);
    close.addEventListener('click', () => setOpen(false));
    toggle.addEventListener('click', () => setOpen(true));
    window.addEventListener('keydown', onKeyDown);
    const motionTimer = setInterval(refreshMotionStatus, 250);

    syncFromFirstFish();
    refreshMotionStatus();
    status.textContent = '面板已就绪';

    return {
        dispose() {
            clearInterval(motionTimer);
            window.removeEventListener('keydown', onKeyDown);
            shell.remove();
        }
    };
}
