/**
 * ============================================================
 *  請求書・請求明細・入金 — 全端末共有 API（2026-10 追加）
 * ============================================================
 *  設計書: invoice_sync_design.md
 *
 *  このファイルは master_sheets.gs と同じ Apps Script プロジェクトに
 *  「ファイルを追加」して貼り付けて使う。
 *  master_sheets.gs 側には doGet / doPost に数行のフックを追加するだけ。
 *
 *  - 請求番号は GAS 側で LockService による排他採番（端末ごとの連番は廃止）
 *  - 同じ案件が有効な請求に2重に入ることをサーバー側で拒否
 *  - 既存シート（案件マスタ等）の列構成は一切変更しない
 * ============================================================
 */

const INV_SHEETS = {
  INVOICES: '請求書',
  ITEMS: '請求明細',
  PAYMENTS: '入金',
};

// [内部キー, 見出し]
const INV_COLS = [
  ['invoiceNo', '請求番号'], ['status', '状態'], ['customerId', '顧客ID'], ['customerName', '請求先'],
  ['periodFrom', '対象期間(開始)'], ['periodTo', '対象期間(終了)'], ['issueDate', '発行日'], ['dueDate', '支払期日'],
  ['feeExTax', '報酬(税抜)'], ['tax', '消費税'], ['feeInTax', '報酬(税込)'], ['advanceTotal', '立替金'],
  ['grandTotal', '請求合計'], ['caseCount', '件数'], ['template', '書式'],
  ['issuedBy', '発行者'], ['issuedDevice', '発行端末'], ['issuedAt', '発行日時'],
  ['canceledBy', '取消者'], ['canceledDevice', '取消端末'], ['canceledAt', '取消日時'], ['cancelReason', '取消理由'],
  ['reissueOf', '再発行元'], ['pdfUrl', 'PDF'], ['note', '備考'],
];
const ITEM_COLS = [
  ['invoiceNo', '請求番号'], ['caseId', '案件ID'], ['lockedFee', '確定報酬(税抜)'],
  ['lockedAdvancesJson', '確定立替金(JSON)'], ['status', '状態'], ['updatedAt', '更新日時'],
];
const PAY_COLS = [
  ['paymentId', '入金ID'], ['invoiceNo', '請求番号'], ['customerId', '顧客ID'], ['amount', '請求額'],
  ['dueDate', '支払期日'], ['paidAmount', '入金額'], ['paidDate', '入金日'], ['status', '状態'],
  ['method', '入金方法'], ['journalId', '入金仕訳ID'], ['updatedBy', '更新者'], ['updatedAt', '更新日時'],
];

const INV_STATUS = { ISSUED: '発行', CANCELED: '取消' };
const ITEM_STATUS = { ACTIVE: '有効', CANCELED: '取消' };
const PAY_STATUS = { UNPAID: '未入金', PAID: '入金済', CANCELED: '取消' };

// ------------------------------------------------------------
//  ルーティング（master_sheets.gs の doGet / doPost から呼ばれる）
// ------------------------------------------------------------
function handleInvoiceAction_(action, data) {
  switch (action) {
    case 'issueInvoice': return withInvoiceLock_(function () { return issueInvoice_(data); });
    case 'cancelInvoice': return withInvoiceLock_(function () { return cancelInvoice_(data); });
    case 'cancelInvoiceCase': return withInvoiceLock_(function () { return cancelInvoiceCase_(data); });
    case 'markInvoicePaid': return withInvoiceLock_(function () { return markInvoicePaid_(data); });
    case 'unmarkInvoicePaid': return withInvoiceLock_(function () { return unmarkInvoicePaid_(data); });
    case 'importInvoices': return withInvoiceLock_(function () { return importInvoices_(data); });
    case 'getInvoices': return getInvoiceData_();
    default: return null; // 請求系アクションではない
  }
}

function isInvoiceAction_(action) {
  return ['issueInvoice', 'cancelInvoice', 'cancelInvoiceCase', 'markInvoicePaid',
          'unmarkInvoicePaid', 'importInvoices', 'getInvoices'].indexOf(action) !== -1;
}

let _invSheetCache_ = {};
function invResetCache_() {
  _invSheetCache_ = {};
}

function withInvoiceLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { error: '他の端末が請求処理中です。数秒後にもう一度お試しください。', code: 'LOCKED' };
  try {
    invResetCache_();
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
//  シート入出力ヘルパー
// ------------------------------------------------------------
function invSheet_(name, cols) {
  if (_invSheetCache_[name]) return _invSheetCache_[name];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 日付・番号の自動変換を防ぐため全列を書式なしテキストに
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
  }
  _invSheetCache_[name] = sh;
  return sh;
}

function invFmt_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, 'Asia/Tokyo', hasTime ? "yyyy-MM-dd'T'HH:mm:ssXXX" : 'yyyy-MM-dd');
  }
  return v;
}

// 全行を {key:value} の配列で返す（_row = シート上の行番号）
function invReadAll_(name, cols) {
  const sh = invSheet_(name, cols);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  return vals.map(function (r, i) {
    const o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c[0]] = invFmt_(r[j]); });
    return o;
  }).filter(function (o) { return o[cols[0][0]] !== ''; });
}

function invToRow_(obj, cols) {
  return cols.map(function (c) {
    const v = obj[c[0]];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

function invAppend_(name, cols, objs) {
  if (!objs.length) return;
  const sh = invSheet_(name, cols);
  const start = sh.getLastRow() + 1;
  const rows = objs.map(function (o) { return invToRow_(o, cols); });
  sh.getRange(start, 1, rows.length, cols.length).setValues(rows);
}

function invUpdate_(name, cols, obj) {
  const sh = invSheet_(name, cols);
  sh.getRange(obj._row, 1, 1, cols.length).setValues([invToRow_(obj, cols)]);
}

function invNum_(v) {
  const n = Number(v);
  return isFinite(n) ? Math.round(n) : 0;
}

function invNow_() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function sumAdvances_(adv) {
  let arr = adv;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr || '[]'); } catch (e) { arr = []; } }
  if (!Array.isArray(arr)) return 0;
  return arr.reduce(function (s, x) { return s + invNum_(x && x.amount); }, 0);
}

// ------------------------------------------------------------
//  採番：INV-YYYYMM-NNNN（4桁）。既存の最大番号より必ず大きくする
// ------------------------------------------------------------
function nextInvoiceNo_(yyyymm, invoices) {
  if (!/^\d{6}$/.test(String(yyyymm))) throw new Error('請求年月(yyyymm)が不正です: ' + yyyymm);
  const props = PropertiesService.getScriptProperties();
  const key = 'INV_SEQ_' + yyyymm;
  let seq = parseInt(props.getProperty(key) || '0', 10);
  const prefix = 'INV-' + yyyymm + '-';
  invoices.forEach(function (inv) {
    const no = String(inv.invoiceNo);
    if (no.indexOf(prefix) === 0) {
      const n = parseInt(no.substring(prefix.length), 10);
      if (n > seq) seq = n;
    }
  });
  seq += 1;
  props.setProperty(key, String(seq));
  return prefix + ('000' + seq).slice(-4);
}

