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
  INBOX:    'インボックス',
  LOCATION: '場所マスタ',
  CLIENT_CONTACT: '顧客担当者マスタ',
};

const CUSTOMER_HEADERS = [
  '顧客ID', '氏名', 'フリガナ', '区分',
  '電話番号', 'FAX番号', 'メールアドレス', '郵便番号', '住所',
  '生年月日', '法人名', '法人番号', '紹介元',
  '担当者ID', '備考', '登録日', '更新日',
];

const STAFF_HEADERS = [
  '担当者ID', '氏名', 'フリガナ', '役職',
  '電話番号', 'メールアドレス', '担当業務', 'ステータス',
  '登録日', '更新日',
];

const CASE_HEADERS = [
  '案件ID', '顧客ID', '案件名', '注文書№', 'カテゴリ',
  'ステータス', '期限', '報酬', '担当者ID',
  '備考', '完了日', '登録日', '更新日',
  '被相続人死亡日', '現地調査予定日', '申請予定日', '交付予定日', '店舗届ける予定日', '店舗届ける時間',
  '現地調査場所ID', '警察署場所ID', '陸運局場所ID',
  '登録予定日', '顧客担当者ID',
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

const INBOX_HEADERS = [
  'インボックスID', '日時', '種別', '送信元',
  '件名', '本文', '添付ファイル', 'ステータス',
  '案件ID', '登録日',
];

const LOCATION_HEADERS = [
  '場所ID', '場所名', '住所', '備考', '登録日', '更新日',
];

const CLIENT_CONTACT_HEADERS = [
  '担当者ID', '顧客ID', '氏名', '電話番号', 'メールアドレス', '備考', '登録日', '更新日',
];

// ============================================================
//  メニュー
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 マスタ管理')
    .addItem('🚀 初期セットアップ', 'initialSetup')
    .addItem('🚗 陸運局・愛知トヨタ初期データ登録', 'forcePopulateDefaults')
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
    '顧客マスタ・担当者マスタ・操作ログ・インボックス・場所マスタシートを作成します。\n' +
    '既存のシートがある場合は上書きされません。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) return;

  setupCustomerMaster_();
  setupDefaultCustomers_();
  setupStaffMaster_();
  setupLogSheet_();
  setupInboxSheet_();
  setupLocationMaster_();
  setupClientContactMaster_();
  updateCaseHeaders_();
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

  const widths = [90, 120, 130, 70, 130, 130, 200, 100, 250, 110, 150, 140, 120, 90, 200, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const kubunRule = SpreadsheetApp.newDataValidation().requireValueInList(['個人', '法人'], true).setAllowInvalid(false).build();
  sheet.getRange('D2:D1000').setDataValidation(kubunRule);

  const phoneRule = SpreadsheetApp.newDataValidation().requireTextContains('').setAllowInvalid(true).build();
  sheet.getRange('E2:E1000').setDataValidation(phoneRule);
  sheet.getRange('E2:E1000').setNumberFormat('@'); // 電話番号
  sheet.getRange('F2:F1000').setNumberFormat('@'); // FAX番号
  sheet.getRange('G2:G1000').setNumberFormat('@'); // メールアドレス
  sheet.getRange('H2:H1000').setNumberFormat('@'); // 郵便番号
  sheet.getRange('L2:L1000').setNumberFormat('@'); // 法人番号

  sheet.getRange('J2:J1000').setNumberFormat('yyyy/mm/dd'); // 生年月日
  sheet.getRange('P2:P1000').setNumberFormat('yyyy/mm/dd'); // 登録日
  sheet.getRange('Q2:Q1000').setNumberFormat('yyyy/mm/dd'); // 更新日

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
//  インボックス セットアップ
// ============================================================

function setupInboxSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.INBOX);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.INBOX);
  }

  const headerRange = sheet.getRange(1, 1, 1, INBOX_HEADERS.length);
  headerRange.setValues([INBOX_HEADERS]);
  headerRange.setBackground('#2e7d32').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  const widths = [130, 130, 70, 180, 200, 300, 250, 90, 130, 130];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(['未対応', '対応済', '除外'], true).setAllowInvalid(false).build();
  sheet.getRange('H2:H1000').setDataValidation(statusRule);

  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(['FAX', 'メール'], true).setAllowInvalid(false).build();
  sheet.getRange('C2:C1000').setDataValidation(typeRule);

  sheet.getRange('B2:B1000').setNumberFormat('yyyy/mm/dd hh:mm');
  sheet.getRange('J2:J1000').setNumberFormat('yyyy/mm/dd hh:mm');

  // 条件付き書式
  const unprocessedRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('未対応').setBackground('#fff9c4').setRanges([sheet.getRange('H2:H1000')]).build();
  const processedRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('対応済').setBackground('#e8f5e9').setRanges([sheet.getRange('H2:H1000')]).build();
  const excludedRule = SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('除外').setBackground('#f5f5f5').setFontColor('#9e9e9e').setRanges([sheet.getRange('H2:H1000')]).build();
  sheet.setConditionalFormatRules([unprocessedRule, processedRule, excludedRule]);

  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), INBOX_HEADERS.length).createFilter();
  }
  sheet.setFrozenRows(1);
}

// ============================================================
//  場所マスタ セットアップ
// ============================================================

function setupLocationMaster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.LOCATION);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.LOCATION);
  }

  const headerRange = sheet.getRange(1, 1, 1, LOCATION_HEADERS.length);
  headerRange.setValues([LOCATION_HEADERS]);
  headerRange.setBackground('#e65100').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center'); // Orange theme

  const widths = [90, 200, 300, 250, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  sheet.setFrozenRows(1);

  // 初期データ (東海3県の陸運局と主要警察署)
  if (sheet.getLastRow() < 2) {
    const defaultLocations = [
      // 陸運局 (愛知・岐阜・三重)
      { id: 'LOC-0001', name: '愛知運輸支局', address: '名古屋市中川区北江口1-1211', memo: '名古屋ナンバー管轄' },
      { id: 'LOC-0002', name: '小牧自動車検査登録事務所', address: '小牧市新小木3-32', memo: '尾張小牧・一宮・春日井ナンバー管轄' },
      { id: 'LOC-0003', name: '西三河自動車検査登録事務所', address: '豊田市若林西町西葉山46', memo: '三河・豊田ナンバー管轄' },
      { id: 'LOC-0004', name: '豊橋自動車検査登録事務所', address: '豊橋市神野新田町字京ノ割20-3', memo: '豊橋ナンバー管轄' },
      { id: 'LOC-0005', name: '岐阜運輸支局', address: '岐阜市日置江2648-1', memo: '岐阜ナンバー管轄' },
      { id: 'LOC-0006', name: '飛騨自動車検査登録事務所', address: '高山市新宮町830-5', memo: '飛騨ナンバー管轄' },
      { id: 'LOC-0007', name: '三重運輸支局', address: '津市結城町370-1', memo: '三重・四日市・伊勢志摩ナンバー管轄' },

      // 愛知県 主要警察署
      { id: 'LOC-0008', name: '一宮警察署', address: '一宮市本町1-6-20', memo: '愛知県警' },
      { id: 'LOC-0009', name: '小牧警察署', address: '小牧市大字小牧201', memo: '愛知県警' },
      { id: 'LOC-0010', name: '春日井警察署', address: '春日井市八田町2-1-12', memo: '愛知県警' },
      { id: 'LOC-0011', name: '江南警察署', address: '江南市木賀町大島12', memo: '愛知県警' },
      { id: 'LOC-0012', name: '犬山警察署', address: '犬山市大字犬山字薬師東1', memo: '愛知県警' },
      { id: 'LOC-0013', name: '名古屋東警察署', address: '名古屋市東区筒井1-1-1', memo: '愛知県警' },
      { id: 'LOC-0014', name: '中警察署', address: '名古屋市中区千代田2-2-3', memo: '愛知県警' },
      { id: 'LOC-0015', name: '中川警察署', address: '名古屋市中川区篠原橋通1-4', memo: '愛知県警' },
      { id: 'LOC-0016', name: '千種警察署', address: '名古屋市千種区覚王山通8-30', memo: '愛知県警' },
      { id: 'LOC-0017', name: '豊田警察署', address: '豊田市錦町1-30', memo: '愛知県警' },
      { id: 'LOC-0018', name: '岡崎警察署', address: '岡崎市明大寺町字銭堤4-1', memo: '愛知県警' },
      { id: 'LOC-0019', name: '豊橋警察署', address: '豊橋市八町通3-8', memo: '愛知県警' },

      // 岐阜県 主要警察署
      { id: 'LOC-0020', name: '岐阜中警察署', address: '岐阜市美江寺町2-10', memo: '岐阜県警' },
      { id: 'LOC-0021', name: '岐阜南警察署', address: '岐阜市茜部大野1-1-1', memo: '岐阜県警' },
      { id: 'LOC-0022', name: '各務原警察署', address: '各務原市蘇原中央町2-1-3', memo: '岐阜県警' },
      { id: 'LOC-0023', name: '大垣警察署', address: '大垣市江崎町422-10', memo: '岐阜県警' },
      { id: 'LOC-0024', name: '多治見警察署', address: '多治見市宝町1-65', memo: '岐阜県警' },

      // 三重県 主要警察署
      { id: 'LOC-0025', name: '津警察署', address: '津市丸之内22-1', memo: '三重県警' },
      { id: 'LOC-0026', name: '四日市南警察署', address: '四日市市新正5-5-5', memo: '三重県警' },
      { id: 'LOC-0027', name: '四日市北警察署', address: '四日市市松原町4-3', memo: '三重県警' },
      { id: 'LOC-0028', name: '桑名警察署', address: '桑名市大字江場626-2', memo: '三重県警' },
      { id: 'LOC-0029', name: '伊勢警察署', address: '伊勢市神久2-1-33', memo: '三重県警' }
    ];

    const now = new Date();
    const rows = defaultLocations.map(loc => [
      loc.id,
      loc.name,
      loc.address,
      loc.memo,
      now,
      now
    ]);
    sheet.getRange(2, 1, rows.length, LOCATION_HEADERS.length).setValues(rows);
  }
}

