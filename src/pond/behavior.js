import { distanceSq } from '../shared/math.js';

export function createBehavior({ config, viewport, time, kois, foods, mouse, spawnRipple, schoolSystem }) {
const { schools, trailPoint, QUEUE_LEN, SOLO_RATIO, SCHOOL_COUNT, SCHOOL_PERCEIVE_K, SCHOOL_PERCEIVE_MIN, SEP_W, ALIGN_W, COH_W, MAX_STEER } = schoolSystem;
const FOOD_DETECT_RADIUS_SQ = 230400;
const EAT_RADIUS = 20;          // 吃到半径(px)。原来只写了平方值,身体判定要用原值
const EAT_RADIUS_SQ = 400;
const FEAR_RADIUS_SQ = 40000;
function computeFlockInfluence() {
        let sepX = 0, sepY = 0, alignX = 0, alignY = 0;
        let centerX = 0, centerY = 0, neighborCount = 0;
        let pushX = 0, pushY = 0, separationPressure = 0;
        const ownLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;

        for (let i = 0; i < kois.length; i++) {
            const other = kois[i];
            if (other === this) continue;
            const dx = this.x - other.x, dy = this.y - other.y;
            const d = Math.hypot(dx, dy);
            if (d < 0.001) continue;

            const otherLength = (other.numSegments - 1) * other.segmentSpacing * config.fishSize * other.sizeMul;

            const personalSpace = (ownLength + otherLength) * 0.60;
            const perception = Math.max(SCHOOL_PERCEIVE_MIN, (ownLength + otherLength) * SCHOOL_PERCEIVE_K);
            if (d > perception) continue;

            if (d < personalSpace) {
                const pressure = 1 - d / personalSpace;
                const nx = dx / d, ny = dy / d;

                sepX += nx * pressure;
                sepY += ny * pressure;
                separationPressure = Math.max(separationPressure, pressure);
            }

            if (this.schoolId >= 0 && this.schoolId === other.schoolId) {
                neighborCount++;
                alignX += other.vx;
                alignY += other.vy;
                centerX += other.x;
                centerY += other.y;
            }
        }

        let forceX = 0, forceY = 0;
        const sepLength = Math.hypot(sepX, sepY);
        if (sepLength > 0.001) {
            forceX += sepX / sepLength * SEP_W;
            forceY += sepY / sepLength * SEP_W;
        }
        if (neighborCount > 0) {
            const alignLength = Math.hypot(alignX, alignY);
            if (alignLength > 0.001) {                 // 对齐:跟上同群的平均朝向
                forceX += alignX / alignLength * ALIGN_W;
                forceY += alignY / alignLength * ALIGN_W;
            }
            const cohesionX = centerX / neighborCount - this.x;
            const cohesionY = centerY / neighborCount - this.y;
            const cohesionLength = Math.hypot(cohesionX, cohesionY);
            if (cohesionLength > 0.001) {              // 聚合:朝同群邻居的质心靠
                forceX += cohesionX / cohesionLength * COH_W;
                forceY += cohesionY / cohesionLength * COH_W;
            }
        }

        const turnFrom = (fx, fy, cap) => {
            const len = Math.hypot(fx, fy);
            if (len < 0.001) return 0;
            const h = Math.atan2(fy, fx);
            return Math.atan2(Math.sin(h - this.heading), Math.cos(h - this.heading)) * Math.min(cap, len) * 1.25;
        };
        return {
            turn: turnFrom(forceX, forceY, MAX_STEER),
            sepTurn: turnFrom(sepX / (sepLength || 1) * SEP_W, sepY / (sepLength || 1) * SEP_W, MAX_STEER),
            pushX,
            pushY,
            pressure: separationPressure
        };
    }

function bodyTouchesFood(f) {
        const S = this.segments;
        // 判定半径 = 身体半宽 + 一点嘴的够得着范围。
        // 不能用 EAT_RADIUS + collR(=28px):那样食物在鼻前 25px 就"算碰到身体"了,
        // 看起来是饲料凭空消失,而不是鱼游过去吃掉的。
        const rr = this.collR + 11;
        const n = Math.min(10, S.length);
        for (let i = 0; i < n; i++) {
            const dx = f.x - S[i].x, dy = f.y - S[i].y;
            if (dx * dx + dy * dy < rr * rr) return true;
        }
        return false;
    }

function update(dt) {
        const collisionLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        this.collHalf = collisionLength * 0.5;
        this.collR = collisionLength * this.type.collisionRadius;
        let dtMult = dt * 60;

        if (this.drop) {
            this.drop.t += dt;
            const p = this.drop.t / this.drop.dur;
            this.speed = 0;                                  // 下落中不游
            if (!this.drop.splashed && p >= 0.55) {
                this.drop.splashed = true;
                const c = this.segments[0];
                const rs = config.rippleStrength;
                // 三圈同心、扩散速度不同:一圈是"点了一下",三圈才像"扑通"
                spawnRipple(c.x, c.y, 3.2 * rs);   // 一道大涟漪(不再叠三圈)
            }
            if (p >= 1) { this.drop = null; this.speed = 2.4; }   // 入水后窜一下,别原地飘
        }
        if (this.fedTimer > 0) this.fedTimer -= dtMult;

        let target = null;
        let minDistSq = Infinity;
        if (this.fedTimer <= 0) {
            for (let i = 0; i < foods.length; i++) {
                let dSq = distanceSq(this, foods[i]);
                if (dSq < minDistSq) {
                    minDistSq = dSq;
                    target = foods[i];
                }
            }
        }

        let effectiveBaseSpeed = this.baseSpeed * config.fishSpeed;
        const bodyLength = (this.numSegments - 1) * this.segmentSpacing * config.fishSize * this.sizeMul;
        const motionTurnRadius = config.motionTurnRadius ?? 1;
        const motionTurnResponse = config.motionTurnResponse ?? 1;
        const motionCruiseCurve = config.motionCruiseCurve ?? 1;
        // 锦鲤平时至少以约 2.5 个身长的半径转弯；速度高时才允许收紧弧线。
        const minimumTurnRadius = bodyLength * this.type.turnRadius * motionTurnRadius;
        const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        let desiredTurnRate = 0;
        let desiredSpeed = effectiveBaseSpeed;
        let behavior = 'cruise';
        let wantHeading = null;   // 本行为想去哪个方向(原地掉头要用)
        const flock = this.computeFlockInfluence();

        const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
        const safeMargin = Math.max(50, bodyLength * 1.0);
        const probeDistance = Math.max(minimumTurnRadius * 1.15, this.speed * 60 * 0.9);
        let inwardX = 0, inwardY = 0, threat = 0;
        const consider = (room, comp, ix, iy) => {
            if (comp <= 0.02) return;                  // 背离这面墙 → 不会撞,不产生威胁
            const t = (room - safeMargin) / (comp * probeDistance);
            if (t < 1) {
                const w = 1 - Math.max(0, t);
                if (w > threat) { threat = w; inwardX = ix; inwardY = iy; }
            }
        };
        consider(viewport.width - this.x, fx, -1, 0);
        consider(this.x, -fx, 1, 0);
        consider(viewport.height - this.y, fy, 0, -1);
        consider(this.y, -fy, 0, 1);
        let edgeThreat = clamp(threat, 0, 1);

        const wantsFood = !!target && minDistSq < FOOD_DETECT_RADIUS_SQ;
        const foodWins = wantsFood && edgeThreat < 0.5;
        if (edgeThreat > 0.04 && !foodWins) {
            behavior = 'edge';
            let inwardHeading = Math.atan2(inwardY, inwardX);
            wantHeading = inwardHeading;
            desiredTurnRate = clamp(wrapAngle(inwardHeading - this.heading) * 3.0, -1.45, 1.45);
            desiredSpeed = effectiveBaseSpeed * (1.0 - edgeThreat * 0.20);
        } else if (foodWins) {
            behavior = 'food';
            let foodHeading = Math.atan2(target.y - this.y, target.x - this.x);
            wantHeading = foodHeading;
            desiredTurnRate = clamp(wrapAngle(foodHeading - this.heading) * 2.6, -1.45, 1.45);

            const fd = Math.sqrt(minDistSq);

            const near = clamp((fd - 14) / 110, 0.34, 1);
            desiredSpeed = effectiveBaseSpeed * 2.20 * near;   // 追饵冲刺(原 1.70)

            if (minDistSq < EAT_RADIUS_SQ || this.bodyTouchesFood(target)) {
                foods.splice(foods.indexOf(target), 1);
                this.onEat?.();
                this.fedTimer = 51;
            }

        } else if (config.shyFish && mouse.active && distanceSq(this, mouse) < FEAR_RADIUS_SQ) {
            behavior = 'flee';
            let fleeHeading = Math.atan2(this.y - mouse.y, this.x - mouse.x);
            wantHeading = fleeHeading;
            desiredTurnRate = clamp(wrapAngle(fleeHeading - this.heading) * 2.7, -1.35, 1.35);
            desiredSpeed = effectiveBaseSpeed * 2.80;   // 受惊逃窜(原 2.15)
        } else if (this.schoolId >= 0 && schools[this.schoolId]) {

            behavior = 'school';
            const s = schools[this.schoolId];

            const arcNow = (s.arcLive !== undefined ? s.arcLive : s.arc);
            const avail = Math.max(80, arcNow - (s.trail && s.trail.length ? s.trail[0].a : 0));
            const queueLen = Math.min(avail, QUEUE_LEN);

            const wantBack = (0.05 + 0.9 * this.schoolFrac) * QUEUE_LEN;
            const back = Math.min(wantBack, Math.max(30, avail - 30));
            const tp = trailPoint(s, back
                                     + Math.sin(time.elapsed * 0.35 + this.slotPhase) * 16);
            const fwd = s.curSpeed || s.speed;
            let tx = this.x, ty = this.y;
            if (tp) {
                const pnx = -tp.ty, pny = tp.tx;          // 路径法线 = 队伍的横向厚度
                const side = this.schoolSide
                           + Math.cos(time.elapsed * 0.29 + this.slotPhase) * 10;
                tx = tp.x + pnx * side;
                ty = tp.y + pny * side;
            }

            const kp = 0.008;
            const fwdX = tp ? tp.tx : Math.cos(s.heading);
            const fwdY = tp ? tp.ty : Math.sin(s.heading);
            const dvx = fwdX * fwd + (tx - this.x) * kp;
            const dvy = fwdY * fwd + (ty - this.y) * kp;
            const dvLen = Math.hypot(dvx, dvy);
            if (dvLen > 0.001) {
                const wantH = Math.atan2(dvy, dvx);
                wantHeading = wantH;
                desiredTurnRate = clamp(wrapAngle(wantH - this.heading) * 2.2, -1.20, 1.20);

                const err = Math.hypot(tx - this.x, ty - this.y);
                const catchUp = Math.min(2.6, 1 + err / 90);
                desiredSpeed = Math.min(dvLen, fwd * catchUp);
            }
        } else {
            // 有记忆的巡游偏向：短时间内保持同侧的微弯，之后才柔和地换侧。
            this.turnBiasTimer -= dt;
            if (this.turnBiasTimer <= 0) {
                this.turnBiasTarget = (Math.random() - 0.5) * 0.26;
                this.turnBiasTimer = 1.8 + Math.random() * 3.2;
            }
            this.turnBias += (this.turnBiasTarget - this.turnBias) * Math.min(1, dt / 1.25);
            desiredTurnRate = this.turnBias * motionCruiseCurve;
            this.cruisePhase += dt * 0.42;

            this.burstPhase += dt * this.burstRate;
            desiredSpeed = effectiveBaseSpeed * (0.78 + 0.34 * (0.5 + 0.5 * Math.sin(this.burstPhase)));
            // 走到这里的一定是独游的鱼(schoolId = -1):群员都在上面的 school 分支里。
        }

        this.lastBehavior = behavior;   // 诊断用:可以随时在控制台/--eval 里查每条鱼走的分支
        // 行为优先级仍由上面的分支决定；群体力只做局部修正。
        // 追食时保留 60% 分离，既能围食也不会让鱼身体互相穿过。
        if (behavior !== 'edge') {
            if (behavior === 'school') {
                // 群员只吃分离:方向和对齐由编队目标点负责,见 computeFlockInfluence 的注释
                desiredTurnRate += flock.sepTurn * 0.30;
            } else {
                const flockWeight = behavior === 'food' ? 0.60 : behavior === 'flee' ? 0.45 : 1.0;
                desiredTurnRate += flock.turn * flockWeight;
            }
        }

        // 全局转向响应只调整运动手感，不改变行为优先级。
        desiredTurnRate *= motionTurnResponse;

        let pivot = false;

        if (wantHeading !== null && behavior !== 'school') {

            pivot = Math.abs(wrapAngle(wantHeading - this.heading)) > 2.39;
        }

        if (pivot) this.pivotTimer = 0.8;
        else if (this.pivotTimer > 0) { this.pivotTimer -= dt; pivot = true; }
        if (pivot) {
            desiredTurnRate = clamp(wrapAngle(wantHeading - this.heading) * 2.6, -2.6, 2.6);
            desiredSpeed = Math.min(desiredSpeed, effectiveBaseSpeed * 0.36);
        }
        this.lastPivot = pivot;      // 诊断用:可随时查哪些鱼正在原地掉头

        // 转向率和速度都有惯性；这里不再直接覆盖 vx/vy。
        const speedPerSecond = Math.max(this.speed, effectiveBaseSpeed * 0.42) * 60;

        // ★ 判断条件用 schoolId,不能用 behavior —— 'school' 行为分支已经删掉了,
        //   继续按 behavior 判断的话群员会拿回 2.5 身长的转弯半径,又跟不住领头鱼。

        let turnRadius = minimumTurnRadius;
        if (pivot) turnRadius = minimumTurnRadius * 0.05;          // 原地掉头:半径压到最小
        else if (behavior === 'food') turnRadius = minimumTurnRadius * 0.26;
        else if (this.schoolId >= 0) turnRadius = minimumTurnRadius * 0.32;

        const fastAct = (behavior === 'food' || behavior === 'flee');
        const maxTurnRate = Math.min(pivot ? 2.6 : (fastAct ? 1.6 : 1.15),
                                     speedPerSecond / turnRadius);
        const turnAcceleration = (pivot ? 7.0 : 2.6) * motionTurnResponse; // 掉头时转向要起得来
        desiredTurnRate = clamp(desiredTurnRate, -maxTurnRate, maxTurnRate);
        this.turnRate += clamp(desiredTurnRate - this.turnRate, -turnAcceleration * dt, turnAcceleration * dt);
        this.turnRate = clamp(this.turnRate, -maxTurnRate, maxTurnRate);
        this.heading = wrapAngle(this.heading + this.turnRate * dt);

        let speedResponse = desiredSpeed > this.speed ? 1.8 : 1.15;
        // 掉头时减速要快:时间常数从 ~0.9 秒压到 ~0.29 秒,否则 0.8 秒的窗口里掉不下来
        if (pivot) speedResponse = 3.5;

        if (behavior === 'food' || behavior === 'flee') speedResponse = 4.5;
        this.speed += (desiredSpeed - this.speed) * Math.min(1, speedResponse * dt);
        // 上限要容得下新的倍率(2.8),否则躲鼠标的速度会被夹在 2.2 倍,提不起来
        let speedCap = effectiveBaseSpeed * 3.2;
        let speedFloor = effectiveBaseSpeed * 0.42;
        if (this.schoolId >= 0 && schools[this.schoolId]) {

            // 循迹之后不需要大范围变速:上限收到 1.5 倍,避免"为了抢位置而冲刺"
            const ls = schools[this.schoolId].speed;
            speedCap = Math.max(speedCap, ls * 2.6);   // 群员仍只跟到领头鱼的 2.6 倍
            speedFloor = Math.min(speedFloor, ls * 0.55);
        }
        this.speed = clamp(this.speed, speedFloor, speedCap);
        this.vx = Math.cos(this.heading) * this.speed;
        this.vy = Math.sin(this.heading) * this.speed;
        this.x += this.vx * dtMult;
        this.y += this.vy * dtMult;
        // 这里不再加 flock.push —— 位置的消重叠统一由 resolveFishCollisions() 负责

        // 兜底而非日常边界策略：若浏览器卡顿导致跨出画布，立即反射朝外分量。
        if (this.x < 0) { this.x = 0; this.heading = Math.atan2(Math.sin(this.heading), Math.abs(Math.cos(this.heading))); this.turnRate = 0; }
        if (this.x > viewport.width) { this.x = viewport.width; this.heading = Math.atan2(Math.sin(this.heading), -Math.abs(Math.cos(this.heading))); this.turnRate = 0; }
        if (this.y < 0) { this.y = 0; this.heading = Math.atan2(Math.abs(Math.sin(this.heading)), Math.cos(this.heading)); this.turnRate = 0; }
        if (this.y > viewport.height) { this.y = viewport.height; this.heading = Math.atan2(-Math.abs(Math.sin(this.heading)), Math.cos(this.heading)); this.turnRate = 0; }
        this.vx = Math.cos(this.heading) * this.speed;
        this.vy = Math.sin(this.heading) * this.speed;

        // 游速主要通过尾拍频率表现；尾幅不随速度夸张放大。
        this.swimCycle += (1.45 + this.speed * 60 * 0.075) * dt;
        this.angle = this.heading;

        this.segments[0].x = this.x;
        this.segments[0].y = this.y;

        let currentSpacing = this.segmentSpacing * config.fishSize * this.sizeMul;   // 少了 sizeMul 的话,大鱼只是变胖不变长

        // 逐节跟随必须**限制每一节相对上一节的转角**。
        // 原来只固定距离、方向完全由上一帧的旧位置决定 —— 头一急转,或者某一帧 dt 变大
        // 让头跳得比节距还远,后面几节就会朝反方向落下去,鱼把自己对折(实测出现过 cos=-1)。

        const MAX_JOINT_TURN = 0.17;                   // 空间:相邻节最大夹角(几何量)
        const MAX_JOINT_RATE = 3.5;                    // 时间:同一关节每秒最多转多少
        const maxJointTurn = MAX_JOINT_TURN;
        const maxJointStep = MAX_JOINT_RATE * dt;
        // ★ 起始角持久化:让第一关节也受限(原来这里是 null,第一关节因此不受限)
        let prevAngle = this.bodyAngle;
        let firstJointAngle = null;   // ★ 要存【第一节】的角度,不是最后一节
        if (!this.jointAngles) this.jointAngles = [];
        for (let i = 1; i < this.numSegments; i++) {
            let prev = this.segments[i - 1];
            let curr = this.segments[i];

            let dx = prev.x - curr.x;
            let dy = prev.y - curr.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            let a = dist > 0.001
                ? Math.atan2(dy, dx)
                : (prevAngle !== null ? prevAngle : this.angle + Math.PI);

            if (prevAngle !== null) {
                let d = Math.atan2(Math.sin(a - prevAngle), Math.cos(a - prevAngle));
                a = prevAngle + Math.max(-maxJointTurn, Math.min(maxJointTurn, d));
            }
            curr.x = prev.x - Math.cos(a) * currentSpacing;
            curr.y = prev.y - Math.sin(a) * currentSpacing;

            const pa = this.jointAngles[i];
            if (pa !== undefined) {
                const d2 = Math.atan2(Math.sin(a - pa), Math.cos(a - pa));
                a = pa + Math.max(-maxJointStep, Math.min(maxJointStep, d2));
            }
            this.jointAngles[i] = a;
            if (i === 1) firstJointAngle = a;
            prevAngle = a;
        }

        if (firstJointAngle !== null) this.bodyAngle = firstJointAngle;

    }

return { computeFlockInfluence, bodyTouchesFood, update };
}
