export function attachBrowserInput(router, canvas) {
    const move = e => router.move(e.clientX, e.clientY);
    const leave = () => router.leave();
    const click = e => { if (!e.defaultPrevented && e.target === canvas) router.activate(e.clientX, e.clientY); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseout', leave);
    window.addEventListener('click', click);
    return () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseout', leave);
        window.removeEventListener('click', click);
    };
}