// ============================================================
//  顧客担当者マスタ セットアップ
// ============================================================

function setupClientContactMaster_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.CLIENT_CONTACT);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.CLIENT_CONTACT);
  }

  const headerRange = sheet.getRange(1, 1, 1, CLIENT_CONTACT_HEADERS.length);
  headerRange.setValues([CLIENT_CONTACT_HEADERS]);
  headerRange.setBackground('#6a1b9a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  const widths = [110, 90, 120, 130, 200, 250, 110, 110];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  sheet.getRange('D2:D1000').setNumberFormat('@'); // 電話番号
  sheet.getRange('E2:E1000').setNumberFormat('@'); // メールアドレス
  sheet.getRange('G2:G1000').setNumberFormat('yyyy/mm/dd'); // 登録日
  sheet.getRange('H2:H1000').setNumberFormat('yyyy/mm/dd'); // 更新日

  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), CLIENT_CONTACT_HEADERS.length).createFilter();
  }
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
      sheet.getRange(row, 16).setValue(new Date());
    }
    sheet.getRange(row, 17).setValue(new Date());
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

  const inboxSheet = ss.getSheetByName(SHEET_NAMES.INBOX);
  if (inboxSheet) {
    protectHeaderRow_(inboxSheet, me, 'インボックス - ヘッダー保護');
    protectIdColumn_(inboxSheet, me, 'インボックス - ID列保護', 1);
  }

  const locationSheet = ss.getSheetByName(SHEET_NAMES.LOCATION);
  if (locationSheet) {
    protectHeaderRow_(locationSheet, me, '場所マスタ - ヘッダー保護');
    protectIdColumn_(locationSheet, me, '場所マスタ - ID列保護', 1);
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
    if (type === 'journals' || type === 'all') result.journals = getJournalsSheetData_();
    if (type === 'inbox' || type === 'all') result.inbox = getSheetDataAsJson_(SHEET_NAMES.INBOX, INBOX_HEADERS);
    if (type === 'locations' || type === 'all') result.locations = getSheetDataAsJson_(SHEET_NAMES.LOCATION, LOCATION_HEADERS);
    if (type === 'clientContacts' || type === 'all') result.clientContacts = getSheetDataAsJson_(SHEET_NAMES.CLIENT_CONTACT, CLIENT_CONTACT_HEADERS);
    
    if (type === 'events' || type === 'all') {
      const daysBack = parseInt((e && e.parameter && e.parameter.daysBack) || '7');
      const daysForward = parseInt((e && e.parameter && e.parameter.daysForward) || '90');
      result.events = getCalendarEvents_(daysBack, daysForward);
    }
    if (type === 'faxLog') result.faxLog = getFaxLog_(50);

    // iOSショートカット連携: 本日のタスク一覧
    if (type === 'todayTasks') {
      result.tasks = getTodayTasks_();
    }

    result.syncedAt = new Date().toISOString();

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    
    // ── LINE Messaging API Webhook の検知とID自動記録 ──
    if (body.events && body.events.length > 0) {
      const event = body.events[0];
      if (event.source) {
        let targetId = '';
        let idLabel = 'ユーザーID';
        
        if (event.source.type === 'group' && event.source.groupId) {
          targetId = event.source.groupId;
          idLabel = 'グループID';
        } else if (event.source.type === 'room' && event.source.roomId) {
          targetId = event.source.roomId;
          idLabel = 'ルームID';
        } else if (event.source.userId) {
          targetId = event.source.userId;
          idLabel = 'ユーザーID';
        }
        
        if (targetId) {
          const msgText = (event.message && event.message.text) ? event.message.text : '（メッセージ受信）';
          
          // スプレッドシートの「操作ログ」に記録
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          const logSheet = ss.getSheetByName(SHEET_NAMES.LOG || '操作ログ');
          if (logSheet) {
            logSheet.appendRow([
              new Date(),
              'LINE Webhook (' + (event.source.type || 'user') + '): ' + msgText,
              'システム',
              '-',
              'LINE連携設定用',
              '-',
              'あなたの' + idLabel + ': ' + targetId
            ]);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = body.action;
    const data = body.data;
    const lineToken = body.lineToken; // LINE公式チャネルアクセストークン
    const lineUserId = body.lineUserId; // 送信先ユーザーID
    const lineNotifyCase = !!body.lineNotifyCase; // 案件完了通知フラグ
    const lineNotifyInbox = !!body.lineNotifyInbox; // インボックス通知フラグ
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
      case 'checkInbox': result = checkIncomingInbox_(); break;
      case 'upsertInboxItem': result = upsertInboxItem_(data, lineToken, lineUserId, lineNotifyInbox); break;
      case 'upsertCase': result = upsertCase_(data, lineToken, lineUserId, lineNotifyCase); break;
      case 'deleteCase': result = deleteRow_(SHEET_NAMES.CASES, data.id); break;
      case 'upsertJournal': result = upsertJournal_(data); break;
      case 'bulkUpsertJournals': result = bulkUpsertJournals_(data); break;
      case 'deleteJournal': result = deleteRow_(SHEET_NAMES.JOURNALS, data.id); break;
      case 'createCaseFolder': result = createCaseFolder_(data); break;
      case 'saveGeneratedPdf': result = saveGeneratedPdf_(data); break;
      case 'saveCaseDocument': result = saveCaseDocument_(data); break;
      case 'deleteCaseDocument': result = deleteCaseDocument_(data); break;
      case 'upsertLocation': result = upsertLocation_(data); break;
      case 'deleteLocation': result = deleteRow_(SHEET_NAMES.LOCATION, data.id); break;
      case 'upsertClientContact': result = upsertClientContact_(data); break;
      case 'deleteClientContact': result = deleteRow_(SHEET_NAMES.CLIENT_CONTACT, data.id); break;
      case 'syncCaseCalendar': result = syncCaseCalendar_(data); break;
      case 'deleteCaseCalendarEvents': result = deleteCaseCalendarEvents_(data); break;
      case 'ocr': result = performOcrAction_(body); break;
      case 'sendLineNotification':
        sendLineMessage_(data.message, lineToken, lineUserId);
        result = { success: true };
        break;
      default: result = { error: '不明なアクション: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ── 完全無料・設定不要のGAS Drive OCR解析処理 ──
function performOcrAction_(body) {
  try {
    var imageBase64 = body.image || '';
    var mimeType = body.mimeType || 'image/jpeg';
    if (imageBase64.indexOf(',') !== -1) {
      imageBase64 = imageBase64.split(',')[1];
    }
    
    // スコープ自重検出用（DriveAppの呼び出し）
    DriveApp.getRootFolder();
    var token = ScriptApp.getOAuthToken();
    
    // アップロードする画像のメタデータ（mimeTypeは元画像のもの）
    var metadata = {
      title: 'Temp_OCR_Image_' + Date.now(),
      mimeType: mimeType
    };

    var boundary = '-------314159265358979323846';
    var delimiter = "\r\n--" + boundary + "\r\n";
    var close_delim = "\r\n--" + boundary + "--";

    var requestBody = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      imageBase64 +
      close_delim;

    // convert=true & ocr=true でGoogleドキュメントへ自動OCR変換
    var url = 'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true&ocr=true&ocrLanguage=ja';
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'multipart/mixed; boundary="' + boundary + '"',
      headers: {
        Authorization: 'Bearer ' + token
      },
      payload: requestBody,
      muteHttpExceptions: true
    });

    var resJson = JSON.parse(response.getContentText());

    if (!resJson.id) {
      throw new Error('Drive OCRに失敗しました: ' + (resJson.error ? resJson.error.message : response.getContentText()));
    }

    var docId = resJson.id;

    // UrlFetchAppを使ってテキスト内容を直で取得（DocumentApp権限エラーを100%回避）
    var exportUrl = 'https://www.googleapis.com/drive/v2/files/' + docId + '/export?mimeType=text/plain';
    var textResponse = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });

    var fullText = textResponse.getContentText();

    // 一時ドキュメントをゴミ箱へ移動して削除
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (e) {}

    // テキスト解析（金額、インボイス番号、日付、品目）
    var amountMatch = fullText.match(/[¥￥]?\s*([0-9,]{3,})/);
    var amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;

    var invoiceMatch = fullText.match(/T\d{13}/);
    var invoiceNo = invoiceMatch ? invoiceMatch[0] : '';

    var dateMatch = fullText.match(/(\d{4})[年\/\.-](\d{1,2})[月\/\.-](\d{1,2})/);
    var dateStr = dateMatch 
      ? dateMatch[1] + '-' + String(dateMatch[2]).padStart(2, '0') + '-' + String(dateMatch[3]).padStart(2, '0')
      : new Date().toISOString().split('T')[0];

    var lines = fullText.split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 0; });
    var vendor = lines[0] || '領収書';

    return {
      success: true,
      data: {
        date: dateStr,
        vendor: vendor,
        amount: amount,
        debitAccount: '消耗品費',
        invoiceNumber: invoiceNo,
        description: lines.slice(0, 3).join(' '),
        isReimbursement: false
      }
    };
  } catch (err) {
    return {
      success: false,
      message: 'GAS OCRエラー: ' + err.toString()
    };
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
  if (sheetName === SHEET_NAMES.CUSTOMER) return {'顧客ID': 'id','氏名': 'name','フリガナ': 'nameKana','区分': 'type','電話番号': 'phone','FAX番号': 'fax','メールアドレス': 'email','郵便番号': 'zip','住所': 'address','生年月日': 'birthday','法人名': 'companyName','法人番号': 'companyNumber','紹介元': 'referral','担当者ID': 'staffId','備考': 'memo','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.STAFF) return {'担当者ID': 'id','氏名': 'name','フリガナ': 'nameKana','役職': 'role','電話番号': 'phone','メールアドレス': 'email','担当業務': 'duties','ステータス': 'status','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.CASES) return {'案件ID': 'id','顧客ID': 'clientId','案件名': 'title','注文書№': 'orderNo','カテゴリ': 'category','ステータス': 'status','期限': 'deadline','報酬': 'fee','担当者ID': 'staffId','備考': 'memo','完了日': 'completedAt','登録日': 'createdAt','更新日': 'updatedAt','被相続人死亡日': 'deathDate','現地調査予定日': 'surveyDate','申請予定日': 'applyDate','交付予定日': 'policeDeliveryDate','店舗届ける予定日': 'storeDeliveryDate','店舗届ける時間': 'storeDeliveryTime','現地調査場所ID': 'surveyLocationId','警察署場所ID': 'policeLocationId','陸運局場所ID': 'landTransportLocationId','登録予定日': 'registrationDate','顧客担当者ID': 'clientContactId'};
  if (sheetName === SHEET_NAMES.JOURNALS) return {'伝票ID': 'id','日付': 'date','借方': 'debit','貸方': 'credit','金額': 'amount','摘要': 'description','案件ID': 'caseId','自動': 'auto','登録日': 'createdAt'};
  if (sheetName === SHEET_NAMES.INBOX) return {'インボックスID': 'id','日時': 'date','種別': 'type','送信元': 'sender','件名': 'subject','本文': 'body','添付ファイル': 'attachments','ステータス': 'status','案件ID': 'caseId','登録日': 'createdAt'};
  if (sheetName === SHEET_NAMES.LOCATION) return {'場所ID': 'id','場所名': 'name','住所': 'address','備考': 'memo','登録日': 'createdAt','更新日': 'updatedAt'};
  if (sheetName === SHEET_NAMES.CLIENT_CONTACT) return {'担当者ID': 'id','顧客ID': 'clientId','氏名': 'name','電話番号': 'phone','メールアドレス': 'email','備考': 'memo','登録日': 'createdAt','更新日': 'updatedAt'};
  return {};
}

function getJournalsSheetData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.JOURNALS) ||
              ss.getSheetByName('仕訳帳') ||
              ss.getSheetByName('仕訳') ||
              ss.getSheetByName('経費') ||
              ss.getSheetByName('帳簿データ');
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  let colNo = headers.findIndex(h => h.includes('伝票ID') || h.includes('取引No') || h.includes('仕訳No') || h === 'ID');
  let colDate = headers.findIndex(h => h.includes('日付') || h.includes('取引日'));
  let colDebit = headers.findIndex(h => h.includes('借方勘定科目') || h.includes('借方科目') || h === '借方');
  let colDebitAmt = headers.findIndex(h => h.includes('借方金額') || h === '金額');
  let colCredit = headers.findIndex(h => h.includes('貸方勘定科目') || h.includes('貸方科目') || h === '貸方');
  let colCreditAmt = headers.findIndex(h => h.includes('貸方金額'));
  let colDesc = headers.findIndex(h => h.includes('摘要') || h.includes('内容') || h.includes('品名'));
  let colMemo = headers.findIndex(h => h.includes('メモ') || h.includes('仕訳メモ'));

  if (colDate === -1) colDate = 1;
  if (colDebit === -1) colDebit = 2;
  if (colCredit === -1) colCredit = 3;
  if (colDebitAmt === -1) colDebitAmt = 4;
  if (colDesc === -1) colDesc = 5;

  const journals = [];
  let lastTxNo = null;
  let lastDebit = '未分類';
  let lastCredit = '未分類';

  data.forEach((row, rIdx) => {
    const txNo = colNo !== -1 ? String(row[colNo]).trim() : '';
    let rawDate = row[colDate];
    let dateStr = '';
    if (rawDate instanceof Date) {
      dateStr = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else if (rawDate) {
      dateStr = String(rawDate).replace(/\//g, '-').trim();
    }

    if (!dateStr || dateStr.length < 8) return;

    let debit = colDebit !== -1 ? String(row[colDebit]).trim() : '';
    let credit = colCredit !== -1 ? String(row[colCredit]).trim() : '';

    if (txNo && txNo === lastTxNo) {
      if (!debit) debit = lastDebit;
      if (!credit) credit = lastCredit;
    } else {
      lastTxNo = txNo;
      if (debit) lastDebit = debit;
      if (credit) lastCredit = credit;
    }

    if (!debit) debit = '未分類';
    if (!credit) credit = '未分類';

    let amtDebit = colDebitAmt !== -1 ? Number(String(row[colDebitAmt]).replace(/[^0-9.]/g, '')) || 0 : 0;
    let amtCredit = colCreditAmt !== -1 ? Number(String(row[colCreditAmt]).replace(/[^0-9.]/g, '')) || 0 : 0;
    let amount = amtDebit > 0 ? amtDebit : amtCredit;

    if (amount <= 0) return;

    let desc = colDesc !== -1 ? String(row[colDesc]).trim() : '';
    let memo = colMemo !== -1 ? String(row[colMemo]).trim() : '';
    let fullDesc = desc;
    if (memo) fullDesc = desc ? `${desc} (${memo})` : memo;

    let id = txNo ? ('j_ss_' + txNo + '_' + rIdx) : ('j_ss_' + rIdx);

    journals.push({
      id: id,
      date: dateStr,
      debit: debit,
      credit: credit,
      amount: amount,
      description: fullDesc,
      auto: false,
      createdAt: new Date().toISOString()
    });
  });

  return journals;
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
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            let val = data[key];
            if ((key === 'phone' || key === 'fax') && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
              val = "'" + val;
            }
            sheet.getRange(row, col + 1).setValue(val);
          }
        });
        sheet.getRange(row, 17).setValue(now);
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = generateCustomerId_(sheet);
  const rowData = CUSTOMER_HEADERS.map(header => {
    const key = getKeyMap_(SHEET_NAMES.CUSTOMER)[header];
    if (key === 'id') return newId;
    if (key === 'createdAt' || key === 'updatedAt') return now;
    let val = data[key] || '';
    if ((key === 'phone' || key === 'fax') && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
      val = "'" + val;
    }
    return val;
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
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            let val = data[key];
            if (key === 'phone' && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
              val = "'" + val;
            }
            sheet.getRange(row, col + 1).setValue(val);
          }
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
    let val = data[key] || '';
    if (key === 'phone' && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
      val = "'" + val;
    }
    return val;
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

function upsertCase_(data, lineToken, lineUserId, lineNotifyCase) {
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
        const oldStatus = sheet.getRange(row, 6).getValue(); // Column 6 (F) is status

        CASE_HEADERS.forEach(function(header, col) {
          const key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            let val = data[key];
            if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            sheet.getRange(row, col + 1).setValue(val);
          }
        });
        sheet.getRange(row, 13).setValue(now); // Column 13 is 更新日 (updatedAt)

        // 案件完了時の通知
        if (data.status === 'done' && oldStatus !== 'done' && lineToken && lineUserId && lineNotifyCase) {
          const clientName = data.clientId ? (getClientName_(data.clientId) || '') : '';
          const msg = '\n【🎉 案件完了】\n' + 
                      (clientName ? clientName + ' 様：' : '') + data.title + '\n' +
                      'カテゴリ：' + getCategoryLabel_(data.category) + '\n' +
                      '報酬額：' + (data.fee ? Number(data.fee).toLocaleString() + '円' : '未設定') + '\n' +
                      '今月の目標に向けて一歩前進しました！';
          sendLineMessage_(msg, lineToken, lineUserId);
        }

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

function bulkUpsertJournals_(journals) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.JOURNALS) || ss.getSheetByName('仕訳帳') || ss.getSheetByName('仕訳');
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.JOURNALS);
    sheet.appendRow(JOURNAL_HEADERS);
    sheet.getRange('1:1').setFontWeight('bold');
  }

  if (!Array.isArray(journals) || journals.length === 0) {
    return { success: true, count: 0 };
  }

  const keyMap = getKeyMap_(SHEET_NAMES.JOURNALS);
  const now = new Date();

  const lastRow = sheet.getLastRow();
  const existingRowMap = {};
  if (lastRow >= 2) {
    const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
    ids.forEach((id, idx) => {
      if (id) existingRowMap[String(id)] = idx + 2;
    });
  }

  const newRows = [];
  let updatedCount = 0;

  journals.forEach(data => {
    const id = data.id || ('J-' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
    data.id = id;

    if (existingRowMap[id]) {
      const row = existingRowMap[id];
      JOURNAL_HEADERS.forEach((header, col) => {
        const key = keyMap[header];
        if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
          sheet.getRange(row, col + 1).setValue(data[key]);
        }
      });
      updatedCount++;
    } else {
      const rowData = JOURNAL_HEADERS.map(header => {
        const key = keyMap[header];
        if (key === 'id') return id;
        if (key === 'createdAt') return data.createdAt || now;
        return data[key] !== undefined ? data[key] : '';
      });
      newRows.push(rowData);
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, JOURNAL_HEADERS.length).setValues(newRows);
  }

  return { success: true, added: newRows.length, updated: updatedCount, total: journals.length };
}


