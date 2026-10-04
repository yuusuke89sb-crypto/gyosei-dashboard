/**
 * 案件の項目単位同期（2026-10 追加）
 * 設計書: case_sync_design.md
 *
 * - 各案件の _fieldTs（項目ごとの変更時刻）と _ack（シートに届いたことを確認した時刻）を比べ、
 *   未送信の項目だけを patchCases でシートへ送る（未送信キューの役割）
 * - 同期（取得）では項目ごとに新しいほうを採用。未送信の変更は消さない
 * - 削除は削除ログで全端末に伝える
 */
const CaseSync = {
  MIGRATED_KEY: 'gyosei_casesync_v1',
  DEL_QUEUE_KEY: 'gyosei_case_delete_queue',
  STATE_KEY: 'gyosei_casesync_state',

  // シートの案件マスタに列がある項目（id/createdAt/updatedAt 以外）
  SYNC_FIELDS: [
    'clientId', 'title', 'orderNo', 'category', 'status', 'deadline', 'fee', 'staffId', 'memo', 'completedAt',
    'deathDate', 'surveyDate', 'applyDate', 'policeDeliveryDate', 'storeDeliveryDate', 'storeDeliveryTime',
    'surveyLocationId', 'policeLocationId', 'landTransportLocationId', 'registrationDate', 'clientContactId',
    'carName', 'carAddress', 'parkingAddress', 'carPolice', 'vin', 'driveFolderUrl', 'subCategory', 'advances',
    'milestoneIndex', 'inboxId', 'faxId', 'docs', 'carNumber', 'oldCarNumber', 'regType', 'isUsedCar',
  ],
  JSON_FIELDS: ['advances', 'docs'],

  _flushing: false,
  _timer: null,
  _retryTimer: null,

  // ---------------- 状態 ----------------
  isMigrated() {
    return localStorage.getItem(this.MIGRATED_KEY) === 'done';
  },
  getState() {
    try { return JSON.parse(localStorage.getItem(this.STATE_KEY)) || {}; } catch (e) { return {}; }
  },
  setState(patch) {
    const s = Object.assign(this.getState(), patch);
    localStorage.setItem(this.STATE_KEY, JSON.stringify(s));
    this.renderBadge();
    return s;
  },
  deviceName() {
    return (typeof InvoiceSync !== 'undefined' && InvoiceSync.getDeviceName()) || '';
  },

  // ---------------- 保存時に呼ぶ ----------------
  /** 新規案件：全項目に変更時刻を付け、未送信として登録 */
  markNew(c) {
    const now = new Date().toISOString();
    c._fieldTs = c._fieldTs || {};
    this.SYNC_FIELDS.forEach(k => { if (!c._fieldTs[k]) c._fieldTs[k] = now; });
    c._new = true;
    c._ack = {};
    return c;
  },
  /** 削除：キューに積む（送信成功まで同期で復活させない） */
  queueDelete(id) {
    const q = this.getDelQueue();
    if (!q.includes(id)) q.push(id);
    localStorage.setItem(this.DEL_QUEUE_KEY, JSON.stringify(q));
    this.flushSoon(300);
  },
  getDelQueue() {
    try { return JSON.parse(localStorage.getItem(this.DEL_QUEUE_KEY)) || []; } catch (e) { return []; }
  },

  /** 未送信の項目 */
  pendingFields(c) {
    if (!c) return [];
    const ts = c._fieldTs || {};
    const ack = c._ack || {};
    if (c._new) return this.SYNC_FIELDS.slice();
    return this.SYNC_FIELDS.filter(k => ts[k] && (!ack[k] || ts[k] > ack[k]));
  },
  pendingCount() {
    if (!this.isMigrated()) return 0;
    let n = 0;
    Store.getCases().forEach(c => { if (this.pendingFields(c).length) n++; });
    return n + this.getDelQueue().length;
  },

  flushSoon(ms = 1500) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this.flush().catch(() => {}); }, ms);
    this.renderBadge();
  },

  // ---------------- 送信 ----------------
  async flush() {
    if (!this.isMigrated() || this._flushing) return;
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) return;
    this._flushing = true;
    try {
      // 1) 削除
      for (const id of this.getDelQueue()) {
        const r = await SpreadsheetSync.push('deleteCase', { id, device: this.deviceName() });
        if (!r || r.error) throw new Error((r && r.error) || '通信できませんでした');
        localStorage.setItem(this.DEL_QUEUE_KEY, JSON.stringify(this.getDelQueue().filter(x => x !== id)));
      }
      // 2) 項目の変更
      const cases = Store.getCases();
      const batch = [];
      cases.forEach(c => {
        const keys = this.pendingFields(c);
        if (!keys.length) return;
        const fields = {}, fieldTs = {};
        keys.forEach(k => {
          fields[k] = c[k] === undefined ? '' : c[k];
          fieldTs[k] = (c._fieldTs && c._fieldTs[k]) || c.createdAt || new Date().toISOString();
        });
        batch.push({ id: c.id, fields, fieldTs, createdAt: c.createdAt });
      });
      for (let i = 0; i < batch.length; i += 40) {
        const chunk = batch.slice(i, i + 40);
        const r = await SpreadsheetSync.push('patchCases', { items: chunk, device: this.deviceName() });
        if (!r || r.error || !Array.isArray(r.results)) throw new Error((r && r.error) || '通信できませんでした');
        this.applyPatchResults(chunk, r.results);
      }
      this.setState({ lastFlushAt: new Date().toISOString(), lastError: '' });
      clearTimeout(this._retryTimer);
    } catch (e) {
      console.warn('[CaseSync.flush]', e);
      this.setState({ lastError: e.message || String(e), lastErrorAt: new Date().toISOString() });
      // 1分後に自動再送
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => this.flush().catch(() => {}), 60 * 1000);
    } finally {
      this._flushing = false;
      this.renderBadge();
    }
  },

  applyPatchResults(sent, results) {
    const sentMap = {};
    sent.forEach(s => { sentMap[s.id] = s; });
    const cases = Store.getCases();
    const idx = {};
    cases.forEach((c, i) => { idx[c.id] = i; });
    const removeIds = [];
    results.forEach(res => {
      const i = idx[res.id];
      if (i === undefined) return;
      const c = cases[i];
      const s = sentMap[res.id] || { fieldTs: {} };
      if (res.status === 'deleted') { removeIds.push(res.id); return; }
      if (res.status === 'error') return;
      c._ack = c._ack || {};
      c._fieldTs = c._fieldTs || {};
      (res.applied || []).forEach(k => {
        // 送信中に再編集されていなければ確認済みにする
        if (c._fieldTs[k] === s.fieldTs[k] || !c._fieldTs[k]) c._ack[k] = s.fieldTs[k];
      });
      Object.keys(res.rejected || {}).forEach(k => {
        // シート側の方が新しかった → シートの値を採用
        if (c._fieldTs[k] !== s.fieldTs[k]) return; // 送信後にさらに編集された
        c[k] = this.parseValue(k, res.rejected[k].value);
        c._fieldTs[k] = res.rejected[k].ts;
        c._ack[k] = res.rejected[k].ts;
      });
      if (res.status === 'added') delete c._new;
      delete c._orphan;
    });
    const out = removeIds.length ? cases.filter(c => !removeIds.includes(c.id)) : cases;
    Store._set(Store.KEYS.CASES, out);
  },

  parseValue(k, v) {
    if (this.JSON_FIELDS.includes(k)) {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string' && v.trim()) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
      return [];
    }
    if (k === 'milestoneIndex') return (v === '' || v === undefined || v === null) ? 0 : Number(v);
    if (k === 'isUsedCar') return v === true || v === 'true' || v === 'TRUE' || v === '○';
    if (v === null || v === undefined) return '';
    return v;
  },

  _eq(k, a, b) {
    const n = (x) => {
      if (x === null || x === undefined) return '';
      if (typeof x === 'object') return JSON.stringify(x);
      return String(x);
    };
    if (this.JSON_FIELDS.includes(k)) return n(this.parseValue(k, a)) === n(this.parseValue(k, b));
    return n(a) === n(b);
  },

  _sheetTimeToIso(s) {
    if (!s) return '';
    const str = String(s);
    if (str.includes('T')) { const d = new Date(str); return isNaN(d) ? '' : d.toISOString(); }
    const d = new Date(str.replace(' ', 'T') + '+09:00');
    return isNaN(d) ? '' : d.toISOString();
  },

  /** 旧い見出し名のまま返ってくる値を通常のキーへ寄せる（従来の同期処理と同じ対応） */
  _normalizeLegacyKeys(rc) {
    const alias = {
      orderNo: ['注文書№', '注文書No', '注文書NO', '注文番号', '注文No'],
      carNumber: ['自動車登録番号', '新自動車登録番号', '登録番号', '新ナンバー'],
      oldCarNumber: ['旧自動車登録番号', '旧登録番号', '旧ナンバー'],
      vin: ['車台番号', 'VIN'],
      regType: ['封印事由', '登録区分', '登録種別区分'],
      subCategory: ['登録種別'],
      completedAt: ['完了日'],
    };
    Object.keys(alias).forEach(k => {
      if (rc[k] !== undefined && rc[k] !== '') return;
      for (const a of alias[k]) {
        if (rc[a] !== undefined && rc[a] !== '') { rc[k] = rc[a]; break; }
      }
    });
  },

  // ---------------- 取得（pull）時のマージ ----------------
  /**
   * @param {Array} remoteCases シートの案件
   * @param {Array} deletedIds 削除ログの案件ID
   */
  mergeRemoteCases(remoteCases, deletedIds, opts) {
    const serverReady = !opts || opts.serverReady !== false;
    const migrating = !this.isMigrated();
    if (migrating && serverReady && typeof AutoBackup !== 'undefined') {
      try { AutoBackup.snapshot('同期方式切替え前', true); } catch (e) { console.warn('[CaseSync] 切替え前バックアップ失敗', e); }
    }
    const local = Store.getCases();
    const localMap = new Map(local.map(c => [c.id, c]));
    const deleted = new Set([...(deletedIds || []).map(String), ...this.getDelQueue()]);
    const seen = new Set();
    const out = [];
    let keptLocal = 0;

    (remoteCases || []).forEach(rc => {
      if (!rc || !rc.id || deleted.has(String(rc.id)) || seen.has(rc.id)) return;
      seen.add(rc.id);
      let rts = rc._fieldTs || {};
      if (typeof rts === 'string') { try { rts = JSON.parse(rts || '{}') || {}; } catch (e) { rts = {}; } }
      const remote = {};
      this._normalizeLegacyKeys(rc);
      Object.keys(rc).forEach(k => { if (k !== '_fieldTs') remote[k] = this.SYNC_FIELDS.includes(k) ? this.parseValue(k, rc[k]) : rc[k]; });
      const l = localMap.get(rc.id);

      if (!l) {
        const c = Object.assign({}, remote, { _fieldTs: {}, _ack: {} });
        this.SYNC_FIELDS.forEach(k => { if (rts[k]) { c._fieldTs[k] = rts[k]; c._ack[k] = rts[k]; } });
        if (!Array.isArray(c.advances)) c.advances = [];
        if (!Array.isArray(c.docs)) c.docs = [];
        out.push(c);
        return;
      }

      const c = Object.assign({}, l);
      c._fieldTs = Object.assign({}, l._fieldTs || {});
      c._ack = Object.assign({}, l._ack || {});
      const remoteUpdated = this._sheetTimeToIso(remote.updatedAt);
      this.SYNC_FIELDS.forEach(k => {
        if (!(k in remote)) return;
        const lt = c._fieldTs[k] || '';
        const rt = rts[k] || '';
        let keepLocal;
        if (migrating) {
          // 初回：シートの最終更新より後に端末で変更した項目だけ端末の値を残す
          keepLocal = !!lt && lt > (rt || remoteUpdated || '') && !this._eq(k, l[k], remote[k]);
          // 立替金・添付：シートが空で端末にだけある場合は端末側を残して送る（従来の同期と同じ保護）
          if (!keepLocal && this.JSON_FIELDS.includes(k) && !rt && Array.isArray(l[k]) && l[k].length && !(remote[k] || []).length) {
            keepLocal = true;
            if (!c._fieldTs[k]) c._fieldTs[k] = new Date().toISOString();
          }
        } else {
          const pending = !!lt && (!c._ack[k] || lt > c._ack[k]);
          keepLocal = pending && lt > rt;
        }
        if (keepLocal) {
          if (migrating) delete c._ack[k]; // 未送信として残す
          keptLocal++;
          return;
        }
        c[k] = remote[k];
        const t = rt || lt || '';
        if (t) { c._fieldTs[k] = t; c._ack[k] = t; } else { delete c._fieldTs[k]; delete c._ack[k]; }
      });
      if (remote.createdAt && !c.createdAt) c.createdAt = remote.createdAt;
      if (remote.updatedAt) c.updatedAt = remote.updatedAt;
      // docs/advances が空で返る旧データ対策：端末側に添付があり、シートが空なら端末側を残す
      if ((!remote.docs || !remote.docs.length) && Array.isArray(l.docs) && l.docs.length && !rts.docs) c.docs = l.docs;
      delete c._new;
      delete c._orphan;
      out.push(c);
    });

    // シートに無い端末の案件
    const orphans = [];
    local.forEach(l => {
      if (seen.has(l.id) || deleted.has(String(l.id))) return;
      if (l._new) { out.push(l); return; }                 // 未送信の新規 → 残して再送
      if (migrating || l._orphan) {                         // 判断保留 → 残して画面で確認
        out.push(Object.assign({}, l, { _orphan: true }));
        orphans.push(l.id);
        return;
      }
      // それ以外（他端末・旧版で削除済み）は端末からも外す
    });

    Store._set(Store.KEYS.CASES, out);
    if (migrating && serverReady) {
      localStorage.setItem(this.MIGRATED_KEY, 'done');
      this.setState({ migratedAt: new Date().toISOString(), migratedKeptLocal: keptLocal, migratedOrphans: orphans.length });
      console.log(`[CaseSync] 初回整合完了: 端末側を残した項目 ${keptLocal} / シートに無い案件 ${orphans.length}`);
    }
    this.setState({ lastPullAt: new Date().toISOString(), orphanCount: out.filter(c => c._orphan).length });
    this.flushSoon(500);
    return { cases: out.length, keptLocal, orphans: orphans.length };
  },

  // ---------------- シートに無い案件の処理 ----------------
  orphanCases() {
    return Store.getCases().filter(c => c._orphan);
  },
  resolveOrphan(id, action) {
    const cases = Store.getCases();
    const c = cases.find(x => x.id === id);
    if (!c) return;
    if (action === 'send') {
      delete c._orphan;
      this.markNew(c);
      Store._set(Store.KEYS.CASES, cases);
      this.flushSoon(200);
    } else if (action === 'drop') {
      Store._set(Store.KEYS.CASES, cases.filter(x => x.id !== id));
    }
    this.setState({ orphanCount: this.orphanCases().length });
    if (typeof SyncPanel !== 'undefined') SyncPanel.refresh();
    if (typeof App !== 'undefined' && App.refreshView) App.refreshView();
  },

  // ---------------- 画面右下のバッジ ----------------
  renderBadge() {
    if (typeof document === 'undefined' || !document.body) return;
    let el = document.getElementById('syncStatusBadge');
    if (!el) {
      el = document.createElement('button');
      el.id = 'syncStatusBadge';
      el.type = 'button';
      el.onclick = () => { if (typeof SyncPanel !== 'undefined') SyncPanel.show(); };
      el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9000;border:none;border-radius:999px;padding:7px 14px;' +
        'font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.25);font-family:inherit;transition:all .2s';
      document.body.appendChild(el);
    }
    const s = this.getState();
    const pending = this.pendingCount();
    const orphan = s.orphanCount || 0;
    const last = s.lastPullAt ? new Date(s.lastPullAt) : null;
    const hm = last ? `${String(last.getHours()).padStart(2, '0')}:${String(last.getMinutes()).padStart(2, '0')}` : '--:--';
    let bg = '#065f46', fg = '#d1fae5', text = `🟢 同期済み ${hm}`;
    if (!this.isMigrated()) { bg = '#334155'; fg = '#e2e8f0'; text = '⏳ 同期準備中'; }
    else if (s.lastError && pending) { bg = '#991b1b'; fg = '#fee2e2'; text = `🔴 未送信 ${pending}件（再送待ち）`; }
    else if (pending) { bg = '#92400e'; fg = '#fef3c7'; text = `🟡 送信中 ${pending}件`; }
    else if (orphan) { bg = '#92400e'; fg = '#fef3c7'; text = `🟡 要確認 ${orphan}件`; }
    el.style.background = bg;
    el.style.color = fg;
    el.textContent = text;
    el.title = '同期の状態（クリックで詳細）';
  },
};

window.addEventListener('online', () => { CaseSync.flushSoon(500); });
document.addEventListener('DOMContentLoaded', () => { setTimeout(() => CaseSync.renderBadge(), 800); });
