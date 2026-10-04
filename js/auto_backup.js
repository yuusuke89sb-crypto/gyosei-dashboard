/**
 * 自動バックアップ（2026-10 追加）
 * - 1日1回、端末内の全データ（手動バックアップと同じ内容）をこの端末の別領域（IndexedDB: gyosei_autobackup）へ保存
 * - 直近7日分を保持（古いものから自動削除）。同期方式の切替え前などは強制保存
 * - 「同期の状態」画面から一覧・ダウンロードできる
 */
const AutoBackup = {
  DB_NAME: 'gyosei_autobackup',
  STORE: 'snapshots',
  KEEP: 7,
  LAST_KEY: 'gyosei_autobackup_last',

  _open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB が使えません')); return; }
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async _tx(mode, fn) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, mode);
      const st = tx.objectStore(this.STORE);
      let out;
      Promise.resolve(fn(st)).then(v => { out = v; });
      tx.oncomplete = () => { db.close(); resolve(out); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  },

  _today() {
    return (typeof Store !== 'undefined' && Store.getLocalDateStr) ? Store.getLocalDateStr() : new Date().toISOString().slice(0, 10);
  },

  /**
   * スナップショット保存。データの組み立ては同期的に行う（呼び出し直後に案件が書き換わっても切替え前の状態を保持）
   * @param {string} reason 保存理由
   * @param {boolean} force 1日1回の制限を無視
   */
  snapshot(reason, force) {
    if (typeof Store === 'undefined' || typeof Store.buildBackupData !== 'function') return Promise.resolve(null);
    const today = this._today();
    if (!force && localStorage.getItem(this.LAST_KEY) === today) return Promise.resolve(null);
    let json;
    try {
      json = JSON.stringify(Store.buildBackupData());
    } catch (e) {
      console.warn('[AutoBackup] 組み立て失敗', e);
      return Promise.resolve(null);
    }
    const now = new Date();
    const rec = {
      id: now.toISOString(),
      date: today,
      reason: reason || '毎日の自動保存',
      size: json.length,
      cases: (() => { try { return Store.getCases().length; } catch (e) { return 0; } })(),
      json,
    };
    return this._tx('readwrite', st => { st.put(rec); })
      .then(() => {
        if (!force) localStorage.setItem(this.LAST_KEY, today);
        return this.prune();
      })
      .then(() => { console.log(`[AutoBackup] 保存しました（${rec.reason}・${Math.round(rec.size / 1024)}KB）`); return rec.id; })
      .catch(e => { console.warn('[AutoBackup] 保存失敗', e); return null; });
  },

  /** 一覧（新しい順・中身なし） */
  list() {
    return this._tx('readonly', st => new Promise(resolve => {
      const out = [];
      const req = st.openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) {
          const v = cur.value;
          out.push({ id: v.id, date: v.date, reason: v.reason, size: v.size, cases: v.cases });
          cur.continue();
        } else {
          resolve(out.sort((a, b) => b.id.localeCompare(a.id)));
        }
      };
      req.onerror = () => resolve(out);
    })).catch(() => []);
  },

  /** 日付ごとに最新1件・直近 KEEP 日分を残す（切替え前などの強制保存は別枠で最新3件まで） */
  async prune() {
    const all = await this.list();
    const daily = all.filter(r => r.reason === '毎日の自動保存');
    const special = all.filter(r => r.reason !== '毎日の自動保存');
    const keepIds = new Set();
    const days = [];
    daily.forEach(r => {
      if (days.includes(r.date)) return;
      if (days.length >= this.KEEP) return;
      days.push(r.date);
      keepIds.add(r.id);
    });
    special.slice(0, 3).forEach(r => keepIds.add(r.id));
    const del = all.filter(r => !keepIds.has(r.id)).map(r => r.id);
    if (!del.length) return;
    await this._tx('readwrite', st => { del.forEach(id => st.delete(id)); });
  },

  async download(id) {
    const rec = await this._tx('readonly', st => new Promise(resolve => {
      const req = st.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    }));
    if (!rec) { alert('バックアップが見つかりません'); return; }
    const d = new Date(rec.id);
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
    const blob = new Blob([rec.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gyosei_autobackup_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  },
};

// 起動から少し待って（データ読み込み後に）1日1回の自動保存
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { AutoBackup.snapshot('毎日の自動保存', false); }, 5000);
});