// ============================================================
//  書類・PDF 保存・削除（案件関連 & 請求書）
// ============================================================


/**
 * 案件専用のネストされたフォルダを作成
 * 行政書士事務所 / {clientName} / {category} / {createdAt} / {title}
 */
function createCaseFolder_(data) {
  try {
    const clientName = data.clientName || '不明な顧客';
    const category = data.category || '未分類';
    const dateStr = data.createdAt ? String(data.createdAt).substring(0, 10) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const title = data.title || '無題の案件';
    const caseId = data.id || '';
    
    const safeTitle = (caseId ? `[${caseId}] ` : '') + title.replace(/[\\/:*?"<>|]/g, '_');
    
    const root = getOrCreateFolder_('行政書士事務所');
    const clientFolder = getOrCreateFolderUnder_(root, clientName);
    const categoryFolder = getOrCreateFolderUnder_(clientFolder, category);
    const dateFolder = getOrCreateFolderUnder_(categoryFolder, dateStr);
    
    // Check if case folder already exists
    let caseFolder = null;
    const folders = dateFolder.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      if (f.getName().indexOf(safeTitle) !== -1 || (caseId && f.getName().indexOf('[' + caseId + ']') !== -1)) {
        caseFolder = f;
        break;
      }
    }
    if (!caseFolder) {
      caseFolder = dateFolder.createFolder(safeTitle);
    }
    
    // Anyone with link can view (so dashboard can link to it directly if needed)
    caseFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return {
      success: true,
      folderId: caseFolder.getId(),
      folderUrl: caseFolder.getUrl()
    };
  } catch (err) {
    return { error: 'フォルダ作成エラー: ' + err.message };
  }
}

/**
 * 自動生成されたPDF（委任状、預かり証など）を指定フォルダへ直接保存
 */
function saveGeneratedPdf_(data) {
  if (!data.html || !data.fileName || !data.folderUrl) return { error: 'パラメータ不足(html, fileName, folderUrl)' };
  
  try {
    // URLからフォルダIDを抽出
    const match = data.folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (!match) return { error: '無効なフォルダURL' };
    
    const folderId = match[1];
    const folder = DriveApp.getFolderById(folderId);
    
    // 同名ファイルがあれば削除
    const existing = folder.getFilesByName(data.fileName);
    while (existing.hasNext()) existing.next().setTrashed(true);
    
    // HTML -> PDF
    const blob = HtmlService.createHtmlOutput(data.html).getBlob().setName(data.fileName);
    const file = folder.createFile(blob);
    
    return { success: true, fileId: file.getId(), fileUrl: file.getUrl() };
  } catch (err) {
    return { error: 'PDF自動保存エラー: ' + err.message };
  }
}

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

    let caseFolder = null;
    if (data.folderUrl) {
      const match = data.folderUrl.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (match) caseFolder = DriveApp.getFolderById(match[1]);
    }
    
    if (!caseFolder) {
      // フォルダURLがない場合のフォールバック（以前の挙動）
      const rootFolder = getOrCreateFolder_('行政書士事務所');
      const clientFolder = getOrCreateFolderUnder_(rootFolder, clientName);
      const docsFolder = getOrCreateFolderUnder_(clientFolder, '案件書類');
      const folders = docsFolder.getFolders();
      while (folders.hasNext()) {
        const f = folders.next();
        if (f.getName().indexOf(String(caseId)) !== -1) {
          caseFolder = f;
          if (f.getName() !== folderName) f.setName(folderName);
          break;
        }
      }
      if (!caseFolder) caseFolder = docsFolder.createFolder(folderName);
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
//  iOSショートカット連携: 本日のタスク一覧取得
// ============================================================
function getTodayTasks_() {
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var cases = getSheetDataAsJson_(SHEET_NAMES.CASES, CASE_HEADERS);
  var customers = getSheetDataAsJson_(SHEET_NAMES.CUSTOMER, CUSTOMER_HEADERS);
  var locations = getSheetDataAsJson_(SHEET_NAMES.LOCATION, LOCATION_HEADERS);

  // ヘルパー: 顧客名を取得
  function getClientName(clientId) {
    if (!clientId) return '';
    for (var i = 0; i < customers.length; i++) {
      if (customers[i].id === clientId) return customers[i].name || '';
    }
    return '';
  }

  // ヘルパー: 場所名を取得
  function getLocName(locId) {
    if (!locId) return '';
    for (var i = 0; i < locations.length; i++) {
      if (locations[i].id === locId) return locations[i].name || '';
    }
    return '';
  }

  var tasks = [];

  // 日程の定義: { dateKey, label, icon, locKey }
  var dateChecks = [
    { dateKey: 'surveyDate',        label: '現調', icon: '🔍', locKey: 'surveyLocationId' },
    { dateKey: 'applyDate',         label: '申請', icon: '📝', locKey: 'policeLocationId' },
    { dateKey: 'policeDeliveryDate', label: '交付', icon: '📋', locKey: 'policeLocationId' },
    { dateKey: 'storeDeliveryDate', label: '店届', icon: '🚚', locKey: 'locationId' },
    { dateKey: 'registrationDate',  label: '登録', icon: '🚗', locKey: 'landTransportLocationId' },
  ];

  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    if (c.status === 'done') continue; // 完了済みはスキップ

    var clientName = getClientName(c.clientId);

    for (var j = 0; j < dateChecks.length; j++) {
      var dc = dateChecks[j];
      var dateVal = c[dc.dateKey] || '';

      // 日付文字列を yyyy-MM-dd に正規化（スプレッドシートのDate型対応）
      if (dateVal && typeof dateVal === 'object' && dateVal.getTime) {
        dateVal = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (dateVal) {
        dateVal = String(dateVal).slice(0, 10);
      }

      if (dateVal === today) {
        var locName = getLocName(c[dc.locKey]);
        var timeStr = (dc.dateKey === 'storeDeliveryDate' && c.storeDeliveryTime) ? c.storeDeliveryTime : '';
        var title = dc.icon + '【' + dc.label + '】' + (c.title || '案件');
        var notes = '';
        if (clientName) notes += clientName + '様';
        if (locName) notes += (notes ? ' / ' : '') + '📍' + locName;
        if (timeStr) notes += (notes ? ' / ' : '') + '⏰' + timeStr;
        if (c.memo) notes += (notes ? '\n' : '') + c.memo;

        tasks.push({
          title: title,
          notes: notes,
          location: locName,
          time: timeStr,
          caseId: c.id,
          clientName: clientName,
          label: dc.label,
        });
      }
    }
  }

  // カレンダーの予定も追加
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var todayDate = new Date(today + 'T00:00:00');
    var tomorrowDate = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
    var events = cal.getEvents(todayDate, tomorrowDate);
    for (var k = 0; k < events.length; k++) {
      var ev = events[k];
      var desc = ev.getDescription() || '';
      // ダッシュボードからの案件同期イベントは除外（二重表示防止）
      if (desc.indexOf('自動同期') !== -1) continue;
      var evStart = ev.getStartTime();
      var evTime = ev.isAllDayEvent() ? '' : Utilities.formatDate(evStart, Session.getScriptTimeZone(), 'HH:mm');
      tasks.push({
        title: '📅 ' + ev.getTitle(),
        notes: evTime ? '⏰' + evTime : '終日',
        location: '',
        time: evTime,
        caseId: '',
        clientName: '',
        label: '予定',
      });
    }
  } catch (e) { /* カレンダー取得エラーは無視 */ }

  return tasks;
}

// ============================================================
//  案件日程 → Google Tasks 一括同期（Taska対応）
//  ※ Apps Scriptエディタで「サービス」→「Tasks API」を追加してください
// ============================================================
function syncCaseCalendar_(data) {
  try {
    var caseTitle = data.caseTitle || '案件';
    var clientName = data.clientName || '';
    var clientLabel = clientName ? ' (' + clientName + '様)' : '';
    var taskListId = '@default'; // デフォルトのタスクリスト

    // 同期対象の日程定義
    var dateFields = [
      { key: 'survey',        icon: '🔍', label: '現調',  dateField: 'surveyDate',        locationField: 'surveyLocationName' },
      { key: 'apply',         icon: '📝', label: '申請',  dateField: 'applyDate',         locationField: 'policeLocationName' },
      { key: 'delivery',      icon: '📋', label: '交付',  dateField: 'policeDeliveryDate', locationField: 'policeLocationName' },
      { key: 'storeDelivery', icon: '🚚', label: '店届',  dateField: 'storeDeliveryDate', locationField: 'locationName', timeField: 'storeDeliveryTime' },
      { key: 'registration',  icon: '🚗', label: '登録',  dateField: 'registrationDate',  locationField: 'landTransportLocationName' },
    ];

    var existingIds = data.calendarEventIds || {};
    var newIds = {};

    for (var i = 0; i < dateFields.length; i++) {
      var df = dateFields[i];
      var dateValue = data[df.dateField] || '';
      var existingTaskId = existingIds[df.key] || '';

      if (!dateValue) {
        // 日付が空 → 既存タスクがあれば削除
        if (existingTaskId) {
          try { Tasks.Tasks.remove(taskListId, existingTaskId); } catch (e) {}
        }
        newIds[df.key] = '';
        continue;
      }

      // タイトル組み立て
      var locName = data[df.locationField] || '';
      var locText = locName ? ' @' + locName : '';
      var storeTime = (df.timeField && data[df.timeField]) ? data[df.timeField] : '';
      var timeText = storeTime ? ' ' + storeTime : '';
      var title = df.icon + ' 【' + df.label + '】' + caseTitle + clientLabel + locText + timeText;
      var notes = '案件ID: ' + (data.caseId || '') + '\n自動同期: ダッシュボードの案件データと連動';

      // Google Tasks の期限日（RFC 3339形式）
      var dueDate = dateValue + 'T00:00:00.000Z';

      if (existingTaskId) {
        // 既存タスクを更新
        try {
          var existingTask = Tasks.Tasks.get(taskListId, existingTaskId);
          existingTask.title = title;
          existingTask.notes = notes;
          existingTask.due = dueDate;
          existingTask.status = 'needsAction'; // 未完了に戻す
          Tasks.Tasks.update(existingTask, taskListId, existingTaskId);
          newIds[df.key] = existingTaskId;
        } catch (e) {
          // タスクが見つからない場合は新規作成
          var fallback = Tasks.Tasks.insert({ title: title, notes: notes, due: dueDate, status: 'needsAction' }, taskListId);
          newIds[df.key] = fallback.id;
        }
      } else {
        // 新規作成
        var created = Tasks.Tasks.insert({ title: title, notes: notes, due: dueDate, status: 'needsAction' }, taskListId);
        newIds[df.key] = created.id;
      }
    }

    return { success: true, calendarEventIds: newIds };
  } catch (err) {
    return { error: '案件タスク同期エラー: ' + err.message + '（Tasks APIが有効か確認してください）' };
  }
}

// 案件削除時にGoogle Tasksも一括削除
function deleteCaseCalendarEvents_(data) {
  try {
    var ids = data.calendarEventIds || {};
    var taskListId = '@default';
    var keys = Object.keys(ids);
    for (var i = 0; i < keys.length; i++) {
      var taskId = ids[keys[i]];
      if (taskId) {
        try { Tasks.Tasks.remove(taskListId, taskId); } catch (e) {}
      }
    }
    return { success: true };
  } catch (err) {
    return { error: '案件タスク削除エラー: ' + err.message };
  }
}

// ============================================================
//  Googleカレンダー連携（スケジュール予定）
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

// ============================================================
//  インボックス連携 & 自動受信スキャン
// ============================================================

function upsertInboxItem_(data, lineToken, lineUserId, lineNotifyInbox) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INBOX);
  if (!sheet) return { error: 'インボックスシートが見つかりません' };

  const now = new Date();
  const keyMap = getKeyMap_(SHEET_NAMES.INBOX);

  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        INBOX_HEADERS.forEach((header, col) => {
          const key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            sheet.getRange(row, col + 1).setValue(data[key]);
          }
        });
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  // 新規追加
  const newId = data.id || ('INB-' + Date.now() + '-' + Math.floor(Math.random()*1000));
  const rowData = INBOX_HEADERS.map(header => {
    const key = keyMap[header];
    if (key === 'id') return newId;
    if (key === 'createdAt') return now;
    if (key === 'date') return data[key] ? new Date(data[key]) : now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);

  // 新着資料・FAXの通知
  if (lineToken && lineUserId && lineNotifyInbox) {
    const msg = '\n【📥 新着資料受信】\n' +
                '種別：' + (data.type || '不明') + '\n' +
                '送信元：' + (data.sender || '不明') + '\n' +
                '件名：' + (data.subject || 'なし') + '\n' +
                'ダッシュボードを開いて確認してください。';
    sendLineMessage_(msg, lineToken, lineUserId);
  }

  return { success: true, action: 'added', id: newId };
}

