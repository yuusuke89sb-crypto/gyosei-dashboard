/**
 * 会計・仕訳帳モジュール（シンプル版）
 */
const Accounting = {
  filterYear: new Date().getFullYear(),
  filterMonth: new Date().getMonth() + 1,
  editingId: null,
  activeTab: 'journals',
  trialBalancePeriod: 'cumulative',

  // 行政書士事務所でよく使う勘定科目
  ACCOUNTS: {
    income: [
      '売上高',
      '雑収入',
    ],
    expense: [
      '旅費交通費',
      '通信費',
      '消耗品費',
      '備品・消耗品費',
      '事務用品費',
      '家賃地代',
      '水道光熱費',
      '接待交際費',
      '広告宣伝費',
      '支払手数料',
      '租税公課',
      '研修費',
      '研修採用費',
      '福利厚生費',
      '新聞図書費',
      '保険料',
      '減価償却費',
      '雑費',
    ],
    asset: [
      '現金', '普通預金', '売掛金', '開業費', '創立費', '事業主貸',
    ],
    liability: [
      '未払金', '事業主借', '役員借入金', '資本金', '元本',
    ],
  },

  getAllAccounts() {
    const all = [];
    Object.values(this.ACCOUNTS).forEach(arr => arr.forEach(a => all.push(a)));
    return [...new Set(all)];
  },

  getJournals() {
    return JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
  },

  saveJournals(data) {
    localStorage.setItem('gyosei_journals', JSON.stringify(data));
  },

  render() {
    const journals = this.getJournals();
    const ym = `${this.filterYear}-${String(this.filterMonth).padStart(2, '0')}`;
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    // 月間集計
    let totalIncome = 0, totalExpense = 0;
    filtered.forEach(j => {
      if (this.ACCOUNTS.income.includes(j.credit)) totalIncome += j.amount;
      if (this.ACCOUNTS.expense.includes(j.debit)) totalExpense += j.amount;
    });

    // 年ナビを動的に生成（仕訳内の年度を走査）
    const currentYear = new Date().getFullYear();
    const yearsSet = new Set([currentYear - 1, currentYear, currentYear + 1]);
    journals.forEach(j => {
      if (j.date && j.date.length >= 4) {
        const y = parseInt(j.date.substring(0, 4), 10);
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    // 月ナビ
    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push(`<option value="${m}" ${this.filterMonth === m ? 'selected' : ''}>${m}月</option>`);
    }

    const debitOptions = this.getAllAccounts().map(a => `<option value="${a}">${a}</option>`).join('');
    const creditOptions = debitOptions;
    const today = Store.getLocalDateStr();

    return `
      <div class="accounting-page">
        <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <h1>💹 帳簿</h1>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary" onclick="ReceiptOCR.showModal('accounting')" style="background:rgba(245,158,11,0.15); border:1px solid var(--accent-gold); color:var(--accent-gold); font-weight:700;">🤖 AIレシートOCR</button>
            <button class="btn btn-primary" onclick="Accounting.showAddModal()">＋ 仕訳追加</button>
          </div>
        </div>

        <!-- タブコントロール -->
        <div class="acc-tabs" style="display:flex; gap:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">
          <button class="btn btn-ghost" style="font-weight:700; font-size:0.95rem; border-radius:var(--radius-sm); ${this.activeTab === 'journals' ? 'background:rgba(245,158,11,0.15); color:var(--accent-gold); border-bottom:2px solid var(--accent-gold);' : ''}" onclick="Accounting.setActiveTab('journals')">📋 仕訳帳</button>
          <button class="btn btn-ghost" style="font-weight:700; font-size:0.95rem; border-radius:var(--radius-sm); ${this.activeTab === 'trial_balance' ? 'background:rgba(245,158,11,0.15); color:var(--accent-gold); border-bottom:2px solid var(--accent-gold);' : ''}" onclick="Accounting.setActiveTab('trial_balance')">📊 合計残高試算表</button>
        </div>

        <div class="acc-controls" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div class="acc-period">
            <select class="filter-select" onchange="Accounting.filterYear=Number(this.value); App.refreshView()">
              ${sortedYears.map(y =>
                `<option value="${y}" ${y === this.filterYear ? 'selected' : ''}>${y}年</option>`
              ).join('')}
            </select>
            <select class="filter-select" onchange="Accounting.filterMonth=Number(this.value); App.refreshView()">
              ${months.join('')}
            </select>
          </div>
          ${this.activeTab === 'journals' ? `
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-small" onclick="Accounting.exportMFCSV()" style="border-color:rgba(245,158,11,0.5); color:var(--accent-gold); font-weight:600;" title="マネーフォワード形式でCSVエクスポート">🧡 MF用CSV出力</button>
              <button class="btn btn-secondary btn-small" onclick="Accounting.showMFImportModal()" style="border-color:rgba(59,130,246,0.5); color:var(--accent-blue); font-weight:600;" title="マネーフォワード等からのCSVインポート">📥 MF用CSV取込</button>
              <button class="btn btn-secondary btn-small" onclick="Accounting.exportCSV()" title="汎用CSV出力">📄 汎用CSV出力</button>
            </div>
          ` : ''}
        </div>

        ${this.activeTab === 'journals' ? `
          <div class="acc-summary">
            <div class="acc-summary-card acc-income">
              <div class="acc-summary-label">収入</div>
              <div class="acc-summary-amount">¥${totalIncome.toLocaleString()}</div>
            </div>
            <div class="acc-summary-card acc-expense">
              <div class="acc-summary-label">支出</div>
              <div class="acc-summary-amount">¥${totalExpense.toLocaleString()}</div>
            </div>
            <div class="acc-summary-card acc-profit ${totalIncome - totalExpense >= 0 ? 'positive' : 'negative'}">
              <div class="acc-summary-label">収支</div>
              <div class="acc-summary-amount">¥${(totalIncome - totalExpense).toLocaleString()}</div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th>借方</th>
                  <th>貸方</th>
                  <th>金額</th>
                  <th>摘要 / インボイス番号</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">仕訳データがありません</td></tr>` :
                  filtered.map(j => `
                      <tr onclick="Accounting.showEditModal('${j.id}')" style="cursor:pointer">
                        <td>${j.date}</td>
                        <td>${j.debit}</td>
                        <td>${j.credit}</td>
                        <td class="amount-cell">¥${j.amount.toLocaleString()}</td>
                        <td>
                          ${j.auto ? '<span class="auto-badge">自動</span> ' : ''}
                          ${j.isReimbursement ? '<span class="badge" style="background:#3b82f6;color:#fff;font-size:0.7rem;margin-right:4px;">立替金</span>' : ''}
                          ${j.invoiceNo ? `<span class="badge" style="background:#10b981;color:#fff;font-size:0.7rem;margin-right:4px;" title="インボイス番号: ${j.invoiceNo}">適格 ${j.invoiceNo}</span>` : ''}
                          ${j.description || ''}
                        </td>
                      </tr>
                    `).join('')
                }
              </tbody>
            </table>
          </div>
        ` : this.renderTrialBalance()}
      </div>
      ${this.renderModal(debitOptions, creditOptions, today)}
    `;
  },

  renderModal(debitOptions, creditOptions, today) {
    return `
      <div id="journalModal" class="modal" style="display:none">
        <div class="modal-overlay" onclick="Accounting.closeModal()"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="journalModalTitle">仕訳追加</h2>
            <button class="modal-close" onclick="Accounting.closeModal()">✕</button>
          </div>
          <form id="journalForm" onsubmit="Accounting.onSubmit(event)">
            <div class="form-row">
              <div class="form-group">
                <label>日付 <span class="required">*</span></label>
                <input type="date" name="date" id="jf_date" required value="${today}">
              </div>
              <div class="form-group">
                <label>金額 <span class="required">*</span></label>
                <input type="number" name="amount" id="jf_amount" required min="1" placeholder="金額">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>借方（費用・資産）<span class="required">*</span></label>
                <select name="debit" id="jf_debit" required>
                  <option value="">選択...</option>
                  <optgroup label="── 費用 ──">${this.ACCOUNTS.expense.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 資産 ──">${this.ACCOUNTS.asset.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 収入 ──">${this.ACCOUNTS.income.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 負債 ──">${this.ACCOUNTS.liability.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                </select>
              </div>
              <div class="form-group">
                <label>貸方（収入・負債）<span class="required">*</span></label>
                <select name="credit" id="jf_credit" required>
                  <option value="">選択...</option>
                  <optgroup label="── 資産 ──">${this.ACCOUNTS.asset.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 収入 ──">${this.ACCOUNTS.income.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 負債 ──">${this.ACCOUNTS.liability.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                  <optgroup label="── 費用 ──">${this.ACCOUNTS.expense.map(a => `<option value="${a}">${a}</option>`).join('')}</optgroup>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>摘要</label>
              <input type="text" name="description" id="jf_desc" placeholder="例：電車代、切手代、○○様報酬" style="width:100%">
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-danger" id="journalDeleteBtn" style="display:none;margin-right:auto"
                onclick="Accounting.onDelete()">🗑️ 削除</button>
              <button type="button" class="btn btn-secondary" onclick="Accounting.closeModal()">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  showAddModal() {
    this.editingId = null;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('journalModalTitle').textContent = '仕訳追加';
      document.getElementById('journalForm').reset();
      document.getElementById('jf_date').value = Store.getLocalDateStr();
      document.getElementById('journalDeleteBtn').style.display = 'none';
      document.getElementById('journalModal').style.display = 'flex';
    }, 0);
  },

  showEditModal(id) {
    const journals = this.getJournals();
    const j = journals.find(x => x.id === id);
    if (!j) return;
    this.editingId = id;
    App.refreshView();
    setTimeout(() => {
      document.getElementById('journalModalTitle').textContent = '仕訳編集';
      document.getElementById('jf_date').value = j.date;
      document.getElementById('jf_amount').value = j.amount;
      document.getElementById('jf_debit').value = j.debit;
      document.getElementById('jf_credit').value = j.credit;
      document.getElementById('jf_desc').value = j.description || '';
      document.getElementById('journalDeleteBtn').style.display = 'block';
      document.getElementById('journalModal').style.display = 'flex';
    }, 0);
  },

  closeModal() {
    document.getElementById('journalModal').style.display = 'none';
    this.editingId = null;
  },

  onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      date: form.date.value,
      amount: Number(form.amount.value),
      debit: form.debit.value,
      credit: form.credit.value,
      description: form.description.value.trim(),
    };

    const journals = this.getJournals();
    if (this.editingId) {
      const idx = journals.findIndex(j => j.id === this.editingId);
      if (idx !== -1) journals[idx] = { ...journals[idx], ...data };
    } else {
      data.id = 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      data.createdAt = new Date().toISOString();
      journals.push(data);
    }
    this.saveJournals(journals);
    this.closeModal();
    App.refreshView();
    App.showToast(this.editingId ? '仕訳を更新しました' : '仕訳を追加しました');
  },

  onDelete() {
    if (!this.editingId) return;
    if (confirm('この仕訳を削除しますか？')) {
      const journals = this.getJournals().filter(j => j.id !== this.editingId);
      this.saveJournals(journals);
      this.closeModal();
      App.refreshView();
      App.showToast('仕訳を削除しました');
    }
  },

  // マネーフォワード形式 CSVエクスポート
  exportMFCSV() {
    const journals = this.getJournals();
    if (journals.length === 0) {
      App.showToast('出力する仕訳データがありません');
      return;
    }
    const ym = `${this.filterYear}-${String(this.filterMonth).padStart(2, '0')}`;
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    const list = filtered.length > 0 ? filtered : journals;
    list.sort((a, b) => a.date.localeCompare(b.date));

    const headers = [
      "取引No", "取引日", "借方勘定科目", "借方補助科目", "借方税区分", "借方金額(円)", "借方税額(円)",
      "貸方勘定科目", "貸方補助科目", "貸方税区分", "貸方金額(円)", "貸方税額(円)",
      "摘要", "仕訳メモ", "タグ", "MF仕訳タイプ", "決算整理仕訳"
    ];

    const rows = [headers.map(h => `"${h}"`).join(',')];

    list.forEach(j => {
      const dateFormatted = j.date ? j.date.replace(/-/g, '/') : '';
      const amount = j.amount || 0;
      const desc = (j.description || '').replace(/"/g, '""');
      const memo = (j.invoiceNo ? `適格No:${j.invoiceNo}` : '').replace(/"/g, '""');
      const debit = (j.debit || '').replace(/"/g, '""');
      const credit = (j.credit || '').replace(/"/g, '""');

      const row = [
        '""',
        `"${dateFormatted}"`,
        `"${debit}"`,
        '""',
        '""',
        `"${amount}"`,
        '""',
        `"${credit}"`,
        '""',
        '""',
        `"${amount}"`,
        '""',
        `"${desc}"`,
        `"${memo}"`,
        '""',
        '""',
        '""'
      ];
      rows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MF_仕訳データ_${this.filterYear}${String(this.filterMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    App.showToast(`マネーフォワード形式CSV (${list.length}件) をダウンロードしました`);
  },

  // 汎用 CSVエクスポート
  exportCSV() {
    const journals = this.getJournals();
    const ym = `${this.filterYear}-${String(this.filterMonth).padStart(2, '0')}`;
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    const list = filtered.length > 0 ? filtered : journals;
    list.sort((a, b) => a.date.localeCompare(b.date));

    if (list.length === 0) {
      App.showToast('出力する仕訳データがありません');
      return;
    }

    const rows = [['日付', '借方', '貸方', '金額', '摘要', 'インボイス番号']];
    list.forEach(j => {
      const desc = (j.description || '').replace(/"/g, '""');
      rows.push([
        `"${j.date || ''}"`,
        `"${j.debit || ''}"`,
        `"${j.credit || ''}"`,
        `"${j.amount || 0}"`,
        `"${desc}"`,
        `"${j.invoiceNo || ''}"`
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `仕訳帳_${this.filterYear}${String(this.filterMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${list.length}件の仕訳をCSV出力しました`);
  },

  // マネーフォワード・CSV仕訳インポート モーダル表示
  showMFImportModal() {
    let modal = document.getElementById('mfImportModal');
    if (!modal) {
      const div = document.createElement('div');
      div.id = 'mfImportModalContainer';
      div.innerHTML = `
        <div id="mfImportModal" class="modal" style="display:none">
          <div class="modal-overlay" onclick="Accounting.closeMFImportModal()"></div>
          <div class="modal-content" style="max-width: 650px;">
            <div class="modal-header">
              <h2>🧡 マネーフォワード・CSV仕訳取込</h2>
              <button class="modal-close" onclick="Accounting.closeMFImportModal()">✕</button>
            </div>
            <div style="padding:16px 0;">
              <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:12px;">
                マネーフォワードの仕訳CSVまたは汎用形式CSVを選択してください。自動的にフォーマットを認識して取込対象を表示します。
              </p>
              <div style="border:2px dashed var(--border-color); border-radius:8px; padding:20px; text-align:center; background:rgba(245,158,11,0.05); margin-bottom:16px;">
                <input type="file" id="mfCsvFileInput" accept=".csv" onchange="Accounting.handleCSVFileSelect(event)" style="display:none">
                <button class="btn btn-secondary" onclick="document.getElementById('mfCsvFileInput').click()">📁 CSVファイルを選択</button>
                <div id="mfCsvFileName" style="font-size:0.85rem; color:var(--text-color); margin-top:8px; font-weight:bold;"></div>
              </div>
              <div id="mfImportPreviewArea" style="display:none;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span id="mfImportStats" style="font-size:0.85rem; font-weight:bold; color:var(--accent-gold);"></span>
                  <span id="mfSkipStats" style="font-size:0.8rem; color:var(--text-muted);"></span>
                </div>
                <div class="table-container" style="max-height: 250px; overflow-y: auto;">
                  <table class="data-table" style="font-size:0.8rem;">
                    <thead>
                      <tr>
                        <th>日付</th>
                        <th>借方</th>
                        <th>貸方</th>
                        <th>金額</th>
                        <th>摘要</th>
                      </tr>
                    </thead>
                    <tbody id="mfImportPreviewBody"></tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" onclick="Accounting.closeMFImportModal()">キャンセル</button>
              <button type="button" class="btn btn-primary" id="mfImportSubmitBtn" style="display:none; background:var(--accent-gold); border-color:var(--accent-gold);" onclick="Accounting.executeImport()">📥 取込を実行</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      modal = document.getElementById('mfImportModal');
    }
    this.pendingImportJournals = [];
    document.getElementById('mfCsvFileInput').value = '';
    document.getElementById('mfCsvFileName').textContent = '';
    document.getElementById('mfImportPreviewArea').style.display = 'none';
    document.getElementById('mfImportSubmitBtn').style.display = 'none';
    modal.style.display = 'flex';
  },

  closeMFImportModal() {
    const modal = document.getElementById('mfImportModal');
    if (modal) modal.style.display = 'none';
    this.pendingImportJournals = [];
  },

  handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('mfCsvFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target.result;
      let text = '';
      
      // まず UTF-8 (strict) でデコード試行
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        text = utf8Decoder.decode(buffer);
      } catch (err) {
        // Shift-JIS (CP932) の場合
        const sjisDecoder = new TextDecoder('shift-jis');
        text = sjisDecoder.decode(buffer);
      }

      // ヘッダーキーワード確認 (取引/日付/借方/金額)
      if (!text.includes('取引') && !text.includes('日付') && !text.includes('借方') && !text.includes('金額')) {
        try {
          const sjisDecoder = new TextDecoder('shift-jis');
          text = sjisDecoder.decode(buffer);
        } catch (e2) {}
      }

      this.parseAndPreviewCSV(text);
    };
    reader.readAsArrayBuffer(file);
  },

  parseCSVLines(text) {
    const lines = [];
    let curLine = [];
    let curCell = '';
    let inQuotes = false;
    
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const nextCh = text[i + 1];

      if (inQuotes) {
        if (ch === '"') {
          if (nextCh === '"') {
            curCell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          curCell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          curLine.push(curCell.trim());
          curCell = '';
        } else if (ch === '\r' || ch === '\n') {
          if (ch === '\r' && nextCh === '\n') i++;
          curLine.push(curCell.trim());
          if (curLine.some(c => c.length > 0)) {
            lines.push(curLine);
          }
          curLine = [];
          curCell = '';
        } else {
          curCell += ch;
        }
      }
    }
    if (curCell || curLine.length > 0) {
      curLine.push(curCell.trim());
      if (curLine.some(c => c.length > 0)) lines.push(curLine);
    }
    return lines;
  },

  parseAndPreviewCSV(csvText) {
    const rows = this.parseCSVLines(csvText);
    if (rows.length < 2) {
      App.showToast('CSVに有効なデータが含まれていません');
      return;
    }

    const header = rows[0].map(h => h.replace(/^"+|"+$/g, '').trim());

    let colNo = header.findIndex(h => h.includes('取引No') || h.includes('仕訳No') || h.includes('No'));
    let colDate = header.findIndex(h => h.includes('取引日') || h.includes('日付'));
    let colDebit = header.findIndex(h => h.includes('借方勘定科目') || h.includes('借方科目') || h === '借方');
    let colDebitAmt = header.findIndex(h => h.includes('借方金額') || h === '金額');
    let colCredit = header.findIndex(h => h.includes('貸方勘定科目') || h.includes('貸方科目') || h === '貸方');
    let colCreditAmt = header.findIndex(h => h.includes('貸方金額'));
    let colDesc = header.findIndex(h => h.includes('摘要') || h.includes('内容') || h.includes('品名'));
    let colMemo = header.findIndex(h => h.includes('メモ') || h.includes('仕訳メモ'));

    if (colDate === -1) colDate = 0;
    if (colDebit === -1) colDebit = 1;
    if (colCredit === -1) colCredit = 2;
    if (colDebitAmt === -1) colDebitAmt = 3;
    if (colDesc === -1) colDesc = 4;

    const existingJournals = this.getJournals();
    const newJournals = [];
    let skipCount = 0;

    let lastTxNo = null;
    let lastDebit = '未分類';
    let lastCredit = '未分類';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= Math.max(colDate, colDebitAmt)) continue;

      const txNo = colNo !== -1 ? row[colNo] : '';
      let rawDate = row[colDate] || '';
      rawDate = rawDate.replace(/\//g, '-').trim();
      const dateParts = rawDate.split('-');
      if (dateParts.length === 3) {
        const y = dateParts[0].padStart(4, '20');
        const m = dateParts[1].padStart(2, '0');
        const d = dateParts[2].padStart(2, '0');
        rawDate = `${y}-${m}-${d}`;
      }

      if (!rawDate || rawDate.length < 8) continue;

      let debit = row[colDebit] || '';
      let credit = row[colCredit] || '';

      // マネーフォワード等の複合仕訳（同一取引No）における勘定科目の継承補完
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

      let amountStr = row[colDebitAmt] || (colCreditAmt !== -1 ? row[colCreditAmt] : '0');
      amountStr = amountStr.replace(/[^0-9.]/g, '');
      const amount = Number(amountStr) || 0;
      if (amount <= 0) continue;

      const desc = row[colDesc] || '';
      const memo = colMemo !== -1 ? row[colMemo] : '';
      
      let fullDesc = desc;
      if (memo) {
        fullDesc = desc ? `${desc} (${memo})` : memo;
      }

      const isDup = existingJournals.some(j =>
        j.date === rawDate && j.debit === debit && j.credit === credit && j.amount === amount && (j.description || '') === fullDesc
      );

      if (isDup) {
        skipCount++;
        continue;
      }

      newJournals.push({
        id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '_' + i,
        date: rawDate,
        debit: debit,
        credit: credit,
        amount: amount,
        description: fullDesc,
        auto: false,
        createdAt: new Date().toISOString()
      });
    }

    this.pendingImportJournals = newJournals;

    const tbody = document.getElementById('mfImportPreviewBody');
    tbody.innerHTML = newJournals.slice(0, 10).map(j => `
      <tr>
        <td>${j.date}</td>
        <td>${j.debit}</td>
        <td>${j.credit}</td>
        <td style="text-align:right;">¥${j.amount.toLocaleString()}</td>
        <td>${j.description || '—'}</td>
      </tr>
    `).join('');

    if (newJournals.length > 10) {
      tbody.innerHTML += `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">…他 ${newJournals.length - 10} 件</td></tr>`;
    }

    document.getElementById('mfImportStats').textContent = `取込対象: ${newJournals.length} 件`;
    document.getElementById('mfSkipStats').textContent = skipCount > 0 ? `(重複によりスキップ: ${skipCount}件)` : '';
    document.getElementById('mfImportPreviewArea').style.display = 'block';
    document.getElementById('mfImportSubmitBtn').style.display = newJournals.length > 0 ? 'inline-block' : 'none';
  },

  executeImport() {
    if (!this.pendingImportJournals || this.pendingImportJournals.length === 0) return;
    const journals = this.getJournals();
    const updated = [...journals, ...this.pendingImportJournals];
    this.saveJournals(updated);
    const count = this.pendingImportJournals.length;
    this.closeMFImportModal();
    App.refreshView();
    App.showToast(`マネーフォワード/CSVから ${count} 件の仕訳を取り込みました！`);
  },

  setTrialBalancePeriod(period) {
    this.trialBalancePeriod = period;
    App.refreshView();
  },

  setActiveTab(tab) {
    this.activeTab = tab;
    App.refreshView();
  },

  renderTrialBalance() {
    const journals = this.getJournals();
    const filtered = journals.filter(j => {
      if (!j.date || !j.date.startsWith(String(this.filterYear))) return false;
      const m = parseInt(j.date.substring(5, 7), 10);
      if (isNaN(m)) return false;
      if (this.trialBalancePeriod === 'cumulative') {
        return m <= this.filterMonth;
      } else {
        return m === this.filterMonth;
      }
    });

    const accounts = this.getAllAccounts();
    const totals = {};
    accounts.forEach(a => {
      totals[a] = { debit: 0, credit: 0, debitBalance: 0, creditBalance: 0 };
    });

    filtered.forEach(j => {
      if (totals[j.debit]) {
        totals[j.debit].debit += j.amount;
      }
      if (totals[j.credit]) {
        totals[j.credit].credit += j.amount;
      }
    });

    accounts.forEach(a => {
      const t = totals[a];
      if (this.ACCOUNTS.asset.includes(a) || this.ACCOUNTS.expense.includes(a)) {
        const bal = t.debit - t.credit;
        if (bal >= 0) {
          t.debitBalance = bal;
          t.creditBalance = 0;
        } else {
          t.debitBalance = 0;
          t.creditBalance = -bal;
        }
      } else {
        const bal = t.credit - t.debit;
        if (bal >= 0) {
          t.creditBalance = bal;
          t.debitBalance = 0;
        } else {
          t.creditBalance = 0;
          t.debitBalance = -bal;
        }
      }
    });

    const categories = [
      { name: '資産の部', list: this.ACCOUNTS.asset },
      { name: '負債の部', list: this.ACCOUNTS.liability },
      { name: '収益の部', list: this.ACCOUNTS.income },
      { name: '費用の部', list: this.ACCOUNTS.expense }
    ];

    let grandDebit = 0;
    let grandCredit = 0;
    let grandDebitBal = 0;
    let grandCreditBal = 0;

    let rowsHtml = '';
    categories.forEach(cat => {
      const activeAccts = cat.list.filter(a => {
        const t = totals[a];
        return t.debit > 0 || t.credit > 0;
      });

      if (activeAccts.length > 0) {
        rowsHtml += `<tr style="background:rgba(255,255,255,0.02); font-weight:600;"><td colspan="5" style="color:var(--accent-gold);">${cat.name}</td></tr>`;
        activeAccts.forEach(a => {
          const t = totals[a];
          grandDebit += t.debit;
          grandCredit += t.credit;
          grandDebitBal += t.debitBalance;
          grandCreditBal += t.creditBalance;

          rowsHtml += `
            <tr>
              <td class="amount-cell" style="color:var(--text-secondary); text-align:right;">${t.debitBalance > 0 ? '¥' + t.debitBalance.toLocaleString() : '—'}</td>
              <td class="amount-cell" style="color:var(--text-muted); text-align:right;">${t.debit > 0 ? '¥' + t.debit.toLocaleString() : '—'}</td>
              <td style="font-weight:600; text-align:center; color:var(--text-primary);">${a}</td>
              <td class="amount-cell" style="color:var(--text-muted); text-align:right;">${t.credit > 0 ? '¥' + t.credit.toLocaleString() : '—'}</td>
              <td class="amount-cell" style="color:var(--text-secondary); text-align:right;">${t.creditBalance > 0 ? '¥' + t.creditBalance.toLocaleString() : '—'}</td>
            </tr>
          `;
        });
      }
    });

    if (rowsHtml === '') {
      rowsHtml = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:24px;">この期間の仕訳データはありません</td></tr>`;
    }

    const checkBalanced = (grandDebit === grandCredit && grandDebitBal === grandCreditBal);
    const balanceAlertHtml = checkBalanced 
      ? `<div style="font-size:0.78rem; color:#2dd4a8; font-weight:600; text-align:right; margin-bottom: 8px;">✅ 貸借整合確認済 (一致しています)</div>`
      : `<div style="font-size:0.78rem; color:var(--accent-red); font-weight:700; text-align:right; margin-bottom: 8px;">⚠️ 警告: 貸借不一致が発生しています。仕訳を確認してください。</div>`;

    return `
      <div class="trial-balance-section" style="margin-top: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <div class="sim-form-group" style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-small ${this.trialBalancePeriod === 'cumulative' ? 'btn-primary' : 'btn-secondary'}" onclick="Accounting.setTrialBalancePeriod('cumulative')">年初からの累計</button>
            <button class="btn btn-small ${this.trialBalancePeriod === 'monthly' ? 'btn-primary' : 'btn-secondary'}" onclick="Accounting.setTrialBalancePeriod('monthly')">当月のみ</button>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-small" onclick="Accounting.printTrialBalance()">🖨️ 試算表を印刷</button>
            <button class="btn btn-secondary btn-small" onclick="Accounting.exportTrialBalanceCSV()">📥 CSV出力</button>
          </div>
        </div>

        ${balanceAlertHtml}

        <div class="acc-table-wrap">
          <table class="acc-table" style="font-size:0.85rem;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03)">
                <th style="text-align:right; width:22%;">借方残高</th>
                <th style="text-align:right; width:22%;">借方合計</th>
                <th style="text-align:center; width:12%;">勘定科目</th>
                <th style="text-align:right; width:22%;">貸方合計</th>
                <th style="text-align:right; width:22%;">貸方残高</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr style="background:rgba(255,255,255,0.02); font-weight:700; border-top: 2px solid var(--border-color);">
                <td class="amount-cell" style="text-align:right; color:#2dd4a8;">¥${grandDebitBal.toLocaleString()}</td>
                <td class="amount-cell" style="text-align:right;">¥${grandDebit.toLocaleString()}</td>
                <td style="text-align:center; color:var(--text-primary);">合計</td>
                <td class="amount-cell" style="text-align:right;">¥${grandCredit.toLocaleString()}</td>
                <td class="amount-cell" style="text-align:right; color:#2dd4a8;">¥${grandCreditBal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  exportTrialBalanceCSV() {
    const journals = this.getJournals();
    const filtered = journals.filter(j => {
      if (!j.date || !j.date.startsWith(String(this.filterYear))) return false;
      const m = parseInt(j.date.substring(5, 7), 10);
      if (isNaN(m)) return false;
      if (this.trialBalancePeriod === 'cumulative') {
        return m <= this.filterMonth;
      } else {
        return m === this.filterMonth;
      }
    });

    const accounts = this.getAllAccounts();
    const totals = {};
    accounts.forEach(a => {
      totals[a] = { debit: 0, credit: 0, debitBalance: 0, creditBalance: 0 };
    });

    filtered.forEach(j => {
      if (totals[j.debit]) totals[j.debit].debit += j.amount;
      if (totals[j.credit]) totals[j.credit].credit += j.amount;
    });

    accounts.forEach(a => {
      const t = totals[a];
      if (this.ACCOUNTS.asset.includes(a) || this.ACCOUNTS.expense.includes(a)) {
        const bal = t.debit - t.credit;
        if (bal >= 0) {
          t.debitBalance = bal;
          t.creditBalance = 0;
        } else {
          t.debitBalance = 0;
          t.creditBalance = -bal;
        }
      } else {
        const bal = t.credit - t.debit;
        if (bal >= 0) {
          t.creditBalance = bal;
          t.debitBalance = 0;
        } else {
          t.creditBalance = 0;
          t.debitBalance = -bal;
        }
      }
    });

    const rows = [['借方残高', '借方合計', '勘定科目', '貸方合計', '貸方残高']];
    let grandDebit = 0, grandCredit = 0, grandDebitBal = 0, grandCreditBal = 0;

    const categories = [
      { name: '【資産の部】', list: this.ACCOUNTS.asset },
      { name: '【負債の部】', list: this.ACCOUNTS.liability },
      { name: '【収益の部】', list: this.ACCOUNTS.income },
      { name: '【費用の部】', list: this.ACCOUNTS.expense }
    ];

    categories.forEach(cat => {
      const activeAccts = cat.list.filter(a => totals[a].debit > 0 || totals[a].credit > 0);
      if (activeAccts.length > 0) {
        rows.push([cat.name, '', '', '', '']);
        activeAccts.forEach(a => {
          const t = totals[a];
          grandDebit += t.debit;
          grandCredit += t.credit;
          grandDebitBal += t.debitBalance;
          grandCreditBal += t.creditBalance;
          rows.push([
            t.debitBalance > 0 ? t.debitBalance : 0,
            t.debit > 0 ? t.debit : 0,
            a,
            t.credit > 0 ? t.credit : 0,
            t.creditBalance > 0 ? t.creditBalance : 0
          ]);
        });
      }
    });

    rows.push(['合計', '', '', '', '']);
    rows.push([grandDebitBal, grandDebit, '合計', grandCredit, grandCreditBal]);

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodLabel = this.trialBalancePeriod === 'cumulative' ? `年初累計_${this.filterMonth}月まで` : `${this.filterMonth}月単月`;
    a.download = `合計残高試算表_${this.filterYear}年_${periodLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📥 試算表をCSV出力しました`);
  },

  printTrialBalance() {
    const journals = this.getJournals();
    const filtered = journals.filter(j => {
      if (!j.date || !j.date.startsWith(String(this.filterYear))) return false;
      const m = parseInt(j.date.substring(5, 7), 10);
      if (isNaN(m)) return false;
      if (this.trialBalancePeriod === 'cumulative') {
        return m <= this.filterMonth;
      } else {
        return m === this.filterMonth;
      }
    });

    const accounts = this.getAllAccounts();
    const totals = {};
    accounts.forEach(a => {
      totals[a] = { debit: 0, credit: 0, debitBalance: 0, creditBalance: 0 };
    });

    filtered.forEach(j => {
      if (totals[j.debit]) totals[j.debit].debit += j.amount;
      if (totals[j.credit]) totals[j.credit].credit += j.amount;
    });

    accounts.forEach(a => {
      const t = totals[a];
      if (this.ACCOUNTS.asset.includes(a) || this.ACCOUNTS.expense.includes(a)) {
        const bal = t.debit - t.credit;
        if (bal >= 0) {
          t.debitBalance = bal;
          t.creditBalance = 0;
        } else {
          t.debitBalance = 0;
          t.creditBalance = -bal;
        }
      } else {
        const bal = t.credit - t.debit;
        if (bal >= 0) {
          t.creditBalance = bal;
          t.debitBalance = 0;
        } else {
          t.creditBalance = 0;
          t.debitBalance = -bal;
        }
      }
    });

    const categories = [
      { name: '資産の部', list: this.ACCOUNTS.asset },
      { name: '負債の部', list: this.ACCOUNTS.liability },
      { name: '収益の部', list: this.ACCOUNTS.income },
      { name: '費用の部', list: this.ACCOUNTS.expense }
    ];

    let grandDebit = 0, grandCredit = 0, grandDebitBal = 0, grandCreditBal = 0;
    let rowsHtml = '';

    categories.forEach(cat => {
      const activeAccts = cat.list.filter(a => totals[a].debit > 0 || totals[a].credit > 0);
      if (activeAccts.length > 0) {
        rowsHtml += `<tr style="background:#f3f4f6; font-weight:bold;"><td colspan="5">${cat.name}</td></tr>`;
        activeAccts.forEach(a => {
          const t = totals[a];
          grandDebit += t.debit;
          grandCredit += t.credit;
          grandDebitBal += t.debitBalance;
          grandCreditBal += t.creditBalance;
          rowsHtml += `
            <tr>
              <td style="text-align:right;">${t.debitBalance > 0 ? '¥' + t.debitBalance.toLocaleString() : '—'}</td>
              <td style="text-align:right; color:#666;">${t.debit > 0 ? '¥' + t.debit.toLocaleString() : '—'}</td>
              <td style="text-align:center; font-weight:bold;">${a}</td>
              <td style="text-align:right; color:#666;">${t.credit > 0 ? '¥' + t.credit.toLocaleString() : '—'}</td>
              <td style="text-align:right;">${t.creditBalance > 0 ? '¥' + t.creditBalance.toLocaleString() : '—'}</td>
            </tr>
          `;
        });
      }
    });

    const periodLabel = this.trialBalancePeriod === 'cumulative' ? `1月1日 〜 ${this.filterMonth}月31日（累計）` : `${this.filterMonth}月1日 〜 ${this.filterMonth}月31日（単月）`;

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>合計残高試算表_${this.filterYear}年_${this.filterMonth}月</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans JP',sans-serif; color:#1a1a2e; background:#fff; padding:32px; max-width:850px; margin:0 auto; font-size:12px; }
  @media print {
    body { padding:16px; }
    .no-print { display:none !important; }
    @page { margin:15mm; size:A4; }
  }
  .print-bar { display:flex; gap:10px; margin-bottom:24px; justify-content:flex-end; }
  .print-bar button { padding:8px 20px; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:600; }
  .btn-print { background:#3b82f6; color:#fff; }
  .btn-close { background:#e5e7eb; color:#374151; }
  .report-header { text-align:center; border-bottom:3px solid #1a1a2e; padding-bottom:16px; margin-bottom:24px; }
  .report-title { font-size:22px; font-weight:700; letter-spacing:4px; margin-bottom:4px; }
  .report-period { font-size:13px; color:#555; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th { background:#1a1a2e; color:#fff; padding:10px; text-align:center; font-size:11px; font-weight:bold; }
  td { padding:8px 10px; border-bottom:1px solid #e5e7eb; font-size:11px; }
  .grand-total { font-weight:bold; background:#e5e7eb; border-top:2px solid #1a1a2e; }
  .footer { text-align:center; margin-top:32px; font-size:10px; color:#999; border-top:1px solid #e5e7eb; padding-top:12px; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>

  <div class="report-header">
    <div class="report-title">合 計 残 高 試 算 表</div>
    <div class="report-period">年度：${this.filterYear}年 ｜ 期間：${periodLabel}</div>
    <div style="font-size:10px; color:#666; margin-top:4px; text-align:right;">出力日: ${new Date().toLocaleDateString('ja-JP')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align:right; width:22%;">借方残高</th>
        <th style="text-align:right; width:22%;">借方合計</th>
        <th style="text-align:center; width:12%;">勘定科目</th>
        <th style="text-align:right; width:22%;">貸方合計</th>
        <th style="text-align:right; width:22%;">貸方残高</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="grand-total">
        <td style="text-align:right;">¥${grandDebitBal.toLocaleString()}</td>
        <td style="text-align:right;">¥${grandDebit.toLocaleString()}</td>
        <td style="text-align:center;">合計</td>
        <td style="text-align:right;">¥${grandCredit.toLocaleString()}</td>
        <td style="text-align:right;">¥${grandCreditBal.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    行政書士法人Felis ｜ 会計管理モジュール自動生成試算表
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },
};
