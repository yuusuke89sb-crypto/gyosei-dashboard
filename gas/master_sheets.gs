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
 * ============================================================
 */

// ============================================================
//  定数
// ============================================================
const SHEET_NAMES = {
  CUSTOMER: '顧客マスタ',
  STAFF:    '担当者マスタ',
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

const LOG_HEADERS = [
  '日時', '操作者', 'シート名', '行番号',
  '列名', '変更前', '変更後',
];


// ============================================================
//  メニュー
// ============================================================

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
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

/**
 * 全シートの初期セットアップを実行
 */
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

  // ヘッダー設定
  const headerRange = sheet.getRange(1, 1, 1, CUSTOMER_HEADERS.length);
  headerRange.setValues([CUSTOMER_HEADERS]);
  headerRange
    .setBackground('#1a237e')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 列幅の調整
  const widths = [90, 120, 130, 70, 130, 200, 100, 250, 110, 150, 140, 120, 90, 200, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 入力規則: 区分（D列）
  const kubunRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['個人', '法人'], true)
    .setAllowInvalid(false)
    .setHelpText('「個人」または「法人」を選択してください')
    .build();
  sheet.getRange('D2:D1000').setDataValidation(kubunRule);

  // 入力規則: 電話番号（E列）— ハイフン付き数字
  const phoneRule = SpreadsheetApp.newDataValidation()
    .requireTextContains('')  // 基本的にテキスト入力
    .setAllowInvalid(true)
    .setHelpText('例: 090-1234-5678')
    .build();
  sheet.getRange('E2:E1000').setDataValidation(phoneRule);
  sheet.getRange('E2:E1000').setNumberFormat('@');  // テキスト形式

  // 入力規則: メールアドレス（F列）
  sheet.getRange('F2:F1000').setNumberFormat('@');

  // 日付形式
  sheet.getRange('I2:I1000').setNumberFormat('yyyy/mm/dd');  // 生年月日
  sheet.getRange('O2:O1000').setNumberFormat('yyyy/mm/dd');  // 登録日
  sheet.getRange('P2:P1000').setNumberFormat('yyyy/mm/dd');  // 更新日

  // 郵便番号テキスト形式
  sheet.getRange('G2:G1000').setNumberFormat('@');

  // 法人番号テキスト形式
  sheet.getRange('K2:K1000').setNumberFormat('@');

  // 条件付き書式: 区分が「法人」の行をハイライト
  const condRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('法人')
    .setBackground('#e8f5e9')
    .setRanges([sheet.getRange('D2:D1000')])
    .build();
  sheet.setConditionalFormatRules([condRule]);

  // フィルター設定
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), CUSTOMER_HEADERS.length).createFilter();
  }

  // 1行目を固定
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

  // ヘッダー設定
  const headerRange = sheet.getRange(1, 1, 1, STAFF_HEADERS.length);
  headerRange.setValues([STAFF_HEADERS]);
  headerRange
    .setBackground('#0d47a1')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 列幅の調整
  const widths = [90, 120, 130, 140, 130, 200, 200, 80, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 入力規則: ステータス（H列）
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['在籍', '退職', '休職'], true)
    .setAllowInvalid(false)
    .setHelpText('ステータスを選択してください')
    .build();
  sheet.getRange('H2:H1000').setDataValidation(statusRule);

  // 入力規則: 役職（D列）
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['代表行政書士', '行政書士', '補助者', '事務員'], true)
    .setAllowInvalid(true)
    .setHelpText('役職を選択または手入力してください')
    .build();
  sheet.getRange('D2:D1000').setDataValidation(roleRule);

  // 電話番号テキスト形式
  sheet.getRange('E2:E1000').setNumberFormat('@');

  // メールアドレステキスト形式
  sheet.getRange('F2:F1000').setNumberFormat('@');

  // 日付形式
  sheet.getRange('I2:I1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('J2:J1000').setNumberFormat('yyyy/mm/dd');

  // 条件付き書式: 退職者をグレーアウト
  const retiredRule = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('退職')
    .setBackground('#f5f5f5')
    .setFontColor('#9e9e9e')
    .setRanges([sheet.getRange('H2:H1000')])
    .build();
  sheet.setConditionalFormatRules([retiredRule]);

  // フィルター設定
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), STAFF_HEADERS.length).createFilter();
  }

  // 1行目を固定
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

  // ヘッダー設定
  const headerRange = sheet.getRange(1, 1, 1, LOG_HEADERS.length);
  headerRange.setValues([LOG_HEADERS]);
  headerRange
    .setBackground('#424242')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // 列幅
  const widths = [160, 100, 120, 70, 100, 200, 200];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // 1行目を固定
  sheet.setFrozenRows(1);
}