function extractFaxNumber_(msg) {
  const subject = msg.getSubject();
  const body = msg.getPlainBody();
  const from = msg.getFrom();

  const phoneRegex = /\b(0\d{1,4}[-ー\s]?\d{1,4}[-ー\s]?\d{3,4})\b/g;
  const efaxRegex = /\b81(\d{9,10})\b/;

  const fromMatch = from.match(/(\d{10,12})@/);
  if (fromMatch) {
    let num = fromMatch[1];
    if (num.indexOf('81') === 0) num = '0' + num.substring(2);
    return formatPhoneNumber_(num);
  }

  const subjectMatches = subject.match(phoneRegex);
  if (subjectMatches && subjectMatches.length > 0) {
    return formatPhoneNumber_(subjectMatches[0]);
  }
  const subjectEfax = subject.match(efaxRegex);
  if (subjectEfax) {
    return formatPhoneNumber_('0' + subjectEfax[1]);
  }

  const bodyMatches = body.match(phoneRegex);
  if (bodyMatches && bodyMatches.length > 0) {
    return formatPhoneNumber_(bodyMatches[0]);
  }

  return from;
}

function formatPhoneNumber_(str) {
  const clean = str.replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    if (clean.startsWith('03') || clean.startsWith('06')) {
      return clean.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
    }
    return clean.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  } else if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return str;
}

