
import { ensureIconStyles, icon } from '../ui/icons.js';

export function createFeeding({ config, foods, Food, spawnRipple, input }) {
ensureIconStyles();
const button = document.createElement('button');
button.className = 'feeding-toggle pond-icon-only';
button.type = 'button';
button.innerHTML = icon('utensils', 'pond-icon pond-icon--20');
button.title = '喂食';
button.setAttribute('aria-pressed', 'false');
button.setAttribute('aria-label', '开启投喂模式');
document.body.appendChild(button);
const settingsButton = document.querySelector('.clock-settings-button');
let buttonLayout = '';

let feeding = false;
function setFeeding(next) {
    feeding = !!next && config.enableFeeding;
    input.setMode(feeding ? 'feed' : 'startle');
    button.title = feeding ? '退出投喂模式' : '喂食';
    button.setAttribute('aria-pressed', String(feeding));
    button.setAttribute('aria-label', feeding ? '关闭投喂模式' : '开启投喂模式');
}
button.addEventListener('click', () => setFeeding(!feeding));

function syncButtonPosition() {
    if (!settingsButton || settingsButton.hidden) return;
    const size = Number.parseFloat(settingsButton.style.width) || 40;
    const left = settingsButton.style.left;
    const top = Number.parseFloat(settingsButton.style.top) || 0;
    const layout = left + '|' + top + '|' + size;
    if (layout === buttonLayout) return;
    buttonLayout = layout;
    button.style.left = left;
    button.style.right = 'auto';
    button.style.top = (top + (size + 8) * 2) + 'px';
    button.style.bottom = 'auto';
    button.style.width = size + 'px';
    button.style.height = size + 'px';
}

function startleAt(x, y) {
    spawnRipple(x, y, 1.5 * config.rippleStrength);
}

function feedAt(x, y) {
    if (config.enableFeeding) {
        // 一次撒一小把饲料,而不是一粒。
        // 这样几条鱼会各自锁定最近的一粒 —— 一撒下去就有一群围过来,而不是只有一条有份。

        const N = 20;                                      // 每次 20 粒
        const MAX_FOOD = 240;                              // 上限,防止狂点堆爆
        const startIdx = foods.length;                     // 只给"新撒的这批"做落水弹跳
        for (let i = 0; i < N && foods.length < MAX_FOOD; i++) {
            let a = Math.random() * Math.PI * 2;
            let d = 8 + Math.pow(Math.random(), 0.60) * 48; // 8~56px,中心稍密
            const fx = x + Math.cos(a) * d;
            const fy = y + Math.sin(a) * d * 0.85;
            foods.push(new Food(fx, fy));
        }
        for (let i = startIdx; i < foods.length; i++) {
            foods[i].pop = 0.4 + Math.random() * 0.6;
        }
    }
    spawnRipple(x, y, 1.5 * config.rippleStrength);
}

return {
    interactions: { startle: startleAt, feed: feedAt },
    update: syncButtonPosition,
    setEnabled(next) {
        config.enableFeeding = !!next;
        button.disabled = !config.enableFeeding;
        if (!config.enableFeeding) setFeeding(false);
    },
    dispose() { button.remove(); }
};
}
