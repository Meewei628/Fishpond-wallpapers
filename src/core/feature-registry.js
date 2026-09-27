// 玩法(特征)注册表 —— 让"加一个玩法"= 加一个文件 + 在 builtins 注册一行(2026-09-26 第二轮)
//
// 第一轮的 app.js 里,玩法是写死的 if/else:
//   setFeature(name){ if(name==='clock')… else if(name==='feeding')… else throw }
// 而且玩法要自己往 renderer 里塞回调(drawClock/drawOverlay)、自己往输入路由注册动作、
// 自己在 dispose 里被一个个点名 —— 加一个玩法要改四处(app/渲染器/销毁/文档)。
//
// 现在玩法声明自己需要什么,装配层照着接:
//
//   features.register({ id: 'rain', create(ctx) { return {
//       setEnabled(on) {},            // 可选:开关(不实现则只记录状态)
//       update(dt) {},                // 可选:每帧模拟(跑在碰撞之前)
//       layers: { weather: draw },    // 可选:往层表投稿(层 id 见 core/layers.js)
//       interactions: { dig: fn },    // 可选:占一个输入模式(由 input-router 管理)
//       dispose() {}                  // 可选:释放监听/定时器
//   };}});
//
// 约束(刻意的):
//   - 禁用特征**不会**注销它的层与输入模式(与第一轮语义一致:setFeature('feeding',false) 只是
//     让 feedAt 不撒料,不摘掉输入模式;要彻底摘掉用 register() 返回的注销函数)。
//   - 层与输入模式在 create 时一次性接好;玩法内部想动态开关,自己在 draw/回调里判断。
export function createFeatureRegistry({ context, layers, input }) {
    const features = new Map();

    function register({ id, create, enabled = true, title }) {
        if (!/^[a-zA-Z][\w-]*$/.test(String(id || ''))) throw new Error('Invalid feature id: ' + id);
        if (features.has(id)) throw new Error('Duplicate feature: ' + id);
        if (typeof create !== 'function') throw new Error('Feature needs a create(ctx): ' + id);
        const instance = create(context) || {};
        const detach = [];
        if (instance.layers) {
            for (const [layerId, draw] of Object.entries(instance.layers)) detach.push(layers.add(layerId, draw));
        }
        if (instance.interactions) {
            for (const [name, handler] of Object.entries(instance.interactions)) detach.push(input.register(name, handler));
        }
        const entry = { id, title: title || id, instance, enabled: enabled !== false, detach };
        features.set(id, entry);
        if (typeof instance.setEnabled === 'function') instance.setEnabled(entry.enabled);
        return () => unregister(id);
    }

    function unregister(id) {
        const entry = features.get(id);
        if (!entry) return false;
        entry.detach.forEach(fn => fn());
        entry.instance.dispose?.();
        features.delete(id);
        return true;
    }

    function setEnabled(id, on) {
        const entry = features.get(id);
        if (!entry) throw new Error('Unknown feature: ' + id);
        entry.enabled = !!on;
        entry.instance.setEnabled?.(entry.enabled);
    }
    function get(id) { return features.get(id)?.instance; }
    function isEnabled(id) { const e = features.get(id); if (!e) return false; return e.enabled; }

    /**
     * 每帧模拟:返回**一个**函数,运行时才筛"启用且实现了 update"的特征
     * (注册顺序即执行顺序)。刻意不返回数组快照 —— 那样注册之后再 setEnabled 就失效了。
     */
    function updater() {
        return dt => {
            for (const e of features.values()) {
                // 启用中的玩法照常跑;禁用中的玩法若声明了 settleWhileDisabled,也要跑完收尾 ——
                // 否则"关掉天气"会把已经下出来的雨**冻在半空**(它有东西要落完/颜色要过渡回中性)
                const active = e.enabled || e.instance.settleWhileDisabled === true;
                if (active && typeof e.instance.update === 'function') e.instance.update(dt);
            }
        };
    }

    function dispose() { [...features.keys()].forEach(unregister); }

    return {
        register, unregister, setEnabled, get, isEnabled, updater, dispose,
        has: id => features.has(id),
        list: () => [...features.keys()],
        inspect: () => [...features.values()].map(e => ({ id: e.id, enabled: e.enabled }))
    };
}