function getInboxDriveFolder_(subfolderName) {
  try {
    const targetFolderId = '1xLELc4YaLMNnDewKejTqG6buDrjObT54'; // Googleドライブ受信用フォルダID
    if (targetFolderId) {
      const parent = DriveApp.getFolderById(targetFolderId);
      if (parent) {
        if (subfolderName) {
          return getOrCreateFolderUnder_(parent, subfolderName);
        }
        return parent;
      }
    }
  } catch (e) {
    Logger.log('受信用フォルダIDアクセス失敗（フォールバック実行）: ' + e.message);
  }

  try {
    const root = getOrCreateFolder_('行政書士事務所');
    return getOrCreateFolderUnder_(root, subfolderName || 'FAX・メール受信');
  } catch (err) {
    return DriveApp.getRootFolder();
  }
}

function checkIncomingInbox_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAMES.INBOX);
    if (!sheet) {
      setupInboxSheet_();
      sheet = ss.getSheetByName(SHEET_NAMES.INBOX);
    }

    let savedCount = 0;
    const now = new Date();

    // A. FAX通知メールスキャン (mail@felis-car.jp 宛、または eFAX / 件名に【受信FAX】等を含む未読)
    const faxQuery = 'is:unread (to:mail@felis-car.jp OR from:efax.com OR subject:【受信FAX】 OR subject:FAX OR subject:受信 OR subject:複合機)';
    try {
      const faxThreads = GmailApp.search(faxQuery, 0, 20);
      faxThreads.forEach(thread => {
        thread.getMessages().forEach(msg => {
          if (msg.isUnread()) {
            const date = msg.getDate();
            const subject = msg.getSubject();
            const body = msg.getPlainBody();
            const from = msg.getFrom();
            const faxNumber = extractFaxNumber_(msg);

            const ts = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
            const attachments = [];

            try {
              msg.getAttachments().forEach(att => {
                const folder = getInboxDriveFolder_('FAX受信');
                const file = folder.createFile(att.copyBlob().setName(ts + '_' + att.getName()));
                try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
                attachments.push({ name: att.getName(), url: file.getUrl() });
              });
            } catch (attErr) {
              Logger.log('FAX添付ファイル保存エラー: ' + attErr.message);
            }

            const newId = 'INB-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            const rowData = [
              newId,
              date,
              'FAX',
              faxNumber,
              subject,
              body.substring(0, 500),
              JSON.stringify(attachments),
              '未対応',
              '',
              now
            ];
            sheet.appendRow(rowData);
            savedCount++;
            msg.markRead();
          }
        });
      });
    } catch (err) {
      Logger.log('FAX受信チェックエラー: ' + err.message);
    }

    // B. 一般顧客メールスキャン (car@felis-car.jp 宛、旧OCN bihoku@globe.ocn.ne.jp からの転送、その他の未読)
    const emailQuery = 'is:unread (to:car@felis-car.jp OR to:bihoku@globe.ocn.ne.jp OR (-to:mail@felis-car.jp -from:efax.com -subject:【受信FAX】 -subject:FAX -subject:複合機))';
    try {
      const emailThreads = GmailApp.search(emailQuery, 0, 20);
      emailThreads.forEach(thread => {
        thread.getMessages().forEach(msg => {
          if (msg.isUnread()) {
            const date = msg.getDate();
            const subject = msg.getSubject();
            const body = msg.getPlainBody();
            const from = msg.getFrom();

            const ts = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
            const attachments = [];

            try {
              msg.getAttachments().forEach(att => {
                const folder = getInboxDriveFolder_('メール添付');
                const file = folder.createFile(att.copyBlob().setName(ts + '_' + att.getName()));
                try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
                attachments.push({ name: att.getName(), url: file.getUrl() });
              });
            } catch (attErr) {
              Logger.log('メール添付ファイル保存エラー: ' + attErr.message);
            }

            const newId = 'INB-' + Date.now() + '-' + Math.floor(Math.random()*1000);
            const rowData = [
              newId,
              date,
              'メール',
              from,
              subject,
              body.substring(0, 1000),
              JSON.stringify(attachments),
              '未対応',
              '',
              now
            ];
            sheet.appendRow(rowData);
            savedCount++;
            msg.markRead();
          }
        });
      });
    } catch (err) {
      Logger.log('メール受信チェックエラー: ' + err.message);
    }

    // C. 後方互換用のFAXログへの書き込み (FAXのみ)
    try {
      if (savedCount > 0) {
        const inboxData = sheet.getRange(sheet.getLastRow() - savedCount + 1, 1, savedCount, INBOX_HEADERS.length).getValues();
        inboxData.forEach(row => {
          if (row[2] === 'FAX') {
            logFax_('受信', row[3], row[4], '');
          }
        });
      }
    } catch (e) {
      // 互換書き込みエラーは無視
    }

    return { success: true, saved: savedCount };
  } catch (globalErr) {
    Logger.log('checkIncomingInbox 全体エラー: ' + globalErr.message);
    return { error: '受信チェック処理で例外が発生しました: ' + globalErr.message, saved: 0 };
  }
}