// ------------------------------------------------------------
//  発行
//  data = { yyyymm, customerId, customerName, periodFrom, periodTo, issueDate, dueDate,
//           feeExTax, tax, advanceTotal, grandTotal, template, issuedBy, issuedDevice,
//           reissueOf, note, items:[{caseId, fee, advances:[...]}] }
// ------------------------------------------------------------
function issueInvoice_(data) {
  if (!data || !Array.isArray(data.items) || !data.items.length) return { error: '請求対象の案件がありません' };
  if (!data.customerId) return { error: '請求先(顧客ID)がありません' };
  if (!data.issuedDevice) return { error: '端末名が設定されていません', code: 'NO_DEVICE' };

  const caseIds = data.items.map(function (it) { return String(it.caseId); });
  if (new Set(caseIds).size !== caseIds.length) return { error: '同じ案件が2回含まれています' };

  // 金額の整合チェック
  const feeSum = data.items.reduce(function (s, it) { return s + invNum_(it.fee); }, 0);
  const advSum = data.items.reduce(function (s, it) { return s + sumAdvances_(it.advances); }, 0);
  if (invNum_(data.feeExTax) !== feeSum) return { error: '報酬合計が明細と一致しません（' + data.feeExTax + ' / ' + feeSum + '）' };
  if (invNum_(data.advanceTotal) !== advSum) return { error: '立替金合計が明細と一致しません（' + data.advanceTotal + ' / ' + advSum + '）' };
  if (invNum_(data.grandTotal) !== feeSum + invNum_(data.tax) + advSum) return { error: '請求合計が一致しません' };

  // 二重請求チェック（高速スキャン：フォーマット処理を省いて必要な列のみ直接検査）
  const shItems = invSheet_(INV_SHEETS.ITEMS, ITEM_COLS);
  const lastItems = shItems.getLastRow();
  if (lastItems >= 2) {
    const itemVals = shItems.getRange(2, 1, lastItems - 1, ITEM_COLS.length).getValues();
    const caseIdSet = new Set(caseIds);
    const activeConflicts = [];
    for (let i = 0; i < itemVals.length; i++) {
      const row = itemVals[i];
      const cId = String(row[1] || '');
      const st = String(row[4] || '');
      if (st === ITEM_STATUS.ACTIVE && caseIdSet.has(cId)) {
        activeConflicts.push({ caseId: cId, invoiceNo: String(row[0] || '') });
      }
    }
    if (activeConflicts.length > 0) {
      const invoices = invReadAll_(INV_SHEETS.INVOICES, INV_COLS);
      const invMap = {};
      invoices.forEach(function (v) { invMap[v.invoiceNo] = v; });
      const conflicts = activeConflicts.map(function (cf) {
        const p = invMap[cf.invoiceNo] || {};
        return { caseId: cf.caseId, invoiceNo: cf.invoiceNo, issuedBy: p.issuedBy || '', issuedDevice: p.issuedDevice || '', issuedAt: p.issuedAt || '' };
      });
      return { error: '請求済みの案件が含まれています', code: 'ALREADY_BILLED', conflicts: conflicts };
    }
  }

  const invoices = invReadAll_(INV_SHEETS.INVOICES, INV_COLS);
  const invMap = {};
  invoices.forEach(function (v) { invMap[v.invoiceNo] = v; });

  if (data.reissueOf && !invMap[data.reissueOf]) return { error: '再発行元の請求番号が見つかりません: ' + data.reissueOf };

  // 端末が指定した番号が空いていれば優先採用（即時発行対応）、衝突または未指定ならGAS自動採番
  let no = data.invoiceNo;
  if (!no || invMap[no]) {
    no = nextInvoiceNo_(data.yyyymm, invoices);
  } else {
    const props = PropertiesService.getScriptProperties();
    const key = 'INV_SEQ_' + data.yyyymm;
    let seq = parseInt(props.getProperty(key) || '0', 10);
    const prefix = 'INV-' + data.yyyymm + '-';
    if (no.indexOf(prefix) === 0) {
      const n = parseInt(no.substring(prefix.length), 10);
      if (n > seq) props.setProperty(key, String(n));
    }
  }

  const now = invNow_();
  const inv = {
    invoiceNo: no, status: INV_STATUS.ISSUED, customerId: data.customerId, customerName: data.customerName || '',
    periodFrom: data.periodFrom || '', periodTo: data.periodTo || '', issueDate: data.issueDate || now.substring(0, 10),
    dueDate: data.dueDate || '', feeExTax: feeSum, tax: invNum_(data.tax), feeInTax: feeSum + invNum_(data.tax),
    advanceTotal: advSum, grandTotal: invNum_(data.grandTotal), caseCount: caseIds.length, template: data.template || '',
    issuedBy: data.issuedBy || '', issuedDevice: data.issuedDevice, issuedAt: now,
    reissueOf: data.reissueOf || '', note: data.note || '',
  };
  const newItems = data.items.map(function (it) {
    return { invoiceNo: no, caseId: it.caseId, lockedFee: invNum_(it.fee),
             lockedAdvancesJson: JSON.stringify(it.advances || []), status: ITEM_STATUS.ACTIVE, updatedAt: now };
  });
  const pay = {
    paymentId: 'pay_' + no, invoiceNo: no, customerId: data.customerId, amount: inv.grandTotal, dueDate: inv.dueDate,
    paidAmount: '', paidDate: '', status: PAY_STATUS.UNPAID, method: '', journalId: '', updatedBy: inv.issuedBy, updatedAt: now,
  };

  // 書込み（チェックはすべて上で完了済み）
  invAppend_(INV_SHEETS.INVOICES, INV_COLS, [inv]);
  invAppend_(INV_SHEETS.ITEMS, ITEM_COLS, newItems);
  invAppend_(INV_SHEETS.PAYMENTS, PAY_COLS, [pay]);

  return { success: true, invoiceNo: no, invoice: inv, items: newItems, payment: pay };
}