// ============================================================
//  onEdit トリガー — 自動処理
// ============================================================

/**
 * セルが編集されたときに自動実行
 *  - 新規行に ID 自動採番
 *  - 更新日を自動記入
 *  - 操作ログに記録
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // ヘッダー行は無視
  if (row === 1) return;

  // 操作ログシートへの変更は無視
  if (sheetName === SHEET_NAMES.LOG) return;

  // ----- 顧客マスタの処理 -----
  if (sheetName === SHEET_NAMES.CUSTOMER) {
    // ID が空なら自動採番（A列）
    const idCell = sheet.getRange(row, 1);
    if (idCell.getValue() === '') {
      idCell.setValue(generateCustomerId_(sheet));
      // 登録日を設定（O列 = 15列目）
      sheet.getRange(row, 15).setValue(new Date());
    }
    // 更新日を自動設定（P列 = 16列目）
    sheet.getRange(row, 16).setValue(new Date());

    // 操作ログ記録
    writeLog_(sheetName, row, CUSTOMER_HEADERS[col - 1] || '', e.oldValue || '', e.value || '');
  }

  // ----- 担当者マスタの処理 -----
  if (sheetName === SHEET_NAMES.STAFF) {
    // ID が空なら自動採番（A列）
    const idCell = sheet.getRange(row, 1);
    if (idCell.getValue() === '') {
      idCell.setValue(generateStaffId_(sheet));
      // 登録日を設定（I列 = 9列目）
      sheet.getRange(row, 9).setValue(new Date());
    }
    // 更新日を自動設定（J列 = 10列目）
    sheet.getRange(row, 10).setValue(new Date());

    // 操作ログ記録
    writeLog_(sheetName, row, STAFF_HEADERS[col - 1] || '', e.oldValue || '', e.value || '');
  }
}


// ============================================================
//  ID 自動採番
// ============================================================

/**
 * 顧客ID を自動採番（C-0001 形式）
 */
function generateCustomerId_(sheet) {
  const data = sheet.getRange('A2:A' + sheet.getLastRow()).getValues().flat().filter(v => v !== '');
  let maxNum = 0;
  data.forEach(id => {
    const match = String(id).match(/^C-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  });
  return 'C-' + String(maxNum + 1).padStart(4, '0');
}

/**
 * 担当者ID を自動採番（S-001 形式）
 */
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

  logSheet.appendRow([
    timestamp,
    email,
    sheetName,
    row,
    columnName,
    oldValue,
    newValue,
  ]);
}


// ============================================================
//  データ検証
// ============================================================

/**
 * 顧客マスタのデータを検証
 */
