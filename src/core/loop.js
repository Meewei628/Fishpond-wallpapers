/**
 * 帧循环。
 *
 * ★ fpsLimit:Wallpaper Engine 把**用户设的帧率上限**通过 `applyGeneralProperties` 推给壁纸,
 *   并要求【壁纸自己遵守】([官方 FPS Limiter](https://docs.wallpaperengine.io/en/web/performance/fps.html))。
 *   不遵守 = 按显示器刷新率全速跑 —— 耗电、GPU 占用都高,而且"宿主 30fps"这个结论根本不成立。
 *
 * 两个容易写错的点:
 *   ① **dt 必须按"距上一次真正绘制"的真实时间给模拟**:若按 rAF 间隔给,跳帧后鱼会走得比实际慢一半;
 *   ② 第一帧 last=0,若直接拿它算 elapsed=0 → 带上限时会永远跳过(第一帧必须直接画)。
 */
export function createLoop({ update, draw, paused = () => false, fpsLimit = () => 0 }) {
    let request = null, last = 0, running = false;
    function tick(now) {
        if (!running) return;
        if (!last) {                                   // 第一帧:直接画
            last = now;
            if (!paused()) { update(0); draw(); }
            request = requestAnimationFrame(tick);
            return;
        }
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        const limit = Math.max(0, Number(fpsLimit()) || 0);
        if (limit > 0 && dt < 1 / limit) {             // 还没到下一帧:跳过绘制,但 last 不动(下次用累计时间)
            request = requestAnimationFrame(tick);
            return;
        }
        last = now;                                    // 只有"真的画了一帧"才推进基准
        if (!paused()) { update(dt); draw(); }
        if (running) request = requestAnimationFrame(tick);
    }
    return {
        start() { if (running) return; running = true; last = 0; request = requestAnimationFrame(tick); },
        stop() { running = false; if (request !== null) cancelAnimationFrame(request); request = null; last = 0; }
    };
}
