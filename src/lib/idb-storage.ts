import type { StateStorage } from "zustand/middleware";

const DB_NAME = "saycut";
const STORE_NAME = "state";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDB().then((db) => {
    const t = db.transaction(STORE_NAME, mode);
    return t.objectStore(STORE_NAME);
  });
}

export const idbStorage: StateStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const store = await tx("readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  removeItem: async (key: string): Promise<void> => {
    const store = await tx("readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
};
