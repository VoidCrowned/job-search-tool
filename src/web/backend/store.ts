// Key-value storage for the online version: IndexedDB in the browser (plenty of room for many letters),
// an in-memory map in tests.

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  /** All keys starting with `prefix`. */
  keys(prefix: string): Promise<string[]>;
}

export function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      // Copies, like IndexedDB, so callers can't change stored objects by accident.
      return data.has(key) ? (structuredClone(data.get(key)) as T) : undefined;
    },
    async set(key, value) {
      data.set(key, structuredClone(value));
    },
    async keys(prefix) {
      return [...data.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

const DB_NAME = 'job-search';
const STORE = 'data';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function indexedDbStore(): KeyValueStore {
  let db: Promise<IDBDatabase> | undefined;
  const open = () => {
    db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return db;
  };
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);
  return {
    async get<T>(key: string) {
      return (await request((await store('readonly')).get(key))) as T | undefined;
    },
    async set(key, value) {
      await request((await store('readwrite')).put(value, key));
    },
    async keys(prefix) {
      const all = await request((await store('readonly')).getAllKeys());
      return all.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
    },
  };
}
