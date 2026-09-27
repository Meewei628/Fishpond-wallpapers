
export function createFeeding({ config, foods, Food, spawnRipple }) {
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

return { feedAt };
}
