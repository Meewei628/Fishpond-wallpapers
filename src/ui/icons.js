// Lucide Icons (ISC) — https://lucide.dev/
// SVG paths are stored locally so the wallpaper remains fully offline.
const ICONS = Object.freeze({
    fish: '<path d="M16.69 7.44a7 7 0 0 0-9.38-1.26L5 7.5l-3-2v13l3-2 2.31 1.32a7 7 0 0 0 9.38-1.26"/><path d="M2 12h5"/><circle cx="16" cy="12" r=".5"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.3 0 1.9.5 2.5 1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    'circle-dot': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2a2 2 0 0 1 2-2h2.1A4.9 4.9 0 0 0 22 10.6 8.6 8.6 0 0 0 12 2Z"/>',
    eraser: '<path d="m7 21-4-4a2.8 2.8 0 0 1 0-4L14 2a2.8 2.8 0 0 1 4 0l4 4a2.8 2.8 0 0 1 0 4L11 21a2.8 2.8 0 0 1-4 0Z"/><path d="m5 11 8 8M5 21h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
});

export function ensureIconStyles() {
    if (document.getElementById('pond-icon-styles')) return;
    const style = document.createElement('style');
    style.id = 'pond-icon-styles';
    style.textContent = [
        '.pond-icon{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
        '.pond-icon--18{width:18px;height:18px}.pond-icon--20{width:20px;height:20px}',
        '.pond-icon-button{display:inline-flex;align-items:center;justify-content:center;gap:7px}',
        '.pond-icon-only{display:grid;place-items:center;padding:0}',
        '.pond-icon-button,.pond-icon-only{transition:transform 150ms cubic-bezier(.16,1,.3,1),background-color 150ms ease-out,border-color 150ms ease-out,color 150ms ease-out,box-shadow 150ms ease-out,filter 150ms ease-out}',
        '.pond-icon-button .pond-icon,.pond-icon-only .pond-icon{transition:transform 180ms cubic-bezier(.16,1,.3,1)}',
        '.pond-icon-button:hover:not(:disabled),.pond-icon-only:hover:not(:disabled){transform:translateY(-1px)}',
        '.pond-icon-button:hover:not(:disabled) .pond-icon,.pond-icon-only:hover:not(:disabled) .pond-icon{transform:scale(1.07)}',
        '.pond-icon-button:active:not(:disabled),.pond-icon-only:active:not(:disabled){transform:translateY(0) scale(.97)}',
        '@media(prefers-reduced-motion:reduce){.pond-icon-button,.pond-icon-only,.pond-icon-button .pond-icon,.pond-icon-only .pond-icon{transition-duration:80ms}.pond-icon-button:hover:not(:disabled),.pond-icon-only:hover:not(:disabled),.pond-icon-button:hover:not(:disabled) .pond-icon,.pond-icon-only:hover:not(:disabled) .pond-icon{transform:none}}'
    ].join('\n');
    document.head.appendChild(style);
}

const visibilityAnimations = new WeakMap();

export function setAnimatedVisibility(element, open) {
    const previous = visibilityAnimations.get(element);
    if (previous) previous.cancel();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open) element.hidden = false;
    if (typeof element.animate !== 'function') {
        element.hidden = !open;
        return Promise.resolve();
    }
    const frames = reduced
        ? [{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }]
        : open
            ? [{ opacity: 0, scale: '.97', filter: 'blur(7px)', clipPath: 'inset(0 0 5% 0 round 16px)' }, { opacity: 1, scale: '1', filter: 'blur(0)', clipPath: 'inset(0 0 0 0 round 16px)' }]
            : [{ opacity: 1, scale: '1', filter: 'blur(0)' }, { opacity: 0, scale: '.985', filter: 'blur(5px)' }];
    const animation = element.animate(frames, {
        duration: reduced ? 110 : (open ? 300 : 180),
        easing: open ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.4,0,1,1)',
        fill: 'both'
    });
    visibilityAnimations.set(element, animation);
    return animation.finished.catch(() => {}).then(() => {
        if (visibilityAnimations.get(element) !== animation) return;
        visibilityAnimations.delete(element);
        animation.cancel();
        if (!open) element.hidden = true;
    });
}

export function icon(name, className = 'pond-icon') {
    if (!ICONS[name]) throw new Error('Unknown pond icon: ' + name);
    return '<svg class="' + className + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
}

export function iconLabel(name, label) {
    return icon(name) + '<span>' + label + '</span>';
}
