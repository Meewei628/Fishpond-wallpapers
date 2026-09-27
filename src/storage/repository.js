export function createRepository() {
    return {
        getRaw(key) { try { return localStorage.getItem(key); } catch { return null; } },
        read(key, fallback = null) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } },
        write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
    };
}
