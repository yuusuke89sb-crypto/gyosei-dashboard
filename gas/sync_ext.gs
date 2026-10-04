/**
 * ============================================================
 *  案件の項目単位同期（patchCases）・削除ログ・拡張ルーター（2026-10 追加）
 * ============================================================
 *  設計書: case_sync_design.md
 *
 *  - 端末は「変更した項目だけ」を項目ごとの変更時刻つきで送る
 *  - GAS は項目ごとに時刻を比べ、新しいほうだけを書き込む
 *    （古い端末が全項目を送って上書きする問題を解消）
 *  - 項目ごとの時刻は 案件マスタ 末尾の「_fieldTs」列（JSON）に保存
 *  - 案件を削除したら「削除ログ」に記録し、他端末にも削除を伝える
 *
 *  master_sheets.gs の doGet / doPost からは extDoGet_ / extDoPost_ を呼ぶだけ。
 * ============================================================
 */

const CASE_TS_HEADER = '_fieldTs';
const DELETE_LOG_SHEET = '削除ログ';
const DELETE_LOG_HEADERS = ['種別', 'ID', '削除日時', '端末'];

// ------------------------------------------------------------
//  ルーター
// ------------------------------------------------------------
/** doPost から呼ぶ。担当外のアクションなら null を返す */
function extDoPost_(action, data, body) {
  if (typeof isInvoiceAction_ === 'function' && isInvoiceAction_(action)) {
    return handleInvoiceAction_(action, data);
  }
  if (action === 'patchCases') return withCaseLock_(function () { return patchCases_(data, body || {}); });
  if (action === 'deleteCase') return withCaseLock_(function () { return deleteCaseLogged_(data || {}); });
  if (action === 'upsertCase') return withCaseLock_(function () { return legacyUpsertCase_(data || {}, body || {}); });
  return null;
}

/**
 * 旧版画面からの upsertCase（全項目送信）を項目単位の保存に変換する。
 * - 既存行：端末側で変更時刻(_fieldTs)が付いている項目だけを時刻比較して反映
 * - 新規行：全項目を作成日時の時刻で登録
 */
function legacyUpsertCase_(data, body) {
  if (!data.id) return { error: 'IDがありません' };
  let ts = data._fieldTs || {};
  if (typeof ts === 'string') { try { ts = JSON.parse(ts) || {}; } catch (e) { ts = {}; } }
  const keyMap = getKeyMap_(SHEET_NAMES.CASES);
  const known = {};
  Object.keys(keyMap).forEach(function (h) { known[keyMap[h]] = true; });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CASES);
  let exists = false;
  if (sheet && sheet.getLastRow() >= 2) {
    exists = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().some(function (r) { return String(r[0]) === String(data.id); });
  }
  const fields = {}, fieldTs = {};
  const cd = data.createdAt ? new Date(data.createdAt) : null;
  const baseTs = (cd && !isNaN(cd.getTime())) ? cd.toISOString() : new Date().toISOString();
  Object.keys(data).forEach(function (k) {
    if (!known[k] || k === 'id' || k === 'createdAt' || k === 'updatedAt' || k === CASE_TS_HEADER) return;
    if (exists && !ts[k]) return;
    fields[k] = data[k];
    fieldTs[k] = String(ts[k] || baseTs);
  });
  const r = patchCases_({ items: [{ id: data.id, fields: fields, fieldTs: fieldTs, createdAt: data.createdAt }] }, body);
  const res = (r.results && r.results[0]) || {};
  return { success: true, action: res.status || 'updated', id: data.id, legacy: true };
}

/** doGet から呼ぶ。result に追加データを書き込む */
function extDoGet_(type, result) {
  if (type === 'invoices' || type === 'all') {
    try { result.invoices = getInvoiceData_(); } catch (e) { result.invoicesError = e.message; }
  }
  if (type === 'deletedCases' || type === 'all') {
    try { result.deletedCases = getDeletedCaseIds_(); } catch (e) { result.deletedCasesError = e.message; }
  }
}

function withCaseLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { error: '他の端末が保存中です。数秒後に自動で再送します。', code: 'LOCKED' };
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
//  削除ログ
// ------------------------------------------------------------
function deleteLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DELETE_LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DELETE_LOG_SHEET);
    sh.getRange(1, 1, 1, DELETE_LOG_HEADERS.length).setValues([DELETE_LOG_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), DELETE_LOG_HEADERS.length).setNumberFormat('@');
  }
  return sh;
}

function getDeletedCaseIds_() {
  const sh = deleteLogSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 2).getValues()
    .filter(function (r) { return r[0] === 'case' && r[1]; })
    .map(function (r) { return String(r[1]); });
}

/** 案件削除（同じIDの重複行もすべて削除）＋削除ログ記録。行が無くてもログは残す */
function deleteCaseLogged_(data) {
  if (!data.id) return { error: 'IDがありません' };
  let removed = 0;
  for (let i = 0; i < 10; i++) {
    const r = deleteRow_(SHEET_NAMES.CASES, data.id);
    if (!r || !r.success) break;
    removed++;
  }
  const already = getDeletedCaseIds_().indexOf(String(data.id)) !== -1;
  if (!already) {
    const sh = deleteLogSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setNumberFormat('@')
      .setValues([['case', String(data.id), new Date().toISOString(), String(data.device || '')]]);
  }
  return { success: true, action: 'deleted', id: data.id, removedRows: removed };
}

