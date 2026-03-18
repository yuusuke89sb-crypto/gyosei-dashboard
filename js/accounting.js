/**
 * 会計・仕訳帳モジュール（シンプル版）
 */
const Accounting = {
  filterYear: new Date().getFullYear(),
  filterMonth: new Date().getMonth() + 1,
  editingId: null,

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
      '事務用品費',
      '家賃地代',
      '水道光熱費',
      '接待交際費',
      '広告宣伝費',
      '支払手数料',
      '租税公課',
      '研修費',
      '新聞図書費',
      '保険料',
      '減価償却費',
      '雑費',
    ],
    asset: [
      '現金', '普通預金', '売掛金', '事業主貸',
    ],
    liability: [
      '未払金', '事業主借',
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

    // 月ナビ
    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push(`<option value="${m}" ${this.filterMonth === m ? 'selected' : ''}>${m}月</option>`);
    }

    const debitOptions = this.getAllAccounts().map(a => `<option value="${a}">${a}</option>`).join('');
    const creditOptions = debitOptions;
    const today = new Date().toISOString().slice(0, 10);

    return `
      <div class="accounting-page">
        <div class="page-header">
          <h1>💹 帳簿</h1>
          <button class="btn btn-primary" onclick="Accounting.showAddModal()">＋ 仕訳追加</button>
        </div>

        <div class="acc-controls">
          <div class="acc-period">
            <select class="filter-select" onchange="Accounting.filterYear=Number(this.value); App.refreshView()">
              ${[this.filterYear - 1, this.filterYear, this.filterYear + 1].map(y =>
      `<option value="${y}" ${y === this.filterYear ? 'selected' : ''}>${y}年</option>`
    ).join('')}
            </select>
            <select class="filter-select" onchange="Accounting.filterMonth=Number(this.value); App.refreshView()">
              ${months.join('')}
            </select>
          </div>
          <button class="btn btn-secondary btn-small" onclick="Accounting.exportCSV()">📥 CSV出力</button>
        </div>

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

        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>借方</th>
                <th>貸方</th>
                <th>金額</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
        ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">この月の仕訳はありません</td></tr>'
        : filtered.map(j => `
                  <tr onclick="Accounting.showEditModal('${j.id}')" style="cursor:pointer">
                    <td>${j.date}</td>
                    <td>${j.debit}</td>
                    <td>${j.credit}</td>
                    <td class="amount-cell">¥${j.amount.toLocaleString()}</td>
                    <td>${j.auto ? '<span class="auto-badge">自動</span> ' : ''}${j.description || ''}</td>
                  </tr>
                `).join('')
      }
            </tbody>
          </table>
        </div>
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
      document.getElementById('jf_date').value = new Date().toISOString().slice(0, 10);
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

  exportCSV() {
    const journals = this.getJournals();
    const ym = `${this.filterYear}-${String(this.filterMonth).padStart(2, '0')}`;
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    if (filtered.length === 0) {
      App.showToast('この月の仕訳がありません');
      return;
    }

    const rows = [['日付', '借方', '貸方', '金額', '摘要']];
    filtered.forEach(j => {
      rows.push([j.date, j.debit, j.credit, j.amount, j.description || '']);
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `仕訳帳_${this.filterYear}年${this.filterMonth}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${filtered.length}件の仕訳をCSV出力しました`);
  },
};
