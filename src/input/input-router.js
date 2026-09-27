export function createInputRouter(mouse) {
    const actions = new Map();
    let mode = 'feed';
    return {
        move(x, y) { mouse.x = x; mouse.y = y; mouse.active = true; },
        leave() { mouse.active = false; },
        register(name, action) {
            if (actions.has(name)) throw new Error('Duplicate input mode: ' + name);
            actions.set(name, action);
            return () => actions.delete(name);
        },
        setMode(name) { if (!actions.has(name)) throw new Error('Unknown input mode: ' + name); mode = name; },
        activate(x, y) { actions.get(mode)?.(x, y); },
        dispose() { actions.clear(); mouse.active = false; }
    };
}
