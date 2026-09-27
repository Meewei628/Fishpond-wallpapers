import { KOI_SHAPE } from '../../shared/legacy-assets.js';
import { varyHexColor } from '../../shared/math.js';
import { createBehavior } from '../behavior.js';

/**
 * 锦鲤 —— 默认生物 kind('koi-fish')。2026-09-26 第二轮从 pond/fish.js 搬进 pond/creatures/,
 * 顺便把"只有一种实体"的假设去掉:类型由注册表解析后传进来,自己声明碰撞契约与 translate()。
 * 身体数学、花纹、行为混入**逐行保持原样**(行为不允许在这次重构里变)。
 */
export function createKoiCreature({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem, drawFish }) {
const { schools, trailPoint, QUEUE_LEN, SOLO_RATIO, SCHOOL_COUNT, SCHOOL_PERCEIVE_K, SCHOOL_PERCEIVE_MIN, SEP_W, ALIGN_W, COH_W, MAX_STEER } = schoolSystem;
class Koi {
    constructor(type, opts = {}) {
        this.type = type;
        this.typeId = type.id;
        this.segmentSpacing = this.type.segmentSpacing;
        // origin 决定"谁拥有它":stock=受鱼数设置管理 / spawned=手动投放 / custom=自定义鱼。
        // (第一轮用 `!custom` 反推"是不是库存鱼",于是任何新生物都会被鱼数设置裁掉 —— 见 population.js)
        this.origin = opts.origin || 'spawned';
        // 自定义鱼才有的字段(默认锦鲤全为 null / false,不影响任何既有分支)
        this.custom = opts.custom === true;
        this.drop = null;         // 投放动画状态:{t, dur, splashed}(见 releaseFish)
        this.shape = this.type.shape ? KOI_SHAPE.clampShape(this.type.shape) : null;        // 部位倍率(见 koishape.js 的 DEFAULTS)
        this.skin = null;         // 用户涂抹的纹理(HTMLImageElement)
        this.skinReady = false;
        this.name = '';
        this.x = Math.random() * viewport.width;
        this.y = Math.random() * viewport.height;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.baseSpeed = (0.4 + Math.random() * 0.4) * this.type.speedMultiplier;
        this.maxForce = 0.03;

        // 尺寸和深浅差异:没有这个,一池鱼像复制粘贴
        this.depth = Math.random();
        this.baseSizeMul = 0.40 + this.depth * 0.56;
        this.pickBreed();
        this.sizeMul = this.baseSizeMul * this.breedSize;

        this.segments = [];
        this.numSegments = 12;
        for (let i = 0; i < this.numSegments; i++) {
            this.segments.push({ x: this.x, y: this.y });
        }
        this.angle = Math.atan2(this.vy, this.vx);
        // 运动控制器：不使用航点或路径。heading/turnRate/speed 是唯一的运动状态，
        // vx/vy 仅是由它们导出的兼容值，供既有绘制和距离逻辑使用。
        this.heading = this.angle;
        this.turnRate = 0;
        this.speed = Math.hypot(this.vx, this.vy);

        this.bodyAngle = this.heading + Math.PI;

        const bodyLen = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        this.waveFreq = 1.00 + Math.random() * 0.55;         // 摆尾频率
        this.waveLen  = 4.3 + Math.random() * 2.3;           // 沿身体的相位差(≈波长)
        this.waveEnv  = bodyLen * (0.070 + Math.random() * 0.060);   // 尾端侧向幅度(约 0.07~0.13 体长)
        // 碰撞体:一条胶囊(脊柱第 0~9 节) + 身体半宽。长条形不能用圆判定。
        this.collHalf = bodyLen * 0.5;
        this.collR    = bodyLen * this.type.collisionRadius;
        // 碰撞契约(第二轮):碰撞系统只认这个描述符,不再假设对方是 12 节锦鲤
        this.collision = { shape: 'capsule', half: this.collHalf, r: this.collR, end: this.type.collisionEnd };
        this.burstRate = 0.30 + Math.random() * 0.35;        // ④ 间歇式游动的节奏
        this.burstPhase = Math.random() * Math.PI * 2;
        this.turnBias = 0;
        this.turnBiasTarget = (Math.random() - 0.5) * 0.20;
        this.turnBiasTimer = 1.5 + Math.random() * 2.5;
        this.cruisePhase = Math.random() * Math.PI * 2;
        // 25% 独游;其余随机分到 3 个群里。不同群之间只保持间距,不互相聚合。
        // 轮转而不是随机:随机分配实测出现过 群0:25 / 群1:15 / 群2:21,
        // 三群大小差一倍,一眼就看出不是三群而是一大两小。
        this.schoolId = Math.random() < this.type.soloRatio ? -1 : (schoolSystem.nextSchool());

        this.schoolFrac = Math.random();
        this.schoolSide = (Math.random() - 0.5) * 110;
        this.slotPhase  = Math.random() * Math.PI * 2;
        this.swimCycle = Math.random() * Math.PI * 2;
        this.fedTimer = 0;

        if (this.schoolId >= 0 && schools[this.schoolId] && schools[this.schoolId].trail) {
            const sc0 = schools[this.schoolId];
            const av0 = Math.max(80, (sc0.arcLive !== undefined ? sc0.arcLive : sc0.arc) - sc0.trail[0].a);
            const ql0 = Math.min(av0, QUEUE_LEN);
            const tp0 = trailPoint(sc0, (0.05 + 0.9 * this.schoolFrac) * ql0);
            if (tp0) {
                this.x = tp0.x + (-tp0.ty) * this.schoolSide;
                this.y = tp0.y + tp0.tx * this.schoolSide;
                this.heading = Math.atan2(tp0.ty, tp0.tx);
                this.angle = this.heading;
                this.vx = Math.cos(this.heading) * this.speed;
                this.vy = Math.sin(this.heading) * this.speed;
                for (let i = 0; i < this.numSegments; i++) {
                    this.segments[i].x = this.x;
                    this.segments[i].y = this.y;
                }
            }
        }
    }

    /** 按权重随机挑一个品种(红白/黄金/孔雀…)。
     *  原来这里还有"霓虹/单色"两个主题分支(上游留下的 fishTheme 属性)——
     *  已按用户决定删掉:这个池塘是低饱和写实风,霓虹/灰阶是另一个产品,
     *  而且默认档位就是它,那个下拉对用户等于没有。 */
    pickBreed() {
        const breeds = this.type.breeds;
        let r = Math.random() * breeds.reduce((sum, b) => sum + b.w, 0), acc = 0, pick = breeds[0];
        for (let k = 0; k < breeds.length; k++) {
            acc += breeds[k].w;
            if (r <= acc) { pick = breeds[k]; break; }
        }
        this.applyBreed(pick);
    }

    applyBreed(pick) {
        this.breedId = pick.id || 'custom-palette';
        this.breed = pick.name;
        this.breedSize = pick.size || 1;
        if (this.baseSizeMul) this.sizeMul = this.baseSizeMul * this.breedSize;
        this.shape = KOI_SHAPE.clampShape(pick.shape || this.type.shape);
        this.outlineWidth = pick.outlineWidth ?? 0.10;
        const tint = (Math.random() - 0.5) * 0.18;
        this.color = varyHexColor(pick.body, tint);

        // 花纹特征
        this.net = (pick.net || 0) * (0.75 + Math.random() * 0.5);      // 每条鱼的网纹强度也有差
        this.sheen = (pick.sheen || 0) * (0.8 + Math.random() * 0.4);
        this.kuchi = pick.kuchi ? varyHexColor(pick.kuchi, tint * 0.6) : null;
        this.edge = pick.edge ? varyHexColor(pick.edge, tint * 0.6) : null;

        // ★ 必须和 Koi.draw 里的 BODY_SPAN 完全一致。
        //   这里曾经是 0.86 而 draw 里是 0.78 —— 斑块的 u 区间整体偏后,
        //   超出体长的部分还会被轮廓裁掉,看着就是"斑长错了位置"。
        const BODY_SPAN = 0.78, NSEG = 11;
        this.spotRanges = [];
        const patches = pick.patches || [];
        for (let k = 0; k < patches.length; k++) {
            const pt = patches[k];
            const segs = pt.segs || [];
            if (!segs.length) continue;
            // 段号 → u 区间。每块斑的宽度和颜色都各自独立(轻微色差更自然)
            const u0 = Math.min(BODY_SPAN, segs[0] / NSEG);
            const u1 = Math.min(BODY_SPAN, (segs[segs.length - 1] + 1) / NSEG);
            this.spotRanges.push([
                u0, u1,
                varyHexColor(pt.color, tint * 0.6),
                pt.pw || 0.5
            ]);
        }
        // 兼容旧的 heads 写法(霓虹/单色主题还在用)
        if (!patches.length && pick.heads && pick.heads.length) {
            const u0 = Math.min(BODY_SPAN, pick.heads[0] / NSEG);
            const u1 = Math.min(BODY_SPAN, (pick.heads[pick.heads.length - 1] + 1) / NSEG);
            this.spotRanges.push([u0, u1, varyHexColor(pick.spot || '#ffffff', tint * 0.6), 0.52]);
        }
    }

    /** 碰撞推开:整体位移(身体各节一起挪,否则会把鱼扯直) */
    translate(dx, dy) {
        this.x += dx; this.y += dy;
        const S = this.segments;
        for (let i = 0; i < S.length; i++) { S[i].x += dx; S[i].y += dy; }
    }
}

Object.assign(Koi.prototype, createBehavior({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem }));
Koi.prototype.draw = function(ctx) { (this.type.draw || drawFish).call(this, ctx); };

// create 是注册表用的入口;Koi 只暴露给"要继承锦鲤身体"的既有功能(自定义鱼)。
// 新生物请写自己的 creature kind,不要继承这个类。
return { create: (type, opts) => new Koi(type, opts), Koi };
}
