import { KOI_BREEDS } from './breeds.js';
import { SOLO_RATIO } from './schools.js';

// Fixed 12-point spine in this renderer. New skeletons require a new renderer/controller.
export const KOI_TYPE = {
    id: 'koi', name: '中国淡水鱼', segmentSpacing: 5,
    shape: null, speedMultiplier: 1, turnRadius: 2.5,
    soloRatio: SOLO_RATIO, collisionRadius: 0.115, collisionEnd: 9,
    breeds: KOI_BREEDS
};

export function createFishTypes() {
    const types = new Map();
    function register(definition) {
        const d = { ...KOI_TYPE, ...definition };
        if (!/^[a-z][a-z0-9-]*$/.test(d.id) || types.has(d.id)) throw new Error('Invalid or duplicate fish type: ' + d.id);
        for (const key of ['segmentSpacing', 'speedMultiplier', 'turnRadius', 'collisionRadius']) {
            if (!Number.isFinite(d[key]) || d[key] <= 0) throw new Error('Invalid fish parameter: ' + key);
        }
        if (!Number.isFinite(d.soloRatio) || d.soloRatio < 0 || d.soloRatio > 1) throw new Error('Invalid soloRatio');
        if (!Number.isInteger(d.collisionEnd) || d.collisionEnd < 1 || d.collisionEnd > 11) throw new Error('Invalid collisionEnd');
        if (!Array.isArray(d.breeds) || !d.breeds.length || d.breeds.some(b => !b.id || !(b.w > 0))) throw new Error('Invalid breeds');
        if (d.draw !== undefined && typeof d.draw !== 'function') throw new Error('Invalid fish renderer');
        d.shape = d.shape ? Object.freeze({ ...d.shape }) : null;
        d.breeds = Object.freeze(d.breeds.map(b => Object.freeze({ ...b })));
        types.set(d.id, Object.freeze(d));
    }
    register(KOI_TYPE);
    return {
        register,
        get(id) { if (!types.has(id)) throw new Error('Unknown fish type: ' + id); return types.get(id); },
        list: () => [...types.values()]
    };
}
