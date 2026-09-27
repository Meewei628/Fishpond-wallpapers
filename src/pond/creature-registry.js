// 生物注册表 —— 「鱼种(数据)」与「生物(实体类)」分开(2026-09-26 第二轮重构)
//
// 第一轮只有一种实体:`Koi` 类。`registerFishType()` 能注册的只是**同一套身体**的参数
// (骨架间距/体型倍率/速度/转向/碰撞半径/花纹),所以文档里只能写"乌龟/青蛙需要新实体或控制器,
// 不能仅靠数据实现" —— 也就是说"加一种新生物"必须去改 app.js / fish.js。
//
// 现在:鱼种用 `creature: '<kind>'` 声明自己用哪套**身体与控制器**(默认 'koi-fish'),
// 新生物 = 写一个自己的 kind 文件 + 在 builtins 里注册一行,核心文件一行不用改。
//
// 实例契约(注册时校验,见 docs/extending.md):
//   update(dt)          每帧推进(必需)
//   draw(ctx)           在 creatures 层画自己,按 depth 排序(必需)
//   depth               0~1,越大越靠前(必需)
//   translate(dx, dy)   被碰撞推开时整体位移(有碰撞就必须有)
//   collision           null | { shape:'capsule', half, r, end } | { shape:'circle', r }
//   dispose?()          释放自己的监听/定时器
export function createCreatureRegistry({ types }) {
    const kinds = new Map();

    function register({ id, create, title, exports = {} }) {
        if (!/^[a-z][a-z0-9-]*$/.test(String(id || ''))) throw new Error('Invalid creature kind id: ' + id);
        if (kinds.has(id)) throw new Error('Duplicate creature kind: ' + id);
        if (typeof create !== 'function') throw new Error('Creature kind needs a create(): ' + id);
        kinds.set(id, Object.freeze({ id, title: title || id, create, exports: Object.freeze({ ...exports }) }));
        return () => kinds.delete(id);
    }

    /** 按鱼种生成一只生物:鱼种决定参数,kind 决定身体 */
    function spawn(typeId, opts = {}) {
        const type = types.get(typeId);
        const kindId = type.creature || 'koi-fish';
        const kind = kinds.get(kindId);
        if (!kind) throw new Error(`Fish type "${typeId}" needs creature kind "${kindId}" — register it first`);
        const creature = kind.create(type, opts);
        if (!creature || typeof creature.update !== 'function' || typeof creature.draw !== 'function') {
            throw new Error(`Creature kind "${kindId}" must return an object with update(dt) and draw(ctx)`);
        }
        if (!Number.isFinite(creature.depth)) throw new Error(`Creature kind "${kindId}" must set a numeric depth`);
        if (creature.collision && typeof creature.translate !== 'function') {
            throw new Error(`Creature kind "${kindId}" declares collision but has no translate(dx, dy)`);
        }
        return creature;
    }

    return {
        register,
        spawn,
        has: id => kinds.has(id),
        /** kind 带出来的额外导出(例如锦鲤把 Koi 类给"自定义鱼"继承用) */
        exports: id => kinds.get(id)?.exports || {},
        kindOf: typeId => types.get(typeId).creature || 'koi-fish',
        list: () => [...kinds.keys()]
    };
}
