const DATABASE_NAME = 'koi-pond';
const DATABASE_VERSION = 1;
const STORE_NAME = 'records';
const LEGACY_PREFIX = 'koi.';

const clone = value => value == null ? value : globalThis.structuredClone
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked'));
    });
}

async function loadRecords(database) {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const finished = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);
    const [keys, values] = await Promise.all([
        requestResult(store.getAllKeys()),
        requestResult(store.getAll())
    ]);
    await finished;
    return new Map(keys.map((key, index) => [key, values[index]]));
}

async function migrateLocalStorage(database, records) {
    const legacy = [];
    try {
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (!key?.startsWith(LEGACY_PREFIX) || records.has(key)) continue;
            const raw = localStorage.getItem(key);
            if (raw == null) continue;
            try { legacy.push([key, JSON.parse(raw)]); } catch { /* Ignore invalid old records. */ }
        }
    } catch { return; }
    if (!legacy.length) return;

    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const finished = transactionDone(transaction);
    const store = transaction.objectStore(STORE_NAME);
    for (const [key, value] of legacy) store.put(value, key);
    await finished;

    for (const [key, value] of legacy) {
        records.set(key, value);
        try { localStorage.removeItem(key); } catch { /* The IndexedDB copy is already durable. */ }
    }
}

function createLocalStorageRepository() {
    return {
        getRaw(key) { try { return localStorage.getItem(key); } catch { return null; } },
        read(key, fallback = null) {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch { return fallback; }
        },
        write(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); return true; }
            catch (error) {
                console.error('[koi] 兼容存储保存失败:', key, error);
                return false;
            }
        }
    };
}

export async function createRepository() {
    if (!globalThis.indexedDB) {
        console.warn('[koi] 当前宿主不支持 IndexedDB，已使用兼容存储。');
        return createLocalStorageRepository();
    }

    let database;
    let records;
    try {
        database = await openDatabase();
        records = await loadRecords(database);
        await migrateLocalStorage(database, records);
    } catch (error) {
        database?.close();
        console.warn('[koi] 当前宿主无法启用 IndexedDB，已使用兼容存储:', error);
        return createLocalStorageRepository();
    }

    return {
        getRaw(key) {
            try { return records.has(key) ? JSON.stringify(records.get(key)) : null; }
            catch { return null; }
        },
        read(key, fallback = null) {
            try { return records.has(key) ? clone(records.get(key)) : fallback; }
            catch { return fallback; }
        },
        write(key, value) {
            let stored;
            try { stored = clone(value); }
            catch (error) {
                console.error('[koi] 无法保存不可复制的数据:', key, error);
                return false;
            }
            records.set(key, stored);
            try {
                const transaction = database.transaction(STORE_NAME, 'readwrite');
                transaction.objectStore(STORE_NAME).put(stored, key);
                transactionDone(transaction).catch(error => {
                    console.error('[koi] IndexedDB 保存失败:', key, error);
                });
                return true;
            } catch (error) {
                console.error('[koi] IndexedDB 保存失败:', key, error);
                return false;
            }
        }
    };
}
