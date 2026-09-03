/**
 * 拡張機能モジュール
 * - 入金管理
 * - 対応履歴
 * - グローバル検索
 * - 案件テンプレート
 * - 書類チェックリスト
 * - 期限リマインダー
 * - 年間収支レポート
 * - 紹介元分析
 */

// ============================================================
// 1. 入金管理
// ============================================================
const Payments = {
  STORAGE_KEY: 'gyosei_payments',

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  // 請求書発行時に請求レコードを作成
  createFromInvoice(invoiceNo, clientId, amount, dueDate, taxRate) {
    const payments = this.getAll();
    payments.push({
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      invoiceNo,
      clientId,
      amount,
      dueDate,
      taxRate: taxRate !== undefined ? Number(taxRate) : 10,
      status: 'unpaid', // unpaid, paid
      paidAt: null,
      paidAmount: 0,
      method: '',
      createdAt: new Date().toISOString(),
    });
    this.save(payments);
  },

  // 請求書番号から入金レコードを削除（請求取消時）
  deleteByInvoiceNo(invoiceNo) {
    if (!invoiceNo) return;
    const payments = this.getAll().filter(x => x.invoiceNo !== invoiceNo);
    this.save(payments);
  },

  markPaid(id, method) {
    const payments = this.getAll();
    const p = payments.find(x => x.id === id);
    if (!p) return;
    p.status = 'paid';
    p.paidAt = new Date().toISOString();
    p.paidAmount = p.amount;
    p.method = method || '振込';
    this.save(payments);

    // 入金仕訳を自動生成
    const client = Store.getClient(p.clientId);
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    journals.push({
      id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: Store.getLocalDateStr(),
      debit: '普通預金',
      credit: '売掛金',
      amount: p.amount,
      description: `入金 ${p.invoiceNo}${client ? ' / ' + client.name : ''}`,
      auto: true,
      paymentId: p.id,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));
  },

  getByClient(clientId) {
    return this.getAll().filter(p => p.clientId == clientId);
  },

  getUnpaid() {
    return this.getAll().filter(p => p.status === 'unpaid');
  },

  showPaymentList() {
    const payments = this.getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'paymentModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('paymentModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>💴 入金管理</h2>
          <button class="modal-close" onclick="document.getElementById('paymentModal').remove()">✕</button>
        </div>
        <div class="payment-tabs">
          <button class="tab-btn active" onclick="Payments.filterTab(this,'all')">全て (${payments.length})</button>
          <button class="tab-btn" onclick="Payments.filterTab(this,'unpaid')">未入金 (${payments.filter(p => p.status === 'unpaid').length})</button>
          <button class="tab-btn" onclick="Payments.filterTab(this,'paid')">入金済 (${payments.filter(p => p.status === 'paid').length})</button>
        </div>
        <div class="mini-case-list" id="paymentListBody">
          ${payments.length === 0 ? '<p class="empty-message">請求データがありません</p>' :
        payments.map(p => {
          const client = Store.getClient(p.clientId);
          const overdue = p.status === 'unpaid' && p.dueDate && new Date(p.dueDate) < new Date();
          return `
              <div class="mini-case-item payment-item" data-status="${p.status}">
                <span class="status-badge ${p.status === 'paid' ? 'status-done' : overdue ? 'status-overdue' : 'status-received'}">
                  ${p.status === 'paid' ? '✅ 入金済' : overdue ? '⚠️ 期限超過' : '🔵 未入金'}
                </span>
                <span class="mini-case-title">${p.invoiceNo}</span>
                <span style="color:var(--text-secondary)">${client ? client.name : ''}</span>
                <span class="mini-case-fee">¥${p.amount.toLocaleString()}</span>
                ${p.status === 'unpaid' ? `<button class="btn btn-small btn-primary" onclick="event.stopPropagation(); Payments.confirmPaid('${p.id}')">入金</button>` : `
                   <div style="display:flex;align-items:center;gap:6px">
                     <span style="font-size:0.75rem;color:var(--text-muted)">${p.paidAt ? p.paidAt.slice(0, 10) : ''}</span>
                     <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); Invoice.showReceipt('${p.invoiceNo}')" style="padding:2px 6px;font-size:0.7rem">🧾 領収書</button>
                   </div>
                 `}
              </div>`;
        }).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  filterTab(btn, filter) {
    btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.payment-item').forEach(el => {
      if (filter === 'all') el.style.display = '';
      else el.style.display = el.dataset.status === filter ? '' : 'none';
    });
  },

  confirmPaid(id) {
    if (confirm('入金を確認しますか？（普通預金への振込として記録します）')) {
      this.markPaid(id, '振込');
      document.getElementById('paymentModal').remove();
      this.showPaymentList();
      App.showToast('入金を記録しました');
    }
  },
};

// ============================================================
// 2. 対応履歴 (Activity Log)
// ============================================================
const ActivityLog = {
  STORAGE_KEY: 'gyosei_activity_log',

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  add(type, refId, text) {
    const logs = this.getAll();
    logs.unshift({
      id: 'log_' + Date.now(),
      type, // 'client' or 'case'
      refId,
      text,
      timestamp: new Date().toISOString(),
    });
    this.save(logs);
  },

  getByRef(type, refId) {
    return this.getAll().filter(l => l.type === type && l.refId == refId);
  },

  renderWidget(type, refId) {
    const logs = this.getByRef(type, refId);
    return `
      <div class="activity-log-widget">
        <h4>📝 対応履歴</h4>
        <div class="activity-add-row">
          <input type="text" id="activityInput_${refId}" placeholder="例：電話にて書類の確認をした" style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();ActivityLog.addFromWidget('${type}','${refId}');}">
          <button type="button" class="btn btn-small btn-primary" onclick="ActivityLog.addFromWidget('${type}','${refId}')">追加</button>
        </div>
        <div class="activity-list" id="activityList_${refId}">
          ${logs.length === 0 ? '<p class="empty-message" style="font-size:0.8rem;padding:8px 0">履歴なし</p>' :
        logs.slice(0, 10).map(l => `
            <div class="activity-item">
              <span class="activity-time">${l.timestamp.slice(0, 16).replace('T', ' ')}</span>
              <span class="activity-text">${l.text}</span>
            </div>
          `).join('')}
          ${logs.length > 10 ? `<p style="font-size:0.75rem;color:var(--text-muted)">... 他${logs.length - 10}件</p>` : ''}
        </div>
      </div>
    `;
  },

  addFromWidget(type, refId) {
    const input = document.getElementById(`activityInput_${refId}`);
    const text = input.value.trim();
    if (!text) return;
    this.add(type, refId, text);
    input.value = '';
    // リフレッシュ
    const listEl = document.getElementById(`activityList_${refId}`);
    if (listEl) {
      const logs = this.getByRef(type, refId);
      listEl.innerHTML = logs.slice(0, 10).map(l => `
        <div class="activity-item">
          <span class="activity-time">${l.timestamp.slice(0, 16).replace('T', ' ')}</span>
          <span class="activity-text">${l.text}</span>
        </div>
      `).join('');
    }
    App.showToast('履歴を追加しました');
  },
};

// ============================================================
// 3. グローバル検索
// ============================================================
const GlobalSearch = {
  _lastQuery: '',

  show() {
    const existing = document.getElementById('globalSearchModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'globalSearchModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('globalSearchModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔍 検索</h2>
          <button class="modal-close" onclick="document.getElementById('globalSearchModal').remove()">✕</button>
        </div>
        <input type="text" id="globalSearchInput" class="search-input" placeholder="顧客名・案件名で検索..." autofocus
          value="${this._lastQuery || ''}"
          oninput="GlobalSearch.onSearch(this.value)" style="width:100%;margin-bottom:12px">
        <div id="globalSearchResults" class="mini-case-list" style="max-height:400px;overflow-y:auto">
          <p class="empty-message">キーワードを入力してください</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (this._lastQuery) {
      this.onSearch(this._lastQuery);
    }
    setTimeout(() => {
      const inp = document.getElementById('globalSearchInput');
      if (inp) {
        inp.focus();
        inp.select();
      }
    }, 50);
  },

  onSearch(q) {
    this._lastQuery = q;
    q = q.trim().toLowerCase();
    const results = document.getElementById('globalSearchResults');
    if (!q) { results.innerHTML = '<p class="empty-message">キーワードを入力してください</p>'; return; }

    let html = '';
    const clients = Store.getClients().filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.nameKana || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.companyName || '').toLowerCase().includes(q)
    );
    const cases = Store.getCases().filter(c => {
      const client = Store.getClient(c.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      return (
        (c.title || '').toLowerCase().includes(q) ||
        (c.carName || '').toLowerCase().includes(q) ||
        (c.applicantName || '').toLowerCase().includes(q) ||
        (c.orderNo || '').toLowerCase().includes(q) ||
        (c.carNumber || '').toLowerCase().includes(q) ||
        (c.oldCarNumber || '').toLowerCase().includes(q) ||
        (c.vin || '').toLowerCase().includes(q) ||
        (c.carAddress || '').toLowerCase().includes(q) ||
        (c.parkingAddress || '').toLowerCase().includes(q) ||
        (typeof c.memo === 'string' && c.memo.toLowerCase().includes(q)) ||
        clientName.includes(q)
      );
    });

    const curPage = (typeof App !== 'undefined' && App.currentPage) ? App.currentPage : 'dashboard';

    if (clients.length > 0) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding:8px 0">👥 顧客</div>';
      clients.forEach(c => {
        html += `<div class="mini-case-item" onclick="document.getElementById('globalSearchModal').remove(); App.navigate('clients'); setTimeout(()=>Clients.showDetail('${c.id}'),100)" style="cursor:pointer">
          <span class="mini-case-title">${c.name}</span>
          <span style="color:var(--text-secondary);font-size:0.8rem">${c.phone || ''} ${c.email || ''}</span>
        </div>`;
      });
    }
    if (cases.length > 0) {
      html += '<div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);padding:8px 0">📋 案件</div>';
      cases.forEach(c => {
        const client = Store.getClient(c.clientId);
        const applicantInfo = c.carName ? ` ｜ 👤 申請者: <strong>${c.carName}</strong>` : '';
        const carInfo = (c.carNumber || c.oldCarNumber || c.vin) ? ` ｜ 🚗 ${c.carNumber || c.oldCarNumber || c.vin}` : '';
        html += `<div class="mini-case-item" onclick="document.getElementById('globalSearchModal').remove(); Cases.showEditModal('${c.id}', '${curPage}')" style="cursor:pointer; display:flex; align-items:center;">
          <div style="flex:1;">
            <div class="mini-case-title" style="margin-bottom:2px;">${c.title} ${c.orderNo ? `<span style="font-weight:normal;font-size:0.8rem;color:#6b7280;margin-left:4px">(${c.orderNo})</span>` : ''}</div>
            <div style="color:var(--text-secondary);font-size:0.8rem">${client ? client.name : '—'}${applicantInfo}${carInfo}</div>
          </div>
          ${c.driveFolderUrl ? `<button class="btn btn-secondary" style="font-size:0.75rem; padding:4px 8px; border-radius:4px;" onclick="event.stopPropagation(); window.open('${c.driveFolderUrl}', '_blank')">📁 Drive</button>` : ''}
        </div>`;
      });
    }
    if (!html) html = '<p class="empty-message">見つかりません</p>';
    results.innerHTML = html;
  },
};

// ============================================================
// 4. 案件テンプレート
// ============================================================
const CaseTemplates = {
  TEMPLATES: {
    garage_oss: { fee: 3500 },
    garage_paper: { fee: 3500 },
    seal: { fee: 5000 },
    car_reg_standard: { fee: 5500 },
    car_reg_light: { fee: 5500 },
  },

  _lastAppliedCategory: null,

  applyTemplate(category) {
    const tmpl = this.TEMPLATES[category];
    if (!tmpl) return;
    const feeEl = document.getElementById('csf_fee');

    // 報酬額が空または他テンプレート由来なら初期値をセット
    const currentFee = feeEl ? feeEl.value : '';
    const isTemplateFee = !currentFee || Object.values(this.TEMPLATES).some(t => String(t.fee) === currentFee);

    if (feeEl && isTemplateFee && tmpl.fee) feeEl.value = tmpl.fee;

    this._lastAppliedCategory = category;
  },

  // 9/1以降の受付分で報酬額が未入力の案件にテンプレート額を自動補完
  backfillSeptemberFees() {
    if (typeof Store === 'undefined' || typeof Store.getCases !== 'function') return;
    const cases = Store.getCases();
    let updatedCount = 0;

    cases.forEach(c => {
      const regDate = c.registeredAt || (c.createdAt ? c.createdAt.slice(0, 10) : '');
      // 9月1日以降の受付分
      if (regDate >= '2026-09-01') {
        const currentFee = (c.fee !== undefined && c.fee !== null && c.fee !== '') ? Number(c.fee) : 0;
        if (currentFee === 0) {
          let fee = 0;
          if (this.TEMPLATES[c.category] && this.TEMPLATES[c.category].fee) {
            fee = this.TEMPLATES[c.category].fee;
          } else {
            const title = (c.title || '') + ' ' + (c.subCategory || '');
            if (title.includes('車庫')) fee = 3500;
            else if (title.includes('封印')) fee = 5000;
            else if (title.includes('軽')) fee = 5500;
            else if (title.includes('登録') || title.includes('名変') || title.includes('移転')) fee = 5500;
            else fee = 3500; // デフォルト車庫
          }

          if (fee > 0) {
            Store.updateCase(c.id, { fee: fee });
            updatedCount++;
          }
        }
      }
    });

    if (updatedCount > 0) {
      console.log(`[CaseTemplates] 9/1以降の未入力案件 ${updatedCount}件 にテンプレート報酬額を自動補完しました。`);
      setTimeout(() => {
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`💡 9/1以降の未入力案件（${updatedCount}件）にテンプレート報酬額を自動反映しました`);
        }
      }, 1000);
    }
  },
};

