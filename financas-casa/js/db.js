/* Banco local (IndexedDB). Nada sai do celular.
   Stores:
   - profiles: perfis (id, nome, preferências, senha em hash)
   - records:  tudo que for lançado (gastos, contas...) — usado nas próximas etapas.
               Cada registro tem profileId; o índice byProfile separa os dados de cada um. */
(function () {
  const DB_NAME = 'financas-casa';
  const DB_VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('records')) {
          const s = db.createObjectStore('records', { keyPath: 'id' });
          s.createIndex('byProfile', 'profileId');
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }

  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });

  window.DB = {
    async get(store, key) { const db = await open(); return req(db.transaction(store).objectStore(store).get(key)); },
    async getAll(store) { const db = await open(); return req(db.transaction(store).objectStore(store).getAll()); },
    async put(store, value) { const db = await open(); const t = db.transaction(store, 'readwrite'); t.objectStore(store).put(value); return done(t); },
    async del(store, key) { const db = await open(); const t = db.transaction(store, 'readwrite'); t.objectStore(store).delete(key); return done(t); },
    async byProfile(profileId) {
      const db = await open();
      return req(db.transaction('records').objectStore('records').index('byProfile').getAll(profileId));
    },
    // Apaga todos os registros de um perfil e grava os novos, numa transação só (tudo ou nada).
    async replaceProfileRecords(profileId, records) {
      const db = await open();
      const t = db.transaction('records', 'readwrite');
      const s = t.objectStore('records');
      const keysReq = s.index('byProfile').getAllKeys(profileId);
      keysReq.onsuccess = () => {
        keysReq.result.forEach((k) => s.delete(k));
        records.forEach((r) => s.put(r));
      };
      return done(t);
    }
  };
})();
