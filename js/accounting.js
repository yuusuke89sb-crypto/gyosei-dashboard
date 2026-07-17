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
    const today = new Date().toISOString().slice(0, 10);

    return `
      <div class="accounting-page">
        <div class="page-header">
          <h1>💹 帳簿</h1>
          <button class="btn btn-primary" onclick="Accounting.showAddModal()">＋ 仕訳追加</button>
        </div>

        <!-- タブコントロール -->
        <div class="acc-tabs" style="display:flex; gap:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px; margin-bottom:16px;">
          <button class="btn btn-ghost" style="font-weight:700; font-size:0.95rem; border-radius:var(--radius-sm); ${this.activeTab === 'journals' ? 'background:rgba(245,158,11,0.15); color:var(--accent-gold); border-bottom:2px solid var(--accent-gold);' : ''}" onclick="Accounting.setActiveTab('journals')">📋 仕訳帳</button>
          <button class="btn btn-ghost" style="font-weight:700; font-size:0.95rem; border-radius:var(--radius-sm); ${this.activeTab === 'trial_balance' ? 'background:rgba(245,158,11,0.15); color:var(--accent-gold); border-bottom:2px solid var(--accent-gold);' : ''}" onclick="Accounting.setActiveTab('trial_balance')">📊 合計残高試算表</button>
        </div>

        <div class="acc-controls">
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
          ${this.activeTab === 'journals' ? `<button class="btn btn-secondary btn-small" onclick="Accounting.exportCSV()">📥 CSV出力</button>` : ''}
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
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${filtered.length}件の仕訳をCSV出力しました`);
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
