export function createInputRouter(mouse) {
    const actions = new Map();
    let mode = 'startle';
    const startle = (x, y) => {
        mouse.x = x;
        mouse.y = y;
        mouse.active = true;
        mouse.startleUntil = performance.now() + 650;
    };
    return {
        move(x, y) {
            mouse.x = x;
            mouse.y = y;
            mouse.active = mode !== 'feed';
        },
        leave() { mouse.active = false; },
        register(name, action) {
            if (actions.has(name)) throw new Error('Duplicate input mode: ' + name);
            actions.set(name, action);
            return () => actions.delete(name);
        },
        setMode(name) {
            if (!actions.has(name)) throw new Error('Unknown input mode: ' + name);
            mode = name;
            mouse.active = false;
        },
        activate(x, y) {
            if (mode === 'feed') {
                mouse.x = x;
                mouse.y = y;
                mouse.active = false;
            } else {
                startle(x, y);
            }
            actions.get(mode)?.(x, y);
        },
        startle,
        getMode: () => mode,
        dispose() { actions.clear(); mouse.active = false; mouse.startleUntil = 0; }
    };
}
