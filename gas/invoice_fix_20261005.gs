/**
 * ============================================================
 *  請求書3件の金額訂正（2026-10-05 / 送付済みPDFに合わせる）— 一回限り
 * ============================================================
 *  原因: 10/4 の移行登録（importInvoices_）が「税額＝送付額−報酬−立替」の逆算だったため、
 *        案件側または登録請求額のズレが消費税欄に出ていた。
 *
 *  訂正内容（すべて送付済みPDFで確認済み）
 *   INV-202609-055 三菱ふそう岐阜 : 請求合計 82,100 → 83,750 / 税 4,000 → 5,650
 *   INV-202609-057 三菱ふそう小牧 : 請求合計 311,734 → 310,634 / 税 21,600 → 20,500
 *   INV-202610-007 トヨタ江南     : 報酬 10,500 → 13,000 / 税 3,800 → 1,300
 *                                   （案件 mtwc8k9vvksb49vf4 の報酬 5,500 → 8,000）
 *
 *  使い方（Apps Script エディタで）
 *   1. previewInvoiceFix20261005()  … 何も書き換えず、変更内容と現在値の一致だけ確認
 *   2. applyInvoiceFix20261005()    … バックアップ作成 → 訂正を反映
 *   現在値が想定と違う場合は、何も書き込まずに中止する。2回目以降の実行も安全に中止する。
 * ============================================================
 */

const FIX_20261005_NOTE = '2026-10-05 金額訂正（送付済みPDFに合わせた）';
const FIX_20261005_CASE_ID = 'mtwc8k9vvksb49vf4';

// 各請求書: 現在値（想定）と訂正後の値
const FIX_20261005_INVOICES = [
  {
    invoiceNo: 'INV-202609-055',
    before: { feeExTax: 56500, tax: 4000, feeInTax: 60500, advanceTotal: 21600, grandTotal: 82100 },
    after:  { feeExTax: 56500, tax: 5650, feeInTax: 62150, advanceTotal: 21600, grandTotal: 83750 },
  },
  {
    invoiceNo: 'INV-202609-057',
    before: { feeExTax: 205000, tax: 21600, feeInTax: 226600, advanceTotal: 85134, grandTotal: 311734 },
    after:  { feeExTax: 205000, tax: 20500, feeInTax: 225500, advanceTotal: 85134, grandTotal: 310634 },
  },
  {
    invoiceNo: 'INV-202610-007',
    before: { feeExTax: 10500, tax: 3800, feeInTax: 14300, advanceTotal: 990, grandTotal: 15290 },
    after:  { feeExTax: 13000, tax: 1300, feeInTax: 14300, advanceTotal: 990, grandTotal: 15290 },
    item: { caseId: FIX_20261005_CASE_ID, lockedFeeBefore: 5500, lockedFeeAfter: 8000 },
  },
];

function previewInvoiceFix20261005() {
  const r = invoiceFix20261005_(false);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function applyInvoiceFix20261005() {
  const r = invoiceFix20261005_(true);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

function invoiceFix20261005_(apply) {
  const invoices = invReadAll_(INV_SHEETS.INVOICES, INV_COLS);
  const payments = invReadAll_(INV_SHEETS.PAYMENTS, PAY_COLS);
  const items = invReadAll_(INV_SHEETS.ITEMS, ITEM_COLS);
  const plan = [];
  const problems = [];

  FIX_20261005_INVOICES.forEach(function (fx) {
    const inv = invoices.filter(function (v) { return v.invoiceNo === fx.invoiceNo; })[0];
    if (!inv) { problems.push(fx.invoiceNo + ': 請求書が見つかりません'); return; }
    Object.keys(fx.before).forEach(function (k) {
      if (invNum_(inv[k]) !== fx.before[k]) {
        problems.push(fx.invoiceNo + ': ' + k + ' が想定と違います（現在 ' + inv[k] + ' / 想定 ' + fx.before[k] + '）。訂正済みの可能性があります');
      }
    });
    const pay = payments.filter(function (p) { return p.invoiceNo === fx.invoiceNo && p.status !== PAY_STATUS.CANCELED; })[0];
    if (!pay) problems.push(fx.invoiceNo + ': 入金予定が見つかりません');
    else if (pay.status !== PAY_STATUS.UNPAID) problems.push(fx.invoiceNo + ': 入金済みのため自動訂正できません');
    let it = null;
    if (fx.item) {
      it = items.filter(function (x) { return x.invoiceNo === fx.invoiceNo && String(x.caseId) === fx.item.caseId && x.status === ITEM_STATUS.ACTIVE; })[0];
      if (!it) problems.push(fx.invoiceNo + ': 明細（案件 ' + fx.item.caseId + '）が見つかりません');
      else if (invNum_(it.lockedFee) !== fx.item.lockedFeeBefore) problems.push(fx.invoiceNo + ': 明細の確定報酬が想定と違います（' + it.lockedFee + '）');
    }
    plan.push({ fx: fx, inv: inv, pay: pay, item: it });
  });

  // 案件側（江南 007 の 5,500 → 8,000）
  const caseRow = getSheetDataAsJson_(SHEET_NAMES.CASES, CASE_HEADERS)
    .filter(function (c) { return String(c.id) === FIX_20261005_CASE_ID; })[0];
  if (!caseRow) problems.push('案件 ' + FIX_20261005_CASE_ID + ' が見つかりません');
  else if (invNum_(caseRow.fee) !== 5500) problems.push('案件 ' + FIX_20261005_CASE_ID + ' の報酬が想定(5500)と違います（' + caseRow.fee + '）');

  if (problems.length) return { applied: false, problems: problems };
  if (!apply) return { applied: false, preview: 'OK（現在値は想定どおり）', changes: FIX_20261005_INVOICES.map(function (f) { return { invoiceNo: f.invoiceNo, before: f.before, after: f.after }; }), caseFee: '5500 → 8000' };

  // 1) バックアップ（スプレッドシート全体のコピー）
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  const copy = DriveApp.getFileById(ss.getId()).makeCopy('バックアップ_請求訂正前_' + stamp);

  // 2) 請求書・入金・明細
  const res = withInvoiceLock_(function () {
    const now = invNow_();
    plan.forEach(function (p) {
      Object.keys(p.fx.after).forEach(function (k) { p.inv[k] = p.fx.after[k]; });
      p.inv.note = [p.inv.note, FIX_20261005_NOTE].filter(String).join(' / ');
      invUpdate_(INV_SHEETS.INVOICES, INV_COLS, p.inv);
      p.pay.amount = p.fx.after.grandTotal; p.pay.updatedBy = '金額訂正'; p.pay.updatedAt = now;
      invUpdate_(INV_SHEETS.PAYMENTS, PAY_COLS, p.pay);
      if (p.item) {
        p.item.lockedFee = p.fx.item.lockedFeeAfter; p.item.updatedAt = now;
        invUpdate_(INV_SHEETS.ITEMS, ITEM_COLS, p.item);
      }
    });
    return { success: true };
  });
  if (res && res.error) return { applied: false, backup: copy.getUrl(), error: res.error };

  // 3) 案件の報酬（項目単位の保存＝端末の古い値に上書きされないよう現在時刻で）
  const nowIso = new Date().toISOString();
  const caseRes = withCaseLock_(function () {
    return patchCases_({ items: [{ id: FIX_20261005_CASE_ID, fields: { fee: 8000 }, fieldTs: { fee: nowIso } }] }, {});
  });

  return { applied: true, backup: copy.getUrl(), caseResult: caseRes };
}