function validateCustomerData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('顧客マスタシートが見つかりません。');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('データがありません。');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, CUSTOMER_HEADERS.length).getValues();
  const errors = [];

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[1];    // 氏名 (B列)
    const phone = row[4];   // 電話番号 (E列)
    const email = row[5];   // メールアドレス (F列)
    const zip = row[6];     // 郵便番号 (G列)

    // 氏名が空
    if (!name || String(name).trim() === '') {
      errors.push(`行${rowNum}: 氏名が空欄です`);
    }

    // 電話番号チェック（入力がある場合）
    if (phone && String(phone).trim() !== '') {
      const phoneStr = String(phone).replace(/[\s\-－]/g, '');
      if (!/^[0-9]{10,11}$/.test(phoneStr)) {
        errors.push(`行${rowNum}: 電話番号の形式が不正です（${phone}）`);
      }
    }

    // メールアドレスチェック（入力がある場合）
    if (email && String(email).trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        errors.push(`行${rowNum}: メールアドレスの形式が不正です（${email}）`);
      }
    }

    // 郵便番号チェック（入力がある場合）
    if (zip && String(zip).trim() !== '') {
      const zipStr = String(zip).replace(/[\-－]/g, '');
      if (!/^\d{7}$/.test(zipStr)) {
        errors.push(`行${rowNum}: 郵便番号の形式が不正です（${zip}）`);
      }
    }
  });

  const ui = SpreadsheetApp.getUi();
  if (errors.length === 0) {
    ui.alert('✅ 検証完了', '顧客マスタのデータに問題はありません。', ui.ButtonSet.OK);
  } else {
    ui.alert(
      '⚠️ 検証結果',
      `${errors.length} 件の問題が見つかりました:\n\n${errors.join('\n')}`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * 担当者マスタのデータを検証
 */
function validateStaffData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('担当者マスタシートが見つかりません。');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('データがありません。');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, STAFF_HEADERS.length).getValues();
  const errors = [];

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const name = row[1];   // 氏名
    const phone = row[4];  // 電話番号
    const email = row[5];  // メールアドレス

    if (!name || String(name).trim() === '') {
      errors.push(`行${rowNum}: 氏名が空欄です`);
    }

    if (phone && String(phone).trim() !== '') {
      const phoneStr = String(phone).replace(/[\s\-－]/g, '');
      if (!/^[0-9]{10,11}$/.test(phoneStr)) {
        errors.push(`行${rowNum}: 電話番号の形式が不正です（${phone}）`);
      }
    }

    if (email && String(email).trim() !== '') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        errors.push(`行${rowNum}: メールアドレスの形式が不正です（${email}）`);
      }
    }
  });

  const ui = SpreadsheetApp.getUi();
  if (errors.length === 0) {
    ui.alert('✅ 検証完了', '担当者マスタのデータに問題はありません。', ui.ButtonSet.OK);
  } else {
    ui.alert(
      '⚠️ 検証結果',
      `${errors.length} 件の問題が見つかりました:\n\n${errors.join('\n')}`,
      ui.ButtonSet.OK
    );
  }
}


// ============================================================
//  セキュリティ設定
// ============================================================

/**
 * 全マスタシートにセキュリティ設定を適用
 *  - ヘッダー行の保護
 *  - 操作ログシートの編集保護
 */
function applySecurity() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const me = Session.getEffectiveUser();

  // ---- 顧客マスタ: ヘッダー行保護 ----
  const customerSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (customerSheet) {
    protectHeaderRow_(customerSheet, me, '顧客マスタ - ヘッダー保護');
    protectIdColumn_(customerSheet, me, '顧客マスタ - ID列保護', 1);
  }

  // ---- 担当者マスタ: ヘッダー行保護 ----
  const staffSheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (staffSheet) {
    protectHeaderRow_(staffSheet, me, '担当者マスタ - ヘッダー保護');
    protectIdColumn_(staffSheet, me, '担当者マスタ - ID列保護', 1);
  }

  // ---- 操作ログ: シート全体を保護（閲覧のみ）----
  const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (logSheet) {
    // 既存の保護を削除してから再設定
    logSheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
    const protection = logSheet.protect().setDescription('操作ログ - 編集保護');
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors().filter(e => e.getEmail() !== me.getEmail()));
    protection.setWarningOnly(true);
  }
}

/**
 * シートの1行目（ヘッダー行）を保護
 */
function protectHeaderRow_(sheet, owner, description) {
  // 既存のヘッダー保護を削除
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
    if (p.getDescription() === description) p.remove();
  });

  const headerRange = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
  const protection = headerRange.protect().setDescription(description);
  protection.addEditor(owner);
  protection.removeEditors(protection.getEditors().filter(e => e.getEmail() !== owner.getEmail()));
}

/**
 * ID列を保護（自動採番のため手動編集を警告）
 */
function protectIdColumn_(sheet, owner, description, col) {
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
    if (p.getDescription() === description) p.remove();
  });

  const idRange = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
  const protection = idRange.protect().setDescription(description);
  protection.setWarningOnly(true);  // 警告のみ（自動採番は許可）
}


// ============================================================
//  Web API — ダッシュボード連携
// ============================================================

