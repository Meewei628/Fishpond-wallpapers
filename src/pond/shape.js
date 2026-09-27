// 形状工具 —— 生物的碰撞几何集中在这里(2026-09-26 第二轮)
// 生物实例只需要给出 `collision` 描述符;几何解释(脊柱取哪几节、圆在哪)由这里统一。

/**
 * 胶囊两端四点 [ax, ay, bx, by](脊柱第 0 节 → 第 collision.end 节)。
 * 不是胶囊、或没有对应的脊柱节点 → null(调用方负责跳过,不要在这里抛)。
 */
export function capsuleEnds(c) {
    const col = c && c.collision;
    if (!col || col.shape !== 'capsule') return null;
    const S = c.segments;
    const end = col.end;
    if (!Array.isArray(S) || !S[0] || !S[end]) return null;
    return [S[0].x, S[0].y, S[end].x, S[end].y];
}

/** 生物中心(有脊柱取脊柱中点,否则取 x/y)—— 完全重合时的兜底分离方向要用 */
export function bodyCenter(c) {
    const e = capsuleEnds(c);
    if (e) return [(e[0] + e[2]) * 0.5, (e[1] + e[3]) * 0.5];
    return [c.x, c.y];
}
