
export function createFood({  }) {
const PELLET_SPRITES = [];
(function buildPelletSprites() {
    const S = 32;
    for (let v = 0; v < 5; v++) {
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        // 四个角各自抖动 → 不规则四边形
        const pad = 5.5 + Math.random() * 3.5;
        const jit = () => (Math.random() - 0.5) * 7;
        const pts = [
            [pad + jit(), pad + jit()],
            [S - pad + jit(), pad + jit()],
            [S - pad + jit(), S - pad + jit()],
            [pad + jit(), S - pad + jit()]
        ];
        // 浅棕:左上来光 → 右下略暗
        const grd = g.createLinearGradient(0, 0, S, S);
        grd.addColorStop(0.00, '#cfb089');
        grd.addColorStop(0.55, '#b8946a');
        grd.addColorStop(1.00, '#9c7952');
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 4; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fillStyle = grd;
        g.fill();
        // 同色描一圈圆角:把四角的尖磨掉,读起来是"颗粒"而不是"色块"
        g.lineJoin = 'round';
        g.lineWidth = 3.4;
        g.strokeStyle = grd;
        g.stroke();
        // 一点高光,别太平
        g.beginPath();
        g.ellipse(S * 0.38, S * 0.33, S * 0.13, S * 0.085, -0.5, 0, Math.PI * 2);
        g.fillStyle = 'rgba(244,232,212,0.45)';
        g.fill();
        PELLET_SPRITES.push(c);
    }
})();

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 1.9 + Math.random() * 1.4;   // 一小把里颗粒有大有小
        this.sprite = PELLET_SPRITES[(Math.random() * PELLET_SPRITES.length) | 0];
        this.spin = Math.random() * Math.PI * 2;   // 每粒自己的朝向
        this.life = 1000;
        this.pop = 1;                              // 落水弹一下

        this.sink = 0;
        this.sinkRate = 0.10 + Math.random() * 0.08;
        const a = Math.random() * Math.PI * 2;
        this.dvx = Math.cos(a) * (0.10 + Math.random() * 0.18);   // 各粒漂移方向不同
        this.dvy = Math.sin(a) * (0.06 + Math.random() * 0.12);
        this.swirl = Math.random() * Math.PI * 2;                 // 回旋相位
    }
    update(dt) {
        let dtMult = dt * 60;
        this.life -= 1 * dtMult;
        if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 4.5);
        if (this.sink < 1) {
            this.sink = Math.min(1, this.sink + dt * this.sinkRate);
            // 水流漂移 + 一点回旋,像悬浮在水里而不是钉在原地
            this.swirl += dt * 0.6;
            this.x += (this.dvx + Math.cos(this.swirl) * 0.06) * dtMult;
            this.y += (this.dvy + Math.sin(this.swirl * 0.8) * 0.05) * dtMult;
        }
    }
    draw(ctx) {
        // 快没了就缩一下,不要"啪"地消失
        let fade = this.life < 90 ? Math.max(0, this.life / 90) : 1;
        let deep = this.sink;

        let d = this.radius * 2.0 * (1 + this.pop * 0.55) * (0.55 + 0.45 * fade) * (1 - deep * 0.30);
        // 越沉越淡(水把它吸收掉了),但不至于消失 —— 沉到底的饵鱼也能看见
        ctx.save();
        ctx.globalAlpha = fade * (1 - deep * 0.55);
        ctx.translate(this.x, this.y);
        ctx.rotate(this.spin);
        ctx.drawImage(this.sprite, -d / 2, -d / 2, d, d);
        ctx.restore();
    }
}

return { Food };
}
