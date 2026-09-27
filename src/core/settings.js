export const DEFAULT_SETTINGS = {
    // 独立网页版使用这里的默认值。
    // 被改成 0 的那次,页面上就只剩一个空池塘(宿主会推值 ≠ 默认值可以随便设)。
    fishCount: 80,

    useGpuCaustics: true,
    useGpuRipples: true,
    waterHue: 195,
    fishSpeed: 1.5,
    // 平面运动调试参数：1.0 为原始运动表现。
    motionTurnRadius: 1.0,
    motionTurnResponse: 1.0,
    motionCruiseCurve: 1.0,

    enableCaustics: true,
    enableFeeding: true,
    shyFish: true,
    fishSize: 1.45,
    rippleStrength: 0.7,

    // 天气(2026-09-26):0=晴 1=雨(阴天已按用户决定摘掉)。**数字下标**——
    // WPE 的 combo 与 Lively 的 dropdown 都只给数字,不是字符串。
    // 默认 0 = 与今天逐帧一致(见 core/environment.js 的注释)。
    weather: 0,

    // 自持事件(2026-09-26):无人值守时的落叶与花瓣。默认开 ——
    // 它不影响任何既有行为(自己的随机流、自己的涟漪池),只往 weather 层多画几件东西。
    idleEvents: true,

    // 光的时段(2026-09-26):让天色/光向跟着现实时间走。**默认开**(用户定)——
    // 它和池里那行时钟自洽(时钟 22:07,水面就真是夜里的样子);不喜欢的人在宿主面板关掉即可。
    dayCycle: true,
    // 帧率上限(0 = 不限)。由宿主推来:WE 走 applyGeneralProperties({fps}),见 core/loop.js 与 platform/properties.js。
    fps: 0,
    // 夜间暗度倍率(0~1.3,1.0 = 现在这版观感)。夜里太暗是这功能最大的口味分歧点,给一根细旋钮。
    nightDim: 1.0
};

export function createSettings() { return { ...DEFAULT_SETTINGS }; }