function upsertLocation_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.LOCATION);
  if (!sheet) return { error: '場所マスタシートが見つかりません' };

  const now = new Date();
  const keyMap = getKeyMap_(SHEET_NAMES.LOCATION);

  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        LOCATION_HEADERS.forEach((header, col) => {
          const key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) sheet.getRange(row, col + 1).setValue(data[key]);
        });
        sheet.getRange(row, 6).setValue(now);
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  const newId = data.id || ('LOC-' + Date.now());
  const rowData = LOCATION_HEADERS.map(header => {
    const key = keyMap[header];
    if (key === 'id') return newId;
    if (key === 'createdAt' || key === 'updatedAt') return now;
    return data[key] || '';
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

// ---- 顧客担当者 upsert ----
function upsertClientContact_(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.CLIENT_CONTACT);
  if (!sheet) {
    // シートがない場合は自動作成
    setupClientContactMaster_();
    sheet = ss.getSheetByName(SHEET_NAMES.CLIENT_CONTACT);
  }
  if (!sheet) return { error: '顧客担当者マスタシートが見つかりません' };

  const now = new Date();
  const keyMap = getKeyMap_(SHEET_NAMES.CLIENT_CONTACT);

  if (data.id) {
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
      const rowIdx = ids.indexOf(data.id);
      if (rowIdx !== -1) {
        const row = rowIdx + 2;
        CLIENT_CONTACT_HEADERS.forEach((header, col) => {
          const key = keyMap[header];
          if (key && key !== 'id' && key !== 'createdAt' && data[key] !== undefined) {
            let val = data[key];
            if (key === 'phone' && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
              val = "'" + val;
            }
            sheet.getRange(row, col + 1).setValue(val);
          }
        });
        sheet.getRange(row, 8).setValue(now); // 更新日
        return { success: true, action: 'updated', id: data.id };
      }
    }
  }

  // 新規追加（ローカルIDをそのまま使う、または新規ID採番）
  const newId = data.id || generateClientContactId_(sheet);
  const rowData = CLIENT_CONTACT_HEADERS.map(header => {
    const key = keyMap[header];
    if (key === 'id') return newId;
    if (key === 'createdAt' || key === 'updatedAt') return now;
    let val = data[key] || '';
    if (key === 'phone' && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
      val = "'" + val;
    }
    return val;
  });
  sheet.appendRow(rowData);
  return { success: true, action: 'added', id: newId };
}

function generateClientContactId_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'CC-0001';
  const ids = sheet.getRange('A2:A' + lastRow).getValues().flat().filter(v => String(v).startsWith('CC-'));
  if (ids.length === 0) return 'CC-0001';
  const maxNum = Math.max(...ids.map(id => parseInt(String(id).replace('CC-', ''), 10) || 0));
  return 'CC-' + String(maxNum + 1).padStart(4, '0');
}