// ------------------------------------------------------------
//  請求書ごと取消  data = { invoiceNo, canceledBy, canceledDevice, reason }
// ------------------------------------------------------------
function cancelInvoice_(data) {
  const invoices = invReadAll_(INV_SHEETS.INVOICES, INV_COLS);
  const inv = invoices.filter(function (v) { return v.invoiceNo === data.invoiceNo; })[0];
  if (!inv) return { error: '請求番号が見つかりません: ' + data.invoiceNo };
  if (inv.status === INV_STATUS.CANCELED) return { error: 'すでに取消済みです', code: 'ALREADY_CANCELED' };

  // 入金チェック（PAY_COLS: invoiceNo=1, status=7）
  const paySheet = invSheet_(INV_SHEETS.PAYMENTS, PAY_COLS);
  const payLast = paySheet.getLastRow();
  const payVals = payLast >= 2 ? paySheet.getRange(2, 1, payLast - 1, PAY_COLS.length).getValues() : [];
  for (let i = 0; i < payVals.length; i++) {
    if (String(payVals[i][1]) === String(data.invoiceNo) && String(payVals[i][7]) === PAY_STATUS.PAID) {
      return { error: '入金済みの請求書は取消できません。先に入金を取り消してください。', code: 'PAID' };
    }
  }

  const now = invNow_();

  // 1) 請求書シートの更新（1行）
  inv.status = INV_STATUS.CANCELED;
  inv.canceledBy = data.canceledBy || '';
  inv.canceledDevice = data.canceledDevice || '';
  inv.canceledAt = now;
  inv.cancelReason = data.reason || '';
  invUpdate_(INV_SHEETS.INVOICES, INV_COLS, inv);

  // 2) 請求明細シートの一括更新（ITEM_COLS: invoiceNo=0, caseId=1, status=4, updatedAt=5）
  //    明細を1件ずつ setValues() するとタイムアウトするため、メモリ上で一括更新して 1回で書き戻す
  const itemSheet = invSheet_(INV_SHEETS.ITEMS, ITEM_COLS);
  const itemLast = itemSheet.getLastRow();
  const canceledCaseIds = [];
  if (itemLast >= 2) {
    const itemRange = itemSheet.getRange(2, 1, itemLast - 1, ITEM_COLS.length);
    const itemVals = itemRange.getValues();
    let itemModified = false;
    for (let i = 0; i < itemVals.length; i++) {
      if (String(itemVals[i][0]) === String(data.invoiceNo)) {
        if (String(itemVals[i][4]) !== ITEM_STATUS.CANCELED) {
          itemVals[i][4] = ITEM_STATUS.CANCELED;
          itemVals[i][5] = now;
          canceledCaseIds.push(String(itemVals[i][1]));
          itemModified = true;
        }
      }
    }
    if (itemModified) {
      itemRange.setValues(itemVals);
    }
  }

  // 3) 入金シートの一括更新（1回の setValues で完了）
  if (payLast >= 2) {
    const payRange = paySheet.getRange(2, 1, payLast - 1, PAY_COLS.length);
    let payModified = false;
    for (let i = 0; i < payVals.length; i++) {
      if (String(payVals[i][1]) === String(data.invoiceNo)) {
        if (String(payVals[i][7]) !== PAY_STATUS.CANCELED) {
          payVals[i][7] = PAY_STATUS.CANCELED;
          payVals[i][10] = data.canceledBy || '';
          payVals[i][11] = now;
          payModified = true;
        }
      }
    }
    if (payModified) {
      payRange.setValues(payVals);
    }
  }

  return { success: true, invoiceNo: data.invoiceNo, caseIds: canceledCaseIds };
}

