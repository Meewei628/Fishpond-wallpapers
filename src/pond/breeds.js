// 中国常见淡水鱼。继续沿用既有 breeds 数据入口，避免另建一套生物系统。
// shape 是俯视轮廓倍率；patches 是沿脊柱分布的背部斑纹。
export const KOI_BREEDS = [
    {
        id: 'grass-carp', name: '草鱼', w: 0.15, body: '#87906f', size: 1.08,
        net: 0.20, sheen: 0.05, outlineWidth: 0.10,
        shape: { bodyLen: 1.14, bodyH: 0.72, headW: 0.94, tailW: 0.88, tailFin: 0.86, fin: 0.82, eye: 0.82 },
        patches: []
    },
    {
        id: 'crucian-carp', name: '鲫鱼', w: 0.13, body: '#a9aa8b', size: 0.82,
        net: 0.15, sheen: 0.09, outlineWidth: 0.11,
        shape: { bodyLen: 0.90, bodyH: 1.24, headW: 0.88, tailW: 0.82, tailFin: 0.82, fin: 0.88, eye: 0.92 },
        patches: []
    },
    {
        id: 'common-carp', name: '鲤鱼', w: 0.13, body: '#a37b43', size: 1.00,
        net: 0.24, sheen: 0.10, outlineWidth: 0.12,
        shape: { bodyLen: 1.02, bodyH: 1.02, headW: 1.08, tailW: 0.94, tailFin: 0.96, fin: 1.00, eye: 0.86 },
        patches: []
    },
    {
        id: 'silver-carp', name: '鲢鱼', w: 0.11, body: '#c5c9bd', size: 1.04,
        net: 0.08, sheen: 0.15, outlineWidth: 0.08,
        shape: { bodyLen: 1.00, bodyH: 1.04, headW: 1.12, tailW: 0.82, tailFin: 0.88, fin: 0.92, eye: 0.72 },
        patches: []
    },
    {
        id: 'bighead-carp', name: '鳙鱼（花鲢）', w: 0.10, body: '#8e9182', size: 1.08,
        net: 0.06, sheen: 0.05, outlineWidth: 0.10,
        shape: { bodyLen: 0.98, bodyH: 1.12, headW: 1.42, tailW: 0.82, tailFin: 0.88, fin: 0.94, eye: 0.72 },
        patches: [
            { segs: [1, 2], color: '#62685d', pw: 0.42 },
            { segs: [4, 5], color: '#6d7065', pw: 0.56 },
            { segs: [7, 8], color: '#5b625a', pw: 0.38 }
        ]
    },
    {
        id: 'black-carp', name: '青鱼', w: 0.10, body: '#465b59', size: 1.12,
        net: 0.22, sheen: 0.07, outlineWidth: 0.10,
        shape: { bodyLen: 1.15, bodyH: 0.80, headW: 0.98, tailW: 0.92, tailFin: 0.88, fin: 0.84, eye: 0.78 },
        patches: []
    },
    {
        id: 'mandarin-fish', name: '鳜鱼', w: 0.08, body: '#9a8954', size: 0.88,
        net: 0.05, sheen: 0.03, outlineWidth: 0.14,
        shape: { bodyLen: 0.88, bodyH: 1.32, headW: 1.36, tailW: 0.82, tailFin: 1.02, fin: 1.18, eye: 1.12 },
        patches: [
            { segs: [1, 2], color: '#4b4938', pw: 0.62 },
            { segs: [4, 5], color: '#5a5034', pw: 0.52 },
            { segs: [7], color: '#403f34', pw: 0.46 }
        ]
    },
    {
        id: 'snakehead', name: '乌鳢（黑鱼）', w: 0.08, body: '#4c5542', size: 0.96,
        net: 0.03, sheen: 0.02, outlineWidth: 0.12,
        shape: { bodyLen: 1.22, bodyH: 0.62, headW: 1.22, tailW: 0.88, tailFin: 0.66, fin: 0.64, eye: 0.76 },
        patches: [
            { segs: [1], color: '#252d28', pw: 0.62 },
            { segs: [3], color: '#31362d', pw: 0.68 },
            { segs: [5], color: '#242c27', pw: 0.64 },
            { segs: [7], color: '#30372d', pw: 0.58 },
            { segs: [9], color: '#222a26', pw: 0.48 }
        ]
    },
    {
        id: 'yellow-catfish', name: '黄颡鱼', w: 0.06, body: '#b99a45', size: 0.75,
        net: 0, sheen: 0.04, outlineWidth: 0.13,
        shape: { bodyLen: 1.08, bodyH: 0.70, headW: 1.38, tailW: 0.72, tailFin: 0.74, fin: 1.18, eye: 0.86 },
        patches: [
            { segs: [1, 2], color: '#5f562f', pw: 0.58 },
            { segs: [5, 6], color: '#625833', pw: 0.50 }
        ]
    },
    {
        id: 'wuchang-bream', name: '武昌鱼（团头鲂）', w: 0.06, body: '#8f9b8d', size: 0.85,
        net: 0.12, sheen: 0.08, outlineWidth: 0.10,
        shape: { bodyLen: 0.78, bodyH: 1.58, headW: 0.78, tailW: 0.72, tailFin: 0.86, fin: 0.90, eye: 0.92 },
        patches: [
            { segs: [3], color: '#68766c', pw: 0.60 },
            { segs: [5], color: '#647268', pw: 0.62 },
            { segs: [7], color: '#607067', pw: 0.56 }
        ]
    }
];
