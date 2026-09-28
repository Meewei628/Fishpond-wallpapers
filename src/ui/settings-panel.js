import { createFishDebugPanel } from './fish-debug-panel.js';
import { createRippleDebugPanel } from './ripple-debug-panel.js';
import { createClockDebugPanel } from './clock-debug-panel.js';
import { ensureIconStyles, icon, setAnimatedVisibility } from './icons.js';

function addStyles() {
    if (document.getElementById('pond-settings-styles')) return;
    const style = document.createElement('style');
    style.id = 'pond-settings-styles';
    style.textContent = [
        '.pond-settings{--bg-top:var(--pond-ui-bg-top);--bg:var(--pond-ui-bg);--surface-1:var(--pond-ui-surface-1);--surface-2:var(--pond-ui-surface-2);--stroke:var(--pond-ui-stroke);--text:var(--pond-ui-text);--muted:var(--pond-ui-muted);--accent:var(--pond-ui-accent);--accent-ink:var(--pond-ui-accent-ink);position:fixed;inset:16px;z-index:42;pointer-events:none;color:var(--text);font:13.5px/1.5 "PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.34)}',
        '.pond-settings *{box-sizing:border-box}.pond-settings button,.pond-settings input,.pond-settings select,.pond-settings textarea{font:inherit}',
        '.pond-settings__panel{pointer-events:auto;position:absolute;left:50%;top:50%;right:auto;transform:translate(-50%,-50%);width:min(960px,calc(100vw - 40px));height:min(820px,calc(100vh - 40px));display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;border:1px solid rgba(222,255,246,.14);border-radius:16px;background:linear-gradient(150deg,var(--bg-top),var(--bg));box-shadow:0 28px 80px rgba(0,22,20,.46);backdrop-filter:blur(28px) saturate(1.3);-webkit-backdrop-filter:blur(28px) saturate(1.3)}',
        '.pond-settings__panel[hidden],.pond-settings__page[hidden]{display:none}',
        '.pond-settings__header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 24px 20px;border-bottom:1px solid rgba(222,255,246,.10)}',
        '.pond-settings__title{margin:0;font-size:17px;line-height:1.25;font-weight:750;letter-spacing:-.02em}.pond-settings__hint{margin:3px 0 0;color:var(--muted);font-size:12.5px}',
        '.pond-settings__close{width:36px;height:36px;padding:0;border:1px solid var(--stroke);border-radius:9px;background:var(--surface-2);color:var(--text);cursor:pointer}',
        '.pond-settings__layout{min-height:0;display:grid;grid-template-columns:196px minmax(0,1fr)}',
        '.pond-settings__nav{display:flex;flex-direction:column;gap:10px;padding:20px 16px;border-right:1px solid rgba(222,255,246,.10);background:rgba(2,32,30,.20)}',
        '.pond-settings__nav-title{margin:1px 8px 9px;color:var(--muted);font-size:11.5px;font-weight:700;letter-spacing:.08em}',
        '.pond-settings__nav-button{min-height:44px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:9px;padding:0 11px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--muted);text-align:left;cursor:pointer;transition:transform 160ms cubic-bezier(.16,1,.3,1),background-color 160ms ease-out,border-color 160ms ease-out,color 160ms ease-out}',
        '.pond-settings__nav-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--surface-1);color:var(--text);font-size:12px;font-weight:800;text-shadow:none}',
        '.pond-settings__nav-arrow{color:transparent;font-size:16px;transition:transform 180ms cubic-bezier(.16,1,.3,1),color 160ms ease-out}.pond-settings__nav-button:hover{background:var(--surface-1);color:var(--text);transform:translateX(2px)}.pond-settings__nav-button:active{transform:translateX(1px) scale(.985)}',
        '.pond-settings__nav-button[aria-selected="true"]{border-color:var(--pond-ui-primary-border);background:var(--pond-ui-primary-soft);color:var(--text);font-weight:700}.pond-settings__nav-button[aria-selected="true"] .pond-settings__nav-icon{background:var(--accent);color:var(--accent-ink)}.pond-settings__nav-button[aria-selected="true"] .pond-settings__nav-arrow{color:var(--accent)}',
        '.pond-settings__content{min-width:0;min-height:0;overflow:auto;padding:28px 32px 36px;scrollbar-color:var(--pond-ui-primary) rgba(255,255,255,.06)}',
        '.pond-settings__page{width:100%;max-width:720px;margin:0 auto}.pond-settings__page:not([hidden]){animation:pond-settings-page-in 220ms cubic-bezier(.16,1,.3,1)}.pond-settings__page-head{margin:0 0 8px;padding:0 0 18px;border-bottom:1px solid rgba(222,255,246,.10)}.pond-settings__page-title{margin:0;font-size:17px;font-weight:750}.pond-settings__page-hint{margin:5px 0 0;color:var(--muted);font-size:12.5px}',
        '.pond-settings .fish-debug,.pond-settings .ripple-debug,.pond-settings .clock-debug{position:static;inset:auto;width:auto;color:var(--text);font:inherit;text-shadow:inherit}',
        '.pond-settings .fish-debug__panel,.pond-settings .ripple-debug__panel,.pond-settings .clock-debug__panel{position:static;width:auto;max-height:none;overflow:visible;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}',
        '.pond-settings .fish-debug__head,.pond-settings .ripple-debug__head,.pond-settings .clock-debug__head,.pond-settings .fish-debug__toggle,.pond-settings .ripple-debug__toggle,.pond-settings .clock-debug__toggle{display:none}',
        '.pond-settings .fish-debug__section,.pond-settings .ripple-debug__section,.pond-settings .clock-debug__section{padding:26px 0;border-top-color:rgba(222,255,246,.10)}',
        '.pond-settings .fish-debug__section:first-of-type,.pond-settings .ripple-debug__section:first-of-type,.pond-settings .clock-debug__section:first-of-type{border-top:0}',
        '.pond-settings .fish-debug__legend,.pond-settings .ripple-debug__legend,.pond-settings .clock-debug__legend{padding-bottom:14px}',
        '.pond-settings .fish-debug__field,.pond-settings .ripple-debug__field,.pond-settings .clock-debug__field{margin-bottom:18px}',
        '.pond-settings .fish-debug__actions,.pond-settings .ripple-debug__actions,.pond-settings .clock-debug__actions{margin-top:8px;padding-top:24px;border-top:1px solid rgba(222,255,246,.10)}',
        '.pond-settings .fish-debug__legend,.pond-settings .ripple-debug__legend,.pond-settings .clock-debug__legend{color:var(--text)}',
        '.pond-settings .fish-debug__field label,.pond-settings .ripple-debug__field label,.pond-settings .clock-debug__field label{color:var(--muted)}',
        '.pond-settings .fish-debug__value,.pond-settings .ripple-debug__value,.pond-settings .clock-debug__value,.pond-settings .fish-debug__metric-value{color:var(--accent)}',
        '.pond-settings input[type="range"]{accent-color:var(--pond-ui-primary)}',
        '.pond-settings .fish-debug__button,.pond-settings .ripple-debug__button,.pond-settings .clock-debug__button{min-height:40px;border-color:var(--stroke);border-radius:9px;background:var(--surface-2);color:var(--text)}',
        '.pond-settings .fish-debug__button--primary,.pond-settings .ripple-debug__button--primary,.pond-settings .clock-debug__button--primary{border-color:var(--accent);background:var(--accent);color:var(--accent-ink);text-shadow:none}',
        '.pond-settings button:hover{filter:brightness(1.10)}.pond-settings button:focus-visible,.pond-settings input:focus-visible,.pond-settings select:focus-visible,.pond-settings textarea:focus-visible{outline:2px solid var(--pond-ui-focus);outline-offset:2px}',
        '@keyframes pond-settings-page-in{from{opacity:0;transform:translateX(10px);filter:blur(3px)}to{opacity:1;transform:translateX(0);filter:blur(0)}}',
        '@media(max-width:720px){.pond-settings{inset:8px}.pond-settings__panel{width:calc(100vw - 16px);height:calc(100vh - 16px)}.pond-settings__header{padding:18px 16px 16px}.pond-settings__layout{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.pond-settings__nav{flex-direction:row;overflow-x:auto;padding:10px;border-right:0;border-bottom:1px solid rgba(222,255,246,.10)}.pond-settings__nav-title{display:none}.pond-settings__nav-button{flex:0 0 auto;grid-template-columns:24px auto;min-height:42px}.pond-settings__nav-icon{width:24px;height:24px}.pond-settings__nav-arrow{display:none}.pond-settings__content{padding:18px 16px 24px}.pond-settings .fish-debug__section,.pond-settings .ripple-debug__section,.pond-settings .clock-debug__section{padding:22px 0}}',
        '@media(prefers-reduced-motion:reduce){.pond-settings__page:not([hidden]){animation:pond-settings-page-fade 100ms ease-out}.pond-settings__nav-button,.pond-settings__nav-arrow{transition-duration:80ms}.pond-settings__nav-button:hover,.pond-settings__nav-button:active{transform:none}}',
        '@keyframes pond-settings-page-fade{from{opacity:.72}to{opacity:1}}',
        '@media(prefers-reduced-transparency:reduce){.pond-settings__panel{background:#092f2d;backdrop-filter:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

export function createSettingsPanel({ kois, config, types, viewport, spawnRipple, repository }) {
    ensureIconStyles();
    addStyles();
    const fish = createFishDebugPanel({ kois, config, types, repository, embedded: true });
    const ripple = createRippleDebugPanel({ config, viewport, spawnRipple, repository, embedded: true });
    const clock = createClockDebugPanel({ repository, embedded: true });
    const definitions = [
        { id: 'fish', title: '鱼外观', hint: '鱼群运动与质感参数', icon: 'fish', instance: fish },
        { id: 'ripple', title: '波纹', hint: '水面波纹的形状、外观与运动', icon: 'waves', instance: ripple },
        { id: 'clock', title: '时间样式', hint: '画面时钟、文字与毛玻璃卡片', icon: 'clock', instance: clock }
    ];

    const shell = document.createElement('aside');
    shell.className = 'pond-settings';
    shell.setAttribute('aria-label', '鱼池设置');
    shell.innerHTML = [
        '<section class="pond-settings__panel" role="dialog" aria-modal="false" aria-label="设置" hidden>',
        '<header class="pond-settings__header"><div><h2 class="pond-settings__title">设置</h2><p class="pond-settings__hint">统一调整鱼群、波纹与时间样式</p></div><button class="pond-settings__close pond-icon-only" type="button" aria-label="收起设置" title="收起">' + icon('x', 'pond-icon pond-icon--18') + '</button></header>',
        '<div class="pond-settings__layout">',
        '<nav class="pond-settings__nav" aria-label="设置分类"><p class="pond-settings__nav-title">设置分类</p>',
        definitions.map(item => '<button class="pond-settings__nav-button" type="button" role="tab" data-page="' + item.id + '" aria-selected="false"><span class="pond-settings__nav-icon" aria-hidden="true">' + icon(item.icon, 'pond-icon pond-icon--18') + '</span><span>' + item.title + '</span><span class="pond-settings__nav-arrow" aria-hidden="true">' + icon('chevron-right') + '</span></button>').join(''),
        '</nav><div class="pond-settings__content"></div></div></section>'
    ].join('');
    document.body.appendChild(shell);

    const panel = shell.querySelector('.pond-settings__panel');
    const close = shell.querySelector('.pond-settings__close');
    const content = shell.querySelector('.pond-settings__content');
    const buttons = Array.from(shell.querySelectorAll('[data-page]'));
    const pages = new Map();
    let activePage = 'fish';

    for (const item of definitions) {
        const page = document.createElement('section');
        page.className = 'pond-settings__page';
        page.dataset.settingsPage = item.id;
        page.setAttribute('role', 'tabpanel');
        page.innerHTML = '<header class="pond-settings__page-head"><h3 class="pond-settings__page-title">' + item.title + '</h3><p class="pond-settings__page-hint">' + item.hint + '</p></header>';
        page.appendChild(item.instance.element);
        content.appendChild(page);
        pages.set(item.id, page);
    }

    function setPage(id, focus = false) {
        if (!pages.has(id)) return;
        activePage = id;
        for (const [pageId, page] of pages) page.hidden = pageId !== id;
        for (const button of buttons) {
            const selected = button.dataset.page === id;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
            if (selected && focus) button.focus();
        }
        content.scrollTop = 0;
    }

    function setOpen(open, pageId = activePage) {
        setPage(pageId);
        setAnimatedVisibility(panel, open);
        window.dispatchEvent(new CustomEvent('koi:settings-state', { detail: { open } }));
        if (open) buttons.find(button => button.dataset.page === activePage)?.focus();
        else document.querySelector('.clock-settings-button')?.focus();
    }

    function onOpenRequest(event) {
        setOpen(true, event.detail?.page || activePage);
    }

    for (const button of buttons) button.addEventListener('click', () => setPage(button.dataset.page));
    close.addEventListener('click', () => setOpen(false));
    window.addEventListener('koi:open-settings', onOpenRequest);
    setPage(activePage);

    return {
        restoreSaved: fish.restoreSaved,
        open: pageId => setOpen(true, pageId || activePage),
        dispose() {
            window.removeEventListener('koi:open-settings', onOpenRequest);
            fish.dispose();
            ripple.dispose();
            clock.dispose();
            shell.remove();
        }
    };
}
