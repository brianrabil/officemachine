import type { MediaAsset } from "./project";

export interface IndexedDbMediaStore {
  storeMediaBlob: (id: string, file: Blob) => Promise<void>;
  loadMediaUrls: (media: readonly MediaAsset[]) => Promise<Record<string, string>>;
}

export interface CreateIndexedDbMediaStoreOptions {
  databaseName: string;
  storeName?: string;
  version?: number;
}

export function createIndexedDbMediaStore(
  options: CreateIndexedDbMediaStoreOptions,
): IndexedDbMediaStore {
  const storeName = options.storeName ?? "media";
  const version = options.version ?? 1;

  function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(options.databaseName, version);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async storeMediaBlob(id, file) {
      const database = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(file, id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    async loadMediaUrls(media) {
      const database = await openDatabase();
      const entries = await Promise.all(
        media.map(
          (asset) =>
            new Promise<[string, string] | null>((resolve, reject) => {
              const request = database
                .transaction(storeName, "readonly")
                .objectStore(storeName)
                .get(asset.id);
              request.onsuccess = () => {
                if (request.result instanceof Blob) {
                  resolve([asset.id, URL.createObjectURL(request.result)]);
                  return;
                }
                resolve(null);
              };
              request.onerror = () => reject(request.error);
            }),
        ),
      );
      database.close();
      return Object.fromEntries(entries.filter((entry) => entry !== null));
    },
  };
}
