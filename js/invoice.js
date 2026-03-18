/**
 * 請求書発行モジュール
 */
const Invoice = {
  // 事務所情報（設定で変更可能）
  getOfficeInfo() {
    const saved = localStorage.getItem('gyosei_office_info');
    if (saved) return JSON.parse(saved);
    return {
      name: '行政書士事務所',
      representative: '',
      zip: '',
      address: '',
      tel: '',
      email: '',
      bankName: '',
      bankBranch: '',
      accountType: '普通',
      accountNumber: '',
      accountHolder: '',
      registrationNumber: '',
    };
  },

  saveOfficeInfo(info) {
    localStorage.setItem('gyosei_office_info', JSON.stringify(info));
  },

  // 請求書番号を生成
  generateInvoiceNumber(clientId, year, month) {
    const m = String(month).padStart(2, '0');
    const seq = String(this.getNextSeq()).padStart(3, '0');
    return `INV-${year}${m}-${seq}`;
  },

  getNextSeq() {
    const current = parseInt(localStorage.getItem('gyosei_invoice_seq') || '0');
    const next = current + 1;
    localStorage.setItem('gyosei_invoice_seq', String(next));
    return next;
  },

  // 対象案件を取得（特定の顧客・年月の完了案件）
  getBillingCases(clientId, year, month) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const cases = Store.getCasesByClient(clientId);
    return cases.filter(c => {
      if (c.status !== 'done' || !c.fee) return false;
      const doneDate = c.completedAt || c.updatedAt || '';
      return doneDate.startsWith(yearMonth);
    });
  },

  // 請求書選択モーダルを表示
  showSelectModal(clientId) {
    const client = Store.getClient(clientId);
    if (!client) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 過去6ヶ月分のオプション
    let monthOptions = '';
    for (let i = 0; i < 6; i++) {
      let y = currentYear;
      let m = currentMonth - i;
      if (m <= 0) { m += 12; y--; }
      const label = `${y}年${m}月`;
      const cases = this.getBillingCases(clientId, y, m);
      const total = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
      const selected = i === 0 ? 'selected' : '';
      monthOptions += `<option value="${y}-${m}" ${selected}>${label} (${cases.length}件 / ¥${total.toLocaleString()})</option>`;
    }

    const existing = document.getElementById('invoiceSelectModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'invoiceSelectModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('invoiceSelectModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>📄 請求書発行</h2>
          <button class="modal-close" onclick="document.getElementById('invoiceSelectModal').remove()">✕</button>
        </div>
        <div style="padding:0">
          <div class="form-group">
            <label>顧客</label>
            <input type="text" class="search-input" value="${client.name}" disabled style="width:100%">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>請求対象月 <span class="required">*</span></label>
              <select id="invoiceMonth" class="form-select" onchange="Invoice.onMonthChange('${clientId}')">
                ${monthOptions}
              </select>
            </div>
            <div class="form-group">
              <label>発行日</label>
              <input type="date" id="invoiceDate" value="${now.toISOString().slice(0, 10)}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>支払期限</label>
              <input type="date" id="invoiceDueDate" value="${new Date(currentYear, currentMonth, 0).toISOString().slice(0, 10)}">
            </div>
            <div class="form-group">
              <label>消費税率 (%)</label>
              <input type="number" id="invoiceTaxRate" value="10" min="0" max="100" step="1">
            </div>
          </div>
          <div class="form-group">
            <label>備考</label>
            <textarea id="invoiceNote" rows="2" placeholder="備考があれば入力..."></textarea>
          </div>
          <div id="invoicePreviewInfo" style="margin:12px 0;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.85rem"></div>
          <div class="form-actions">
            <button class="btn btn-secondary" onclick="Invoice.showOfficeSettings()">🏢 事務所情報</button>
            <button class="btn btn-primary" onclick="Invoice.generate('${clientId}')">📄 請求書を発行</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    this.onMonthChange(clientId);
  },

  onMonthChange(clientId) {
    const val = document.getElementById('invoiceMonth').value;
    const [year, month] = val.split('-').map(Number);
    const cases = this.getBillingCases(clientId, year, month);
    const total = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    const CATS = { garage: '🚗 車庫証明', inheritance: '📜 相続', mahjong: '🀄 麻雀関連', construction: '🏗️ 建設業', farmland: '🌾 農地転用', liquor: '🍶 酒類販売', visa: '🛂 在留資格', other: 'その他' };
    const info = document.getElementById('invoicePreviewInfo');
    if (cases.length === 0) {
      info.innerHTML = '<span style="color:var(--text-muted)">この月に完了した案件はありません</span>';
    } else {
      info.innerHTML = `
        <strong>対象案件 (${cases.length}件)</strong><br>
        ${cases.map(c => `・${CATS[c.category] || ''} ${c.title}：¥${Number(c.fee).toLocaleString()}`).join('<br>')}
        <br><strong style="color:var(--accent-green)">小計：¥${total.toLocaleString()}</strong>
      `;
    }
  },

  // 請求書を生成して新しいウィンドウで開く
  generate(clientId) {
    const val = document.getElementById('invoiceMonth').value;
    const [year, month] = val.split('-').map(Number);
    const cases = this.getBillingCases(clientId, year, month);

    if (cases.length === 0) {
      App.showToast('対象の完了案件がありません');
      return;
    }

    const client = Store.getClient(clientId);
    const office = this.getOfficeInfo();
    const issueDate = document.getElementById('invoiceDate').value;
    const dueDate = document.getElementById('invoiceDueDate').value;
    const taxRate = parseInt(document.getElementById('invoiceTaxRate').value) || 10;
    const note = document.getElementById('invoiceNote').value;
    const invoiceNo = this.generateInvoiceNumber(clientId, year, month);

    const subtotal = cases.reduce((sum, c) => sum + Number(c.fee || 0), 0);
    const tax = Math.floor(subtotal * taxRate / 100);
    const total = subtotal + tax;

    const CATS = { garage: '車庫証明', inheritance: '相続', mahjong: '麻雀関連', construction: '建設業', farmland: '農地転用', liquor: '酒類販売', visa: '在留資格', other: 'その他' };

    const html = this.buildInvoiceHTML({
      invoiceNo,
      issueDate,
      dueDate,
      year,
      month,
      client,
      office,
      cases,
      CATS,
      subtotal,
      tax,
      taxRate,
      total,
      note,
    });

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();

    document.getElementById('invoiceSelectModal').remove();
    // 入金管理に請求レコードを追加
    if (typeof Payments !== 'undefined') {
      Payments.createFromInvoice(invoiceNo, clientId, total, dueDate);
    }
    App.showToast(`請求書 ${invoiceNo} を発行しました`);

    // Google Drive に自動保存（非同期・失敗しても印刷には影響しない）
    if (typeof SpreadsheetSync !== 'undefined' && SpreadsheetSync.isConfigured()) {
      const clientDisplayName = client.type === '法人' ? (client.companyName || client.name) : client.name;
      SpreadsheetSync.pushInvoice(html, invoiceNo, clientDisplayName, '請求書').then(result => {
        if (result && result.success) {
          App.showToast(`📁 Driveに保存しました: ${result.folderPath}`);
        } else if (result === null) {
          // 通信エラー（コンソールに既に出力済み）
        }
      });
    }
  },

  buildInvoiceHTML({ invoiceNo, issueDate, dueDate, year, month, client, office, cases, CATS, subtotal, tax, taxRate, total, note }) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Noto Sans JP', sans-serif;
    color: #1a1a2e;
    background: #fff;
    padding: 40px;
    max-width: 800px;
    margin: 0 auto;
  }
  @media print {
    body { padding: 20px; }
    .no-print { display: none !important; }
    @page { margin: 15mm; size: A4; }
  }

  .print-bar {
    display: flex; gap: 10px; margin-bottom: 30px; justify-content: flex-end;
  }
  .print-bar button {
    padding: 8px 20px; border: none; border-radius: 6px; cursor: pointer;
    font-size: 14px; font-weight: 600;
  }
  .btn-print { background: #3b82f6; color: #fff; }
  .btn-print:hover { background: #2563eb; }
  .btn-close { background: #e5e7eb; color: #374151; }

  .invoice-header {
    text-align: center;
    margin-bottom: 32px;
    border-bottom: 3px solid #1a1a2e;
    padding-bottom: 16px;
  }
  .invoice-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 12px;
    margin-bottom: 8px;
  }
  .invoice-no {
    font-size: 13px;
    color: #666;
  }

  .invoice-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 32px;
    gap: 32px;
  }
  .invoice-client {
    flex: 1;
  }
  .invoice-office {
    flex: 1;
    text-align: right;
  }

  .client-name-box {
    font-size: 20px;
    font-weight: 700;
    border-bottom: 2px solid #1a1a2e;
    padding-bottom: 4px;
    margin-bottom: 8px;
    display: inline-block;
  }
  .client-name-box::after {
    content: " 御中";
    font-size: 14px;
    font-weight: 400;
  }
  .client-address {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }

  .office-name {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .office-detail {
    font-size: 11px;
    color: #555;
    line-height: 1.8;
  }
  .stamp-area {
    display: inline-block;
    width: 60px;
    height: 60px;
    border: 2px solid #c00;
    border-radius: 50%;
    margin-top: 8px;
    text-align: center;
    line-height: 56px;
    font-size: 11px;
    color: #c00;
    font-weight: 700;
  }

  .total-box {
    background: #f8f9fa;
    border: 2px solid #1a1a2e;
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .total-label {
    font-size: 16px;
    font-weight: 700;
  }
  .total-amount {
    font-size: 28px;
    font-weight: 700;
  }
  .total-amount::before {
    content: "¥";
    font-size: 18px;
    margin-right: 2px;
  }

  .date-info {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;
    font-size: 13px;
  }
  .date-info span { font-weight: 600; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    font-size: 13px;
  }
  th {
    background: #1a1a2e;
    color: #fff;
    padding: 10px 12px;
    text-align: left;
    font-weight: 600;
    font-size: 12px;
  }
  th:last-child { text-align: right; }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  td:last-child { text-align: right; font-weight: 600; }
  tr:nth-child(even) { background: #f9fafb; }

  .summary-table {
    width: 260px;
    margin-left: auto;
    margin-bottom: 24px;
  }
  .summary-table td {
    padding: 6px 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  .summary-table .total-row td {
    border-top: 2px solid #1a1a2e;
    border-bottom: 2px solid #1a1a2e;
    font-size: 15px;
    font-weight: 700;
    padding: 10px 12px;
  }

  .bank-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 20px;
    font-size: 12px;
  }
  .bank-title {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 8px;
  }
  .bank-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 16px;
    line-height: 1.8;
  }
  .bank-label { color: #666; }

  .note-section {
    font-size: 12px;
    color: #555;
    line-height: 1.8;
    padding: 12px 0;
    border-top: 1px solid #e5e7eb;
  }
  .note-title { font-weight: 700; margin-bottom: 4px; }

  .footer {
    text-align: center;
    margin-top: 32px;
    font-size: 11px;
    color: #999;
  }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>

  <div class="invoice-header">
    <div class="invoice-title">請 求 書</div>
    <div class="invoice-no">No. ${invoiceNo}</div>
  </div>

  <div class="invoice-info">
    <div class="invoice-client">
      <div class="client-name-box">${client.type === '法人' ? (client.companyName || client.name) : client.name}</div>
      <div class="client-address">
        ${client.zip ? '〒' + client.zip + '<br>' : ''}
        ${client.address || ''}
      </div>
    </div>
    <div class="invoice-office">
      <div class="office-name">${office.name}</div>
      <div class="office-detail">
        ${office.representative ? office.representative + '<br>' : ''}
        ${office.zip ? '〒' + office.zip + '<br>' : ''}
        ${office.address ? office.address + '<br>' : ''}
        ${office.tel ? 'TEL: ' + office.tel + '<br>' : ''}
        ${office.email ? office.email + '<br>' : ''}
        ${office.registrationNumber ? '登録番号: ' + office.registrationNumber : ''}
      </div>
      <div class="stamp-area">印</div>
    </div>
  </div>

  <div class="date-info">
    <div>発行日: <span>${issueDate}</span></div>
    <div>お支払期限: <span>${dueDate}</span></div>
    <div>対象期間: <span>${year}年${month}月分</span></div>
  </div>

  <div class="total-box">
    <div class="total-label">ご請求金額（税込）</div>
    <div class="total-amount">${total.toLocaleString()}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>業務内容</th>
        <th style="width:100px">カテゴリ</th>
        <th style="width:80px">数量</th>
        <th style="width:120px">金額</th>
      </tr>
    </thead>
    <tbody>
      ${cases.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${c.title}</td>
        <td>${CATS[c.category] || c.category}</td>
        <td>1</td>
        <td>¥${Number(c.fee).toLocaleString()}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <table class="summary-table">
    <tr>
      <td>小計</td>
      <td>¥${subtotal.toLocaleString()}</td>
    </tr>
    <tr>
      <td>消費税 (${taxRate}%)</td>
      <td>¥${tax.toLocaleString()}</td>
    </tr>
    <tr class="total-row">
      <td>合計</td>
      <td>¥${total.toLocaleString()}</td>
    </tr>
  </table>

  ${office.bankName ? `
  <div class="bank-section">
    <div class="bank-title">📋 お振込先</div>
    <div class="bank-grid">
      <span class="bank-label">金融機関</span><span>${office.bankName}</span>
      <span class="bank-label">支店名</span><span>${office.bankBranch}</span>
      <span class="bank-label">口座種別</span><span>${office.accountType}</span>
      <span class="bank-label">口座番号</span><span>${office.accountNumber}</span>
      <span class="bank-label">口座名義</span><span>${office.accountHolder}</span>
    </div>
  </div>` : ''}

  ${note ? `
  <div class="note-section">
    <div class="note-title">備考</div>
    ${note.replace(/\n/g, '<br>')}
  </div>` : ''}

  <div class="footer">
    この請求書は電子的に作成されたものです
  </div>
</body>
</html>`;
  },

  // 事務所情報設定モーダル
  showOfficeSettings() {
    const info = this.getOfficeInfo();
    const existing = document.getElementById('officeSettingsModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'officeSettingsModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('officeSettingsModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>🏢 事務所情報設定</h2>
          <button class="modal-close" onclick="document.getElementById('officeSettingsModal').remove()">✕</button>
        </div>
        <form id="officeForm" onsubmit="Invoice.onSaveOffice(event)">
          <div class="form-group">
            <label>事務所名 <span class="required">*</span></label>
            <input type="text" name="name" value="${info.name}" required placeholder="例：行政書士 佐藤事務所">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>代表者名</label>
              <input type="text" name="representative" value="${info.representative}" placeholder="例：行政書士 佐藤太郎">
            </div>
            <div class="form-group">
              <label>登録番号</label>
              <input type="text" name="registrationNumber" value="${info.registrationNumber}" placeholder="T0000000000000">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>郵便番号</label>
              <input type="text" name="zip" value="${info.zip}" placeholder="000-0000">
            </div>
            <div class="form-group">
              <label>電話番号</label>
              <input type="text" name="tel" value="${info.tel}" placeholder="000-0000-0000">
            </div>
          </div>
          <div class="form-group">
            <label>住所</label>
            <input type="text" name="address" value="${info.address}" placeholder="愛知県名古屋市..." style="width:100%">
          </div>
          <div class="form-group">
            <label>メールアドレス</label>
            <input type="email" name="email" value="${info.email}" placeholder="info@example.com" style="width:100%">
          </div>
          <h3 style="margin:16px 0 8px;font-size:0.95rem">🏦 振込先口座</h3>
          <div class="form-row">
            <div class="form-group">
              <label>金融機関名</label>
              <input type="text" name="bankName" value="${info.bankName}" placeholder="例：三菱UFJ銀行">
            </div>
            <div class="form-group">
              <label>支店名</label>
              <input type="text" name="bankBranch" value="${info.bankBranch}" placeholder="例：名古屋支店">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>口座種別</label>
              <select name="accountType" class="form-select">
                <option value="普通" ${info.accountType === '普通' ? 'selected' : ''}>普通</option>
                <option value="当座" ${info.accountType === '当座' ? 'selected' : ''}>当座</option>
              </select>
            </div>
            <div class="form-group">
              <label>口座番号</label>
              <input type="text" name="accountNumber" value="${info.accountNumber}" placeholder="1234567">
            </div>
          </div>
          <div class="form-group">
            <label>口座名義</label>
            <input type="text" name="accountHolder" value="${info.accountHolder}" placeholder="例：ギョウセイショシ サトウタロウ" style="width:100%">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('officeSettingsModal').remove()">キャンセル</button>
            <button type="submit" class="btn btn-primary">💾 保存</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onSaveOffice(e) {
    e.preventDefault();
    const form = e.target;
    const info = {
      name: form.name.value.trim(),
      representative: form.representative.value.trim(),
      registrationNumber: form.registrationNumber.value.trim(),
      zip: form.zip.value.trim(),
      tel: form.tel.value.trim(),
      address: form.address.value.trim(),
      email: form.email.value.trim(),
      bankName: form.bankName.value.trim(),
      bankBranch: form.bankBranch.value.trim(),
      accountType: form.accountType.value,
      accountNumber: form.accountNumber.value.trim(),
      accountHolder: form.accountHolder.value.trim(),
    };
    this.saveOfficeInfo(info);
    document.getElementById('officeSettingsModal').remove();
    App.showToast('事務所情報を保存しました');
  },
};