// ============================================================
// 4-B. 相続案件 期限自動計算アラート
// ============================================================
const InheritanceDeadlines = {
  // 法定期限の定義
  DEADLINES: [
    { key: 'souzokuHouki',      label: '相続放棄',         months: 3,  years: 0, severity: 'critical', note: '相続を知った日から3ヶ月' },
    { key: 'junKakuteiShinkoku', label: '準確定申告',       months: 4,  years: 0, severity: 'warning',  note: '死亡日から4ヶ月（該当者のみ）' },
    { key: 'souzokuZei',        label: '相続税申告・納付', months: 10, years: 0, severity: 'critical', note: '死亡日から10ヶ月' },
    { key: 'iryubun',           label: '遺留分侵害額請求', months: 0,  years: 1, severity: 'warning',  note: '知った日から1年（該当者のみ）' },
    { key: 'toukiGimu',         label: '相続登記義務化',   months: 0,  years: 3, severity: 'important', note: '知った日から3年（2024年4月〜）' },
  ],

  // 死亡日から各期限日を計算
  calculateDeadlines(deathDateStr) {
    if (!deathDateStr) return [];
    const d = new Date(deathDateStr);
    if (isNaN(d.getTime())) return [];
    return this.DEADLINES.map(def => {
      const dl = new Date(d);
      if (def.months) dl.setMonth(dl.getMonth() + def.months);
      if (def.years) dl.setFullYear(dl.getFullYear() + def.years);
      const today = new Date(); today.setHours(0,0,0,0);
      const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
      return { ...def, date: Store.getLocalDateStr(dl), diffDays };
    });
  },

  // 案件モーダル内に期限一覧を表示
  renderDeadlinePanel(deathDateStr) {
    const deadlines = this.calculateDeadlines(deathDateStr);
    if (deadlines.length === 0) return '';

    return `
      <div class="checklist-widget" style="margin-top:12px">
        <h4 style="margin:0 0 8px;font-size:0.9rem">⏰ 相続期限アラート</h4>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">
          被相続人死亡日: ${deathDateStr}
        </div>
        ${deadlines.map(dl => {
          const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
          let statusClass = '';
          let statusLabel = '';
          if (dl.diffDays < 0) {
            statusClass = 'color:#ef4444;font-weight:700';
            statusLabel = `${Math.abs(dl.diffDays)}日超過`;
          } else if (dl.diffDays <= 30) {
            statusClass = 'color:#f59e0b;font-weight:700';
            statusLabel = `あと${dl.diffDays}日`;
          } else {
            statusClass = 'color:var(--text-secondary)';
            statusLabel = `あと${dl.diffDays}日`;
          }
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:0.82rem">
              <span>${icon}</span>
              <span style="flex:1">${dl.label}</span>
              <span style="min-width:80px">${dl.date}</span>
              <span style="${statusClass};min-width:70px;text-align:right">${statusLabel}</span>
            </div>`;
        }).join('')}
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">
          ※ 相続放棄・遺留分・登記義務は「知った日」が起算日（ここでは死亡日で仮計算）
        </div>
      </div>`;
  },

  // ダッシュボード用ウィジェット: すべての相続案件の期限を一覧表示
  renderDashboardWidget() {
    const cases = Store.getCases().filter(c => c.category === 'inheritance' && c.status !== 'done' && c.deathDate);
    if (cases.length === 0) return '';

    let alertItems = [];
    cases.forEach(c => {
      const deadlines = this.calculateDeadlines(c.deathDate);
      deadlines.forEach(dl => {
        if (dl.diffDays <= 90) { // 90日以内の期限のみ表示
          alertItems.push({ ...dl, caseTitle: c.title, caseId: c.id });
        }
      });
    });
    alertItems.sort((a, b) => a.diffDays - b.diffDays);

    if (alertItems.length === 0) return '';

    return `
      <div class="dashboard-section">
        <h2 class="section-title">⏰ 相続期限アラート</h2>
        <div class="urgent-list">
          ${alertItems.map(dl => {
            const icon = dl.severity === 'critical' ? '🔴' : dl.severity === 'important' ? '🟠' : '🟡';
            let urgencyClass = dl.diffDays < 0 ? 'overdue' : dl.diffDays <= 30 ? 'warning' : '';
            let urgencyLabel = dl.diffDays < 0 ? `${Math.abs(dl.diffDays)}日超過` : `あと${dl.diffDays}日`;
            return `
              <div class="urgent-item ${urgencyClass}" onclick="App.navigate('cases'); setTimeout(()=>Cases.showEditModal('${dl.caseId}'),100)">
                <div class="urgent-item-header">
                  <span class="urgent-badge badge-${urgencyClass || 'info'}">${icon} ${urgencyLabel}</span>
                  <span class="category-tag category-inheritance">📜 相続</span>
                </div>
                <div class="urgent-item-title">${dl.label}</div>
                <div class="urgent-item-client">${dl.caseTitle} ｜ 期限: ${dl.date}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  },
};

// ============================================================
// 5. 書類チェックリスト（案件メモ内の □/■ をトグル）
// ============================================================
const DocChecklist = {
  toggle(caseId, lineIndex) {
    const c = Store.getCase(caseId);
    if (!c || !c.memo) return;
    const lines = c.memo.split('\n');
    if (lines[lineIndex]) {
      if (lines[lineIndex].startsWith('□')) {
        lines[lineIndex] = '■' + lines[lineIndex].slice(1);
      } else if (lines[lineIndex].startsWith('■')) {
        lines[lineIndex] = '□' + lines[lineIndex].slice(1);
      }
      Store.updateCase(caseId, { memo: lines.join('\n') });
    }
    // モーダル内のチェックリストだけを再描画（モーダルを閉じない）
    this.refreshInPlace(caseId);
  },

  // チェックリストウィジェットだけをその場で更新
  refreshInPlace(caseId) {
    const wrapper = document.querySelector('.checklist-widget');
    if (!wrapper) return;
    // 新しいチェックリストHTMLを生成して差し替え
    const newHtml = this.renderChecklist(caseId);
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    const newWidget = temp.querySelector('.checklist-widget');
    if (newWidget) {
      wrapper.replaceWith(newWidget);
    }
    // メモ欄も同期（モーダル内のtextareaがあれば更新）
    const memoEl = document.getElementById('csf_memo');
    const c = Store.getCase(caseId);
    if (memoEl && c) {
      memoEl.value = c.memo || '';
    }
  },

  renderChecklist(caseId) {
    const c = Store.getCase(caseId);
    if (!c || !c.memo) return '';
    const lines = c.memo.split('\n');
    const checkItems = lines.filter(l => l.startsWith('□') || l.startsWith('■'));
    if (checkItems.length === 0) return '';
    const done = lines.filter(l => l.startsWith('■')).length;
    const total = checkItems.length;
    const pct = Math.round((done / total) * 100);
    return `
      <div class="checklist-widget">
        <div class="checklist-progress">
          <div class="checklist-bar"><div class="checklist-fill" style="width:${pct}%"></div></div>
          <span class="checklist-count">${done}/${total}</span>
        </div>
        <div class="checklist-items">
          ${lines.map((l, i) => {
      if (l.startsWith('□')) return `<div class="checklist-item" onclick="DocChecklist.toggle('${caseId}',${i})"><span class="check-box">☐</span>${l.slice(1).trim()}</div>`;
      if (l.startsWith('■')) return `<div class="checklist-item done" onclick="DocChecklist.toggle('${caseId}',${i})"><span class="check-box">☑</span>${l.slice(1).trim()}</div>`;
      return '';
    }).join('')}
        </div>
      </div>
    `;
  },
};

// ============================================================
// 6. 期限リマインダー通知
// ============================================================
const Reminders = {
  init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
    this.check();
    // 1時間ごとにチェック
    setInterval(() => this.check(), 60 * 60 * 1000);
  },

  check() {
    if (Notification.permission !== 'granted') return;
    const cases = Store.getCases();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 3);

    const lastNotified = localStorage.getItem('gyosei_last_reminder') || '';
    const todayStr = Store.getLocalDateStr(today);
    if (lastNotified === todayStr) return; // 1日1回
    localStorage.setItem('gyosei_last_reminder', todayStr);

    const urgent = cases.filter(c => {
      if (c.status === 'done' || !c.deadline) return false;
      const dl = new Date(c.deadline);
      return dl <= dayAfter;
    });

    if (urgent.length > 0) {
      new Notification('⚖️ 行政書士法人Felis', {
        body: `期限間近の案件が${urgent.length}件あります`,
        icon: '⚖️',
      });
    }
  },
};

// ============================================================
// 7. 年間収支レポート
// ============================================================
const AnnualReport = {
  show(year) {
    year = year || new Date().getFullYear();
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE = ['旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'];

    const monthlyData = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`;
      const monthJ = journals.filter(j => j.date && j.date.startsWith(ym));
      const income = monthJ.filter(j => INCOME.includes(j.credit)).reduce((s, j) => s + (j.amount || 0), 0);
      const expense = monthJ.filter(j => EXPENSE.includes(j.debit)).reduce((s, j) => s + (j.amount || 0), 0);
      monthlyData.push({ month: m, income, expense, profit: income - expense });
    }

    const totalIncome = monthlyData.reduce((s, d) => s + d.income, 0);
    const totalExpense = monthlyData.reduce((s, d) => s + d.expense, 0);
    const totalProfit = totalIncome - totalExpense;

    // 経費科目別集計
    const expByAccount = {};
    journals.filter(j => j.date && j.date.startsWith(String(year)) && EXPENSE.includes(j.debit))
      .forEach(j => { expByAccount[j.debit] = (expByAccount[j.debit] || 0) + j.amount; });

    const existing = document.getElementById('annualReportModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'annualReportModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('annualReportModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>📊 ${year}年 年間収支レポート</h2>
          <button class="modal-close" onclick="document.getElementById('annualReportModal').remove()">✕</button>
        </div>
        <div class="acc-controls" style="margin-bottom:16px">
          <div class="acc-period">
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('annualReportModal').remove(); AnnualReport.show(${year - 1})">◀ ${year - 1}年</button>
            <span style="font-weight:700;padding:0 12px">${year}年</span>
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('annualReportModal').remove(); AnnualReport.show(${year + 1})">${year + 1}年 ▶</button>
          </div>
        </div>
        <div class="acc-summary" style="margin-bottom:16px">
          <div class="acc-summary-card acc-income"><div class="acc-summary-label">年間収入</div><div class="acc-summary-amount">¥${totalIncome.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-expense"><div class="acc-summary-label">年間支出</div><div class="acc-summary-amount">¥${totalExpense.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-profit ${totalProfit >= 0 ? 'positive' : 'negative'}"><div class="acc-summary-label">年間利益</div><div class="acc-summary-amount">¥${totalProfit.toLocaleString()}</div></div>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>月</th><th>収入</th><th>支出</th><th>利益</th></tr></thead>
            <tbody>
              ${monthlyData.map(d => `
                <tr>
                  <td>${d.month}月</td>
                  <td class="amount-cell" style="color:var(--accent-green)">¥${d.income.toLocaleString()}</td>
                  <td class="amount-cell" style="color:var(--accent-orange)">¥${d.expense.toLocaleString()}</td>
                  <td class="amount-cell" style="color:${d.profit >= 0 ? 'var(--accent-blue)' : '#ef4444'}">¥${d.profit.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr style="font-weight:700;border-top:2px solid var(--border-color)">
                <td>合計</td>
                <td class="amount-cell" style="color:var(--accent-green)">¥${totalIncome.toLocaleString()}</td>
                <td class="amount-cell" style="color:var(--accent-orange)">¥${totalExpense.toLocaleString()}</td>
                <td class="amount-cell" style="color:${totalProfit >= 0 ? 'var(--accent-blue)' : '#ef4444'}">¥${totalProfit.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${Object.keys(expByAccount).length > 0 ? `
        <h3 style="margin:20px 0 8px;font-size:0.95rem">📋 経費科目別内訳</h3>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>勘定科目</th><th>金額</th><th>構成比</th></tr></thead>
            <tbody>
              ${Object.entries(expByAccount).sort((a, b) => b[1] - a[1]).map(([acct, amt]) => `
                <tr>
                  <td>${acct}</td>
                  <td class="amount-cell">¥${amt.toLocaleString()}</td>
                  <td class="amount-cell">${totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    `;
    document.body.appendChild(modal);
  },
};

// ============================================================
// 8. 紹介元分析
// ============================================================
const ReferralAnalysis = {
  show() {
    const clients = Store.getClients();
    const referralMap = {};
    clients.forEach(c => {
      const ref = c.referral || '直接・不明';
      referralMap[ref] = (referralMap[ref] || 0) + 1;
    });
    const sorted = Object.entries(referralMap).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...sorted.map(s => s[1]), 1);

    // 紹介元ごとの売上
    const refRevenue = {};
    clients.forEach(c => {
      const ref = c.referral || '直接・不明';
      const cases = Store.getCasesByClient(c.id);
      const revenue = cases.filter(cs => cs.status === 'done' && cs.fee).reduce((s, cs) => s + Number(cs.fee || 0), 0);
      refRevenue[ref] = (refRevenue[ref] || 0) + revenue;
    });

    const existing = document.getElementById('referralModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'referralModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('referralModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🤝 紹介元分析</h2>
          <button class="modal-close" onclick="document.getElementById('referralModal').remove()">✕</button>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead><tr><th>紹介元</th><th>顧客数</th><th>売上合計</th></tr></thead>
            <tbody>
              ${sorted.map(([ref, cnt]) => `
                <tr>
                  <td>${ref}</td>
                  <td class="amount-cell">${cnt}件</td>
                  <td class="amount-cell">¥${(refRevenue[ref] || 0).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <h3 style="margin:20px 0 8px;font-size:0.95rem">📊 紹介元比率</h3>
        <div class="chart-bars">
          ${sorted.map(([ref, cnt]) => `
            <div class="chart-bar-row">
              <span class="chart-label">${ref}</span>
              <div class="chart-bar-track">
                <div class="chart-bar-fill" style="width:${(cnt / max) * 100}%;background:var(--accent-gold)"></div>
              </div>
              <span class="chart-value">${cnt}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
};

// ============================================================
// 9. 定型仕訳（毎月の固定経費をワンクリック一括登録）
//    固定費ツール（koteihi_data）と連携
// ============================================================
const RecurringExpenses = {
  STORAGE_KEY: 'gyosei_recurring',

  // 固定費ツールの勘定科目 → ダッシュボードの勘定科目マッピング
  CATEGORY_MAP: {
    'office': { debit: '家賃地代', note: '事務所関連' },
    'insurance': { debit: '保険料', note: '保険・年金' },
    'vehicle': { debit: '旅費交通費', note: '車両関連' },
    'business': { debit: '租税公課', note: '事業経費' },
    'living': { debit: '雑費', note: '生活費' },
    'tax': { debit: '租税公課', note: '税金・社会保険' },
    'other': { debit: '雑費', note: 'その他' },
  },

  // 固定費ツールの項目名 → 最適な勘定科目
  ITEM_DEBIT_MAP: {
    '家賃': '家賃地代',
    '電気代': '水道光熱費',
    'ガス代': '水道光熱費',
    '水道代': '水道光熱費',
    'インターネット': '通信費',
    '固定電話': '通信費',
    'FAX': '通信費',
    '国民健康保険': '保険料',
    '国民年金': '保険料',
    '生命保険': '保険料',
    '賠償責任保険': '保険料',
    '車両ローン': '雑費',
    '自動車保険': '保険料',
    '駐車場': '家賃地代',
    'ガソリン': '旅費交通費',
    '行政書士会費': '租税公課',
    '政治連盟': '租税公課',
    '会計ソフト': '支払手数料',
    'HP': '広告宣伝費',
    'ドメイン': '広告宣伝費',
    '名刺': '広告宣伝費',
    'チラシ': '広告宣伝費',
    '事務用品': '事務用品費',
    '消耗品': '消耗品費',
    '食費': '雑費',
    '日用品': '雑費',
    '携帯電話': '通信費',
    'サブスク': '雑費',
    '住民税': '租税公課',
    '所得税': '租税公課',
    '個人事業税': '租税公課',
    '消費税': '租税公課',
    '交際費': '接待交際費',
    '書籍': '新聞図書費',
    '研修': '研修費',
    '予備費': '雑費',
  },

  getAll() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
  },
  save(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  defaults() {
    return [
      { id: 'r1', debit: '家賃地代', credit: '普通預金', amount: 0, description: '事務所家賃', enabled: true },
      { id: 'r2', debit: '通信費', credit: '普通預金', amount: 0, description: '電話・インターネット', enabled: true },
      { id: 'r3', debit: '水道光熱費', credit: '普通預金', amount: 0, description: '電気・水道', enabled: true },
      { id: 'r4', debit: '保険料', credit: '普通預金', amount: 0, description: '行政書士賠償責任保険', enabled: true },
      { id: 'r5', debit: '租税公課', credit: '普通預金', amount: 0, description: '行政書士会会費', enabled: true },
      { id: 'r6', debit: '支払手数料', credit: '普通預金', amount: 0, description: '銀行手数料等', enabled: true },
    ];
  },

  // 固定費ツールからデータを読み込み
  importFromKoteihi() {
    const raw = localStorage.getItem('koteihi_data');
    if (!raw) {
      App.showToast('固定費ツールのデータが見つかりません。同じブラウザで固定費ツールを開いてデータを入力してください。');
      return [];
    }

    try {
      const koteihiData = JSON.parse(raw);
      const items = [];
      let idx = 0;

      Object.keys(koteihiData).forEach(catId => {
        const catItems = koteihiData[catId];
        if (!Array.isArray(catItems)) return;

        catItems.forEach(item => {
          const amount = parseInt(String(item.amount).replace(/[¥,、\s]/g, ''), 10) || 0;
          if (amount <= 0) return; // 0円の項目はスキップ

          // 項目名から最適な勘定科目を判定
          let debit = (this.CATEGORY_MAP[catId] || { debit: '雑費' }).debit;
          for (const [keyword, account] of Object.entries(this.ITEM_DEBIT_MAP)) {
            if (item.name && item.name.includes(keyword)) {
              debit = account;
              break;
            }
          }

          items.push({
            id: 'k_' + catId + '_' + idx++,
            debit,
            credit: '普通預金',
            amount,
            description: item.name + (item.note ? ` (${item.note})` : ''),
            enabled: true,
            fromKoteihi: true,
          });
        });
      });

      return items;
    } catch (e) {
      App.showToast('固定費データの読み込みに失敗しました');
      return [];
    }
  },

  // 固定費ツールからインポートして定型仕訳に反映
  syncFromKoteihi() {
    const imported = this.importFromKoteihi();
    if (imported.length === 0) return;

    // 既存のkoteihi由来のアイテムを削除し、手動追加分は保持
    let existing = this.getAll();
    const manual = existing.filter(item => !item.fromKoteihi);

    const merged = [...imported, ...manual];
    this.save(merged);

    // モーダルを再表示
    const modal = document.getElementById('recurringModal');
    if (modal) modal.remove();
    this.show();
    App.showToast(`固定費ツールから ${imported.length} 件のデータを取り込みました`);
  },

  // 固定費ツールにデータがあるか確認
  hasKoteihiData() {
    const raw = localStorage.getItem('koteihi_data');
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      return Object.values(data).some(items =>
        Array.isArray(items) && items.some(item => {
          const amt = parseInt(String(item.amount).replace(/[¥,、\s]/g, ''), 10) || 0;
          return amt > 0;
        })
      );
    } catch (e) {
      return false;
    }
  },

  openKoteihiTool() {
    window.open('../../固定費/index.html', '_blank');
  },

  show() {
    let items = this.getAll();

    // 初回起動時：固定費ツールにデータがあれば自動インポート
    if (items.length === 0) {
      if (this.hasKoteihiData()) {
        items = this.importFromKoteihi();
        if (items.length > 0) {
          this.save(items);
        } else {
          items = this.defaults();
          this.save(items);
        }
      } else {
        items = this.defaults();
        this.save(items);
      }
    }

    const existing = document.getElementById('recurringModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'recurringModal';
    modal.style.display = 'flex';

    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 合計金額を計算
    const totalAmount = items.filter(item => item.enabled).reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0);

    const hasKoteihi = this.hasKoteihiData();

    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('recurringModal').remove()"></div>
      <div class="modal-content modal-large">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:12px;">
            <h2 style="margin:0;">🔄 定型仕訳</h2>
            <button class="btn btn-secondary" onclick="RecurringExpenses.openKoteihiTool()" style="font-size:0.8rem; padding:4px 10px; border:1px solid rgba(245,158,11,0.4); color:var(--accent-gold); background:rgba(245,158,11,0.1); cursor:pointer;" title="固定費計算＆ライフプランニングツールを開きます">
              ⚙️ 固定費ツールを開く ↗
            </button>
          </div>
          <button class="modal-close" onclick="document.getElementById('recurringModal').remove()">✕</button>
        </div>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">
          毎月発生する固定経費を一括登録できます。金額を設定して「一括登録」ボタンを押してください。
        </p>
        ${hasKoteihi ? `
        <div style="margin-bottom:12px;padding:10px 14px;background:rgba(45,212,168,0.1);border:1px solid rgba(45,212,168,0.3);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="font-size:0.82rem;color:#2dd4a8">💰 固定費ツールのデータを検出しました</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-ghost" style="font-size:0.8rem;padding:4px 10px;border:1px solid rgba(45,212,168,0.4);color:#2dd4a8" onclick="RecurringExpenses.openKoteihiTool()">⚙️ 固定費ツールを開く ↗</button>
            <button class="btn btn-secondary" style="font-size:0.8rem;padding:4px 12px" onclick="RecurringExpenses.syncFromKoteihi()">📥 最新データを取り込む</button>
          </div>
        </div>
        ` : `
        <div style="margin-bottom:12px;padding:10px 14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span style="font-size:0.82rem;color:var(--text-secondary)">💡 固定費ツールで毎月の家賃・光熱費・サブスク等の項目をシミュレーション編集できます</span>
          <button class="btn btn-ghost" style="font-size:0.8rem;padding:4px 10px;border:1px solid rgba(59,130,246,0.4);color:#3b82f6" onclick="RecurringExpenses.openKoteihiTool()">⚙️ 固定費ツールを開く ↗</button>
        </div>
        `}
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:8px;justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="font-size:0.85rem;font-weight:600">記帳月:</label>
            <input type="month" id="recurringMonth" value="${defaultYM}" 
              style="padding:6px 10px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit">
          </div>
          <div style="font-size:0.9rem;font-weight:700;color:var(--primary)">
            合計: ¥${totalAmount.toLocaleString()}/月
          </div>
        </div>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr><th>✓</th><th>借方（経費）</th><th>摘要</th><th>金額</th></tr>
            </thead>
            <tbody>
              ${items.map((item, i) => `
                <tr${item.fromKoteihi ? ' style="background:rgba(45,212,168,0.03)"' : ''}>
                  <td><input type="checkbox" id="rec_chk_${i}" ${item.enabled ? 'checked' : ''}></td>
                  <td style="font-size:0.82rem">${item.debit}${item.fromKoteihi ? ' <span style="font-size:0.7rem;color:#2dd4a8">●</span>' : ''}</td>
                  <td><input type="text" id="rec_desc_${i}" value="${item.description}" 
                    style="padding:4px 8px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:0.82rem;width:100%;font-family:inherit"></td>
                  <td><input type="number" id="rec_amt_${i}" value="${item.amount}" min="0" 
                    style="padding:4px 8px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);font-size:0.82rem;width:100px;font-family:inherit;text-align:right"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="form-actions" style="margin-top:16px">
          <button class="btn btn-secondary" onclick="RecurringExpenses.addRow()">＋ 行追加</button>
          <button class="btn btn-primary" onclick="RecurringExpenses.registerAll()">📝 一括登録</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  addRow() {
    const items = this.getAll();
    items.push({
      id: 'r_' + Date.now(),
      debit: '雑費',
      credit: '普通預金',
      amount: 0,
      description: '',
      enabled: true,
    });
    this.save(items);
    document.getElementById('recurringModal').remove();
    this.show();
  },

  registerAll() {
    const items = this.getAll();
    const ym = document.getElementById('recurringMonth').value; // e.g. "2026-07"
    const date = ym + '-28'; // 月末付近
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    let count = 0;

    items.forEach((item, i) => {
      const chk = document.getElementById(`rec_chk_${i}`);
      const amt = document.getElementById(`rec_amt_${i}`);
      const desc = document.getElementById(`rec_desc_${i}`);
      if (!chk || !chk.checked) return;
      const amount = parseInt(amt.value) || 0;
      if (amount <= 0) return;

      // 設定を保存
      item.amount = amount;
      item.description = desc.value;
      item.enabled = true;

      // 重複防止
      const exists = journals.some(j => j.auto && j.recurringId === item.id && j.date && j.date.startsWith(ym));
      if (exists) return;

      journals.push({
        id: 'j_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        date,
        debit: item.debit,
        credit: item.credit,
        amount,
        description: item.description,
        auto: true,
        recurringId: item.id,
        createdAt: new Date().toISOString(),
      });
      count++;
    });

    this.save(items);
    localStorage.setItem('gyosei_journals', JSON.stringify(journals));
    document.getElementById('recurringModal').remove();
    App.showToast(`${count}件の定型仕訳を登録しました`);
    App.refreshView();
  },
};

// ============================================================
// 10. 年間目標トラッカー
// ============================================================
const GoalTracker = {
  STORAGE_KEY: 'gyosei_goals',

  getGoals() {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null') || {
      annualRevenue: 3000000,
      annualCases: 50,
      monthlyCases: 5,
    };
  },
  saveGoals(goals) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(goals));
  },

  renderWidget() {
    const goals = this.getGoals();
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    // 年間実績
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const yearlyIncome = journals
      .filter(j => j.date && j.date.startsWith(String(year)) && INCOME.includes(j.credit))
      .reduce((s, j) => s + (j.amount || 0), 0);

    const cases = Store.getCases();
    const yearlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(String(year))).length;
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const monthlyCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(ym)).length;

    const revPct = goals.annualRevenue > 0 ? Math.min(100, Math.round(yearlyIncome / goals.annualRevenue * 100)) : 0;
    const caseYPct = goals.annualCases > 0 ? Math.min(100, Math.round(yearlyCases / goals.annualCases * 100)) : 0;
    const caseMPct = goals.monthlyCases > 0 ? Math.min(100, Math.round(monthlyCases / goals.monthlyCases * 100)) : 0;

    return `
      <div class="goal-tracker">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:0.95rem;margin:0">🎯 年間目標</h3>
          <button class="btn btn-small btn-ghost" onclick="GoalTracker.showSettings()">⚙️</button>
        </div>
        <div class="goal-item">
          <div class="goal-label">💰 年間売上 <span style="float:right">¥${yearlyIncome.toLocaleString()} / ¥${goals.annualRevenue.toLocaleString()}</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${revPct}%;background:${revPct >= 80 ? 'var(--accent-green)' : revPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${revPct}%</div>
        </div>
        <div class="goal-item">
          <div class="goal-label">📋 年間案件数 <span style="float:right">${yearlyCases} / ${goals.annualCases}件</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${caseYPct}%;background:${caseYPct >= 80 ? 'var(--accent-green)' : caseYPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${caseYPct}%</div>
        </div>
        <div class="goal-item">
          <div class="goal-label">📅 今月案件数 <span style="float:right">${monthlyCases} / ${goals.monthlyCases}件</span></div>
          <div class="checklist-bar"><div class="checklist-fill" style="width:${caseMPct}%;background:${caseMPct >= 80 ? 'var(--accent-green)' : caseMPct >= 50 ? 'var(--accent-gold)' : 'var(--accent-orange)'}"></div></div>
          <div style="text-align:right;font-size:0.72rem;color:var(--text-muted)">${caseMPct}%</div>
        </div>
      </div>
    `;
  },

  showSettings() {
    const goals = this.getGoals();
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'goalSettingsModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('goalSettingsModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🎯 目標設定</h2>
          <button class="modal-close" onclick="document.getElementById('goalSettingsModal').remove()">✕</button>
        </div>
        <form onsubmit="event.preventDefault(); GoalTracker.onSave()">
          <div class="form-group">
            <label>年間売上目標（円）</label>
            <input type="number" id="goal_revenue" value="${goals.annualRevenue}" min="0" step="100000">
          </div>
          <div class="form-group">
            <label>年間案件数目標</label>
            <input type="number" id="goal_cases_y" value="${goals.annualCases}" min="0">
          </div>
          <div class="form-group">
            <label>月間案件数目標</label>
            <input type="number" id="goal_cases_m" value="${goals.monthlyCases}" min="0">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('goalSettingsModal').remove()">キャンセル</button>
            <button type="submit" class="btn btn-primary">保存</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  onSave() {
    const goals = {
      annualRevenue: parseInt(document.getElementById('goal_revenue').value) || 0,
      annualCases: parseInt(document.getElementById('goal_cases_y').value) || 0,
      monthlyCases: parseInt(document.getElementById('goal_cases_m').value) || 0,
    };
    this.saveGoals(goals);
    document.getElementById('goalSettingsModal').remove();
    App.refreshView();
    App.showToast('目標を更新しました');
  },
};

// ============================================================
// 11. 月次レポート
// ============================================================
const MonthlyReport = {
  _year: null,
  _month: null,

  show(year, month) {
    const existing = document.getElementById('monthlyReportModal');
    if (existing) existing.remove();

    const now = new Date();
    this._year = year || this._year || now.getFullYear();
    this._month = month || this._month || now.getMonth() + 1;
    const data = this._collectData(this._year, this._month);
    const prevData = this._collectData(
      this._month === 1 ? this._year - 1 : this._year,
      this._month === 1 ? 12 : this._month - 1
    );

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'monthlyReportModal';
    modal.style.display = 'flex';
    modal.innerHTML = this._renderModal(data, prevData);
    document.body.appendChild(modal);
  },

  // データ収集（指定月）
  _collectData(year, month) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const filtered = journals.filter(j => j.date && j.date.startsWith(ym));
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = typeof Accounting !== 'undefined' ? Accounting.ACCOUNTS.expense : [];

    let totalIncome = 0, totalExpense = 0;
    const incomeItems = [], expenseItems = [];
    filtered.forEach(j => {
      if (INCOME.includes(j.credit)) { totalIncome += j.amount || 0; incomeItems.push(j); }
      if (EXPENSE_ACCOUNTS.includes(j.debit)) { totalExpense += j.amount || 0; expenseItems.push(j); }
    });

    const cases = Store.getCases();
    const monthCases = cases.filter(c => c.createdAt && c.createdAt.startsWith(ym));
    const completedCases = cases.filter(c => c.completedAt && c.completedAt.startsWith(ym));
    const activeCases = cases.filter(c => c.status !== 'done');
    const clients = Store.getClients();
    const newClients = clients.filter(c => c.createdAt && c.createdAt.startsWith(ym));

    const payments = JSON.parse(localStorage.getItem('gyosei_payments') || '[]');
    const monthPayments = payments.filter(p => p.paidAt && p.paidAt.startsWith(ym));
    const totalPaid = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const unpaid = payments.filter(p => p.status === 'unpaid');
    const totalUnpaid = unpaid.reduce((s, p) => s + (p.amount || 0), 0);
    // 期限超過の未収金
    const today = Store.getLocalDateStr();
    const overduePayments = unpaid.filter(p => p.dueDate && p.dueDate < today);

    const expenseByAccount = {};
    expenseItems.forEach(j => {
      if (!expenseByAccount[j.debit]) expenseByAccount[j.debit] = 0;
      expenseByAccount[j.debit] += j.amount || 0;
    });

    const CATS = { garage_oss: '車庫証明(OSS)', garage_paper: '車庫証明(一般)', seal: '丁種封印', inheritance: '相続' };
    const catCounts = {}, catRevenue = {};
    completedCases.forEach(c => {
      const label = CATS[c.category] || c.category;
      catCounts[label] = (catCounts[label] || 0) + 1;
      catRevenue[label] = (catRevenue[label] || 0) + Number(c.fee || 0);
    });

    const clientCounts = {};
    monthCases.forEach(c => {
      const client = Store.getClient(c.clientId);
      const cName = client ? (client.companyName || client.name) : '顧客未設定';
      clientCounts[cName] = (clientCounts[cName] || 0) + 1;
    });

    return {
      year, month, ym,
      totalIncome, totalExpense, profit: totalIncome - totalExpense,
      incomeItems, expenseItems, filtered,
      monthCases, completedCases, activeCases,
      newClients, totalPaid, totalUnpaid, unpaid, overduePayments,
      expenseByAccount, catCounts, catRevenue, clientCounts, CATS,
    };
  },

  // 前月比較のバッジ生成
  _diffBadge(current, prev, isReverse) {
    if (prev === 0 && current === 0) return '';
    const diff = current - prev;
    if (diff === 0) return '<span style="font-size:0.7rem;color:var(--text-muted);margin-left:4px">→ 横ばい</span>';
    const pct = prev > 0 ? Math.round(Math.abs(diff) / prev * 100) : '—';
    const isUp = diff > 0;
    const color = isReverse ? (isUp ? '#ff6b6b' : '#2dd4a8') : (isUp ? '#2dd4a8' : '#ff6b6b');
    const arrow = isUp ? '▲' : '▼';
    return `<span style="font-size:0.7rem;color:${color};margin-left:4px">${arrow} ${pct}% (${isUp ? '+' : ''}¥${diff.toLocaleString()})</span>`;
  },

  _diffBadgeCount(current, prev) {
    const diff = current - prev;
    if (diff === 0) return '';
    const color = diff > 0 ? '#2dd4a8' : '#ff6b6b';
    const arrow = diff > 0 ? '▲' : '▼';
    return `<span style="font-size:0.7rem;color:${color};margin-left:4px">${arrow} ${diff > 0 ? '+' : ''}${diff}</span>`;
  },

  _renderModal(d, pd) {
    const y = d.year, m = d.month;
    const prevMonth = m === 1 ? 12 : m - 1;
    const prevYear = m === 1 ? y - 1 : y;
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;

    const expenseEntries = Object.entries(d.expenseByAccount).sort((a, b) => b[1] - a[1]);
    const clientEntries = Object.entries(d.clientCounts).sort((a, b) => b[1] - a[1]);

    // 完了案件の明細テーブル
    let completedDetailHtml = '';
    if (d.completedCases.length > 0) {
      completedDetailHtml = d.completedCases.map(c => {
        const client = Store.getClient(c.clientId);
        const clientName = client ? (client.companyName || client.name) : '—';
        const catLabel = d.CATS[c.category] || c.category;
        const fee = Number(c.fee || 0);
        const advTotal = (c.advances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
        return `<tr>
          <td style="font-size:0.78rem">${c.completedAt ? c.completedAt.slice(0, 10) : '—'}</td>
          <td style="font-size:0.78rem">${c.title}</td>
          <td style="font-size:0.78rem">${clientName}</td>
          <td style="font-size:0.78rem">${catLabel}</td>
          <td style="text-align:right;font-weight:600;font-size:0.78rem">¥${fee.toLocaleString()}</td>
          <td style="text-align:right;font-size:0.78rem;color:var(--text-muted)">${advTotal > 0 ? '¥' + advTotal.toLocaleString() : '—'}</td>
        </tr>`;
      }).join('');
    }

    // 未収金明細
    let unpaidDetailHtml = '';
    if (d.unpaid.length > 0) {
      unpaidDetailHtml = d.unpaid.map(p => {
        const client = Store.getClient(p.clientId);
        const clientName = client ? (client.companyName || client.name) : '—';
        const today = Store.getLocalDateStr();
        const isOverdue = p.dueDate && p.dueDate < today;
        const daysOver = isOverdue ? Math.ceil((new Date(today) - new Date(p.dueDate)) / (1000 * 60 * 60 * 24)) : 0;
        return `<tr style="${isOverdue ? 'background:rgba(255,107,107,0.08)' : ''}">
          <td style="font-size:0.78rem">${p.invoiceNo || '—'}</td>
          <td style="font-size:0.78rem">${clientName}</td>
          <td style="text-align:right;font-weight:600;font-size:0.78rem">¥${(p.amount || 0).toLocaleString()}</td>
          <td style="font-size:0.78rem">${p.dueDate || '—'}</td>
          <td style="font-size:0.78rem;font-weight:600;color:${isOverdue ? '#ff6b6b' : 'var(--text-muted)'}">${isOverdue ? daysOver + '日超過' : '期限内'}</td>
        </tr>`;
      }).join('');
    }

    return `
      <div class="modal-overlay" onclick="document.getElementById('monthlyReportModal').remove()"></div>
      <div class="modal-content modal-large" style="max-width:780px">
        <div class="modal-header" style="flex-wrap:wrap;gap:8px">
          <h2 style="flex:1">📄 ${y}年${m}月 月次レポート</h2>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-ghost btn-small" onclick="MonthlyReport.show(${prevYear},${prevMonth})" title="前月">◀</button>
            <span style="font-size:0.85rem;font-weight:600;min-width:90px;text-align:center">${y}年${m}月</span>
            <button class="btn btn-ghost btn-small" onclick="MonthlyReport.show(${nextYear},${nextMonth})" title="翌月">▶</button>
            <span style="width:1px;height:20px;background:var(--border-color);margin:0 4px"></span>
            <button class="btn btn-secondary btn-small" onclick="MonthlyReport.exportCSV()" title="CSV出力">📥 CSV</button>
            <button class="btn btn-primary btn-small" onclick="MonthlyReport.printReport()" title="印刷用レポート">🖨 印刷</button>
            <button class="modal-close" onclick="document.getElementById('monthlyReportModal').remove()">✕</button>
          </div>
        </div>

        <!-- 比較付き収支サマリー -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:rgba(45,212,168,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">収入</div>
            <div style="font-size:1.3rem;font-weight:700;color:#2dd4a8">¥${d.totalIncome.toLocaleString()}</div>
            <div>${this._diffBadge(d.totalIncome, pd.totalIncome, false)}</div>
          </div>
          <div style="background:rgba(255,107,107,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">支出</div>
            <div style="font-size:1.3rem;font-weight:700;color:#ff6b6b">¥${d.totalExpense.toLocaleString()}</div>
            <div>${this._diffBadge(d.totalExpense, pd.totalExpense, true)}</div>
          </div>
          <div style="background:rgba(108,99,255,0.1);padding:14px;border-radius:8px;text-align:center">
            <div style="font-size:0.75rem;color:var(--text-secondary)">利益</div>
            <div style="font-size:1.3rem;font-weight:700;color:${d.profit >= 0 ? '#2dd4a8' : '#ff6b6b'}">¥${d.profit.toLocaleString()}</div>
            <div>${this._diffBadge(d.profit, pd.profit, false)}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <div>
            <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">📋 案件サマリー</h3>
            <table class="acc-table" style="font-size:0.82rem">
              <tr><td>新規受付</td><td style="text-align:right;font-weight:600">${d.monthCases.length}件 ${this._diffBadgeCount(d.monthCases.length, pd.monthCases.length)}</td></tr>
              <tr><td>完了</td><td style="text-align:right;font-weight:600">${d.completedCases.length}件 ${this._diffBadgeCount(d.completedCases.length, pd.completedCases.length)}</td></tr>
              <tr><td>現在進行中</td><td style="text-align:right;font-weight:600">${d.activeCases.length}件</td></tr>
              <tr><td>新規顧客</td><td style="text-align:right;font-weight:600">${d.newClients.length}名</td></tr>
            </table>
          </div>
          <div>
            <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">💴 入金状況</h3>
            <table class="acc-table" style="font-size:0.82rem">
              <tr><td>今月入金</td><td style="text-align:right;font-weight:600;color:#2dd4a8">¥${d.totalPaid.toLocaleString()}</td></tr>
              <tr><td>未収金合計</td><td style="text-align:right;font-weight:600;color:${d.totalUnpaid > 0 ? '#ff6b6b' : 'inherit'}">¥${d.totalUnpaid.toLocaleString()}</td></tr>
              <tr><td>未収件数</td><td style="text-align:right;font-weight:600">${d.unpaid.length}件</td></tr>
              ${d.overduePayments.length > 0 ? `<tr><td style="color:#ff6b6b">⚠ 期限超過</td><td style="text-align:right;font-weight:700;color:#ff6b6b">${d.overduePayments.length}件</td></tr>` : ''}
            </table>
          </div>
        </div>

        ${d.completedCases.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">📊 カテゴリ別売上</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            ${Object.entries(d.catCounts).map(([label, count]) => `
              <span style="background:var(--bg-input);padding:6px 12px;border-radius:12px;font-size:0.8rem">
                ${label}: ${count}件 / ¥${(d.catRevenue[label] || 0).toLocaleString()}
              </span>
            `).join('')}
          </div>
        </div>
        ` : ''}

        ${d.completedCases.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">✅ 完了案件一覧（${d.completedCases.length}件）</h3>
          <div style="overflow-x:auto">
            <table class="acc-table" style="font-size:0.82rem">
              <thead><tr>
                <th>完了日</th><th>案件名</th><th>顧客</th><th>種別</th><th style="text-align:right">報酬</th><th style="text-align:right">立替金</th>
              </tr></thead>
              <tbody>${completedDetailHtml}</tbody>
              <tfoot><tr style="font-weight:700;border-top:2px solid var(--border-color)">
                <td colspan="4">合計</td>
                <td style="text-align:right">¥${d.completedCases.reduce((s, c) => s + Number(c.fee || 0), 0).toLocaleString()}</td>
                <td style="text-align:right">¥${d.completedCases.reduce((s, c) => s + (c.advances || []).reduce((ss, a) => ss + Number(a.amount || 0), 0), 0).toLocaleString()}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
        ` : ''}

        ${d.unpaid.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">💸 未収金明細（${d.unpaid.length}件）</h3>
          <div style="overflow-x:auto">
            <table class="acc-table" style="font-size:0.82rem">
              <thead><tr>
                <th>請求書No</th><th>顧客</th><th style="text-align:right">金額</th><th>支払期限</th><th>状態</th>
              </tr></thead>
              <tbody>${unpaidDetailHtml}</tbody>
            </table>
          </div>
        </div>
        ` : ''}

        ${clientEntries.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">👥 顧客別の新規案件数</h3>
          <table class="acc-table" style="font-size:0.82rem">
            ${clientEntries.map(([cName, count]) => `
              <tr><td>${cName}</td><td style="text-align:right;font-weight:600">${count}件</td></tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        ${expenseEntries.length > 0 ? `
        <div style="margin-bottom:20px">
          <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">💳 経費内訳</h3>
          <table class="acc-table" style="font-size:0.82rem">
            ${expenseEntries.map(([account, amount]) => `
              <tr>
                <td>${account}</td>
                <td style="text-align:right;font-weight:600">¥${amount.toLocaleString()}</td>
                <td style="text-align:right;color:var(--text-muted);font-size:0.75rem">${d.totalExpense > 0 ? Math.round(amount / d.totalExpense * 100) : 0}%</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}

        <div style="text-align:center;padding:12px;font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--border-color);margin-top:12px">
          レポート生成日: ${new Date().toLocaleDateString('ja-JP')} | 行政書士法人Felis
        </div>
      </div>
    `;
  },

  // ===== CSV出力（税理士向け） =====
  exportCSV() {
    const d = this._collectData(this._year, this._month);
    const rows = [];

    // ヘッダー
    rows.push(['月次レポート', `${d.year}年${d.month}月`]);
    rows.push([]);

    // 収支サマリー
    rows.push(['【収支サマリー】']);
    rows.push(['収入', d.totalIncome]);
    rows.push(['支出', d.totalExpense]);
    rows.push(['利益', d.profit]);
    rows.push([]);

    // 案件サマリー
    rows.push(['【案件サマリー】']);
    rows.push(['新規受付', d.monthCases.length]);
    rows.push(['完了', d.completedCases.length]);
    rows.push(['進行中', d.activeCases.length]);
    rows.push(['新規顧客', d.newClients.length]);
    rows.push([]);

    // 入金状況
    rows.push(['【入金状況】']);
    rows.push(['今月入金額', d.totalPaid]);
    rows.push(['未収金合計', d.totalUnpaid]);
    rows.push(['未収件数', d.unpaid.length]);
    rows.push([]);

    // 完了案件明細
    if (d.completedCases.length > 0) {
      rows.push(['【完了案件明細】']);
      rows.push(['完了日', '案件名', '顧客', '種別', '報酬', '立替金']);
      d.completedCases.forEach(c => {
        const client = Store.getClient(c.clientId);
        const clientName = client ? (client.companyName || client.name) : '';
        const catLabel = d.CATS[c.category] || c.category;
        const advTotal = (c.advances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
        rows.push([
          c.completedAt ? c.completedAt.slice(0, 10) : '',
          c.title, clientName, catLabel, Number(c.fee || 0), advTotal
        ]);
      });
      rows.push([]);
    }

    // 経費内訳
    const expenseEntries = Object.entries(d.expenseByAccount).sort((a, b) => b[1] - a[1]);
    if (expenseEntries.length > 0) {
      rows.push(['【経費内訳】']);
      rows.push(['勘定科目', '金額', '構成比']);
      expenseEntries.forEach(([account, amount]) => {
        rows.push([account, amount, d.totalExpense > 0 ? Math.round(amount / d.totalExpense * 100) + '%' : '0%']);
      });
      rows.push([]);
    }

    // 仕訳明細
    rows.push(['【仕訳明細】']);
    rows.push(['日付', '借方', '貸方', '金額', '摘要']);
    d.filtered.sort((a, b) => a.date.localeCompare(b.date)).forEach(j => {
      rows.push([j.date, j.debit, j.credit, j.amount, j.description || '']);
    });

    // 未収金明細
    if (d.unpaid.length > 0) {
      rows.push([]);
      rows.push(['【未収金明細】']);
      rows.push(['請求書No', '顧客', '金額', '支払期限', '状態']);
      d.unpaid.forEach(p => {
        const client = Store.getClient(p.clientId);
        const clientName = client ? (client.companyName || client.name) : '';
        const today = Store.getLocalDateStr();
        const isOverdue = p.dueDate && p.dueDate < today;
        rows.push([p.invoiceNo || '', clientName, p.amount || 0, p.dueDate || '', isOverdue ? '期限超過' : '期限内']);
      });
    }

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `月次レポート_${d.year}年${d.month}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast(`📥 ${d.year}年${d.month}月の月次レポートをCSV出力しました`);
  },

  // ===== 印刷用レポート（新しいウィンドウで開く） =====
  printReport() {
    const d = this._collectData(this._year, this._month);
    const office = typeof Invoice !== 'undefined' ? Invoice.getOfficeInfo() : { name: '行政書士法人Felis' };
    const CATS = d.CATS;

    const expenseEntries = Object.entries(d.expenseByAccount).sort((a, b) => b[1] - a[1]);

    // 完了案件テーブル行
    const completedRows = d.completedCases.map((c, i) => {
      const client = Store.getClient(c.clientId);
      const clientName = client ? (client.companyName || client.name) : '—';
      const catLabel = CATS[c.category] || c.category;
      const fee = Number(c.fee || 0);
      const advTotal = (c.advances || []).reduce((s, a) => s + Number(a.amount || 0), 0);
      return `<tr>
        <td>${i + 1}</td>
        <td>${c.completedAt ? c.completedAt.slice(0, 10) : '—'}</td>
        <td>${c.title}</td>
        <td>${clientName}</td>
        <td>${catLabel}</td>
        <td style="text-align:right">¥${fee.toLocaleString()}</td>
        <td style="text-align:right">${advTotal > 0 ? '¥' + advTotal.toLocaleString() : '—'}</td>
      </tr>`;
    }).join('');

    const totalFee = d.completedCases.reduce((s, c) => s + Number(c.fee || 0), 0);
    const totalAdv = d.completedCases.reduce((s, c) => s + (c.advances || []).reduce((ss, a) => ss + Number(a.amount || 0), 0), 0);

    // 未収金行
    const unpaidRows = d.unpaid.map(p => {
      const client = Store.getClient(p.clientId);
      const clientName = client ? (client.companyName || client.name) : '—';
      const today = Store.getLocalDateStr();
      const isOverdue = p.dueDate && p.dueDate < today;
      const daysOver = isOverdue ? Math.ceil((new Date(today) - new Date(p.dueDate)) / (1000 * 60 * 60 * 24)) : 0;
      return `<tr ${isOverdue ? 'style="background:#fff5f5"' : ''}>
        <td>${p.invoiceNo || '—'}</td>
        <td>${clientName}</td>
        <td style="text-align:right">¥${(p.amount || 0).toLocaleString()}</td>
        <td>${p.dueDate || '—'}</td>
        <td style="color:${isOverdue ? '#dc2626' : '#16a34a'};font-weight:600">${isOverdue ? daysOver + '日超過' : '期限内'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>月次レポート ${d.year}年${d.month}月</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Noto Sans JP',sans-serif; color:#1a1a2e; background:#fff; padding:32px; max-width:900px; margin:0 auto; font-size:13px; }
  @media print {
    body { padding:16px; }
    .no-print { display:none !important; }
    @page { margin:12mm; size:A4; }
  }
  .print-bar { display:flex; gap:10px; margin-bottom:24px; justify-content:flex-end; }
  .print-bar button { padding:8px 20px; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:600; }
  .btn-print { background:#3b82f6; color:#fff; }
  .btn-close { background:#e5e7eb; color:#374151; }
  .report-header { text-align:center; border-bottom:3px solid #1a1a2e; padding-bottom:16px; margin-bottom:24px; }
  .report-title { font-size:24px; font-weight:700; letter-spacing:6px; margin-bottom:4px; }
  .report-period { font-size:14px; color:#555; }
  .report-office { font-size:11px; color:#888; margin-top:4px; }
  .summary-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; }
  .summary-card { border:1px solid #e5e7eb; border-radius:8px; padding:16px; text-align:center; }
  .summary-card .label { font-size:11px; color:#888; margin-bottom:4px; }
  .summary-card .value { font-size:22px; font-weight:700; }
  .income .value { color:#059669; }
  .expense .value { color:#dc2626; }
  .profit .value { color:#2563eb; }
  .section { margin-bottom:20px; }
  .section-title { font-size:14px; font-weight:700; border-bottom:2px solid #1a1a2e; padding-bottom:4px; margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th { background:#1a1a2e; color:#fff; padding:8px 10px; text-align:left; font-size:11px; font-weight:600; }
  td { padding:7px 10px; border-bottom:1px solid #e5e7eb; font-size:12px; }
  tr:nth-child(even) { background:#f9fafb; }
  tfoot td { border-top:2px solid #1a1a2e; font-weight:700; font-size:13px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px; }
  .mini-table td { padding:5px 8px; }
  .mini-table td:last-child { text-align:right; font-weight:600; }
  .footer { text-align:center; margin-top:32px; font-size:11px; color:#999; border-top:1px solid #e5e7eb; padding-top:12px; }
  .cat-badges { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
  .cat-badge { background:#f3f4f6; padding:4px 12px; border-radius:12px; font-size:12px; }
</style>
</head>
<body>
  <div class="print-bar no-print">
    <button class="btn-print" onclick="window.print()">🖨 印刷 / PDF保存</button>
    <button class="btn-close" onclick="window.close()">✕ 閉じる</button>
  </div>

  <div class="report-header">
    <div class="report-title">月 次 報 告 書</div>
    <div class="report-period">${d.year}年${d.month}月</div>
    <div class="report-office">${office.name}${office.representative ? ' / ' + office.representative : ''}</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card income"><div class="label">売上高</div><div class="value">¥${d.totalIncome.toLocaleString()}</div></div>
    <div class="summary-card expense"><div class="label">経費合計</div><div class="value">¥${d.totalExpense.toLocaleString()}</div></div>
    <div class="summary-card profit"><div class="label">差引利益</div><div class="value">¥${d.profit.toLocaleString()}</div></div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">📋 案件実績</div>
      <table class="mini-table">
        <tr><td>新規受付</td><td>${d.monthCases.length} 件</td></tr>
        <tr><td>完了</td><td>${d.completedCases.length} 件</td></tr>
        <tr><td>進行中</td><td>${d.activeCases.length} 件</td></tr>
        <tr><td>新規顧客</td><td>${d.newClients.length} 名</td></tr>
      </table>
    </div>
    <div class="section">
      <div class="section-title">💴 入金状況</div>
      <table class="mini-table">
        <tr><td>今月入金額</td><td style="color:#059669">¥${d.totalPaid.toLocaleString()}</td></tr>
        <tr><td>未収金合計</td><td style="color:${d.totalUnpaid > 0 ? '#dc2626' : 'inherit'}">¥${d.totalUnpaid.toLocaleString()}</td></tr>
        <tr><td>未収件数</td><td>${d.unpaid.length} 件</td></tr>
        ${d.overduePayments.length > 0 ? `<tr><td style="color:#dc2626">⚠ 期限超過</td><td style="color:#dc2626;font-weight:700">${d.overduePayments.length} 件</td></tr>` : ''}
      </table>
    </div>
  </div>

  ${d.completedCases.length > 0 ? `
  <div class="section">
    <div class="section-title">✅ 完了案件明細 (${d.completedCases.length}件 / 報酬合計 ¥${totalFee.toLocaleString()})</div>
    <div class="cat-badges">
      ${Object.entries(d.catCounts).map(([label, count]) =>
        `<span class="cat-badge">${label}: ${count}件 / ¥${(d.catRevenue[label] || 0).toLocaleString()}</span>`
      ).join('')}
    </div>
    <table>
      <thead><tr><th>No</th><th>完了日</th><th>案件名</th><th>顧客</th><th>種別</th><th style="text-align:right">報酬</th><th style="text-align:right">立替金</th></tr></thead>
      <tbody>${completedRows}</tbody>
      <tfoot><tr><td colspan="5">合計</td><td style="text-align:right">¥${totalFee.toLocaleString()}</td><td style="text-align:right">¥${totalAdv.toLocaleString()}</td></tr></tfoot>
    </table>
  </div>` : ''}

  ${expenseEntries.length > 0 ? `
  <div class="section">
    <div class="section-title">💳 経費内訳</div>
    <table>
      <thead><tr><th>勘定科目</th><th style="text-align:right">金額</th><th style="text-align:right">構成比</th></tr></thead>
      <tbody>
        ${expenseEntries.map(([account, amount]) => `
          <tr><td>${account}</td><td style="text-align:right">¥${amount.toLocaleString()}</td><td style="text-align:right">${d.totalExpense > 0 ? Math.round(amount / d.totalExpense * 100) : 0}%</td></tr>
        `).join('')}
      </tbody>
      <tfoot><tr><td>経費合計</td><td style="text-align:right">¥${d.totalExpense.toLocaleString()}</td><td style="text-align:right">100%</td></tr></tfoot>
    </table>
  </div>` : ''}

  ${d.unpaid.length > 0 ? `
  <div class="section">
    <div class="section-title">💸 未収金明細 (${d.unpaid.length}件 / 合計 ¥${d.totalUnpaid.toLocaleString()})</div>
    <table>
      <thead><tr><th>請求書No</th><th>顧客</th><th style="text-align:right">金額</th><th>支払期限</th><th>状態</th></tr></thead>
      <tbody>${unpaidRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    作成日: ${new Date().toLocaleDateString('ja-JP')} ｜ ${office.name} ｜ 本報告書は業務管理システムにより自動生成されました
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  },
};

// ============================================================
// 12. ダッシュボード 収支ウィジェット
// ============================================================
const RevenueWidget = {
  renderWidget() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const ym = `${year}-${String(month).padStart(2, '0')}`;

    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
    const INCOME = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = typeof Accounting !== 'undefined' ? Accounting.ACCOUNTS.expense : [];

    const monthFiltered = journals.filter(j => j.date && j.date.startsWith(ym));
    let monthIncome = 0, monthExpense = 0;
    monthFiltered.forEach(j => {
      if (INCOME.includes(j.credit)) monthIncome += j.amount || 0;
      if (EXPENSE_ACCOUNTS.includes(j.debit)) monthExpense += j.amount || 0;
    });
    const monthProfit = monthIncome - monthExpense;

    // 前月比較
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevYm = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    const prevFiltered = journals.filter(j => j.date && j.date.startsWith(prevYm));
    let prevIncome = 0;
    prevFiltered.forEach(j => {
      if (INCOME.includes(j.credit)) prevIncome += j.amount || 0;
    });

    const diff = monthIncome - prevIncome;
    const diffLabel = diff > 0 ? `↑ +¥${diff.toLocaleString()}` : diff < 0 ? `↓ ¥${diff.toLocaleString()}` : '→ 変動なし';
    const diffColor = diff > 0 ? '#2dd4a8' : diff < 0 ? '#ff6b6b' : '#888';

    return `
      <div class="goal-tracker" style="cursor:pointer" onclick="MonthlyReport.show()" title="クリックで月次レポートを表示">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:0.95rem;margin:0">💰 ${month}月の収支</h3>
          <span style="font-size:0.72rem;color:${diffColor};font-weight:600">${diffLabel}（前月比）</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">収入</div>
            <div style="font-size:1.05rem;font-weight:700;color:#2dd4a8">¥${monthIncome.toLocaleString()}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">支出</div>
            <div style="font-size:1.05rem;font-weight:700;color:#ff6b6b">¥${monthExpense.toLocaleString()}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.72rem;color:var(--text-muted)">利益</div>
            <div style="font-size:1.05rem;font-weight:700;color:${monthProfit >= 0 ? '#2dd4a8' : '#ff6b6b'}">¥${monthProfit.toLocaleString()}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;justify-content:flex-end;border-top:1px solid var(--border-color);padding-top:8px" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-small" style="font-size:0.72rem;padding:3px 8px" onclick="MonthlyReport._year=${year};MonthlyReport._month=${month};MonthlyReport.exportCSV()">📥 CSV出力</button>
          <button class="btn btn-ghost btn-small" style="font-size:0.72rem;padding:3px 8px" onclick="MonthlyReport._year=${year};MonthlyReport._month=${month};MonthlyReport.printReport()">🖨 印刷レポート</button>
        </div>
      </div>
    `;
  },
};

// ============================================================
// 13. ローカル担当者マスタ管理 (StaffManager)
// ============================================================
const StaffManager = {
  show() {
    const staff = Store.getAllStaff();
    const existing = document.getElementById('staffManagerModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'staffManagerModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('staffManagerModal').remove()"></div>
      <div class="modal-content modal-large" style="max-width: 600px">
        <div class="modal-header">
          <h2>👥 担当者マスタ管理</h2>
          <button class="modal-close" onclick="document.getElementById('staffManagerModal').remove()">✕</button>
        </div>
        <p style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:12px">
          顧客や案件に紐づく担当者（所員・補助者）を設定します。退職に設定すると新規登録の選択肢から非表示になります。
        </p>
        <div class="acc-table-wrap" style="max-height: 250px; overflow-y: auto; margin-bottom: 16px">
          <table class="acc-table">
            <thead>
              <tr><th>名前</th><th>役職</th><th>ステータス</th><th>操作</th></tr>
            </thead>
            <tbody>
              ${staff.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">担当者が登録されていません</td></tr>' : 
                staff.map((s, i) => `
                <tr>
                  <td style="font-weight: 600">${s.name}</td>
                  <td>${s.role || '—'}</td>
                  <td>
                    <span class="status-badge ${s.status === '退職' ? 'status-done' : 'status-received'}" style="font-size:0.75rem">
                      ${s.status || '在籍'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-small btn-secondary" onclick="StaffManager.toggleStatus('${s.id}')">
                      ${s.status === '退職' ? '復職' : '退職'}
                    </button>
                    <button class="btn btn-small btn-danger" onclick="StaffManager.deleteStaff('${s.id}')" style="margin-left: 4px">
                      削除
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h3 style="font-size:0.9rem;margin-bottom:8px;color:var(--text-secondary)">＋ 新規担当者登録</h3>
        <form onsubmit="event.preventDefault(); StaffManager.addStaff()">
          <div class="form-row" style="margin-bottom: 12px">
            <div class="form-group">
              <label>名前 <span class="required">*</span></label>
              <input type="text" id="sm_name" required placeholder="例：鈴木 一郎" style="width:100%">
            </div>
            <div class="form-group">
              <label>役職</label>
              <input type="text" id="sm_role" placeholder="例：補助者、行政書士" style="width:100%">
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('staffManagerModal').remove()">閉じる</button>
            <button type="submit" class="btn btn-primary">➕ 担当者を追加</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  },

  addStaff() {
    const name = document.getElementById('sm_name').value.trim();
    const role = document.getElementById('sm_role').value.trim();
    if (!name) return;

    const staff = Store.getAllStaff();
    const newMember = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name,
      role,
      status: '在籍',
      createdAt: new Date().toISOString()
    };
    staff.push(newMember);
    Store._set(Store.KEYS.STAFF, staff);

    App.showToast(`👥 ${name} を担当者として登録しました`);
    this.show();
    App.refreshView();
  },

  toggleStatus(id) {
    const staff = Store.getAllStaff();
    const s = staff.find(x => x.id === id);
    if (!s) return;

    s.status = s.status === '退職' ? '在籍' : '退職';
    Store._set(Store.KEYS.STAFF, staff);
    App.showToast(`ステータスを「${s.status}」に変更しました`);
    this.show();
    App.refreshView();
  },

  deleteStaff(id) {
    const staff = Store.getAllStaff();
    const s = staff.find(x => x.id === id);
    if (!s) return;

    if (confirm(`担当者「${s.name}」を完全に削除しますか？\n（過去の案件や顧客にこの担当者が設定されている場合、表示が空白になる可能性があります。通常は「退職」にすることをおすすめします。）`)) {
      const updated = staff.filter(x => x.id !== id);
      Store._set(Store.KEYS.STAFF, updated);
      App.showToast('担当者を削除しました');
      this.show();
      App.refreshView();
    }
  }
};

// ============================================================
// 14. 車庫証明・封印 調査/交付スケジュールウィジェット (GarageScheduleWidget)
// ============================================================
const GarageScheduleWidget = {
  renderDashboardWidget() {
    const cases = Store.getCases().filter(c => 
      c.status !== 'done' && 
      ['garage_oss', 'garage_paper', 'seal'].includes(c.category) && 
      (c.surveyDate || c.applyDate || c.policeDeliveryDate || c.storeDeliveryDate)
    );

    if (cases.length === 0) return '';

    // スケジュール一覧を生成し、直近の日付順に並べ替え
    const schedules = [];
    const todayStr = Store.getLocalDateStr();
    const today = new Date(todayStr);

    cases.forEach(c => {
      const client = Store.getClient(c.clientId);
      if (c.surveyDate) {
        const diff = Store.getDiffDays(c.surveyDate);
        schedules.push({
          type: 'survey',
          date: c.surveyDate,
          diffDays: diff,
          caseId: c.id,
          caseTitle: c.title,
          clientName: client ? client.name : '—',
          police: c.carPolice || '管轄警察署未選択',
          label: '🔍 現地調査'
        });
      }
      if (c.applyDate && c.status !== 'applying') {
        const diff = Store.getDiffDays(c.applyDate);
        schedules.push({
          type: 'apply',
          date: c.applyDate,
          diffDays: diff,
          caseId: c.id,
          caseTitle: c.title,
          clientName: client ? client.name : '—',
          police: c.carPolice || '管轄警察署未選択',
          label: '📝 警察署申請'
        });
      }
      if (c.policeDeliveryDate) {
        const diff = Store.getDiffDays(c.policeDeliveryDate);
        schedules.push({
          type: 'delivery',
          date: c.policeDeliveryDate,
          diffDays: diff,
          caseId: c.id,
          caseTitle: c.title,
          clientName: client ? client.name : '—',
          police: c.carPolice || '管轄警察署未選択',
          label: '🚔 警察署交付'
        });
      }
      if (c.storeDeliveryDate) {
        const diff = Store.getDiffDays(c.storeDeliveryDate);
        schedules.push({
          type: 'store_delivery',
          date: c.storeDeliveryDate,
          time: c.storeDeliveryTime || '',
          diffDays: diff,
          caseId: c.id,
          caseTitle: c.title,
          clientName: client ? client.name : '—',
          police: c.carPolice || '管轄警察署未選択',
          label: '🚚 店舗お届け'
        });
      }
    });

    // 日付順にソート (期限超過も考慮して昇順)
    schedules.sort((a, b) => a.diffDays - b.diffDays);

    if (schedules.length === 0) return '';

    return `
      <div class="dashboard-section">
        <h2 class="section-title">🚗 車庫・封印 調査/交付予定</h2>
        <div class="urgent-list" style="max-height: 250px; overflow-y: auto">
          ${schedules.map(s => {
            let urgencyClass = '';
            let urgencyLabel = '';
            if (s.diffDays < 0) {
              urgencyClass = 'overdue';
              urgencyLabel = `${Math.abs(s.diffDays)}日超過`;
            } else if (s.diffDays === 0) {
              urgencyClass = 'warning';
              urgencyLabel = '本日予定';
            } else if (s.diffDays <= 3) {
              urgencyClass = 'warning';
              urgencyLabel = `あと${s.diffDays}日`;
            } else {
              urgencyClass = 'info';
              urgencyLabel = `あと${s.diffDays}日`;
            }

            return `
              <div class="urgent-item ${urgencyClass}" onclick="App.navigate('cases'); setTimeout(() => Cases.showEditModal('${s.caseId}'), 100)">
                <div class="urgent-item-header">
                  <span class="urgent-badge badge-${urgencyClass}">${s.label}</span>
                  <span class="category-tag category-garage_oss" style="font-size:0.7rem">${s.police}</span>
                  <span style="font-size:0.75rem; color:var(--text-secondary); margin-left:auto; font-weight: 600">${urgencyLabel}</span>
                </div>
                <div class="urgent-item-title">${s.caseTitle}</div>
                <div class="urgent-item-client">依頼者: ${s.clientName} ｜ 予定日: ${s.date}${s.time ? ' (' + s.time + ')' : ''}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
};

// ============================================================
// 15. 確定申告・勘定科目集計表 (TaxHelper)
// ============================================================
const TaxHelper = {
  show(year) {
    year = year || new Date().getFullYear();
    const journals = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');

    // 勘定科目定義
    const INCOME_ACCOUNTS = ['売上高', '雑収入'];
    const EXPENSE_ACCOUNTS = [
      '旅費交通費', '通信費', '消耗品費', '事務用品費', '家賃地代', 
      '水道光熱費', '接待交際費', '広告宣伝費', '支払手数料', '租税公課', 
      '研修費', '新聞図書費', '保険料', '減価償却費', '雑費'
    ];

    // 年度でフィルタ
    const yearJournals = journals.filter(j => j.date && j.date.startsWith(String(year)));

    // 集計
    const incomeSummary = {};
    INCOME_ACCOUNTS.forEach(acct => { incomeSummary[acct] = 0; });
    
    const expenseSummary = {};
    EXPENSE_ACCOUNTS.forEach(acct => { expenseSummary[acct] = 0; });

    yearJournals.forEach(j => {
      // 収入（貸方に記載がある場合）
      if (INCOME_ACCOUNTS.includes(j.credit)) {
        incomeSummary[j.credit] += j.amount || 0;
      }
      // 経費（借方に記載がある場合）
      if (EXPENSE_ACCOUNTS.includes(j.debit)) {
        expenseSummary[j.debit] += j.amount || 0;
      }
    });

    const totalIncome = Object.values(incomeSummary).reduce((s, a) => s + a, 0);
    const totalExpense = Object.values(expenseSummary).reduce((s, a) => s + a, 0);
    const profit = totalIncome - totalExpense;

    const existing = document.getElementById('taxHelperModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'taxHelperModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('taxHelperModal').remove()"></div>
      <div class="modal-content modal-large tax-print-area" style="max-width: 680px">
        <div class="modal-header no-print">
          <h2>📊 ${year}年度 確定申告（青色申告）簡易科目集計</h2>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary btn-small" onclick="window.print()">🖨️ 印刷 / PDF保存</button>
            <button class="modal-close" onclick="document.getElementById('taxHelperModal').remove()">✕</button>
          </div>
        </div>
        
        <div class="print-only" style="display:none; text-align:center; margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom:10px">
          <h1 style="font-size:1.6rem; font-weight:bold">${year}年度 青色申告勘定科目別集計表</h1>
          <p style="font-size:0.8rem; text-align:right">行政書士法人Felis | 出力日: ${new Date().toLocaleDateString('ja-JP')}</p>
        </div>

        <div class="acc-controls no-print" style="margin-bottom:12px">
          <div class="acc-period">
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('taxHelperModal').remove(); TaxHelper.show(${year - 1})">◀ ${year - 1}年</button>
            <span style="font-weight:700;padding:0 12px">${year}年</span>
            <button class="btn btn-small btn-secondary" onclick="document.getElementById('taxHelperModal').remove(); TaxHelper.show(${year + 1})">${year + 1}年 ▶</button>
          </div>
        </div>

        <div class="acc-summary" style="margin-bottom:16px">
          <div class="acc-summary-card acc-income"><div class="acc-summary-label">収入合計</div><div class="acc-summary-amount">¥${totalIncome.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-expense"><div class="acc-summary-label">経費合計</div><div class="acc-summary-amount">¥${totalExpense.toLocaleString()}</div></div>
          <div class="acc-summary-card acc-profit ${profit >= 0 ? 'positive' : 'negative'}"><div class="acc-summary-label">差引控除前利益</div><div class="acc-summary-amount">¥${profit.toLocaleString()}</div></div>
        </div>

        <h3 style="margin:16px 0 8px;font-size:0.95rem;border-left: 4px solid var(--primary);padding-left:8px">💰 収入の内訳</h3>
        <div class="acc-table-wrap" style="margin-bottom: 16px">
          <table class="acc-table">
            <thead>
              <tr><th>青色申告決算書 勘定科目</th><th>金額</th><th>備考</th></tr>
            </thead>
            <tbody>
              ${Object.entries(incomeSummary).map(([acct, amt]) => `
                <tr>
                  <td style="font-weight:600">${acct}</td>
                  <td class="amount-cell" style="font-weight:600; color:var(--accent-green)">¥${amt.toLocaleString()}</td>
                  <td style="color:var(--text-muted); font-size:0.75rem">${acct === '売上高' ? '主たる業務の報酬合計（自動連携含む）' : 'その他雑収入など'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h3 style="margin:16px 0 8px;font-size:0.95rem;border-left: 4px solid var(--accent-orange);padding-left:8px">💸 経費・販売管理費の内訳</h3>
        <div class="acc-table-wrap">
          <table class="acc-table">
            <thead>
              <tr><th>青色申告決算書 経費科目</th><th>集計金額</th><th>構成比</th></tr>
            </thead>
            <tbody>
              ${Object.entries(expenseSummary).sort((a,b) => b[1] - a[1]).map(([acct, amt]) => `
                <tr>
                  <td>${acct}</td>
                  <td class="amount-cell" style="font-weight:600; color:${amt > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}">¥${amt.toLocaleString()}</td>
                  <td class="amount-cell" style="color:var(--text-muted); font-size:0.78rem">${totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <style>
          @media print {
            body * { visibility: hidden; }
            .tax-print-area, .tax-print-area * { visibility: visible; }
            .tax-print-area { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .modal { background: none; }
            .modal-content { border:none; box-shadow:none; padding: 0; width: 100%; max-width: 100%; }
          }
        </style>
      </div>
    `;
    document.body.appendChild(modal);
  }
};

// ============================================================
// 9. 相続関係図（ファミリーツリー）メーカー
// ============================================================
const FamilyTreeMaker = {
  currentCaseId: null,
  childrenDraft: [],

  show(caseId) {
    this.currentCaseId = caseId;
    const c = Store.getCase(caseId);
    if (!c) return;

    // デフォルトデータ作成
    let data = c.familyTreeData;
    if (!data) {
      const client = Store.getClient(c.clientId);
      data = {
        deceased: { name: c.carName || '被相続人 氏名', deathDate: c.deathDate || '' },
        spouse: { name: client ? client.name : '配偶者 氏名', isAlive: true, exists: true },
        children: [],
        parents: [
          { name: '父 氏名', relation: '父', isAlive: false, exists: false },
          { name: '母 氏名', relation: '母', isAlive: false, exists: false }
        ]
      };
    }

    const existing = document.getElementById('familyTreeModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'familyTreeModal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="FamilyTreeMaker.close()"></div>
      <div class="modal-content ft-modal-content ft-no-print">
        <div class="modal-header">
          <h2>🌳 相続関係図メーカー</h2>
          <button class="modal-close" onclick="FamilyTreeMaker.close()">✕</button>
        </div>
        <div class="ft-layout">
          <!-- 左側：エディタフォーム -->
          <div class="ft-sidebar">
            <h3 style="font-size:0.9rem;border-bottom:1px solid var(--border-color);padding-bottom:6px">👤 被相続人 (亡くなった方)</h3>
            <div class="form-group">
              <label>氏名</label>
              <input type="text" id="ft_deceased_name" value="${data.deceased.name || ''}" oninput="FamilyTreeMaker.update()">
            </div>
            <div class="form-group">
              <label>死亡日</label>
              <input type="date" id="ft_deceased_date" value="${data.deceased.deathDate || ''}" oninput="FamilyTreeMaker.update()">
            </div>

            <h3 style="font-size:0.9rem;border-bottom:1px solid var(--border-color);padding-bottom:6px;margin-top:10px;display:flex;align-items:center;justify-content:space-between">
              👥 配偶者
              <label style="font-size:0.75rem;font-weight:normal;display:flex;align-items:center;gap:4px">
                <input type="checkbox" id="ft_spouse_exists" ${data.spouse.exists ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> あり
              </label>
            </h3>
            <div id="ft_spouse_section" style="${data.spouse.exists ? '' : 'display:none'}">
              <div class="form-group">
                <label>氏名</label>
                <input type="text" id="ft_spouse_name" value="${data.spouse.name || ''}" oninput="FamilyTreeMaker.update()">
              </div>
              <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-top:6px">
                <label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;cursor:pointer">
                  <input type="radio" name="ft_spouse_alive" value="true" ${data.spouse.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> 存命
                </label>
                <label style="font-size:0.8rem;display:flex;align-items:center;gap:4px;cursor:pointer">
                  <input type="radio" name="ft_spouse_alive" value="false" ${!data.spouse.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> 死亡
                </label>
              </div>
            </div>

            <h3 style="font-size:0.9rem;border-bottom:1px solid var(--border-color);padding-bottom:6px;margin-top:10px;display:flex;align-items:center;justify-content:space-between">
              👶 子供
              <button class="btn btn-secondary btn-small" style="font-size:0.75rem;padding:2px 8px" onclick="FamilyTreeMaker.addChild()">＋ 追加</button>
            </h3>
            <div id="ft_children_list" style="display:flex;flex-direction:column;gap:8px">
              <!-- 子供リストが動的挿入される -->
            </div>

            <h3 style="font-size:0.9rem;border-bottom:1px solid var(--border-color);padding-bottom:6px;margin-top:10px">
              👴 父母
            </h3>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${data.parents.map((p, idx) => `
                <div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:4px;border:1px solid var(--border-color)">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <label style="font-weight:600;font-size:0.8rem">${p.relation}</label>
                    <label style="font-size:0.75rem;display:flex;align-items:center;gap:4px;cursor:pointer">
                      <input type="checkbox" id="ft_parent_exists_${idx}" ${p.exists ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> 記載する
                    </label>
                  </div>
                  <div id="ft_parent_section_${idx}" style="${p.exists ? '' : 'display:none'}">
                    <input type="text" id="ft_parent_name_${idx}" value="${p.name || ''}" placeholder="氏名" style="width:100%;margin-bottom:6px" oninput="FamilyTreeMaker.update()">
                    <div style="display:flex;align-items:center;gap:12px">
                      <label style="font-size:0.78rem;display:flex;align-items:center;gap:4px;cursor:pointer">
                        <input type="radio" name="ft_parent_alive_${idx}" value="true" ${p.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> 存命
                      </label>
                      <label style="font-size:0.78rem;display:flex;align-items:center;gap:4px;cursor:pointer">
                        <input type="radio" name="ft_parent_alive_${idx}" value="false" ${!p.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.update()"> 死亡
                      </label>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>

            <div style="margin-top:auto;display:flex;gap:8px">
              <button class="btn btn-primary" onclick="FamilyTreeMaker.save()" style="flex:1">💾 保存</button>
              <button class="btn btn-secondary" onclick="FamilyTreeMaker.print()" style="flex:1">🖨️ 印刷</button>
            </div>
          </div>

          <!-- 右側：関係図プレビューキャンバス -->
          <div class="ft-canvas-container">
            <div class="ft-tree" id="ft_preview_tree"></div>
          </div>
        </div>
      </div>

      <!-- 印刷用隠しエリア -->
      <div id="ftPrintArea" class="ft-print-only-layout" style="display:none"></div>
    `;
    document.body.appendChild(modal);

    // 子供たちのリストをロード
    this.childrenDraft = JSON.parse(JSON.stringify(data.children || []));
    this.renderChildrenList();
    this.update();
  },

  close() {
    const m = document.getElementById('familyTreeModal');
    if (m) m.remove();
  },

  addChild() {
    const nextIndex = this.childrenDraft.length + 1;
    let label = '子';
    if (nextIndex === 1) label = '長男';
    else if (nextIndex === 2) label = '長女';
    else if (nextIndex === 3) label = '二男';
    else label = `子 ${nextIndex}`;

    this.childrenDraft.push({
      name: `相続人 ${nextIndex}`,
      relation: label,
      isAlive: true
    });
    this.renderChildrenList();
    this.update();
  },

  removeChild(idx) {
    this.childrenDraft.splice(idx, 1);
    this.renderChildrenList();
    this.update();
  },

  onChildInput(idx, field, value) {
    if (field === 'isAlive') {
      this.childrenDraft[idx].isAlive = value === 'true';
    } else {
      this.childrenDraft[idx][field] = value;
    }
    this.update();
  },

  renderChildrenList() {
    const list = document.getElementById('ft_children_list');
    if (!list) return;

    if (this.childrenDraft.length === 0) {
      list.innerHTML = '<p style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:12px 0">子供は追加されていません</p>';
      return;
    }

    list.innerHTML = this.childrenDraft.map((c, i) => `
      <div style="background:rgba(0,0,0,0.15);padding:8px;border-radius:4px;border:1px solid var(--border-color)">
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px">
          <input type="text" value="${c.name || ''}" placeholder="名前" style="flex:2;font-size:0.8rem;padding:4px" oninput="FamilyTreeMaker.onChildInput(${i}, 'name', this.value)">
          <select style="flex:1.2;font-size:0.8rem;padding:2px" onchange="FamilyTreeMaker.onChildInput(${i}, 'relation', this.value)">
            <option value="長男" ${c.relation === '長男' ? 'selected' : ''}>長男</option>
            <option value="長女" ${c.relation === '長女' ? 'selected' : ''}>長女</option>
            <option value="二男" ${c.relation === '二男' ? 'selected' : ''}>二男</option>
            <option value="二女" ${c.relation === '二女' ? 'selected' : ''}>二女</option>
            <option value="三男" ${c.relation === '三男' ? 'selected' : ''}>三男</option>
            <option value="三女" ${c.relation === '三女' ? 'selected' : ''}>三女</option>
          </select>
          <button class="btn btn-secondary" style="padding:2px 8px;color:#ef4444;border-color:var(--border-color)" onclick="FamilyTreeMaker.removeChild(${i})">✕</button>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <label style="font-size:0.78rem;display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="ft_child_alive_${i}" value="true" ${c.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.onChildInput(${i}, 'isAlive', this.value)"> 存命
          </label>
          <label style="font-size:0.78rem;display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="radio" name="ft_child_alive_${i}" value="false" ${!c.isAlive ? 'checked' : ''} onchange="FamilyTreeMaker.onChildInput(${i}, 'isAlive', this.value)"> 死亡
          </label>
        </div>
      </div>
    `).join('');
  },

  update() {
    const data = this.readFormData();
    
    // UI表示
    const spouseSec = document.getElementById('ft_spouse_section');
    if (spouseSec) spouseSec.style.display = data.spouse.exists ? '' : 'none';

    data.parents.forEach((p, idx) => {
      const parentSec = document.getElementById('ft_parent_section_'+idx);
      if (parentSec) parentSec.style.display = p.exists ? '' : 'none';
    });

    const canvas = document.getElementById('ft_preview_tree');
    if (canvas) {
      canvas.innerHTML = this.buildTreeHTML(data);
    }
  },

  readFormData() {
    const spouseExists = document.getElementById('ft_spouse_exists')?.checked || false;
    const spouseAliveRadio = document.querySelector('input[name="ft_spouse_alive"]:checked');
    const spouseIsAlive = spouseAliveRadio ? spouseAliveRadio.value === 'true' : true;

    const parentList = [];
    const relations = ['父', '母'];
    relations.forEach((rel, idx) => {
      const exists = document.getElementById('ft_parent_exists_' + idx)?.checked || false;
      const name = document.getElementById('ft_parent_name_' + idx)?.value || '';
      const aliveRadio = document.querySelector(`input[name="ft_parent_alive_${idx}"]:checked`);
      const isAlive = aliveRadio ? aliveRadio.value === 'true' : true;
      parentList.push({ relation: rel, name, isAlive, exists });
    });

    return {
      deceased: {
        name: document.getElementById('ft_deceased_name')?.value || '被相続人',
        deathDate: document.getElementById('ft_deceased_date')?.value || ''
      },
      spouse: {
        exists: spouseExists,
        name: document.getElementById('ft_spouse_name')?.value || '',
        isAlive: spouseIsAlive
      },
      children: this.childrenDraft,
      parents: parentList
    };
  },

  buildTreeHTML(data) {
    // 父母の行
    const activeParents = data.parents.filter(p => p.exists);
    let parentsRowHtml = '';
    if (activeParents.length > 0) {
      parentsRowHtml = `
        <div class="ft-row">
          ${activeParents.map(p => `
            <div class="ft-node-wrapper">
              <div class="ft-node ${!p.isAlive ? 'dead' : ''}">
                <div class="ft-node-role">${p.relation}</div>
                <div>${p.name || '未入力'}</div>
                ${!p.isAlive ? '<div class="ft-node-death">（死亡）</div>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="ft-line-v"></div>
      `;
    }

    // 被相続人と配偶者
    let centerHtml = `
      <div class="ft-node-wrapper">
        <div class="ft-node deceased">
          <div class="ft-node-role">被相続人</div>
          <div>${data.deceased.name || '未入力'}</div>
          ${data.deceased.deathDate ? `<div class="ft-node-death">（死亡）<br>${data.deceased.deathDate.replace(/-/g, '/')}</div>` : ''}
        </div>
      </div>`;

    if (data.spouse.exists) {
      centerHtml += `
        <div class="ft-connect-double"></div>
        <div class="ft-node-wrapper">
          <div class="ft-node spouse ${!data.spouse.isAlive ? 'dead' : ''}">
            <div class="ft-node-role">配偶者</div>
            <div>${data.spouse.name || '未入力'}</div>
            ${!data.spouse.isAlive ? '<div class="ft-node-death">（死亡）</div>' : ''}
          </div>
        </div>`;
    }

    const centerRow = `<div class="ft-row">${centerHtml}</div>`;

    // 子供たち
    let childrenHtml = '';
    if (data.children.length > 0) {
      childrenHtml = `
        <div class="ft-line-v"></div>
        <div class="ft-children-container">
          ${data.children.map(c => `
            <div class="ft-child-branch">
              <div class="ft-node-wrapper">
                <div class="ft-node ${!c.isAlive ? 'dead' : ''}">
                  <div class="ft-node-role">${c.relation}</div>
                  <div>${c.name || '未入力'}</div>
                  ${!c.isAlive ? '<div class="ft-node-death">（死亡）</div>' : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      ${parentsRowHtml}
      ${centerRow}
      ${childrenHtml}
    `;
  },

  save() {
    const data = this.readFormData();
    Store.updateCase(this.currentCaseId, { familyTreeData: data });
    App.showToast('関係図データを保存しました');
    this.close();
    
    // 案件モーダルを再描画
    if (typeof Cases !== 'undefined' && Cases.editingId) {
      Cases.showEditModal(this.currentCaseId);
    }
  },

  print() {
    const data = this.readFormData();
    const treeHtml = this.buildTreeHTML(data);
    
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>相続関係説明図 - 印刷</title>
        <style>
          body {
            background: white !important;
            color: black !important;
            padding: 40px !important;
            font-family: serif !important;
          }
          .ft-print-header {
            text-align: center;
            margin-bottom: 50px;
            border-bottom: 2px solid black;
            padding-bottom: 12px;
          }
          .ft-print-header h1 {
            font-size: 24px;
            letter-spacing: 6px;
          }
          .ft-print-canvas {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .ft-tree {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 32px;
            min-width: 600px;
          }
          .ft-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 48px;
            position: relative;
          }
          .ft-node-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
          }
          .ft-node {
            width: 120px;
            padding: 12px 10px;
            border: 2px solid black !important;
            text-align: center;
            font-size: 0.9rem;
            font-weight: 600;
            background: white !important;
            color: black !important;
          }
          .ft-node-role {
            font-size: 0.72rem;
            margin-bottom: 4px;
            font-weight: normal;
          }
          .ft-node-death {
            font-size: 0.7rem;
            margin-top: 2px;
            font-weight: normal;
          }
          .ft-node.dead {
            opacity: 0.6;
          }
          .ft-connect-double {
            width: 48px;
            height: 8px;
            border-top: 2px double black !important;
            border-bottom: 2px double black !important;
            margin: 0 -48px;
          }
          .ft-line-v {
            width: 2px;
            height: 32px;
            background: black !important;
          }
          .ft-children-container {
            display: flex;
            gap: 32px;
            position: relative;
            padding-top: 24px;
            border-top: 2px solid black !important;
          }
          .ft-child-branch {
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
          }
          .ft-child-branch::before {
            content: "";
            position: absolute;
            top: -26px;
            height: 26px;
            width: 2px;
            background: black !important;
          }
          .no-print {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 50px;
          }
          .no-print button {
            padding: 10px 24px;
            font-size: 14px;
            font-weight: bold;
            background: #1e293b;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="ft-print-header">
          <h1>相続関係説明図</h1>
        </div>
        <div class="ft-print-canvas">
          <div class="ft-tree">
            ${treeHtml}
          </div>
        </div>
        <div class="no-print">
          <button onclick="window.print()">🖨️ 印刷する / PDF保存</button>
          <button onclick="window.close()" style="background:#64748b">✕ 閉じる</button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }
};