// ------------------------------------------------------------
//  項目単位の保存
//  data = { device, items: [{ id, fields: {key: value}, fieldTs: {key: isoString} }] }
//  戻り値 results: [{ id, status: added|updated|deleted|error, applied:[], rejected:{key:{value,ts}}, fieldTs:{} }]
// ------------------------------------------------------------
function patchCases_(data, body) {
  const items = (data && data.items) || [];
  if (!items.length) return { success: true, results: [] };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CASES);
  if (!sheet) return { error: '案件マスタが見つかりません' };

  // 見出しの確認（不足分は追加。既存列は動かさない）
  let lastCol = sheet.getLastColumn();
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  if (lastCol < CASE_HEADERS.length) {
    sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);
    lastCol = CASE_HEADERS.length;
    headers = CASE_HEADERS.slice();
  }
  let tsCol = headers.indexOf(CASE_TS_HEADER);
  if (tsCol === -1) {
    lastCol += 1;
    sheet.getRange(1, lastCol).setValue(CASE_TS_HEADER).setFontWeight('bold');
    headers.push(CASE_TS_HEADER);
    tsCol = lastCol - 1;
  }

  const keyMap = getKeyMap_(SHEET_NAMES.CASES);
  const keyCol = {};
  headers.forEach(function (h, i) {
    const k = keyMap[h];
    if (k && keyCol[k] === undefined) keyCol[k] = i;
  });
  const idCol = keyCol.id !== undefined ? keyCol.id : 0;
  const statusCol = keyCol.status;
  const updatedCol = keyCol.updatedAt;
  const createdCol = keyCol.createdAt;

  const lastRow = sheet.getLastRow();
  const values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  const rowOf = {};
  values.forEach(function (r, i) { const id = String(r[idCol]); if (id && rowOf[id] === undefined) rowOf[id] = i; });
  const deleted = {};
  getDeletedCaseIds_().forEach(function (id) { deleted[id] = true; });

  const nowIso = new Date().toISOString();
  const nowDate = new Date();
  const touched = {};
  const appendRows = [];
  const results = [];
  const notify = [];

  items.forEach(function (it) {
    const id = String(it.id || '');
    if (!id) { results.push({ id: id, status: 'error', error: 'IDなし' }); return; }
    if (deleted[id]) { results.push({ id: id, status: 'deleted' }); return; }
    const fields = it.fields || {};
    const fts = it.fieldTs || {};

    if (rowOf[id] === undefined) {
      // 新規行
      const row = new Array(lastCol).fill('');
      const stored = {};
      const applied = [];
      Object.keys(fields).forEach(function (k) {
        const col = keyCol[k];
        if (col === undefined || k === 'id' || k === 'createdAt' || k === 'updatedAt') return;
        row[col] = caseCellValue_(fields[k]);
        stored[k] = String(fts[k] || nowIso);
        applied.push(k);
      });
      row[idCol] = id;
      if (createdCol !== undefined) {
        const cdt = it.createdAt ? new Date(it.createdAt) : null;
        row[createdCol] = (cdt && !isNaN(cdt.getTime())) ? cdt : nowDate;
      }
      if (updatedCol !== undefined) row[updatedCol] = nowDate;
      row[tsCol] = JSON.stringify(stored);
      appendRows.push(row);
      rowOf[id] = -1; // 同一バッチ内の重複追加防止
      results.push({ id: id, status: 'added', applied: applied, rejected: {}, fieldTs: stored });
      if (fields.status === 'done') notify.push({ fields: fields, id: id });
      return;
    }
    if (rowOf[id] === -1) { results.push({ id: id, status: 'error', error: '同一バッチ内で重複' }); return; }

    const r = rowOf[id];
    const row = values[r];
    let stored = {};
    try { stored = JSON.parse(row[tsCol] || '{}') || {}; } catch (e) { stored = {}; }
    const oldStatus = statusCol !== undefined ? row[statusCol] : '';
    const applied = [];
    const rejected = {};
    Object.keys(fields).forEach(function (k) {
      const col = keyCol[k];
      if (col === undefined || k === 'id' || k === 'createdAt' || k === 'updatedAt') return;
      const inTs = String(fts[k] || nowIso);
      if (!stored[k] || inTs >= String(stored[k])) {
        row[col] = caseCellValue_(fields[k]);
        stored[k] = inTs;
        applied.push(k);
      } else {
        rejected[k] = { value: caseCellOut_(k, row[col]), ts: stored[k] };
      }
    });
    if (applied.length) {
      row[tsCol] = JSON.stringify(stored);
      if (updatedCol !== undefined) row[updatedCol] = nowDate;
      touched[r] = true;
      if (applied.indexOf('status') !== -1 && fields.status === 'done' && oldStatus !== 'done') notify.push({ fields: fields, id: id, row: row, keyCol: keyCol });
    }
    results.push({ id: id, status: 'updated', applied: applied, rejected: rejected, fieldTs: stored });
  });

  Object.keys(touched).forEach(function (r) {
    const i = Number(r);
    sheet.getRange(i + 2, 1, 1, lastCol).setValues([values[i]]);
  });
  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, lastCol).setValues(appendRows);
  }

  // 案件完了のLINE通知（従来の upsertCase と同等）
  try {
    if (notify.length && body.lineToken && body.lineUserId && body.lineNotifyCase) {
      notify.forEach(function (n) {
        const get = function (k) {
          if (n.fields[k] !== undefined) return n.fields[k];
          return (n.row && n.keyCol && n.keyCol[k] !== undefined) ? n.row[n.keyCol[k]] : '';
        };
        const clientId = get('clientId');
        const clientName = clientId ? (getClientName_(clientId) || '') : '';
        const fee = get('fee');
        const msg = '\n【🎉 案件完了】\n' + (clientName ? clientName + ' 様：' : '') + get('title') + '\n' +
          'カテゴリ：' + getCategoryLabel_(get('category')) + '\n' +
          '報酬額：' + (fee ? Number(fee).toLocaleString() + '円' : '未設定') + '\n' +
          '今月の目標に向けて一歩前進しました！';
        sendLineMessage_(msg, body.lineToken, body.lineUserId);
      });
    }
  } catch (e) { /* 通知失敗は保存結果に影響させない */ }

  return { success: true, results: results };
}

function caseCellValue_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function caseCellOut_(key, v) {
  if (v instanceof Date) {
    const withTime = (key === 'createdAt' || key === 'updatedAt');
    return Utilities.formatDate(v, Session.getScriptTimeZone(), withTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  }
  return v;
}
