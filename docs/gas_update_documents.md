# GAS スクリプト（完全版）

以下のコードは、既存のプロジェクト機能に「**案件書類（PDF・画像等）のGoogle Drive自動保存機能**」を追加し、一つにまとめた完全版です。
既存のGASプロジェクトのコードをすべて消去し、以下のコードを丸ごとコピー＆ペーストしてください。

## 更新手順

1. [Google Apps Script](https://script.google.com) を開く
2. 既存のプロジェクトを選択する
3. エディタに書かれているコードを **すべて削除** する
4. 以下のコードを **すべてコピーして貼り付ける**
5. 「デプロイ」→「デプロイを管理」→「新しいバージョン」でデプロイを更新する

---

## コード（すべてコピーしてください）

```javascript
/**
 * ============================================================
 *  行政書士事務所 — 顧客マスタ・担当者マスタ 管理スクリプト
 *  Google スプレッドシート用 Apps Script
 * ============================================================
 *
 *  【セットアップ】
 *   1. Google スプレッドシートを新規作成
 *   2. 拡張機能 → Apps Script を開く
 *   3. このコードを貼り付けて保存
 *   4. メニューから「マスタ管理 → 初期セットアップ」を実行
 *
 *  【機能一覧】
 *   - 顧客マスタ / 担当者マスタの自動生成
 *   - ID 自動採番（C-0001 / S-001）
 *   - 更新日の自動記入
 *   - 操作ログの自動記録
 *   - データバリデーション（電話番号・メール）
 *   - シート保護（ヘッダー行ロック）
 *   - ダッシュボードからの API 連携（取得・追加・更新・削除）
 *   - 書類自動保存（PDF・画像等を Drive へ）
 * ============================================================
 */

// ============================================================
//  定数
// ============================================================
const SHEET_NAMES = {
  CUSTOMER: '顧客マスタ',
  STAFF:    '担当者マスタ',
  CASES:    '案件マスタ',
  JOURNALS: '帳簿',
  LOG:      '操作ログ',
};

const CUSTOMER_HEADERS = [
  '顧客ID', '氏名', 'フリガナ', '区分',
  '電話番号', 'メールアドレス', '郵便番号', '住所',
  '生年月日', '法人名', '法人番号', '紹介元',
  '担当者ID', '備考', '登録日', '更新日',
];

const STAFF_HEADERS = [
  '担当者ID', '氏名', 'フリガナ', '役職',
  '電話番号', 'メールアドレス', '担当業務', 'ステータス',
  '登録日', '更新日',
];

const CASE_HEADERS = [
  '案件ID', '顧客ID', '案件名', 'カテゴリ',
  'ステータス', '期限', '報酬', '担当者ID',
  '備考', '完了日', '登録日', '更新日',
];

const JOURNAL_HEADERS = [
  '伝票ID', '日付', '借方', '貸方',
  '金額', '摘要', '案件ID', '自動',
  '登録日',
];

const LOG_HEADERS = [
  '日時', '操作者', 'シート名', '行番号',
  '列名', '変更前', '変更後',
];

// ============================================================
//  メニュー
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 マスタ管理')
    .addItem('🚀 初期セットアップ', 'initialSetup')
    .addSeparator()
    .addItem('✅ データ検証（顧客マスタ）', 'validateCustomerData')
    .addItem('✅ データ検証（担当者マスタ）', 'validateStaffData')
    .addSeparator()
    .addItem('🔒 セキュリティ設定を再適用', 'applySecurity')
    .addToUi();
}

// ============================================================
//  初期セットアップ
// ============================================================

function initialSetup() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '初期セットアップ',
    '顧客マスタ・担当者マスタ・操作ログシートを作成します。\n' +
    '既存のシートがある場合は上書きされません。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  setupCustomerMaster_();
  setupStaffMaster_();
  setupLogSheet_();
  applySecurity();

  ui.alert('✅ セットアップ完了', 'すべてのマスタシートが作成されました。', ui.ButtonSet.OK);
}

// ============================================================
//  顧客マスタ セットアップ
// ============================================================

function setupCustomerMaster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CUSTOMER);
  }

  const headerRange = sheet.getRange(1, 1, 1, CUSTOMER_HEADERS.length);
  headerRange.setValues([CUSTOMER_HEADERS]);
  headerRange.setBackground('#1a237e').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  const widths = [90, 120, 130, 70, 130, 200, 100, 250, 110, 150, 140, 120, 90, 200, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const kubunRule = SpreadsheetApp.newDataValidation().requireValueInList(['個人', '法人'], true).setAllowInvalid(false).build();
  sheet.getRange('D2:D1000').setDataValidation(kubunRule);

  const phoneRule = SpreadsheetApp.newDataValidation().requireTextContains('').setAllowInvalid(true).build();
  sheet.getRange('E2:E1000').setDataValidation(phoneRule);
  sheet.getRange('E2:E1000').setNumberFormat('@');
  sheet.getRange('F2:F1000').setNumberFormat('@');

  sheet.getRange('I2:I1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('O2:O1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('P2:P1000').setNumberFormat('yyyy/mm/dd');

  sheet.getRange('G2:G1000').setNumberFormat('@');
  sheet.getRange('K2:K1000').setNumberFormat('@');

  const condRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('法人').setBackground('#e8f5e9').setRanges([sheet.getRange('D2:D1000')]).build();
  sheet.setConditionalFormatRules([condRule]);

  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), CUSTOMER_HEADERS.length).createFilter();
  }
  sheet.setFrozenRows(1);
}

// ============================================================
//  担当者マスタ セットアップ
// ============================================================

function setupStaffMaster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.STAFF);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.STAFF);
  }

  const headerRange = sheet.getRange(1, 1, 1, STAFF_HEADERS.length);
  headerRange.setValues([STAFF_HEADERS]);
  headerRange.setBackground('#0d47a1').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  const widths = [90, 120, 130, 140, 130, 200, 200, 80, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['在籍', '退職', '休職'], true).setAllowInvalid(false).build();
  sheet.getRange('H2:H1000').setDataValidation(statusRule);

  const roleRule = SpreadsheetApp.newDataValidation().requireValueInList(['代表行政書士', '行政書士', '補助者', '事務員'], true).setAllowInvalid(true).build();
  sheet.getRange('D2:D1000').setDataValidation(roleRule);

  sheet.getRange('E2:E1000').setNumberFormat('@');
  sheet.getRange('F2:F1000').setNumberFormat('@');
  sheet.getRange('I2:I1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('J2:J1000').setNumberFormat('yyyy/mm/dd');

  const retiredRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('退職').setBackground('#f5f5f5').setFontColor('#9e9e9e').setRanges([sheet.getRange('H2:H1000')]).build();
  sheet.setConditionalFormatRules([retiredRule]);

  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), STAFF_HEADERS.length).createFilter();
  }
  sheet.setFrozenRows(1);
}

// ============================================================
//  操作ログシート セットアップ
// ============================================================

function setupLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.LOG);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.LOG);
  }

  const headerRange = sheet.getRange(1, 1, 1, LOG_HEADERS.length);
  headerRange.setValues([LOG_HEADERS]);
  headerRange.setBackground('#424242').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  const widths = [160, 100, 120, 70, 100, 200, 200];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);
}

// ============================================================
//  onEdit トリガー — 自動処理
// ============================================================

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row === 1) return;
  if (sheetName === SHEET_NAMES.LOG) return;

  if (sheetName === SHEET_NAMES.CUSTOMER) {
    const idCell = sheet.getRange(row, 1);
    if (idCell.getValue() === '') {
      idCell.setValue(generateCustomerId_(sheet));
      sheet.getRange(row, 15).setValue(new Date());
    }
    sheet.getRange(row, 16).setValue(new Date());
    writeLog_(sheetName, row, CUSTOMER_HEADERS[col - 1] || '', e.oldValue || '', e.value || '');
  }

  if (sheetName === SHEET_NAMES.STAFF) {
    const idCell = sheet.getRange(row, 1);
    if (idCell.getValue() === '') {
      idCell.setValue(generateStaffId_(sheet));
      sheet.getRange(row, 9).setValue(new Date());
    }
    sheet.getRange(row, 10).setValue(new Date());
    writeLog_(sheetName, row, STAFF_HEADERS[col - 1] || '', e.oldValue || '', e.value || '');
  }
}

// ============================================================
//  ID 自動採番
// ============================================================

function generateCustomerId_(sheet) {
  const data = sheet.getRange('A2:A' + sheet.getLastRow()).getValues().flat().filter(v => v !== '');
  let maxNum = 0;
  data.forEach(id => {
    const match = String(id).match(/^C-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return 'C-' + String(maxNum + 1).padStart(4, '0');
}

function generateStaffId_(sheet) {
  const data = sheet.getRange('A2:A' + sheet.getLastRow()).getValues().flat().filter(v => v !== '');
  let maxNum = 0;
  data.forEach(id => {
    const match = String(id).match(/^S-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return 'S-' + String(maxNum + 1).padStart(3, '0');
}

// ============================================================
//  操作ログ記録
// ============================================================

function writeLog_(sheetName, row, columnName, oldValue, newValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!logSheet) {
    setupLogSheet_();
    logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  }

  const email = Session.getActiveUser().getEmail() || '不明';
  const timestamp = new Date();

  logSheet.appendRow([timestamp, email, sheetName, row, columnName, oldValue, newValue]);
}

// ============================================================
//  データ検証
// ============================================================

function validateCustomerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) return SpreadsheetApp.getUi().alert('顧客マスタシートが見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return SpreadsheetApp.getUi().alert('データがありません。');

  const data = sheet.getRange(2, 1, lastRow - 1, CUSTOMER_HEADERS.length).getValues();
  const errors = [];

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[1];
    const phone = row[4];
    const email = row[5];
    const zip = row[6];

    if (!name || String(name).trim() === '') errors.push('行' + rowNum + ': 氏名が空欄です');
    if (phone && String(phone).trim() !== '') {
      if (!/^[0-9]{10,11}$/.test(String(phone).replace(/[\s\-－]/g, ''))) errors.push('行' + rowNum + ': 電話番号の形式が不正です（' + phone + '）');
    }
    if (email && String(email).trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('行' + rowNum + ': メールアドレスの形式が不正です（' + email + '）');
    }
    if (zip && String(zip).trim() !== '') {
      if (!/^\d{7}$/.test(String(zip).replace(/[\-－]/g, ''))) errors.push('行' + rowNum + ': 郵便番号の形式が不正です（' + zip + '）');
    }
  });

  const ui = SpreadsheetApp.getUi();
  if (errors.length === 0) ui.alert('✅ 検証完了', '顧客マスタのデータに問題はありません。', ui.ButtonSet.OK);
  else ui.alert('⚠️ 検証結果', errors.length + ' 件の問題が見つかりました:\n\n' + errors.join('\n'), ui.ButtonSet.OK);
}

function validateStaffData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!sheet) return SpreadsheetApp.getUi().alert('担当者マスタシートが見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return SpreadsheetApp.getUi().alert('データがありません。');

  const data = sheet.getRange(2, 1, lastRow - 1, STAFF_HEADERS.length).getValues();
  const errors = [];

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[1];
    const phone = row[4];
    const email = row[5];

    if (!name || String(name).trim() === '') errors.push('行' + rowNum + ': 氏名が空欄です');
    if (phone && String(phone).trim() !== '') {
      if (!/^[0-9]{10,11}$/.test(String(phone).replace(/[\s\-－]/g, ''))) errors.push('行' + rowNum + ': 電話番号の形式が不正です（' + phone + '）');
    }
    if (email && String(email).trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) errors.push('行' + rowNum + ': メールアドレスの形式が不正です（' + email + '）');
    }
  });

  const ui = SpreadsheetApp.getUi();
  if (errors.length === 0) ui.alert('✅ 検証完了', '担当者マスタのデータに問題はありません。', ui.ButtonSet.OK);
  else ui.alert('⚠️ 検証結果', errors.length + ' 件の問題が見つかりました:\n\n' + errors.join('\n'), ui.ButtonSet.OK);
}

// ============================================================
//  セキュリティ設定
// ============================================================

function applySecurity() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const me = Session.getEffectiveUser();

  const customerSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (customerSheet) {
    protectHeaderRow_(customerSheet, me, '顧客マスタ - ヘッダー保護');
    protectIdColumn_(customerSheet, me, '顧客マスタ - ID列保護', 1);
  }

  const staffSheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (staffSheet) {
    protectHeaderRow_(staffSheet, me, '担当者マスタ - ヘッダー保護');
    protectIdColumn_(staffSheet, me, '担当者マスタ - ID列保護', 1);
  }

  const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (logSheet) {
    logSheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
    const protection = logSheet.protect().setDescription('操作ログ - 編集保護');
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(e => e.getEmail() !== me.getEmail()));
    protection.setWarningOnly(true);
  }
}

function protectHeaderRow_(sheet, owner, description) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
    if (p.getDescription() === description) p.remove();
  });
  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  const protection = headerRange.protect().setDescription(description);
  protection.addEditor(owner);
  protection.removeEditors(protection.getEditors().filter(e => e.getEmail() !== owner.getEmail()));
}

function protectIdColumn_(sheet, owner, description, col) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
    if (p.getDescription() === description) p.remove();
  });
  const idRange = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
  const protection = idRange.protect().setDescription(description);
  protection.setWarningOnly(true);
}

// ============================================================
//  Web API — ダッシュボード連携
// ============================================================

function doGet(e) {
  try {
    const type = (e && e.parameter && e.parameter.type) || 'all';
    const result = {};

    if (type === 'customers' || type === 'all') result.customers = getSheetDataAsJson_(SHEET_NAMES.CUSTOMER, CUSTOMER_HEADERS);
    if (type === 'staff' || type === 'all') result.staff = getSheetDataAsJson_(SHEET_NAMES.STAFF, STAFF_HEADERS);
    if (type === 'cases' || type === 'all') result.cases = getSheetDataAsJson_(SHEET_NAMES.CASES, CASE_HEADERS);
    if (type === 'journals' || type === 'all') result.journals = getSheetDataAsJson_(SHEET_NAMES.JOURNALS, JOURNAL_HEADERS);
    
    if (type === 'events' || type === 'all') {
      const daysBack = parseInt((e && e.parameter && e.parameter.daysBack) || '7');
      const daysForward = parseInt((e && e.parameter && e.parameter.daysForward) || '90');
      result.events = getCalendarEvents_(daysBack, daysForward);
    }
    if (type === 'faxLog') result.faxLog = getFaxLog_(50);

    result.syncedAt = new Date().toISOString();

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data;
    let result = {};

    switch (action) {
      case 'upsertCustomer': result = upsertCustomer_(data); break;
      case 'upsertStaff': result = upsertStaff_(data); break;
      case 'deleteCustomer': result = deleteRow_(SHEET_NAMES.CUSTOMER, data.id); break;
      case 'deleteStaff': result = deleteRow_(SHEET_NAMES.STAFF, data.id); break;
      case 'saveInvoicePdf': result = saveInvoicePdf_(data); break;
      case 'createCalendarEvent': result = createCalendarEvent_(data); break;
      case 'updateCalendarEvent': result = updateCalendarEvent_(data); break;
      case 'deleteCalendarEvent': result = deleteCalendarEvent_(data); break;
      case 'sendFax': result = sendFax_(data); break;
      case 'checkFax': result = checkIncomingFax_(); break;
      case 'upsertCase': result = upsertCase_(data); break;
      case 'deleteCase': result = deleteRow_(SHEET_NAMES.CASES, data.id); break;
      case 'upsertJournal': result = upsertJournal_(data); break;
      case 'deleteJournal': result = deleteRow_(SHEET_NAMES.JOURNALS, data.id); break;
      case 'saveCaseDocument': result = saveCaseDocument_(data); break;
      case 'deleteCaseDocument': result = deleteCaseDocument_(data); break;
      default: result = { error: '不明なアクション: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
//  Web API ヘルパー関数
// ============================================================

function getSheetDataAsJson_(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const jsonData = [];
  const keyMap = getKeyMap_(sheetName);

  data.forEach(row => {
    const obj = {};
    let hasData = false;
    headers.forEach((header, i) => {
      const key = keyMap[header] || header;
      let value = row[i];
      if (value instanceof Date) value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      obj[key] = value !== '' ? value : '';
      if (value !== '') hasData = true;
    });
    if (hasData) jsonData.push(obj);
  });
  return jsonData;
}

function getKeyMap_(sheetName) {
  if (sheetName === SHEET_NAMES.CUSTOMER) return {'顧客ID': 'id','氏名': 'name','フリガナ': 'nameKana','区分': 'type','電話番号': 'phone','メールアドレス': 'email','郵便番号': 'zip','住所': 'address','生年月日': 'birthday','法人名': 'companyName','法人番号': 'companyNumber','紹介元': 'referral','担当者ID': 'staffId','備考': 'memo','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.STAFF) return {'担当者ID': 'id','氏名': 'name','フリガナ': 'nameKana','役職': 'role','電話番号': 'phone','メールアドレス': 'email','担当業務': 'duties','ステータス': 'status','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.CASES) return {'案件ID': 'id','顧客ID': 'clientId','案件名': 'title','カテゴリ': 'category','ステータス': 'status','期限': 'deadline','報酬': 'fee','担当者ID': 'staffId','備考': 'memo','完了日': 'completedAt','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.JOURNALS) return {'伝票ID': 'id','日付': 'date','借方': 'debit','貸方': 'credit','金額': 'amount','摘要': 'description','案件ID': 'caseId','自動': 'auto','登録日': 'createdAt'};
  return {};
}

function upsertCustomer_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) return { error: '顧客マスタシートが見つかりません' };

  const now = new Date();
  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        CUSTOMER_HEADERS.forEach((header, col) => {
          const key = getKeyMap_(SHEET_NAMES.CUSTOMER)[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) sheet.getRange(row, col + 1).setValue(data[key]);
        });
        sheet.getRange(row, 16).setValue(now);
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = generateCustomerId_(sheet);
  const rowData = CUSTOMER_HEADERS.map(header => {
    const key = getKeyMap_(SHEET_NAMES.CUSTOMER)[header];
    if (key === 'id') return newId;
    if (key === 'createdAt' || key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

function upsertStaff_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!sheet) return { error: '担当者マスタシートが見つかりません' };

  const now = new Date();
  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        STAFF_HEADERS.forEach((header, col) => {
          const key = getKeyMap_(SHEET_NAMES.STAFF)[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) sheet.getRange(row, col + 1).setValue(data[key]);
        });
        sheet.getRange(row, 10).setValue(now);
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = generateStaffId_(sheet);
  const rowData = STAFF_HEADERS.map(header => {
    const key = getKeyMap_(SHEET_NAMES.STAFF)[header];
    if (key === 'id') return newId;
    if (key === 'createdAt' || key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

function deleteRow_(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: sheetName + 'が見つかりません' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'データがありません' };

  const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
  const rowIdx = ids.indexOf(id);
  if (rowIdx === -1) return { error: 'ID が見つかりません: ' + id };

  sheet.deleteRow(rowIdx + 2);
  return { success: true, action: 'deleted', id: id };
}

function upsertCase_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.CASES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CASES);
    sheet.appendRow(CASE_HEADERS);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  const keyMap = getKeyMap_(SHEET_NAMES.CASES);
  const now = new Date();

  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        CASE_HEADERS.forEach(function(header, col) {
          const key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) sheet.getRange(row, col + 1).setValue(data[key]);
        });
        sheet.getRange(row, 12).setValue(now);
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = data.id || ('CASE-' + Date.now());
  const rowData = CASE_HEADERS.map(function(header) {
    var key = keyMap[header];
    if (key === 'id') return newId;
    if (key === 'createdAt') return data.createdAt || now;
    if (key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

function upsertJournal_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.JOURNALS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.JOURNALS);
    sheet.appendRow(JOURNAL_HEADERS);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  const keyMap = getKeyMap_(SHEET_NAMES.JOURNALS);
  const now = new Date();

  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        JOURNAL_HEADERS.forEach(function(header, col) {
          var key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) sheet.getRange(row, col + 1).setValue(data[key]);
        });
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = data.id || ('J-' + Date.now());
  const rowData = JOURNAL_HEADERS.map(function(header) {
    var key = keyMap[header];
    if (key === 'id') return newId;
    if (key === 'createdAt') return data.createdAt || now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}


// ============================================================
//  書類・PDF 保存・削除（案件関連 & 請求書）
// ============================================================

/**
 * 案件書類をDriveに保存
 */
function saveCaseDocument_(data) {
  try {
    const caseId = data.caseId;
    const caseTitle = data.caseTitle || '無題の案件';
    const clientName = data.clientName || '不明な顧客';
    
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    // フォルダ名に使えない文字を置換
    const folderName = `${todayStr}_${caseId}_${caseTitle}`.replace(/[\\/:*?"<>|]/g, '_');
    
    const fileName = data.fileName;
    const mimeType = data.mimeType;
    const base64Data = data.base64Data;

    // 行政書士事務所/{clientName}/案件書類/{folderName}/ に保存
    const rootFolder = getOrCreateFolder_('行政書士事務所');
    const clientFolder = getOrCreateFolderUnder_(rootFolder, clientName);
    const docsFolder = getOrCreateFolderUnder_(clientFolder, '案件書類');

    let caseFolder = null;
    const folders = docsFolder.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      // 既存のフォルダ（IDが含まれているか前方一致等）があればリネームして再利用
      if (f.getName().indexOf(String(caseId)) !== -1) {
        caseFolder = f;
        if (f.getName() !== folderName) f.setName(folderName);
        break;
      }
    }
    if (!caseFolder) {
      caseFolder = docsFolder.createFolder(folderName);
    }

    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, mimeType || 'application/octet-stream', fileName);
    const file = caseFolder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      success: true,
      url: file.getUrl(),
      fileId: file.getId(),
      folderPath: `行政書士事務所/${clientName}/案件書類/${folderName}`,
    };
  } catch (err) {
    return { error: '書類保存エラー: ' + err.message };
  }
}

/**
 * 案件書類をDriveから削除（ゴミ箱へ）
 */
function deleteCaseDocument_(data) {
  try {
    const fileId = data.fileId;
    DriveApp.getFileById(fileId).setTrashed(true);
    return { success: true };
  } catch (err) {
    return { error: '書類削除エラー: ' + err.message };
  }
}

/**
 * 請求書等の保存
 */
function saveInvoicePdf_(data) {
  if (!data.html || !data.invoiceNo || !data.clientName) return { error: '必須パラメータが不足' };

  const docType = data.docType || '請求書';
  const fileName = data.invoiceNo + '.pdf';

  try {
    const clientFolder = getOrCreateClientFolder_(data.clientName, docType);
    const existing = clientFolder.getFilesByName(fileName);
    if (existing.hasNext()) existing.next().setTrashed(true);

    const blob = HtmlService.createHtmlOutput(data.html).getBlob().setName(fileName);
    const file = clientFolder.createFile(blob);

    return { success: true, fileId: file.getId(), fileUrl: file.getUrl(), fileName: fileName, folderPath: '行政書士事務所/' + data.clientName + '/' + docType };
  } catch (err) {
    return { error: 'PDF保存エラー: ' + err.message };
  }
}

// ---- Drive フォルダ生成ヘルパー ----
function getOrCreateFolder_(folderName) {
  const folders = DriveApp.getRootFolder().getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.getRootFolder().createFolder(folderName);
}
function getOrCreateFolderUnder_(parentFolder, subFolderName) {
  const folders = parentFolder.getFoldersByName(subFolderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(subFolderName);
}

function getOrCreateClientFolder_(clientName, subFolderName) {
  const rootFolder = getOrCreateFolder_('行政書士事務所');
  const clientFolder = getOrCreateFolderUnder_(rootFolder, clientName);
  return getOrCreateFolderUnder_(clientFolder, subFolderName);
}

// ============================================================
//  Googleカレンダー連携
// ============================================================
function createCalendarEvent_(data) {
  if (!data.title || !data.date) return { error: 'タイトルと日付は必須です' };
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const CATS = { meeting: '🤝', visit: '🚗', training: '📚', deadline: '⏰', other: '📌' };
    const icon = CATS[data.category] || '📌';
    const title = icon + ' ' + data.title;
    const description = (data.memo || '') + (data.localId ? '\n[dashboardId:' + data.localId + ']' : '');

    let event;
    if (data.time) {
      const startDate = new Date(data.date + 'T' + data.time + ':00');
      const endTime = data.endTime || data.time;
      const endDate = new Date(data.date + 'T' + endTime + ':00');
      if (endDate <= startDate) endDate.setHours(startDate.getHours() + 1);
      event = cal.createEvent(title, startDate, endDate, { description });
    } else {
      event = cal.createAllDayEvent(title, new Date(data.date + 'T00:00:00'), { description });
    }
    return { success: true, calendarEventId: event.getId(), localId: data.localId || '' };
  } catch (err) { return { error: 'カレンダー作成エラー: ' + err.message }; }
}

function updateCalendarEvent_(data) {
  if (!data.calendarEventId) return { error: 'calendarEventId は必須です' };
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const event = cal.getEventById(data.calendarEventId);
    if (!event) return { error: '予定が見つかりません' };

    const CATS = { meeting: '🤝', visit: '🚗', training: '📚', deadline: '⏰', other: '📌' };
    const icon = CATS[data.category] || '📌';

    if (data.title) event.setTitle(icon + ' ' + data.title);
    if (data.memo !== undefined) event.setDescription((data.memo || '') + (data.localId ? '\n[dashboardId:' + data.localId + ']' : ''));

    if (data.date && data.time) {
      const startDate = new Date(data.date + 'T' + data.time + ':00');
      const endTime = data.endTime || data.time;
      const endDate = new Date(data.date + 'T' + endTime + ':00');
      if (endDate <= startDate) endDate.setHours(startDate.getHours() + 1);
      event.setTime(startDate, endDate);
    } else if (data.date) {
      event.setAllDayDate(new Date(data.date + 'T00:00:00'));
    }
    return { success: true, calendarEventId: data.calendarEventId };
  } catch (err) { return { error: 'カレンダー更新エラー: ' + err.message }; }
}

function deleteCalendarEvent_(data) {
  if (!data.calendarEventId) return { error: 'calendarEventId は必須です' };
  try {
    const event = CalendarApp.getDefaultCalendar().getEventById(data.calendarEventId);
    if (!event) return { error: '予定が見つかりません' };
    event.deleteEvent();
    return { success: true };
  } catch (err) { return { error: 'カレンダー削除エラー: ' + err.message }; }
}

function getCalendarEvents_(daysBack, daysForward) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - (daysBack || 7));
    const end = new Date(now); end.setDate(end.getDate() + (daysForward || 90));

    return cal.getEvents(start, end).map(function(ev) {
      const allDay = ev.isAllDayEvent();
      const startTime = ev.getStartTime();
      return {
        calendarEventId: ev.getId(),
        title: ev.getTitle(),
        date: Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        time: allDay ? '' : Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm'),
        endTime: allDay ? '' : Utilities.formatDate(ev.getEndTime(), Session.getScriptTimeZone(), 'HH:mm'),
        description: ev.getDescription() || '',
        allDay: allDay,
      };
    });
  } catch (err) { return []; }
}

// ============================================================
//  eFax連携
// ============================================================
function sendFax_(data) {
  if (!data.faxNumber) return { error: 'FAX番号は必須です' };
  try {
    const faxEmail = data.faxNumber.replace(/[-\s]/g, '') + '@efaxsend.com';
    const options = {};
    if (data.pdfBase64 && data.pdfName) {
      const pdfBlob = Utilities.newBlob(Utilities.base64Decode(data.pdfBase64), 'application/pdf', data.pdfName);
      options.attachments = [pdfBlob];
      if (data.clientName) {
        const folder = getOrCreateClientFolder_(data.clientName, 'FAX送信');
        const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        folder.createFile(pdfBlob.setName(ts + '_' + data.pdfName));
      }
    }
    GmailApp.sendEmail(faxEmail, data.subject || 'FAX送信', data.body || '', options);
    logFax_('送信', data.faxNumber, data.subject, data.clientName || '');
    return { success: true, message: 'FAXを送信しました', sentTo: faxEmail };
  } catch (err) { return { error: 'FAX送信エラー: ' + err.message }; }
}

function checkIncomingFax_() {
  try {
    let saved = 0;
    GmailApp.search('from:@efax.com is:unread', 0, 20).forEach(thread => {
      thread.getMessages().forEach(msg => {
        if (msg.isUnread()) {
          const ts = Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
          msg.getAttachments().forEach(att => {
            if (att.getContentType() === 'application/pdf' || att.getName().endsWith('.pdf')) {
              const root = getOrCreateFolder_('行政書士事務所');
              const folder = getOrCreateFolderUnder_(root, 'FAX受信');
              folder.createFile(att.copyBlob().setName(ts + '_' + att.getName()));
              saved++;
            }
          });
          logFax_('受信', msg.getFrom(), msg.getSubject(), '');
          msg.markRead();
        }
      });
    });
    return { success: true, saved: saved };
  } catch (err) { return { error: '受信FAXチェックエラー: ' + err.message }; }
}

function logFax_(direction, number, subject, clientName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('FAXログ');
  if (!sheet) {
    sheet = ss.insertSheet('FAXログ');
    sheet.appendRow(['日時', '種別', '番号/送信元', '件名', '顧客名']);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  sheet.appendRow([new Date(), direction, number, subject, clientName]);
}

function getFaxLog_(count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FAXログ');
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const numRows = Math.min(count || 50, lastRow - 1);
  const data = sheet.getRange(Math.max(2, lastRow - numRows + 1), 1, numRows, 5).getValues();
  return data.reverse().map(row => ({
    date: row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(row[0]),
    direction: row[1],
    number: row[2],
    subject: row[3],
    clientName: row[4],
  }));
}
```

---

## 確認方法

1. GASのエディタで上書き保存し、**「デプロイ」→「デプロイを管理」→「新しいバージョン」** でデプロイを更新します。
2. ダッシュボードから任意の案件を開き、「📎 書類を追加」ボタンから書類（PDFや画像）をアップロードします。
3. アップロード完了後、Google Driveの `マイドライブ/行政書士事務所/案件書類/{案件ID}/` フォルダに保存されていれば成功です。
