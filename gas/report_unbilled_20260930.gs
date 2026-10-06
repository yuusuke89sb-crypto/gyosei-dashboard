/**
 * ============================================================
 *  未請求の完了案件レポート（読み取り専用・何も書き換えません）
 * ============================================================
 *  「完了日が指定日以前で、有効な請求書にまだ入っていない案件」を
 *  得意先グループ別（トヨタ／三菱ふそう／日産／その他）に集計して実行ログに出す。
 *
 *  使い方（Apps Script エディタで）
 *   reportUnbilledDone_20260930() を実行 → 「実行ログ」を確認
 *   ※ 完了日を変える場合は下の UNBILLED_CUTOFF を書き換える
 * ============================================================
 */

const UNBILLED_CUTOFF = '2026-09-30';

function reportUnbilledDone_20260930() {
  const cases = getSheetDataAsJson_(SHEET_NAMES.CASES, CASE_HEADERS);
  const customers = getSheetDataAsJson_(SHEET_NAMES.CUSTOMER, CUSTOMER_HEADERS);
  const custById = {};
  customers.forEach(function (c) { custById[String(c.id)] = c; });

  const billed = {};
  invReadAll_(INV_SHEETS.ITEMS, ITEM_COLS).forEach(function (it) {
    if (it.status === ITEM_STATUS.ACTIVE) billed[String(it.caseId)] = it.invoiceNo;
  });
  const deleted = {};
  getDeletedCaseIds_().forEach(function (id) { deleted[id] = true; });

  const dateOf = function (v) {
    if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM-dd');
    return String(v || '').substring(0, 10);
  };
  const groupOf = function (c) {
    const cu = custById[String(c.clientId)];
    if (!cu) return '得意先未設定';
    const n = String((cu.companyName || '') + ' ' + (cu.name || '')).toUpperCase();
    if (n.indexOf('トヨタ') !== -1 || n.indexOf('WEST') !== -1 || n.indexOf('キャラット') !== -1) return 'トヨタ';
    if (n.indexOf('三菱') !== -1 || n.indexOf('ふそう') !== -1 || n.indexOf('FUSO') !== -1) return '三菱ふそう';
    if (n.indexOf('日産') !== -1 || n.indexOf('NISSAN') !== -1) return '日産';
    return 'その他';
  };

  const unbilled = cases.filter(function (c) {
    if (deleted[String(c.id)] || c.status !== 'done') return false;
    const d = dateOf(c.completedAt);
    return d && d <= UNBILLED_CUTOFF && !billed[String(c.id)];
  });

  const groups = {};
  const lines = [];
  unbilled.forEach(function (c) {
    const g = groupOf(c);
    const cu = custById[String(c.clientId)] || {};
    const fee = invNum_(c.fee);
    const adv = sumAdvances_(c.advances);
    const a = groups[g] || (groups[g] = { count: 0, fee: 0, adv: 0 });
    a.count++; a.fee += fee; a.adv += adv;
    lines.push([dateOf(c.completedAt), g, (cu.companyName || cu.name || '(未設定)'), c.title || '', fee, adv, 'ID:' + c.id].join(' | '));
  });
  lines.sort();

  const total = { count: 0, fee: 0, adv: 0 };
  Object.keys(groups).forEach(function (g) { total.count += groups[g].count; total.fee += groups[g].fee; total.adv += groups[g].adv; });

  Logger.log('■ 未請求の完了案件（完了日 ' + UNBILLED_CUTOFF + ' 以前・請求書なし）');
  Logger.log('■ グループ別: ' + JSON.stringify(groups));
  Logger.log('■ 合計: ' + JSON.stringify(total) + '（報酬は税抜）');
  Logger.log('■ 明細（完了日 | グループ | 得意先 | 案件名 | 報酬 | 立替 | 案件ID）');
  lines.forEach(function (l) { Logger.log(l); });
  return { groups: groups, total: total, count: unbilled.length };
}