function setupDefaultCustomers_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) return;

  // すでに「愛知トヨタ」が含まれる顧客が存在する場合は重複挿入を回避
  const lastRow = sheet.getLastRow();
  let hasAichiToyota = false;
  if (lastRow >= 2) {
    const names = sheet.getRange('B2:B' + lastRow).getValues().flat();
    hasAichiToyota = names.some(n => String(n).includes('愛知トヨタ'));
  }

  if (!hasAichiToyota) {
    const now = new Date();
    const defaultClients = [
      { id: 'C-0001', name: '愛知トヨタ 一宮店', nameKana: 'アイチトヨタ イチノミヤテン', type: '法人', phone: '0586-71-4666', fax: '0586-72-4832', zip: '491-0931', address: '一宮市大和町宮地花池字高見55', memo: 'ディーラーマスタ' },
      { id: 'C-0002', name: '愛知トヨタ 一宮インター店', nameKana: 'アイチトヨタ イチノミヤインターテン', type: '法人', phone: '0586-77-1151', fax: '0586-77-7810', zip: '491-0828', address: '一宮市島崎1丁目12番1号', memo: 'ディーラーマスタ' },
      { id: 'C-0003', name: '愛知トヨタ 一宮開明店', nameKana: 'アイチトヨタ イチノミヤカイメイテン', type: '法人', phone: '0586-45-1011', fax: '0586-45-0011', zip: '494-0001', address: '一宮市開明字西石亀46', memo: 'ディーラーマスタ' },
      { id: 'C-0004', name: '愛知トヨタ 一宮三条店', nameKana: 'アイチトヨタ イチノミヤサンジョウテン', type: '法人', phone: '0586-62-2211', fax: '0586-62-2215', zip: '494-0003', address: '一宮市三条エグロ97-1', memo: 'ディーラーマスタ' },
      { id: 'C-0005', name: '愛知トヨタ キャラット一宮店', nameKana: 'アイチトヨタ キャラットイチノミヤテン', type: '法人', phone: '0586-77-1011', fax: '0586-77-4534', zip: '491-0833', address: '一宮市平島1-2-1', memo: '中古車取扱・ディーラーマスタ' },
      { id: 'C-0006', name: '愛知トヨタ 中店', nameKana: 'アイチトヨタ ナカテン', type: '法人', phone: '052-262-1411', fax: '052-262-0914', zip: '460-0011', address: '名古屋市中区大須3-5-10', memo: 'ディーラーマスタ' },
      { id: 'C-0007', name: '愛知トヨタ 高辻店', nameKana: 'アイチトヨタ タカツジテン', type: '法人', phone: '052-881-2800', fax: '052-872-3981', zip: '466-0057', address: '名古屋市昭和区高辻町6-8', memo: 'ディーラーマスタ' },
      { id: 'C-0008', name: '愛知トヨタ 中村店', nameKana: 'アイチトヨタ ナカムラテン', type: '法人', phone: '052-471-6131', fax: '052-471-6261', zip: '453-0823', address: '名古屋市中村区鈍池町3-131', memo: 'ディーラーマスタ' },
      { id: 'C-0009', name: '愛知トヨタ 江南店', nameKana: 'アイチトヨタ コウナンテン', type: '法人', phone: '0587-56-1181', fax: '0587-56-0275', zip: '483-8259', address: '江南市木賀東町新宮48', memo: 'ディーラーマスタ' },
      { id: 'C-0010', name: '愛知トヨタ 豊田店', nameKana: 'アイチトヨタ トヨタテン', type: '法人', phone: '0565-32-2525', fax: '0565-33-0005', zip: '471-0875', address: '豊田市下市場町5-25', memo: 'ディーラーマスタ' },
      { id: 'C-0011', name: '愛知トヨタ 岡崎店', nameKana: 'アイチトヨタ オカザキテン', type: '法人', phone: '0564-51-1811', fax: '0564-53-5272', zip: '444-0840', address: '岡崎市戸崎町字しのはら3-1', memo: 'ディーラーマスタ' },
      { id: 'C-0012', name: '愛知トヨタ 豊橋店', nameKana: 'アイチトヨタ トヨハシテン', type: '法人', phone: '0532-54-3211', fax: '0532-54-1502', zip: '440-0086', address: '豊橋市下地町字境田100', memo: 'ディーラーマスタ' },
      { id: 'C-0013', name: '愛知トヨタ 稲沢おりづマイカーセンター', nameKana: 'アイチトヨタ イナザワオリズマイカーセンター', type: '法人', phone: '0587-24-0246', fax: '0587-24-0340', zip: '492-8094', address: '稲沢市下津下町西1-170-1', memo: '中古車取扱・ディーラーマスタ' },
      { id: 'C-0014', name: '愛知トヨタ 西春店', nameKana: 'アイチトヨタ ニシハルテン', type: '法人', phone: '0568-23-3161', fax: '0568-25-0133', zip: '481-0043', address: '北名古屋市沖村権現14', memo: 'ディーラーマスタ' },
      { id: 'C-0015', name: '愛知トヨタ 北名古屋店', nameKana: 'アイチトヨタ キタナゴヤテン', type: '法人', phone: '0568-21-1101', fax: '0568-21-0543', zip: '481-0043', address: '北名古屋市沖村西ノ郷162-2', memo: 'ディーラーマスタ' },
      { id: 'C-0016', name: '愛知トヨタ 北店', nameKana: 'アイチトヨタ キタテン', type: '法人', phone: '052-981-1541', fax: '052-913-2631', zip: '462-0854', address: '名古屋市北区若葉通4-10', memo: 'ディーラーマスタ' },
      { id: 'C-0017', name: '愛知トヨタ 昭和橋店', nameKana: 'アイチトヨタ ショウワバシテン', type: '法人', phone: '052-651-5321', fax: '052-651-1120', zip: '454-0857', address: '名古屋市中川区福川町5-2-1', memo: 'ディーラーマスタ' },
      { id: 'C-0018', name: '愛知トヨタ 小牧村中店', nameKana: 'アイチトヨタ コマキムラナカテン', type: '法人', phone: '0568-73-6011', fax: '0568-76-3604', zip: '485-0012', address: '小牧市村中11', memo: 'ディーラーマスタ' },
      { id: 'C-0019', name: '愛知トヨタ キャラット小牧店', nameKana: 'アイチトヨタ キャラットコマキテン', type: '法人', phone: '0568-72-5633', fax: '0568-75-8783', zip: '485-0021', address: '小牧市郷中1-75', memo: '中古車取扱・ディーラーマスタ' },
      { id: 'C-0020', name: '愛知トヨタ 蟹江店', nameKana: 'アイチトヨタ カニエテン', type: '法人', phone: '0567-95-4081', fax: '0567-95-4080', zip: '497-0034', address: '海部郡蟹江町錦3-1', memo: 'ディーラーマスタ' },
      { id: 'C-0021', name: '愛知トヨタ 津島店', nameKana: 'アイチトヨタ ツシマテン', type: '法人', phone: '0567-28-7560', fax: '0567-28-7583', zip: '496-8014', address: '愛西市諸桑町郷城338', memo: 'ディーラーマスタ' }
    ];

    const keyMap = getKeyMap_(SHEET_NAMES.CUSTOMER);
    const rows = defaultClients.map(c => {
      return CUSTOMER_HEADERS.map(header => {
        const key = keyMap[header];
        if (key === 'id') return c.id;
        if (key === 'createdAt' || key === 'updatedAt') return now;
        return c[key] || '';
      });
    });
    sheet.getRange(2, 1, rows.length, CUSTOMER_HEADERS.length).setValues(rows);
  }
}

