const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadModule(file) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

(async () => {
    const values = new Map();
    global.localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
        key: index => [...values.keys()][index] ?? null,
        get length() { return values.size; }
    };

    const { createRepository } = await loadModule('src/storage/repository.js');
    const repository = await createRepository();
    assert.equal(repository.write('koi.test', { ok: true }), true);
    assert.deepEqual(repository.read('koi.test'), { ok: true });

    const mouse = { x: null, y: null, active: false };
    const { createInputRouter } = await loadModule('src/input/input-router.js');
    const router = createInputRouter(mouse);
    let action = null;
    router.register('startle', () => { action = 'startle'; });
    router.register('feed', () => { action = 'feed'; });

    router.activate(10, 20);
    assert.equal(action, 'startle');
    assert.equal(mouse.active, true);
    assert.ok(mouse.startleUntil > performance.now());

    router.setMode('feed');
    router.move(30, 40);
    router.activate(30, 40);
    assert.equal(action, 'feed');
    assert.equal(mouse.active, false);
    console.log('storage fallback and input modes: ok');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
