// 模拟顺序 —— 群路径 → 食物 → 生物行为/运动 → 玩法 → 碰撞
// (2026-09-26 第二轮:顺序不变,只把"实体必须是锦鲤"换成"实体有 update(dt)";
//  玩法自己的每帧模拟通过 extraUpdaters 注入,排在碰撞之前 —— 与第一轮 fish.update 之后、
//  resolveFishCollisions 之前的位置一致。)
export function createSimulation({ kois, foods, schoolSystem, resolveFishCollisions, extraUpdate = () => {} }) {
    return { update(dt) {
        schoolSystem.updateSchools(dt);
        for (let i = foods.length - 1; i >= 0; i--) {
            foods[i].update(dt);
            if (foods[i].life <= 0) foods.splice(i, 1);
        }
        for (const entity of kois) entity.update(dt);
        extraUpdate(dt);
        resolveFishCollisions(dt);
    } };
}