function forcePopulateDefaults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  const confirm = ui.alert(
    '初期データ登録',
    '顧客マスタに「愛知トヨタ 12店舗」、場所マスタに「東海3県陸運局・主要警察署 29箇所」を追加登録します。\n' +
    '（既に同名のデータが登録されている場合は重複登録されません）\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  let customerAdded = 0;
  let locationAdded = 0;

  // 1. 愛知トヨタ店舗の追加
  const customerSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (customerSheet) {
    const defaultClients = [
      { name: '愛知トヨタ 一宮店', nameKana: 'アイチトヨタ イチノミヤテン', type: '法人', phone: '0586-71-4666', fax: '0586-72-4832', zip: '491-0931', address: '一宮市大和町宮地花池字高見55', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 一宮インター店', nameKana: 'アイチトヨタ イチノミヤインターテン', type: '法人', phone: '0586-77-1151', fax: '0586-77-7810', zip: '491-0828', address: '一宮市島崎1丁目12番1号', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 一宮開明店', nameKana: 'アイチトヨタ イチノミヤカイメイテン', type: '法人', phone: '0586-45-1011', fax: '0586-45-0011', zip: '494-0001', address: '一宮市開明字西石亀46', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 一宮三条店', nameKana: 'アイチトヨタ イチノミヤサンジョウテン', type: '法人', phone: '0586-62-2211', fax: '0586-62-2215', zip: '494-0003', address: '一宮市三条エグロ97-1', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ キャラット一宮店', nameKana: 'アイチトヨタ キャラットイチノミヤテン', type: '法人', phone: '0586-77-1011', fax: '0586-77-4534', zip: '491-0833', address: '一宮市平島1-2-1', memo: '中古車取扱・ディーラーマスタ' },
      { name: '愛知トヨタ 中店', nameKana: 'アイチトヨタ ナカテン', type: '法人', phone: '052-262-1411', fax: '052-262-0914', zip: '460-0011', address: '名古屋市中区大須3-5-10', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 高辻店', nameKana: 'アイチトヨタ タカツジテン', type: '法人', phone: '052-881-2800', fax: '052-872-3981', zip: '466-0057', address: '名古屋市昭和区高辻町6-8', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 中村店', nameKana: 'アイチトヨタ ナカムラテン', type: '法人', phone: '052-471-6131', fax: '052-471-6261', zip: '453-0823', address: '名古屋市中村区鈍池町3-131', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 江南店', nameKana: 'アイチトヨタ コウナンテン', type: '法人', phone: '058-756-1181', fax: '058-756-0275', zip: '483-8259', address: '江南市木賀東町新宮48', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 豊田店', nameKana: 'アイチトヨタ トヨタテン', type: '法人', phone: '0565-32-2525', fax: '0565-33-0005', zip: '471-0875', address: '豊田市下市場町5-25', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 岡崎店', nameKana: 'アイチトヨタ オカザキテン', type: '法人', phone: '0564-51-1811', fax: '0564-53-5272', zip: '444-0840', address: '岡崎市戸崎町字しのはら3-1', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 豊橋店', nameKana: 'アイチトヨタ トヨハシテン', type: '法人', phone: '0532-54-3211', fax: '0532-54-1502', zip: '440-0086', address: '豊橋市下地町字境田100', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 稲沢おりづマイカーセンター', nameKana: 'アイチトヨタ イナザワオリズマイカーセンター', type: '法人', phone: '0587-24-0246', fax: '0587-24-0340', zip: '492-8094', address: '稲沢市下津下町西1-170-1', memo: '中古車取扱・ディーラーマスタ' },
      { name: '愛知トヨタ 西春店', nameKana: 'アイチトヨタ ニシハルテン', type: '法人', phone: '0568-23-3161', fax: '0568-25-0133', zip: '481-0043', address: '北名古屋市沖村権現14', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 北名古屋店', nameKana: 'アイチトヨタ キタナゴヤテン', type: '法人', phone: '0568-21-1101', fax: '0568-21-0543', zip: '481-0043', address: '北名古屋市沖村西ノ郷162-2', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 北店', nameKana: 'アイチトヨタ キタテン', type: '法人', phone: '052-981-1541', fax: '052-913-2631', zip: '462-0854', address: '名古屋市北区若葉通4-10', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 昭和橋店', nameKana: 'アイチトヨタ ショウワバシテン', type: '法人', phone: '052-651-5321', fax: '052-651-1120', zip: '454-0857', address: '名古屋市中川区福川町5-2-1', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 小牧村中店', nameKana: 'アイチトヨタ コマキムラナカテン', type: '法人', phone: '0568-73-6011', fax: '0568-76-3604', zip: '485-0012', address: '小牧市村中11', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ キャラット小牧店', nameKana: 'アイチトヨタ キャラットコマキテン', type: '法人', phone: '0568-72-5633', fax: '0568-75-8783', zip: '485-0021', address: '小牧市郷中1-75', memo: '中古車取扱・ディーラーマスタ' },
      { name: '愛知トヨタ 蟹江店', nameKana: 'アイチトヨタ カニエテン', type: '法人', phone: '0567-95-4081', fax: '0567-95-4080', zip: '497-0034', address: '海部郡蟹江町錦3-1', memo: 'ディーラーマスタ' },
      { name: '愛知トヨタ 津島店', nameKana: 'アイチトヨタ ツシマテン', type: '法人', phone: '0567-28-7560', fax: '0567-28-7583', zip: '496-8014', address: '愛西市諸桑町郷城338', memo: 'ディーラーマスタ' }
    ];

    const lastRow = customerSheet.getLastRow();
    const existingNames = lastRow >= 2 ? customerSheet.getRange('B2:B' + lastRow).getValues().flat().map(String) : [];
    const keyMap = getKeyMap_(SHEET_NAMES.CUSTOMER);
    const now = new Date();

    // ID採番
    let nextIdNum = 1;
    if (lastRow >= 2) {
      const ids = customerSheet.getRange('A2:A' + lastRow).getValues().flat();
      ids.forEach(id => {
        const m = String(id).match(/^C-(\d+)$/);
        if (m) nextIdNum = Math.max(nextIdNum, parseInt(m[1], 10) + 1);
      });
    }

    defaultClients.forEach(c => {
      if (!existingNames.includes(c.name)) {
        const newId = 'C-' + String(nextIdNum++).padStart(4, '0');
        const rowData = CUSTOMER_HEADERS.map(header => {
          const key = keyMap[header];
          if (key === 'id') return newId;
          if (key === 'createdAt' || key === 'updatedAt') return now;
          let val = c[key] || '';
          if ((key === 'phone' || key === 'fax') && typeof val === 'string' && val.startsWith('0') && /^\d+$/.test(val)) {
            val = "'" + val;
          }
          return val;
        });
        customerSheet.appendRow(rowData);
        customerAdded++;
      }
    });
  }

  // 2. 場所マスタの追加
  const locationSheet = ss.getSheetByName(SHEET_NAMES.LOCATION);
  if (locationSheet) {
    const defaultLocations = [
      { name: '愛知運輸支局', address: '名古屋市中川区北江口1-1211', memo: '名古屋ナンバー管轄' },
      { name: '小牧自動車検査登録事務所', address: '小牧市新小木3-32', memo: '尾張小牧・一宮・春日井ナンバー管轄' },
      { name: '西三河自動車検査登録事務所', address: '豊田市若林西町西葉山46', memo: '三河・豊田ナンバー管轄' },
      { name: '豊橋自動車検査登録事務所', address: '豊橋市神野新田町字京ノ割20-3', memo: '豊橋ナンバー管轄' },
      { name: '岐阜運輸支局', address: '岐阜市日置江2648-1', memo: '岐阜ナンバー管轄' },
      { name: '飛騨自動車検査登録事務所', address: '高山市新宮町830-5', memo: '飛騨ナンバー管轄' },
      { name: '三重運輸支局', address: '津市結城町370-1', memo: '三重・四日市・伊勢志摩ナンバー管轄' },
      { name: '一宮警察署', address: '一宮市本町1-6-20', memo: '愛知県警' },
      { name: '小牧警察署', address: '小牧市大字小牧201', memo: '愛知県警' },
      { name: '春日井警察署', address: '春日井市八田町2-1-12', memo: '愛知県警' },
      { name: '江南警察署', address: '江南市木賀町大島12', memo: '愛知県警' },
      { name: '犬山警察署', address: '犬山市大字犬山字薬師東1', memo: '愛知県警' },
      { name: '名古屋東警察署', address: '名古屋市東区筒井1-1-1', memo: '愛知県警' },
      { name: '中警察署', address: '名古屋市中区千代田2-2-3', memo: '愛知県警' },
      { name: '中川警察署', address: '名古屋市中川区篠原橋通1-4', memo: '愛知県警' },
      { name: '千種警察署', address: '名古屋市千種区覚王山通8-30', memo: '愛知県警' },
      { name: '豊田警察署', address: '豊田市錦町1-30', memo: '愛知県警' },
      { name: '岡崎警察署', address: '岡崎市明大寺町字銭堤4-1', memo: '愛知県警' },
      { name: '豊橋警察署', address: '豊橋市八町通3-8', memo: '愛知県警' },
      { name: '岐阜中警察署', address: '岐阜市美江寺町2-10', memo: '岐阜県警' },
      { name: '岐阜南警察署', address: '岐阜市茜部大野1-1-1', memo: '岐阜県警' },
      { name: '各務原警察署', address: '各務原市蘇原中央町2-1-3', memo: '岐阜県警' },
      { name: '大垣警察署', address: '大垣市江崎町422-10', memo: '岐阜県警' },
      { name: '多治見警察署', address: '多治見市宝町1-65', memo: '岐阜県警' },
      { name: '津警察署', address: '津市丸之内22-1', memo: '三重県警' },
      { name: '四日市南警察署', address: '四日市市新正5-5-5', memo: '三重県警' },
      { name: '四日市北警察署', address: '四日市市松原町4-3', memo: '三重県警' },
      { name: '桑名警察署', address: '桑名市大字江場626-2', memo: '三重県警' },
      { name: '伊勢警察署', address: '伊勢市神久2-1-33', memo: '三重県警' }
    ];

    const lastRow = locationSheet.getLastRow();
    const existingNames = lastRow >= 2 ? locationSheet.getRange('B2:B' + lastRow).getValues().flat().map(String) : [];
    const now = new Date();

    // ID採番
    let nextIdNum = 1;
    if (lastRow >= 2) {
      const ids = locationSheet.getRange('A2:A' + lastRow).getValues().flat();
      ids.forEach(id => {
        const m = String(id).match(/^LOC-(\d+)$/);
        if (m) nextIdNum = Math.max(nextIdNum, parseInt(m[1], 10) + 1);
      });
    }

    defaultLocations.forEach(loc => {
      if (!existingNames.includes(loc.name)) {
        const newId = 'LOC-' + String(nextIdNum++).padStart(4, '0');
        locationSheet.appendRow([
          newId,
          loc.name,
          loc.address,
          loc.memo,
          now,
          now
        ]);
        locationAdded++;
      }
    });
  }

  // 3. 案件マスタのヘッダー拡張
  updateCaseHeaders_();

  ui.alert(
    '初期データ追加完了',
    `登録が完了しました。\n\n・顧客マスタ: ${customerAdded}件 追加\n・場所マスタ: ${locationAdded}件 追加\n・案件マスタ: ヘッダー更新（5カラム追加）\n\nダッシュボード側で「同期」を実行してください。`,
    ui.ButtonSet.OK
  );
}

function updateCaseHeaders_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CASES);
  if (sheet) {
    sheet.getRange(1, 1, 1, CASE_HEADERS.length).setValues([CASE_HEADERS]);
  }
}

// ── LINE Messaging API 用ヘルパー関数群 ──

function sendLineMessage_(message, accessToken, userId) {
  if (!accessToken || !userId) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG || '操作ログ');
    if (logSheet) {
      logSheet.appendRow([
        new Date(),
        'LINE送信スキップ',
        'システム',
        '-',
        'LINE 連携デバッグ',
        '-',
        '理由: トークン(' + (accessToken ? '設定済' : '未設定') + ') または ユーザーID(' + (userId ? '設定済' : '未設定') + ') が不足しています'
      ]);
    }
    return;
  }
  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [
      {
        type: 'text',
        text: message
      }
    ]
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    const response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    
    // スプレッドシートの「操作ログ」に記録
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG || '操作ログ');
    if (logSheet) {
      logSheet.appendRow([
        new Date(),
        'LINE送信結果',
        'システム',
        '-',
        'LINE 連携デバッグ',
        '-',
        'レスポンス: ' + resText
      ]);
    }
  } catch (err) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG || '操作ログ');
    if (logSheet) {
      logSheet.appendRow([
        new Date(),
        'LINE送信例外エラー',
        'システム',
        '-',
        'LINE 連携デバッグ',
        '-',
        'エラー: ' + err.toString()
      ]);
    }
  }
}

function getClientName_(clientId) {
  if (!clientId) return '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CUSTOMER);
  if (!sheet) return '';
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  const ids = sheet.getRange('A2:A' + lastRow).getValues().flat();
  const idx = ids.indexOf(clientId);
  if (idx !== -1) {
    return sheet.getRange(idx + 2, 2).getValue(); // Column 2 is 氏名 (name)
  }
  return '';
}

function getCategoryLabel_(cat) {
  const cats = {
    'garage_oss': '車庫証明（OSS）',
    'garage_paper': '車庫証明（書面）',
    'seal': '丁種封印',
    'inheritance': '相続手続き',
    'other': 'その他業務'
  };
  return cats[cat] || cat;
}