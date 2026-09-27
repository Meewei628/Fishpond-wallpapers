export const KOI_BREEDS = [
    // patches: 多块斑,每块 = { segs:[连续段号], color, pw:相对体宽(0~0.72) }
    //   —— 一块斑是"贴纸",两三块大小不一、颜色微差才是锦鲤
    // net   鳞片网强度(網目/松葉,最能拉开质感的一项)
    // sheen 金属光泽(黄金/孔雀这类亮皮)
    // kuchi 红唇(红白常见)   edge 腹侧红边(浅黄的标志)
    { name: '红白', body: '#f6f3ea', w: 0.25, net: 0.055, kuchi: '#e0562a',
      patches: [ { segs: [1, 2],    color: '#e0562a', pw: 0.60 },
                 { segs: [6, 7],    color: '#e34f24', pw: 0.46 } ] },

    { name: '大正三色', body: '#f6f3ea', w: 0.15, net: 0.055,
      patches: [ { segs: [2, 3],    color: '#dc4a20', pw: 0.58 },
                 { segs: [4, 5],    color: '#2a241c', pw: 0.28 },
                 { segs: [7, 8],    color: '#2a241c', pw: 0.22 } ] },

    { name: '昭和三色', body: '#3b352b', w: 0.09, net: 0.075, sheen: 0.14,
      patches: [ { segs: [1, 2, 3], color: '#eae5d8', pw: 0.60 },
                 { segs: [5, 6],    color: '#d8441c', pw: 0.50 } ] },

    { name: '白别甲', body: '#f6f3ea', w: 0.11, net: 0.060,
      patches: [ { segs: [2, 3],    color: '#2a241c', pw: 0.40 },
                 { segs: [6, 7],    color: '#2a241c', pw: 0.34 } ] },

    { name: '黄金', body: '#eab842', w: 0.14, net: 0.10, sheen: 0.30,
      patches: [] },

    { name: '孔雀', body: '#e0a83c', w: 0.08, net: 0.17, sheen: 0.26,
      patches: [ { segs: [3, 4, 5], color: '#d2571e', pw: 0.48 } ] },

    { name: '浅黄', body: '#9db8c8', w: 0.08, net: 0.15, edge: '#c0483a',
      patches: [] },

    { name: '绯', body: '#dd5322', w: 0.10, net: 0.05, sheen: 0.15,
      patches: [] }
];

const ids=['kohaku','taisho-sanke','showa-sanke','shiro-bekko','ogon','kujaku','asagi','hi'];
KOI_BREEDS.forEach((b,i)=>{b.id=ids[i];});
