// 种群管理 —— 谁的鱼数受设置控制,谁的鱼不被动(2026-09-26 第二轮重构)
//
// 第一轮的 syncKois() 用 `!f.custom` 反推"这是库存锦鲤",于是:
//   ① 任何通过 spawnFish() 投放的新生物都会被当成库存,鱼数一调就被裁掉(静默消失)
//   ② 库存鱼永远是锦鲤 —— 想"默认一池里混几只别的生物"没有入口
// 现在用实例上的 `origin` 显式区分:
//   'stock'   受 config.fishCount 管理(数量不足就补、超了就裁)
//   'spawned' 手动投放的,种群系统不碰
//   'custom'  用户捏的鱼(由 features/custom-fish.js 自己管)
export function createPopulation({ list, registry, config, stockTypeId = 'koi', onAfterSync = () => {} }) {
    function spawnStock() {
        const creature = registry.spawn(stockTypeId, { origin: 'stock' });
        creature.origin = 'stock';
        return creature;
    }
    function syncStock() {
        const stock = list.filter(e => e.origin === 'stock');
        while (stock.length < config.fishCount) stock.push(spawnStock());
        stock.length = Math.min(stock.length, config.fishCount);
        const others = list.filter(e => e.origin !== 'stock');
        list.splice(0, list.length, ...stock, ...others);
        onAfterSync();
    }
    /** 手动投放(不受鱼数设置影响;origin 默认 'spawned') */
    function spawn(typeId, opts = {}) {
        const creature = registry.spawn(typeId, { origin: opts.origin || 'spawned', ...opts });
        list.push(creature);
        return creature;
    }
    function countBy(origin) { return list.filter(e => e.origin === origin).length; }
    return { syncStock, spawn, countBy, counts: () => ({ stock: countBy('stock'), spawned: countBy('spawned'), custom: countBy('custom'), total: list.length }) };
}