/**
 * GET リクエスト — スプレッドシートのデータを JSON で返す
 *
 * 使い方:
 *   ?type=customers  → 顧客マスタ
 *   ?type=staff      → 担当者マスタ
 *   ?type=all        → 両方（デフォルト）
 */
function doGet(e) {
  try {
    const type = (e && e.parameter && e.parameter.type) || 'all';
    const result = {};

    if (type === 'customers' || type === 'all') {
      result.customers = getSheetDataAsJson_(SHEET_NAMES.CUSTOMER, CUSTOMER_HEADERS);
    }
    if (type === 'staff' || type === 'all') {
      result.staff = getSheetDataAsJson_(SHEET_NAMES.STAFF, STAFF_HEADERS);
    }
    if (type === 'events' || type === 'all') {
      const daysBack = parseInt((e && e.parameter && e.parameter.daysBack) || '7');
      const daysForward = parseInt((e && e.parameter && e.parameter.daysForward) || '90');
      result.events = getCalendarEvents_(daysBack, daysForward);
    }
    if (type === 'faxLog') {
      result.faxLog = getFaxLog_(50);
    }

    result.syncedAt = new Date().toISOString();

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST リクエスト — ダッシュボードからデータを受け取って書き込み
 *
 * リクエストボディ:
 * {
 *   "action": "upsertCustomer" | "upsertStaff" | "deleteCustomer" | "deleteStaff",
 *   "data": { ... }
 * }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const data = body.data;
    let result = {};

    switch (action) {
      case 'upsertCustomer':
        result = upsertCustomer_(data);
        break;
      case 'upsertStaff':
        result = upsertStaff_(data);
        break;
      case 'deleteCustomer':
        result = deleteRow_(SHEET_NAMES.CUSTOMER, data.id);
        break;
      case 'deleteStaff':
        result = deleteRow_(SHEET_NAMES.STAFF, data.id);
        break;
      case 'saveInvoicePdf':
        result = saveInvoicePdf_(data);
        break;
      case 'createCalendarEvent':
        result = createCalendarEvent_(data);
        break;
      case 'updateCalendarEvent':
        result = updateCalendarEvent_(data);
        break;
      case 'deleteCalendarEvent':
        result = deleteCalendarEvent_(data);
        break;
      case 'sendFax':
        result = sendFax_(data);
        break;
      case 'checkFax':
        result = checkIncomingFax_();
        break;
      default:
        result = { error: '不明なアクション: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
//  Web API ヘルパー関数
// ============================================================

/**
 * シートのデータを JSON 配列として取得
 */
function getSheetDataAsJson_(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const jsonData = [];

  // ヘッダー名 → JSON キーのマッピング
  const keyMap = getKeyMap_(sheetName);

  data.forEach(row => {
    const obj = {};
    let hasData = false;
    headers.forEach((header, i) => {
      const key = keyMap[header] || header;
      let value = row[i];
      // Date オブジェクトを文字列に変換
      if (value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[key] = value !== '' ? value : '';
      if (value !== '') hasData = true;
    });
    if (hasData) jsonData.push(obj);
  });

  return jsonData;
}

/**
 * ヘッダー名 → ダッシュボードの JSON キー名マッピング
 */
function getKeyMap_(sheetName) {
  if (sheetName === SHEET_NAMES.CUSTOMER) {
    return {
      '顧客ID': 'id',
      '氏名': 'name',
      'フリガナ': 'nameKana',
      '区分': 'type',
      '電話番号': 'phone',
      'メールアドレス': 'email',
      '郵便番号': 'zip',
      '住所': 'address',
      '生年月日': 'birthday',
      '法人名': 'companyName',
      '法人番号': 'companyNumber',
      '紹介元': 'referral',
      '担当者ID': 'staffId',
      '備考': 'memo',
      '登録日': 'createdAt',
      '更新日': 'updatedAt',
    };
  }
  if (sheetName === SHEET_NAMES.STAFF) {
    return {
      '担当者ID': 'id',
      '氏名': 'name',
      'フリガナ': 'nameKana',
      '役職': 'role',
      '電話番号': 'phone',
      'メールアドレス': 'email',
      '担当業務': 'duties',
      'ステータス': 'status',
      '登録日': 'createdAt',
      '更新日': 'updatedAt',
    };
  }
  return {};
}

/**
 * JSON キー名 → ヘッダー名の逆マッピング
 */
function getReverseKeyMap_(sheetName) {
  const map = getKeyMap_(sheetName);
  const reverse = {};
  Object.keys(map).forEach(k => { reverse[map[k]] = k; });
  return reverse;
}

/**
 * 顧客データの追加/更新（upsert）
 */
function upsertCustomer_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) return { error: '顧客マスタシートが見つかりません' };

  const reverseMap = getReverseKeyMap_(SHEET_NAMES.CUSTOMER);
  const now = new Date();

  // ID で既存行を検索
  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        // 更新
        const row = rowIdx + 2;
        CUSTOMER_HEADERS.forEach((header, col) => {
          const key = getKeyMap_(SHEET_NAMES.CUSTOMER)[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            sheet.getRange(row, col + 1).setValue(data[key]);
          }
        });
        sheet.getRange(row, 16).setValue(now); // 更新日
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  // 新規追加
  const newId = generateCustomerId_(sheet);
  const rowData = CUSTOMER_HEADERS.map(header => {
    const key = getKeyMap_(SHEET_NAMES.CUSTOMER)[header];
    if (key === 'id') return newId;
    if (key === 'createdAt') return now;
    if (key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

/**
 * 担当者データの追加/更新（upsert）
 */
function upsertStaff_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STAFF);
  if (!sheet) return { error: '担当者マスタシートが見つかりません' };

  const now = new Date();

  // ID で既存行を検索
  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        STAFF_HEADERS.forEach((header, col) => {
          const key = getKeyMap_(SHEET_NAMES.STAFF)[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            sheet.getRange(row, col + 1).setValue(data[key]);
          }
        });
        sheet.getRange(row, 10).setValue(now); // 更新日
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  // 新規追加
  const newId = generateStaffId_(sheet);
  const rowData = STAFF_HEADERS.map(header => {
    const key = getKeyMap_(SHEET_NAMES.STAFF)[header];
    if (key === 'id') return newId;
    if (key === 'createdAt') return now;
    if (key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

/**
 * 行を削除（ID で検索）
 */
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


// ============================================================
//  請求書 PDF → Google Drive 保存
// ============================================================

/**
 * 請求書HTMLをPDFに変換してGoogle Driveに保存
 *
 * data: {
 *   html: 請求書のHTML文字列,
 *   invoiceNo: 請求書番号 (例: INV-202603-001),
 *   clientName: 顧客名,
 *   docType: 書類種別 (例: '請求書', '納品書')
 * }
 */
function saveInvoicePdf_(data) {
  if (!data.html || !data.invoiceNo || !data.clientName) {
    return { error: '必須パラメータが不足しています (html, invoiceNo, clientName)' };
  }

  const docType = data.docType || '請求書';
  const fileName = data.invoiceNo + '.pdf';

  try {
    // 顧客フォルダを取得/作成
    const clientFolder = getOrCreateClientFolder_(data.clientName, docType);

    // 同一ファイル名がある場合は上書き（重複防止）
    const existing = clientFolder.getFilesByName(fileName);
    if (existing.hasNext()) {
      existing.next().setTrashed(true);
    }

    // HTML → PDF 変換
    const blob = HtmlService.createHtmlOutput(data.html)
      .getBlob()
      .setName(fileName);

    // Driveに保存
    const file = clientFolder.createFile(blob);

    return {
      success: true,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      fileName: fileName,
      folderPath: '行政書士事務所/' + data.clientName + '/' + docType,
    };

  } catch (err) {
    return { error: 'PDF保存エラー: ' + err.message };
  }
}

/**
 * 顧客ごとのフォルダ構成を取得/作成
 *
 *   マイドライブ/
 *     └── 行政書士事務所/
 *         └── 顧客名/
 *             └── 請求書/
 */
function getOrCreateClientFolder_(clientName, subFolderName) {
  const ROOT_FOLDER_NAME = '行政書士事務所';
  const root = DriveApp.getRootFolder();

  // ルートフォルダ（行政書士事務所）
  let officeFolder;
  const officeFolders = root.getFoldersByName(ROOT_FOLDER_NAME);
  if (officeFolders.hasNext()) {
    officeFolder = officeFolders.next();
  } else {
    officeFolder = root.createFolder(ROOT_FOLDER_NAME);
  }

  // 顧客フォルダ
  let clientFolder;
  const clientFolders = officeFolder.getFoldersByName(clientName);
  if (clientFolders.hasNext()) {
    clientFolder = clientFolders.next();
  } else {
    clientFolder = officeFolder.createFolder(clientName);
  }

  // 書類種別フォルダ（請求書, 納品書 etc.）
  let docFolder;
  const docFolders = clientFolder.getFoldersByName(subFolderName);
  if (docFolders.hasNext()) {
    docFolder = docFolders.next();
  } else {
    docFolder = clientFolder.createFolder(subFolderName);
  }

  return docFolder;
}


// ============================================================
//  Googleカレンダー連携
// ============================================================

/**
 * Googleカレンダーに予定を作成
 *
 * data: {
 *   title: タイトル,
 *   date: '2026-03-20',
 *   time: '10:00' (省略時は終日イベント),
 *   endTime: '11:00',
 *   memo: メモ,
 *   category: カテゴリ,
 *   localId: ダッシュボード側のID
 * }
 */
function createCalendarEvent_(data) {
  if (!data.title || !data.date) {
    return { error: 'タイトルと日付は必須です' };
  }

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
      const d = new Date(data.date + 'T00:00:00');
      event = cal.createAllDayEvent(title, d, { description });
    }

    return {
      success: true,
      calendarEventId: event.getId(),
      localId: data.localId || '',
    };

  } catch (err) {
    return { error: 'カレンダー作成エラー: ' + err.message };
  }
}

/**
 * Googleカレンダーの予定を更新
 */
function updateCalendarEvent_(data) {
  if (!data.calendarEventId) {
    return { error: 'calendarEventId は必須です' };
  }

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
      const d = new Date(data.date + 'T00:00:00');
      event.setAllDayDate(d);
    }

    return { success: true, calendarEventId: data.calendarEventId };

  } catch (err) {
    return { error: 'カレンダー更新エラー: ' + err.message };
  }
}

/**
 * Googleカレンダーの予定を削除
 */
function deleteCalendarEvent_(data) {
  if (!data.calendarEventId) {
    return { error: 'calendarEventId は必須です' };
  }

  try {
    const cal = CalendarApp.getDefaultCalendar();
    const event = cal.getEventById(data.calendarEventId);
    if (!event) return { error: '予定が見つかりません（既に削除済み？）' };

    event.deleteEvent();
    return { success: true };

  } catch (err) {
    return { error: 'カレンダー削除エラー: ' + err.message };
  }
}

/**
 * Googleカレンダーから予定を取得
 */
function getCalendarEvents_(daysBack, daysForward) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - (daysBack || 7));
    const end = new Date(now);
    end.setDate(end.getDate() + (daysForward || 90));

    const events = cal.getEvents(start, end);
    return events.map(function(ev) {
      const allDay = ev.isAllDayEvent();
      const startTime = ev.getStartTime();
      const endTime = ev.getEndTime();
      return {
        calendarEventId: ev.getId(),
        title: ev.getTitle(),
        date: Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        time: allDay ? '' : Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm'),
        endTime: allDay ? '' : Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm'),
        description: ev.getDescription() || '',
        allDay: allDay,
      };
    });

  } catch (err) {
    return [];
  }
}


// ============================================================
//  eFax連携
// ============================================================

/**
 * eFaxメールゲートウェイ経由でFAX送信
 *
 * data: {
 *   faxNumber: '0312345678',
 *   subject: '件名（カバーページ）',
 *   body: '本文（カバーページ内容）',
 *   clientName: '顧客名（Drive保存用）',
 *   pdfBase64: 'base64エンコードされたPDF（任意）',
 *   pdfName: 'ファイル名.pdf'
 * }
 */
function sendFax_(data) {
  if (!data.faxNumber) {
    return { error: 'FAX番号は必須です' };
  }

  try {
    // eFaxのメールゲートウェイアドレス
    const faxEmail = data.faxNumber.replace(/[-\s]/g, '') + '@efaxsend.com';
    const subject = data.subject || 'FAX送信';
    const body = data.body || '';

    const options = {};
    // PDF添付がある場合
    if (data.pdfBase64 && data.pdfName) {
      const pdfBlob = Utilities.newBlob(
        Utilities.base64Decode(data.pdfBase64),
        'application/pdf',
        data.pdfName
      );
      options.attachments = [pdfBlob];

      // 送信記録をDriveに保存
      if (data.clientName) {
        const folder = getOrCreateClientFolder_(data.clientName, 'FAX送信');
        const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
        folder.createFile(pdfBlob.setName(ts + '_' + data.pdfName));
      }
    }

    GmailApp.sendEmail(faxEmail, subject, body, options);

    // FAXログに記録
    logFax_('送信', data.faxNumber, subject, data.clientName || '');

    return {
      success: true,
      message: 'FAXを送信しました: ' + data.faxNumber,
      sentTo: faxEmail,
    };

  } catch (err) {
    return { error: 'FAX送信エラー: ' + err.message };
  }
}

/**
 * Gmailから受信FAXメールを検知してDriveに保存
 * GASトリガーで定期実行（5分ごと等）
 */
function checkIncomingFax_() {
  try {
    // eFaxからの未読メールを検索
    const threads = GmailApp.search('from:@efax.com is:unread', 0, 20);
    let saved = 0;

    threads.forEach(function(thread) {
      const messages = thread.getMessages();
      messages.forEach(function(msg) {
        if (msg.isUnread()) {
          const attachments = msg.getAttachments();
          const from = msg.getFrom();
          const subject = msg.getSubject();
          const date = msg.getDate();
          const ts = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');

          // PDF添付をDriveに保存
          attachments.forEach(function(att) {
            if (att.getContentType() === 'application/pdf' || att.getName().endsWith('.pdf')) {
              const folder = getOrCreateFaxFolder_('FAX受信');
              const fileName = ts + '_' + att.getName();
              folder.createFile(att.copyBlob().setName(fileName));
              saved++;
            }
          });

          // FAXログに記録
          logFax_('受信', from, subject, '');
          msg.markRead();
        }
      });
    });

    return { success: true, saved: saved };

  } catch (err) {
    return { error: '受信FAXチェックエラー: ' + err.message };
  }
}

/**
 * FAXフォルダを取得/作成（受信用）
 */
function getOrCreateFaxFolder_(folderName) {
  const ROOT_FOLDER_NAME = '行政書士事務所';
  const root = DriveApp.getRootFolder();

  let officeFolder;
  const officeFolders = root.getFoldersByName(ROOT_FOLDER_NAME);
  if (officeFolders.hasNext()) {
    officeFolder = officeFolders.next();
  } else {
    officeFolder = root.createFolder(ROOT_FOLDER_NAME);
  }

  let faxFolder;
  const faxFolders = officeFolder.getFoldersByName(folderName);
  if (faxFolders.hasNext()) {
    faxFolder = faxFolders.next();
  } else {
    faxFolder = officeFolder.createFolder(folderName);
  }

  return faxFolder;
}

/**
 * FAX送受信ログをスプレッドシートに記録
 */
function logFax_(direction, number, subject, clientName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('FAXログ');
  if (!sheet) {
    sheet = ss.insertSheet('FAXログ');
    sheet.appendRow(['日時', '種別', '番号/送信元', '件名', '顧客名']);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  sheet.appendRow([
    new Date(),
    direction,
    number,
    subject,
    clientName,
  ]);
}

/**
 * FAXログを取得
 */
function getFaxLog_(count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FAXログ');
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const numRows = Math.min(count || 50, lastRow - 1);
  const startRow = Math.max(2, lastRow - numRows + 1);
  const data = sheet.getRange(startRow, 1, numRows, 5).getValues();

  return data.reverse().map(function(row) {
    return {
      date: row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(row[0]),
      direction: row[1],
      number: row[2],
      subject: row[3],
      clientName: row[4],
    };
  });
}