// ------------------------------------------------------------
//  1案件だけ取消（請求書の金額を再計算）
//  data = { invoiceNo, caseId, canceledBy, canceledDevice, reason }
// ------------------------------------------------------------
function cancelInvoiceCase_(data) {
  const invoices = invReadAll_(INV_SHEETS.INVOICES, INV_COLS);
  const inv = invoices.filter(function (v) { return v.invoiceNo === data.invoiceNo; })[0];
  if (!inv) return { error: '請求番号が見つかりません: ' + data.invoiceNo };
  if (inv.status === INV_STATUS.CANCELED) return { error: 'この請求書は取消済みです' };

  const pays = invReadAll_(INV_SHEETS.PAYMENTS, PAY_COLS).filter(function (p) { return p.invoiceNo === data.invoiceNo; });
  if (pays.some(function (p) { return p.status === PAY_STATUS.PAID; })) return { error: '入金済みの請求書は変更できません', code: 'PAID' };

  const items = invReadAll_(INV_SHEETS.ITEMS, ITEM_COLS).filter(function (it) { return it.invoiceNo === data.invoiceNo; });
  const target = items.filter(function (it) { return String(it.caseId) === String(data.caseId) && it.status === ITEM_STATUS.ACTIVE; })[0];
  if (!target) return { error: 'この請求書に該当案件がありません' };

  const active = items.filter(function (it) { return it.status === ITEM_STATUS.ACTIVE && it !== target; });
  if (!active.length) {
    // 最後の1件なら請求書ごと取消
    return cancelInvoice_({ invoiceNo: data.invoiceNo, canceledBy: data.canceledBy, canceledDevice: data.canceledDevice,
                            reason: (data.reason || '') + '（最後の1件を取消）' });
  }

  const now = invNow_();
  target.status = ITEM_STATUS.CANCELED; target.updatedAt = now;
  invUpdate_(INV_SHEETS.ITEMS, ITEM_COLS, target);

  const fee = active.reduce(function (s, it) { return s + invNum_(it.lockedFee); }, 0);
  const adv = active.reduce(function (s, it) { return s + sumAdvances_(it.lockedAdvancesJson); }, 0);
  const tax = Math.floor(fee * 10 / 100);
  inv.feeExTax = fee; inv.tax = tax; inv.feeInTax = fee + tax; inv.advanceTotal = adv;
  inv.grandTotal = fee + tax + adv; inv.caseCount = active.length;
  inv.note = [inv.note, now.substring(0, 10) + ' 案件' + data.caseId + 'を取消（' + (data.canceledBy || '') + '/' + (data.canceledDevice || '') + '）']
    .filter(String).join(' / ');
  invUpdate_(INV_SHEETS.INVOICES, INV_COLS, inv);

  pays.forEach(function (p) {
    if (p.status === PAY_STATUS.CANCELED) return;
    p.amount = inv.grandTotal; p.updatedBy = data.canceledBy || ''; p.updatedAt = now;
    invUpdate_(INV_SHEETS.PAYMENTS, PAY_COLS, p);
  });
  return { success: true, invoiceNo: data.invoiceNo, caseId: data.caseId, invoice: inv };
}

// ------------------------------------------------------------
//  入金消込  data = { invoiceNo, paidAmount, paidDate, method, updatedBy }
//  入金仕訳は固定ID j_pay_<paymentId> で upsert（重複しない）
// ------------------------------------------------------------
function markInvoicePaid_(data) {
  const pays = invReadAll_(INV_SHEETS.PAYMENTS, PAY_COLS);
  const p = pays.filter(function (x) { return x.invoiceNo === data.invoiceNo && x.status !== PAY_STATUS.CANCELED; })[0];
  if (!p) return { error: '入金予定が見つかりません: ' + data.invoiceNo };

  const paidAmount = data.paidAmount !== undefined && data.paidAmount !== '' ? invNum_(data.paidAmount) : invNum_(p.amount);
  const paidDate = data.paidDate || invNow_().substring(0, 10);
  const journalId = 'j_pay_' + p.paymentId;

  const jr = upsertJournal_({
    id: journalId, date: paidDate, debit: '普通預金', credit: '売掛金', amount: paidAmount,
    description: '[入金] ' + p.invoiceNo, caseId: '', auto: true,
  });
  if (jr && jr.error) return { error: '入金仕訳の登録に失敗: ' + jr.error };

  p.paidAmount = paidAmount; p.paidDate = paidDate; p.status = PAY_STATUS.PAID; p.method = data.method || '';
  p.journalId = journalId; p.updatedBy = data.updatedBy || ''; p.updatedAt = invNow_();
  invUpdate_(INV_SHEETS.PAYMENTS, PAY_COLS, p);
  return { success: true, payment: p };
}

function unmarkInvoicePaid_(data) {
  const pays = invReadAll_(INV_SHEETS.PAYMENTS, PAY_COLS);
  const p = pays.filter(function (x) { return x.invoiceNo === data.invoiceNo && x.status === PAY_STATUS.PAID; })[0];
  if (!p) return { error: '入金済みの記録が見つかりません: ' + data.invoiceNo };
  if (p.journalId) deleteRow_(SHEET_NAMES.JOURNALS, p.journalId);
  p.paidAmount = ''; p.paidDate = ''; p.status = PAY_STATUS.UNPAID; p.method = ''; p.journalId = '';
  p.updatedBy = data.updatedBy || ''; p.updatedAt = invNow_();
  invUpdate_(INV_SHEETS.PAYMENTS, PAY_COLS, p);
  return { success: true, payment: p };
}

// ------------------------------------------------------------
//  移行用：確定済み請求一覧の一括登録（既存番号はスキップ）
//  data = { confirm: 'IMPORT_CONFIRMED', invoices:[{ invoiceNo, customerId, customerName, amount, dueDate,
//           issuedAt, issuedDevice, items:[{caseId, lockedFee, lockedAdvances}] }] }
// ------------------------------------------------------------
function importInvoices_(data) {
  if (!data || data.confirm !== 'IMPORT_CONFIRMED') return { error: '確認キーがありません' };
  const existing = {};
  invReadAll_(INV_SHEETS.INVOICES, INV_COLS).forEach(function (v) { existing[v.invoiceNo] = true; });
  const activeCase = {};
  invReadAll_(INV_SHEETS.ITEMS, ITEM_COLS).forEach(function (it) { if (it.status === ITEM_STATUS.ACTIVE) activeCase[it.caseId] = it.invoiceNo; });

  const now = invNow_();
  const invRows = [], itemRows = [], payRows = [], skipped = [], conflicts = [];
  (data.invoices || []).forEach(function (src) {
    if (existing[src.invoiceNo]) { skipped.push(src.invoiceNo); return; }
    const its = src.items || [];
    its.forEach(function (it) { if (activeCase[it.caseId]) conflicts.push({ caseId: it.caseId, invoiceNo: activeCase[it.caseId], importing: src.invoiceNo }); });
    const fee = its.reduce(function (s, it) { return s + invNum_(it.lockedFee); }, 0);
    const adv = its.reduce(function (s, it) { return s + sumAdvances_(it.lockedAdvances); }, 0);
    const amount = invNum_(src.amount);
    const tax = amount - fee - adv; // 送付済み金額を正とする
    invRows.push({
      invoiceNo: src.invoiceNo, status: INV_STATUS.ISSUED, customerId: src.customerId, customerName: src.customerName || '',
      periodFrom: src.periodFrom || '', periodTo: src.periodTo || '', issueDate: String(src.issuedAt || '').substring(0, 10),
      dueDate: src.dueDate || '', feeExTax: fee, tax: tax, feeInTax: fee + tax, advanceTotal: adv, grandTotal: amount,
      caseCount: its.length, template: '', issuedBy: src.issuedBy || '', issuedDevice: src.issuedDevice || '移行',
      issuedAt: src.issuedAt || '', note: '移行登録 ' + now.substring(0, 10),
    });
    its.forEach(function (it) {
      itemRows.push({ invoiceNo: src.invoiceNo, caseId: it.caseId, lockedFee: invNum_(it.lockedFee),
                      lockedAdvancesJson: JSON.stringify(it.lockedAdvances || []), status: ITEM_STATUS.ACTIVE, updatedAt: now });
      activeCase[it.caseId] = src.invoiceNo;
    });
    payRows.push({ paymentId: 'pay_' + src.invoiceNo, invoiceNo: src.invoiceNo, customerId: src.customerId, amount: amount,
                   dueDate: src.dueDate || '', paidAmount: '', paidDate: '', status: PAY_STATUS.UNPAID, method: '',
                   journalId: '', updatedBy: '移行', updatedAt: now });
  });
  if (conflicts.length) return { error: '他の請求書と重複する案件があります。登録を中止しました。', conflicts: conflicts };

  invAppend_(INV_SHEETS.INVOICES, INV_COLS, invRows);
  invAppend_(INV_SHEETS.ITEMS, ITEM_COLS, itemRows);
  invAppend_(INV_SHEETS.PAYMENTS, PAY_COLS, payRows);
  return { success: true, imported: invRows.length, items: itemRows.length, skipped: skipped };
}

// ------------------------------------------------------------
//  取得（pull 用）
// ------------------------------------------------------------
function getInvoiceData_() {
  const strip = function (arr) { return arr.map(function (o) { delete o._row; return o; }); };
  return {
    invoices: strip(invReadAll_(INV_SHEETS.INVOICES, INV_COLS)),
    items: strip(invReadAll_(INV_SHEETS.ITEMS, ITEM_COLS)),
    payments: strip(invReadAll_(INV_SHEETS.PAYMENTS, PAY_COLS)),
  };
}
